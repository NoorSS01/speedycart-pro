import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatVariantDisplay } from '@/lib/formatUnit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
    ArrowLeft,
    ShoppingCart,
    Plus,
    Minus,
    Trash2,
    Package,
    Clock,
    Tag,
    ShieldCheck,
    AlertTriangle,
    MapPin,
    Ticket,
    X,
} from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import OrderConfirmation from '@/components/OrderConfirmation';
import HorizontalScrollContainer from '@/components/HorizontalScrollContainer';

interface Product {
    id: string;
    name: string;
    price: number;
    mrp?: number | null;
    image_url: string | null;
    stock_quantity: number;
    unit: string;
    discount_percent?: number | null;
    category_id?: string | null;
    categories?: { id: string; name: string } | null;
}

interface ProductVariant {
    id: string;
    variant_name: string;
    variant_value: number;
    variant_unit: string;
    price: number;
    mrp: number | null;
}

interface CartItem {
    id: string;
    product_id: string;
    quantity: number;
    variant_id: string | null;
    products: Product;
    product_variants: ProductVariant | null;
}

interface Coupon {
    id: string;
    code: string;
    description: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    minimum_order: number;
    maximum_discount: number | null;
    valid_until: string | null;
}

export default function Cart() {
    const { user, loading: authLoading } = useAuth();
    const { refreshCart } = useCart();
    const navigate = useNavigate();
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [promoCode, setPromoCode] = useState('');
    const [promoApplied, setPromoApplied] = useState(false);
    const [showOrderSuccess, setShowOrderSuccess] = useState(false);
    const [lastOrderId, setLastOrderId] = useState('');

    // Address dialog
    const [showAddressDialog, setShowAddressDialog] = useState(false);
    const [savedAddress, setSavedAddress] = useState('');
    const [addressOption, setAddressOption] = useState<'saved' | 'new'>('saved');
    const [newAddress, setNewAddress] = useState('');
    const [placingOrder, setPlacingOrder] = useState(false);
    // Enhanced address fields
    const [selectedApartment, setSelectedApartment] = useState<string>('');
    const [blockNumber, setBlockNumber] = useState('');
    const [roomNumber, setRoomNumber] = useState('');

    // Coupon state
    const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
    const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
    const [discountAmount, setDiscountAmount] = useState(0);



    const fetchCart = useCallback(async () => {
        if (!user) return;

        const { data, error } = await supabase
            .from('cart_items')
            .select(`
        *,
        products (*, categories (id, name)),
        product_variants (*)
      `)
            .eq('user_id', user.id);

        if (!error && data) {
            setCartItems(data as CartItem[]);
        }
        setLoading(false);
    }, [user]);

    const fetchSavedAddress = useCallback(async () => {
        if (!user) return;
        const { data } = await supabase
            .from('profiles')
            .select('address')
            .eq('id', user.id)
            .single();
        if (data?.address) {
            setSavedAddress(data.address);
        }
    }, [user]);

    // Fetch available coupons
    const fetchCoupons = useCallback(async () => {
        if (!user) return;

        try {
            const { data: coupons } = await supabase
                .from('coupons')
                .select('*')
                .eq('is_active', true)
                .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString()}`);

            if (coupons) {
                // Filter to only show coupons user hasn't redeemed (if not stackable)
                const { data: usedCoupons } = await supabase
                    .from('coupon_usage')
                    .select('coupon_id')
                    .eq('user_id', user.id);

                const redeemedIds = new Set((usedCoupons || []).map(uc => uc.coupon_id));

                const eligibleCoupons = coupons.filter(c =>
                    !redeemedIds.has(c.id) || c.is_stackable
                );

                setAvailableCoupons(eligibleCoupons as unknown as Coupon[]);
            }
        } catch (e) {
            // Log error for debugging - coupons table may not exist yet
            logger.error('Failed to fetch coupons', { error: e });
        }
    }, [user]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            navigate('/auth');
            return;
        }
        fetchCart();
        fetchSavedAddress();
        fetchCoupons();
    }, [user, authLoading, navigate, fetchCart, fetchSavedAddress, fetchCoupons]);

    // Apply coupon using server-side validation
    const applyCoupon = async (coupon: Coupon) => {
        if (!user) return;

        const currentSubtotal = cartItems.reduce((sum, item) => {
            // Calculate price using variant if available, otherwise use product price
            const price = item.product_variants?.price ?? item.products.price;
            return sum + price * item.quantity;
        }, 0);

        try {
            // SERVER-SIDE VALIDATION: Call the RPC function to validate and calculate discount
            // This ensures the UI shows exactly what the server will apply during checkout
            const { data, error } = await supabase.rpc('validate_and_apply_coupon', {
                p_user_id: user.id,
                p_coupon_code: coupon.code,
                p_subtotal: currentSubtotal
            });

            if (error) {
                logger.error('Coupon validation error', { error });
                toast.error('Failed to validate coupon. Please try again.');
                return;
            }

            const result = data as unknown as {
                valid: boolean;
                coupon_id?: string;
                code?: string;
                discount?: number;
                error?: string;
            };

            if (!result.valid) {
                toast.error(result.error || 'Coupon is not valid');
                return;
            }

            // Apply server-calculated discount
            setAppliedCoupon(coupon);
            setDiscountAmount(result.discount || 0);
            setPromoCode(result.code || coupon.code);
            setPromoApplied(true);
            toast.success(`${result.code} applied! You save ₹${(result.discount || 0).toFixed(0)}`);
        } catch (e) {
            logger.error('Coupon application error', { error: e });
            toast.error('Failed to apply coupon. Please try again.');
        }
    };

    // Remove coupon
    const removeCoupon = () => {
        setAppliedCoupon(null);
        setDiscountAmount(0);
        setPromoCode('');
        setPromoApplied(false);
    };

    const updateQuantity = async (itemId: string, newQuantity: number) => {
        if (newQuantity < 1) {
            await removeItem(itemId);
            return;
        }

        const item = cartItems.find(i => i.id === itemId);
        if (item && newQuantity > item.products.stock_quantity) {
            toast.error(`Only ${item.products.stock_quantity} available`);
            return;
        }

        const { error } = await supabase
            .from('cart_items')
            .update({ quantity: newQuantity })
            .eq('id', itemId);

        if (!error) {
            setCartItems(prev =>
                prev.map(item =>
                    item.id === itemId ? { ...item, quantity: newQuantity } : item
                )
            );
        }
    };

    const removeItem = async (itemId: string) => {
        const { error } = await supabase
            .from('cart_items')
            .delete()
            .eq('id', itemId);

        if (!error) {
            setCartItems(prev => prev.filter(item => item.id !== itemId));
            refreshCart(); // Instant badge update
            toast.success('Item removed');
        }
    };

    const applyPromoCode = () => {
        // All promo codes are now managed via database coupons
        // Check if the entered code matches an available coupon
        const code = promoCode.toUpperCase().trim();
        const matchingCoupon = availableCoupons.find(c => c.code.toUpperCase() === code);

        if (matchingCoupon) {
            applyCoupon(matchingCoupon);
        } else {
            toast.error('Invalid or expired promo code');
        }
    };

    const handleCheckout = () => {
        if (cartItems.length === 0) {
            toast.error('Your cart is empty');
            return;
        }

        // Check stock
        const outOfStock = cartItems.filter(item => item.products.stock_quantity < item.quantity);
        if (outOfStock.length > 0) {
            toast.error(`Some items are out of stock`);
            return;
        }

        setShowAddressDialog(true);
    };

    const confirmOrder = async () => {
        if (!user) return;

        // Build delivery address from form fields
        let deliveryAddress = '';
        if (addressOption === 'saved') {
            deliveryAddress = savedAddress;
        } else {
            if (selectedApartment && selectedApartment !== 'Other') {
                // Build structured address
                const parts = [];
                if (blockNumber) parts.push(`Block ${blockNumber}`);
                if (roomNumber) parts.push(`Room ${roomNumber}`);
                parts.push(selectedApartment);
                parts.push('Chandapura-Anekal Road, Bangalore - 562106');
                deliveryAddress = parts.join(', ');
            } else {
                // Use custom address for "Other"
                deliveryAddress = newAddress;
            }
        }

        if (!deliveryAddress.trim()) {
            toast.error('Please enter a delivery address');
            return;
        }

        setPlacingOrder(true);

        try {
            // Build cart items array for atomic RPC call
            const cartItemsPayload = cartItems.map(item => ({
                product_id: item.product_id,
                variant_id: item.variant_id || null,
                quantity: item.quantity,
                price: item.product_variants?.price || item.products.price
            }));

            // ATOMIC ORDER PLACEMENT: Single RPC call handles stock validation,
            // order creation, coupon usage, and cart clearing in one transaction
            // Note: Cast to any as place_order_atomic is a custom function not in generated types
            const { data, error } = await supabase.rpc('place_order_atomic', {
                p_user_id: user.id,
                p_delivery_address: deliveryAddress,
                p_cart_items: cartItemsPayload,
                p_coupon_id: appliedCoupon?.id || undefined,
                p_coupon_discount: discountAmount || 0
            });

            if (error) {
                logger.error('Order placement RPC error', { error });
                toast.error('Failed to place order. Please try again.');
                return;
            }

            // Handle response from atomic function
            const result = data as unknown as { success: boolean; order_id?: string; error?: string; product_id?: string };

            if (!result.success) {
                toast.error(result.error || 'Failed to place order');
                // Refresh cart in case stock changed
                if (result.product_id) {
                    fetchCart();
                }
                return;
            }

            // Save address if new (save the complete built address)
            if (addressOption === 'new' && deliveryAddress) {
                await supabase
                    .from('profiles')
                    .update({ address: deliveryAddress })
                    .eq('id', user.id);
                setSavedAddress(deliveryAddress);
            }

            // Show success animation
            setLastOrderId(result.order_id || '');
            setShowAddressDialog(false);
            setCartItems([]);
            refreshCart(); // Update global cart count immediately
            setAppliedCoupon(null);
            setDiscountAmount(0);
            setPromoApplied(false);
            setPromoCode('');
            setShowOrderSuccess(true);

        } catch (error: any) {
            logger.error('Order placement error', { error });
            toast.error('Failed to place order. Please try again.');
        } finally {
            setPlacingOrder(false);
        }
    };

    // Helper function to get effective price for a cart item
    const getItemPrice = (item: CartItem): number => {
        // Use variant price if variant exists, otherwise use product price
        return item.product_variants?.price ?? item.products.price;
    };

    // Helper function to get effective MRP for a cart item
    const getItemMrp = (item: CartItem): number => {
        // Use variant MRP if variant exists, otherwise use product MRP
        return item.product_variants?.mrp ?? item.products.mrp ?? item.products.price;
    };

    // Check if cart contains ONLY water products (free delivery for water-only carts)
    // Check by product NAME containing "water", not by category
    const isWaterOnlyCart = cartItems.length > 0 && cartItems.every(item => {
        const productName = item.products.name?.toLowerCase() || '';
        return productName.includes('water');
    });

    // Calculations - use selling prices (variant price or product price)
    const originalTotal = cartItems.reduce((sum, item) => sum + getItemMrp(item) * item.quantity, 0);
    const subtotal = cartItems.reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0);
    const productSavings = originalTotal - subtotal; // Savings from MRP vs selling price
    // Coupon savings is the ONLY discount from coupons (discountAmount is set when coupon is applied)
    const couponSavings = discountAmount;
    const baseDeliveryFee = 35; // Default delivery fee
    // Free delivery if: order > ₹200 OR cart contains only water products
    const deliveryFee = (subtotal > 200 || isWaterOnlyCart) ? 0 : baseDeliveryFee;
    const deliverySavings = (subtotal > 200 || isWaterOnlyCart) ? baseDeliveryFee : 0; // Free delivery savings
    // Total savings = product discounts + coupon + free delivery
    const totalSavings = productSavings + couponSavings + deliverySavings;
    const finalTotal = subtotal - couponSavings + deliveryFee;

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-20">
                <header className="sticky top-0 z-40 border-b border-border/40 bg-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20">
                    <div className="container mx-auto px-4 py-4 flex items-center gap-3">
                        <Skeleton className="h-9 w-9" />
                        <Skeleton className="h-6 w-32" />
                    </div>
                </header>
                <main className="container mx-auto px-4 py-6 space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-24 w-full rounded-xl bg-muted/80 animate-pulse" />
                    ))}
                    <div className="h-48 w-full rounded-xl bg-muted/80 animate-pulse" />
                </main>
                <BottomNav />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-44">
            {showOrderSuccess && (
                <OrderConfirmation
                    orderId={lastOrderId}
                    onClose={() => setShowOrderSuccess(false)}
                />
            )}

            {/* Header + Savings Banner - Both sticky */}
            <div className="sticky top-0 z-40">
                <header className="border-b border-border/40 bg-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20 shadow-sm">
                    <div className="container mx-auto px-4 py-4 flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/shop')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                                <ShoppingCart className="h-4 w-4 text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold">Your Cart</h1>
                                <p className="text-xs text-muted-foreground">{cartItems.length} items</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Savings Banner - Simple total only */}
                {cartItems.length > 0 && totalSavings > 0 && (
                    <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-green-600 text-white py-2.5 text-center shadow-md">
                        <p className="text-sm font-bold">
                            🎉 You save ₹{totalSavings.toFixed(0)}
                        </p>
                    </div>
                )}
            </div>

            <main className="container mx-auto px-4 py-4 space-y-4 max-w-2xl">
                {/* Delivery estimate */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                    <Clock className="h-5 w-5 text-green-600" />
                    <div>
                        <p className="text-sm font-medium text-green-700 dark:text-green-400">
                            Estimated delivery: 15-30 mins
                        </p>
                        <p className="text-xs text-green-600/70">Free delivery on orders above ₹200</p>
                    </div>
                </div>

                {/* Empty cart */}
                {cartItems.length === 0 && (
                    <Card className="flex flex-col items-center justify-center py-12">
                        <ShoppingCart className="h-16 w-16 text-muted-foreground/30 mb-4" />
                        <h2 className="text-lg font-semibold text-muted-foreground">Your cart is empty</h2>
                        <p className="text-sm text-muted-foreground/70 mb-4">Browse our products and add items</p>
                        <Button onClick={() => navigate('/shop')}>
                            <Package className="h-4 w-4 mr-2" />
                            Shop Now
                        </Button>
                    </Card>
                )}

                {/* Cart Items */}
                {cartItems.length > 0 && (
                    <div className="space-y-3">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            Cart ({cartItems.length})
                        </h2>
                        {cartItems.map(item => {
                            const isLowStock = item.products.stock_quantity <= 5 && item.products.stock_quantity > 0;
                            const isOutOfStock = item.products.stock_quantity <= 0;

                            return (
                                <Card key={item.id} className={`overflow-hidden ${isOutOfStock ? 'opacity-60 border-destructive/50' : ''}`}>
                                    <CardContent className="p-3">
                                        <div className="flex gap-3">
                                            {/* Product image */}
                                            <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                                {item.products.image_url ? (
                                                    <img
                                                        src={item.products.image_url}
                                                        alt={item.products.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Package className="h-8 w-8 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Product info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p
                                                            className="font-medium text-sm truncate cursor-pointer hover:text-primary"
                                                            onClick={() => navigate(`/product/${item.product_id}`)}
                                                        >
                                                            {item.products.name}
                                                        </p>
                                                        {item.product_variants && (
                                                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                                                {formatVariantDisplay(item.product_variants)}
                                                            </span>
                                                        )}
                                                        {(() => {
                                                            const price = getItemPrice(item);
                                                            const mrp = getItemMrp(item);
                                                            const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
                                                            const unitName = item.product_variants ? formatVariantDisplay(item.product_variants) : item.products.unit;

                                                            return discount > 0 ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-xs text-green-600 font-semibold">{discount}% OFF</span>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        ₹{price} / {unitName}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground line-through">
                                                                        ₹{mrp}
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground">
                                                                    ₹{price} / {unitName}
                                                                </p>
                                                            );
                                                        })()}
                                                    </div>
                                                    <p className="font-bold text-primary whitespace-nowrap">
                                                        ₹{(getItemPrice(item) * item.quantity).toFixed(0)}
                                                    </p>
                                                </div>

                                                {/* Stock indicator */}
                                                {isLowStock && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                                                        <span className="text-xs text-amber-600">Only {item.products.stock_quantity} left</span>
                                                    </div>
                                                )}
                                                {isOutOfStock && (
                                                    <Badge variant="destructive" className="text-xs mt-1">Out of Stock</Badge>
                                                )}

                                                {/* Quantity controls */}
                                                <div className="flex items-center justify-between mt-2">
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            size="icon"
                                                            variant="outline"
                                                            className="h-7 w-7"
                                                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                        >
                                                            <Minus className="h-3 w-3" />
                                                        </Button>
                                                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                                        <Button
                                                            size="icon"
                                                            variant="outline"
                                                            className="h-7 w-7"
                                                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                            disabled={item.quantity >= item.products.stock_quantity}
                                                        >
                                                            <Plus className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                                            onClick={() => removeItem(item.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Promo code */}
                {cartItems.length > 0 && (
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                                <Tag className="h-5 w-5 text-primary" />
                                <span className="text-sm font-medium">Promo Code</span>
                            </div>
                            <div className="flex gap-2 mt-3">
                                <Input
                                    placeholder="Enter code"
                                    value={promoCode}
                                    onChange={(e) => setPromoCode(e.target.value)}
                                    className="flex-1"
                                    disabled={promoApplied}
                                />
                                {promoApplied ? (
                                    <Button onClick={removeCoupon} variant="outline">
                                        <X className="h-4 w-4 mr-1" />
                                        Remove
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={applyPromoCode}
                                        disabled={!promoCode.trim()}
                                    >
                                        Apply
                                    </Button>
                                )}
                            </div>

                            {/* Applied coupon indicator */}
                            {appliedCoupon && (
                                <div className="mt-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Ticket className="h-4 w-4 text-green-600" />
                                            <span className="text-sm font-medium text-green-700">{appliedCoupon.code}</span>
                                        </div>
                                        <span className="text-sm font-bold text-green-600">-₹{discountAmount.toFixed(0)}</span>
                                    </div>
                                    <p className="text-xs text-green-600/80 mt-1">{appliedCoupon.description}</p>
                                </div>
                            )}

                            {/* Available coupon chips */}
                            {availableCoupons.length > 0 && !appliedCoupon && (
                                <div className="mt-3">
                                    <p className="text-xs text-muted-foreground mb-2">Available for you:</p>
                                    <HorizontalScrollContainer className="gap-2" showButtons={true}>
                                        {availableCoupons.map((coupon) => {
                                            const subtotal = cartItems.reduce((sum, item) => {
                                                const price = item.product_variants?.price ?? item.products.price;
                                                return sum + price * item.quantity;
                                            }, 0);
                                            const isEligible = coupon.minimum_order <= subtotal;

                                            return (
                                                <button
                                                    key={coupon.id}
                                                    onClick={() => isEligible && applyCoupon(coupon)}
                                                    disabled={!isEligible}
                                                    className={`flex-shrink-0 px-4 py-2.5 rounded-xl border-2 transition-all duration-200 ${isEligible
                                                        ? 'border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/50 dark:hover:to-emerald-900/50 cursor-pointer shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
                                                        : 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Ticket className={`h-4 w-4 ${isEligible ? 'text-green-600' : 'text-gray-400'}`} />
                                                        <span className={`text-sm font-bold ${isEligible ? 'text-green-700 dark:text-green-400' : 'text-gray-500'}`}>
                                                            {coupon.code}
                                                        </span>
                                                    </div>
                                                    <p className={`text-xs mt-0.5 text-left whitespace-nowrap ${isEligible ? 'text-green-600/80' : 'text-gray-400'}`}>
                                                        {coupon.discount_type === 'percentage'
                                                            ? `${coupon.discount_value}% off`
                                                            : `₹${coupon.discount_value} off`}
                                                        {coupon.minimum_order > 0 && ` • Min ₹${coupon.minimum_order}`}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </HorizontalScrollContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Order summary */}
                {cartItems.length > 0 && (
                    <Card className="border-primary/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal (MRP)</span>
                                <span>₹{originalTotal.toFixed(0)}</span>
                            </div>
                            {productSavings > 0 && (
                                <div className="flex justify-between text-sm text-green-600">
                                    <span>🎉 Product Discount</span>
                                    <span>-₹{productSavings.toFixed(0)}</span>
                                </div>
                            )}
                            {couponSavings > 0 && (
                                <div className="flex justify-between text-sm text-green-600">
                                    <span>🎟️ Coupon Discount</span>
                                    <span>-₹{couponSavings.toFixed(0)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Delivery</span>
                                {deliveryFee === 0 ? (
                                    <div className="flex items-center gap-1">
                                        <span className="line-through text-muted-foreground">₹{baseDeliveryFee}</span>
                                        <span className="text-green-600 font-semibold">FREE</span>
                                    </div>
                                ) : (
                                    <span>₹{deliveryFee}</span>
                                )}
                            </div>
                            {deliverySavings > 0 && (
                                <div className="flex justify-between text-xs text-green-600">
                                    <span>🚚 {isWaterOnlyCart ? 'Free delivery on Water' : 'Free delivery on orders over ₹200'}</span>
                                    <span>-₹{deliverySavings.toFixed(0)}</span>
                                </div>
                            )}
                            <Separator />
                            {totalSavings > 0 && (
                                <div className="flex justify-between text-sm font-semibold text-green-600 bg-green-50 dark:bg-green-950/30 p-2 rounded-lg">
                                    <span>💰 Total Savings</span>
                                    <span>₹{totalSavings.toFixed(0)}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-bold text-lg">
                                <span>Total</span>
                                <span className="text-primary">₹{finalTotal.toFixed(0)}</span>
                            </div>

                            {/* Checkout button */}
                            <Button
                                className="w-full h-12 text-base font-semibold mt-2"
                                onClick={handleCheckout}
                            >
                                <ShieldCheck className="h-5 w-5 mr-2" />
                                Proceed to Checkout
                            </Button>

                            <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                                <ShieldCheck className="h-3 w-3" />
                                100% secure checkout
                            </p>
                        </CardContent>
                    </Card>
                )}
            </main>

            {/* Sticky Checkout Bar */}
            {
                cartItems.length > 0 && (
                    <div className="fixed bottom-16 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
                        <div className="container mx-auto px-4 py-3 max-w-2xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground">Total Amount</p>
                                    <p className="text-xl font-bold text-primary">₹{finalTotal.toFixed(0)}</p>
                                    {totalSavings > 0 && (
                                        <p className="text-xs text-green-600 font-medium">
                                            You save ₹{totalSavings.toFixed(0)}!
                                        </p>
                                    )}
                                </div>
                                <Button
                                    className="h-12 px-8 text-base font-semibold"
                                    onClick={handleCheckout}
                                >
                                    <ShieldCheck className="h-5 w-5 mr-2" />
                                    Checkout
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Address Dialog */}
            <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-primary" />
                            Delivery Address
                        </DialogTitle>
                    </DialogHeader>

                    <RadioGroup value={addressOption} onValueChange={(v) => setAddressOption(v as 'saved' | 'new')}>
                        {savedAddress && (
                            <div className="flex items-start space-x-3 p-3 rounded-lg border">
                                <RadioGroupItem value="saved" id="saved" className="mt-1" />
                                <div className="flex-1">
                                    <Label htmlFor="saved" className="font-medium cursor-pointer">
                                        Saved Address
                                    </Label>
                                    <p className="text-sm text-muted-foreground mt-1">{savedAddress}</p>
                                </div>
                            </div>
                        )}
                        <div className="flex items-start space-x-3 p-3 rounded-lg border">
                            <RadioGroupItem value="new" id="new" className="mt-1" />
                            <div className="flex-1">
                                <Label htmlFor="new" className="font-medium cursor-pointer">
                                    New Address
                                </Label>
                                {addressOption === 'new' && (
                                    <div className="space-y-3 mt-3">
                                        {/* Apartment Dropdown */}
                                        <div>
                                            <Label className="text-sm">Apartment Complex</Label>
                                            <select
                                                value={selectedApartment}
                                                onChange={(e) => setSelectedApartment(e.target.value)}
                                                className="w-full mt-1.5 p-2.5 border rounded-md bg-background text-sm"
                                            >
                                                <option value="">Select your apartment...</option>
                                                <option value="VBHC Vaibhava">VBHC Vaibhava</option>
                                                <option value="Symphony">Symphony</option>
                                                <option value="Other">Other</option>
                                            </select>
                                            {selectedApartment && selectedApartment !== 'Other' && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    📍 {selectedApartment}, Chandapura-Anekal Road, Bangalore - 562106
                                                </p>
                                            )}
                                        </div>

                                        {/* Block and Room */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <Label className="text-sm">Block/Tower</Label>
                                                <Input
                                                    placeholder="e.g., 51"
                                                    value={blockNumber}
                                                    onChange={(e) => setBlockNumber(e.target.value)}
                                                    className="mt-1.5"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-sm">Room Number</Label>
                                                <Input
                                                    placeholder="e.g., 603"
                                                    value={roomNumber}
                                                    onChange={(e) => setRoomNumber(e.target.value)}
                                                    className="mt-1.5"
                                                />
                                            </div>
                                        </div>

                                        {/* Additional Address for Other */}
                                        {selectedApartment === 'Other' && (
                                            <Textarea
                                                placeholder="Enter your complete delivery address"
                                                value={newAddress}
                                                onChange={(e) => setNewAddress(e.target.value)}
                                                rows={2}
                                            />
                                        )}

                                        {/* Preview */}
                                        {(selectedApartment && selectedApartment !== 'Other' && (blockNumber || roomNumber)) && (
                                            <div className="p-2 bg-muted/50 rounded-lg text-sm">
                                                <p className="font-medium">Delivery to:</p>
                                                <p className="text-muted-foreground">
                                                    {blockNumber && `Block ${blockNumber}`}{roomNumber && `, Room ${roomNumber}`}
                                                    <br />
                                                    {selectedApartment}, Chandapura-Anekal Road, Bangalore - 562106
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </RadioGroup>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddressDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={confirmOrder} disabled={placingOrder}>
                            {placingOrder ? 'Placing Order...' : 'Confirm Order'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <BottomNav />
        </div >
    );
}

