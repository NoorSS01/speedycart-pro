import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Package,
    Plus,
    Minus,
    ShoppingCart,
    Zap,
    Share2,
    Tag,
    Leaf,
    Scale,
    Box,
    Info,
    Star,
    ChevronDown,
    ChevronUp,
    MapPin,
    User,
    Search,
    X
} from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useFrequentlyBoughtTogether } from '@/hooks/useFrequentlyBoughtTogether';
import OrderConfirmation from '@/components/OrderConfirmation';

interface Product {
    id: string;
    name: string;
    description: string | null;
    price: number;
    mrp?: number | null;
    image_url: string | null;
    stock_quantity: number;
    unit: string;
    category_id: string | null;
    discount_percent?: number | null;
}

interface ProductVariant {
    id: string;
    variant_name: string;
    variant_value: number;
    variant_unit: string;
    price: number;
    mrp: number | null;
    is_default: boolean | null;
}

interface ProductReview {
    id: string;
    rating: number;
    review_text: string | null;
    created_at: string;
    user_id: string;
    profiles: {
        full_name: string | null;
    } | null;
}

export default function ProductDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { refreshCart } = useCart();
    const [product, setProduct] = useState<Product | null>(null);
    const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
    const [reviews, setReviews] = useState<ProductReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);
    const [addingToCart, setAddingToCart] = useState(false);
    const [showAddressDialog, setShowAddressDialog] = useState(false);
    const [savedAddress, setSavedAddress] = useState('');
    const [addressOption, setAddressOption] = useState<'saved' | 'new'>('saved');
    const [newAddress, setNewAddress] = useState('');
    const [showInfo, setShowInfo] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [variants, setVariants] = useState<ProductVariant[]>([]);
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
    const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
    const [lastOrderId, setLastOrderId] = useState('');
    const { trackView } = useRecommendations();
    const { products: frequentlyBought, isLoading: frequentlyBoughtLoading } = useFrequentlyBoughtTogether(id);

    useEffect(() => {
        if (id) {
            fetchProduct();
            fetchReviews();
            fetchVariants();
        }
    }, [id]);

    useEffect(() => {
        if (user) {
            fetchSavedAddress();
        }
    }, [user]);

    const fetchProduct = async () => {
        if (!id) return;

        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (!error && data) {
            setProduct(data);
            // Track view for AI recommendations
            trackView(data.id);
            if (data.category_id) {
                fetchRelatedProducts(data.category_id, data.id);
            }
        }
        setLoading(false);
    };

    const fetchReviews = async () => {
        if (!id) return;

        // Attempt to fetch reviews - wrapped in try/catch in case table doesn't exist
        try {
            const { data, error } = await supabase
                .from('product_reviews' as any)
                .select(`
          id,
          rating,
          review_text,
          created_at,
          user_id,
          profiles:user_id(full_name)
        `)
                .eq('product_id', id)
                .order('created_at', { ascending: false });

            if (data && !error) {
                setReviews(data as any);
            }
        } catch (e) {
            console.log('Product reviews table may not exist yet');
        }
    };

    const fetchRelatedProducts = async (categoryId: string, currentProductId: string) => {
        const { data } = await supabase
            .from('products')
            .select('*')
            .eq('category_id', categoryId)
            .neq('id', currentProductId)
            .gt('stock_quantity', 0)
            .limit(6);

        if (data) {
            setRelatedProducts(data);
        }
    };

    const fetchVariants = async () => {
        if (!id) return;

        try {
            const { data, error } = await supabase
                .from('product_variants')
                .select('*')
                .eq('product_id', id)
                .order('display_order');

            if (!error && data && data.length > 0) {
                setVariants(data as ProductVariant[]);
                // Set default variant or first one
                const defaultVariant = data.find(v => v.is_default) || data[0];
                setSelectedVariant(defaultVariant as ProductVariant);
            }
        } catch (e) {
            console.log('Product variants table may not exist yet');
        }
    };


    const fetchSavedAddress = async () => {
        if (!user) return;
        const { data } = await supabase
            .from('profiles')
            .select('address')
            .eq('id', user.id)
            .single();
        if (data?.address) {
            setSavedAddress(data.address);
        }
    };

    const addToCart = async () => {
        if (!user || !product) {
            toast.error('Please sign in first');
            navigate('/auth');
            return;
        }

        if (quantity > product.stock_quantity) {
            toast.error(`Only ${product.stock_quantity} available`);
            return;
        }

        setAddingToCart(true);

        try {
            const variantId = selectedVariant?.id || null;

            // Amazon-style: Each product+variant combo is a unique cart line item
            // Check if this exact combo already exists in cart
            let query = supabase
                .from('cart_items')
                .select('*')
                .eq('user_id', user.id)
                .eq('product_id', product.id);

            // Handle variant matching correctly
            if (variantId) {
                query = query.eq('variant_id', variantId);
            } else {
                query = query.is('variant_id', null);
            }

            // Use maybeSingle() - returns null if no match, doesn't throw error
            const { data: existingItem, error: fetchError } = await query.maybeSingle();

            if (fetchError) {
                console.error('Cart fetch error:', fetchError);
                toast.error('Failed to check cart. Please try again.');
                setAddingToCart(false);
                return;
            }

            if (existingItem) {
                // This exact product+variant already in cart - update quantity
                const newQty = existingItem.quantity + quantity;
                if (newQty > product.stock_quantity) {
                    toast.error(`Only ${product.stock_quantity} available (${existingItem.quantity} already in cart)`);
                    setAddingToCart(false);
                    return;
                }

                const { error: updateError } = await supabase
                    .from('cart_items')
                    .update({ quantity: newQty })
                    .eq('id', existingItem.id);

                if (updateError) {
                    console.error('Cart update error:', updateError);
                    toast.error('Failed to update cart. Please try again.');
                    setAddingToCart(false);
                    return;
                }
            } else {
                // New product+variant combo - insert new cart item
                const { error: insertError } = await supabase
                    .from('cart_items')
                    .insert({
                        user_id: user.id,
                        product_id: product.id,
                        quantity,
                        variant_id: variantId
                    });

                if (insertError) {
                    console.error('Cart insert error:', insertError);
                    // Check if it's a unique constraint violation
                    if (insertError.code === '23505') {
                        toast.error('This item is already in your cart. Try refreshing the page.');
                    } else {
                        toast.error('Failed to add to cart. Please try again.');
                    }
                    setAddingToCart(false);
                    return;
                }
            }

            const variantName = selectedVariant ? ` (${selectedVariant.variant_name})` : '';
            toast.success(`Added ${quantity}${variantName} to cart`);
            refreshCart(); // Instant badge update
        } catch (error) {
            console.error('Unexpected cart error:', error);
            toast.error('Something went wrong. Please try again.');
        } finally {
            setAddingToCart(false);
        }
    };

    const handleBuyNow = () => {
        if (!user || !product) {
            toast.error('Please sign in first');
            navigate('/auth');
            return;
        }
        if (product.stock_quantity <= 0) {
            toast.error('Out of stock');
            return;
        }
        setShowAddressDialog(true);
    };

    const confirmOrder = async () => {
        if (!user || !product) return;

        const deliveryAddress = addressOption === 'saved' ? savedAddress : newAddress.trim();
        if (!deliveryAddress) {
            toast.error('Please provide a delivery address');
            return;
        }

        // Verify stock
        const { data: freshProduct } = await supabase
            .from('products')
            .select('stock_quantity, name')
            .eq('id', product.id)
            .single();

        if (!freshProduct || quantity > freshProduct.stock_quantity) {
            toast.error(`Only ${freshProduct?.stock_quantity || 0} available`);
            return;
        }

        // Save new address
        if (addressOption === 'new' && newAddress.trim()) {
            await supabase.from('profiles').update({ address: newAddress.trim() }).eq('id', user.id);
            setSavedAddress(newAddress.trim());
        }

        const totalAmount = product.price * quantity;

        // Create order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                user_id: user.id,
                total_amount: totalAmount,
                delivery_address: deliveryAddress,
                status: 'pending'
            })
            .select()
            .single();

        if (orderError || !order) {
            toast.error('Failed to place order');
            return;
        }

        // Create order item
        await supabase.from('order_items').insert({
            order_id: order.id,
            product_id: product.id,
            quantity,
            price: selectedVariant?.price || product.price,
            variant_id: selectedVariant?.id || null
        });

        // Update stock
        const newStock = Math.max(0, freshProduct.stock_quantity - quantity);
        await supabase.from('products').update({ stock_quantity: newStock }).eq('id', product.id);

        setShowAddressDialog(false);
        setNewAddress('');
        // Show success animation
        setLastOrderId(order.id);
        setShowOrderConfirmation(true);
        // toast.success('🎉 Order placed successfully!');
        // navigate('/orders');
    };

    const handleShare = async () => {
        if (navigator.share && product) {
            try {
                await navigator.share({
                    title: product.name,
                    text: `Check out ${product.name} on PremasShop!`,
                    url: window.location.href
                });
            } catch (err) { }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-24">
                <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
                    <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                        <Skeleton className="h-9 w-9 rounded-md" />
                        <Skeleton className="h-9 w-9 rounded-md" />
                    </div>
                </header>

                <div className="w-full aspect-square bg-muted relative">
                    <Skeleton className="w-full h-full" />
                </div>

                <div className="container mx-auto px-4 py-4 space-y-4">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-3/4" />
                        <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-2">
                                <Skeleton className="h-8 w-24" />
                                <Skeleton className="h-4 w-12" />
                            </div>
                            <Skeleton className="h-6 w-16 rounded-full" />
                        </div>
                    </div>

                    <Skeleton className="h-20 w-full" />

                    <div className="flex items-center gap-3">
                        <Skeleton className="h-4 w-8" />
                        <Skeleton className="h-10 w-32 rounded-full" />
                    </div>

                    <div className="flex gap-3">
                        <Skeleton className="h-12 flex-1 rounded-md" />
                        <Skeleton className="h-12 flex-1 rounded-md" />
                    </div>

                    <Skeleton className="h-40 w-full rounded-xl" />
                    <Skeleton className="h-14 w-full rounded-xl" />
                    <Skeleton className="h-40 w-full rounded-xl" />
                </div>
                <BottomNav />
            </div>
        );
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-4">
                <Package className="h-16 w-16 text-muted-foreground" />
                <p className="text-muted-foreground">Product not found</p>
                <Button onClick={() => navigate('/shop')}>Back to Shop</Button>
            </div>
        );
    }

    const isOutOfStock = product.stock_quantity <= 0;
    const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 5;
    const averageRating = reviews.length > 0
        ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
        : null;

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-24">
            {showOrderConfirmation && (
                <OrderConfirmation
                    orderId={lastOrderId}
                    onClose={() => setShowOrderConfirmation(false)}
                />
            )}

            {/* Header - Address & Search */}
            <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
                <div className="container mx-auto px-4 py-3">
                    {showSearch ? (
                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="flex-1"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && searchQuery.trim()) {
                                        navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
                                    }
                                }}
                            />
                            <Button variant="ghost" size="icon" onClick={() => { setShowSearch(false); setSearchQuery(''); }}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0" onClick={() => setShowAddressDialog(true)}>
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(-1); }}>
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 flex-1 min-w-0 cursor-pointer hover:bg-muted transition-colors">
                                    <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                                    <span className="text-sm truncate">
                                        {savedAddress ? savedAddress.slice(0, 30) + (savedAddress.length > 30 ? '...' : '') : 'Add delivery address'}
                                    </span>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowSearch(true)}>
                                <Search className="h-5 w-5" />
                            </Button>
                        </div>
                    )}
                </div>
            </header>

            {/* Product Image */}
            <div className="w-full aspect-square bg-muted relative">
                {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-24 w-24 text-muted-foreground" />
                    </div>
                )}
                {/* Discount Badge - Top Left */}
                {(() => {
                    const displayMrp = selectedVariant?.mrp ?? product.mrp;
                    const displayPrice = selectedVariant?.price ?? product.price;
                    const discount = displayMrp && displayMrp > displayPrice
                        ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100)
                        : 0;

                    return discount > 0 ? (
                        <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-bold shadow-lg">
                            {discount}% OFF
                        </div>
                    ) : null;
                })()}
                {isLowStock && (
                    <Badge className="absolute top-4 right-4 bg-red-500 text-white">Only {product.stock_quantity} left!</Badge>
                )}
                {isOutOfStock && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Badge variant="destructive" className="text-lg px-4 py-2">Out of Stock</Badge>
                    </div>
                )}
            </div>

            {/* Product Info */}
            <div className="container mx-auto px-4 py-4 space-y-4">
                <div>
                    <h1 className="text-2xl font-bold">{product.name}</h1>

                    {/* Variant Selector */}
                    {variants.length > 0 && (
                        <div className="mt-4">
                            <p className="text-sm text-muted-foreground mb-2">Select Size/Quantity:</p>
                            <div className="flex flex-wrap gap-2">
                                {variants.map(variant => {
                                    const isSelected = selectedVariant?.id === variant.id;
                                    const variantDiscount = variant.mrp ? Math.round(((variant.mrp - variant.price) / variant.mrp) * 100) : 0;
                                    return (
                                        <button
                                            key={variant.id}
                                            onClick={() => setSelectedVariant(variant)}
                                            className={`relative p-3 rounded-xl border-2 transition-all min-w-[100px] ${isSelected
                                                ? 'border-primary bg-primary/5 shadow-md'
                                                : 'border-border hover:border-primary/50'
                                                }`}
                                        >
                                            {variantDiscount > 0 && (
                                                <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                    {variantDiscount}% OFF
                                                </span>
                                            )}
                                            <p className="font-semibold text-sm">{variant.variant_name}</p>
                                            <p className="text-primary font-bold">₹{variant.price}</p>
                                            {variant.mrp && variant.mrp > variant.price && (
                                                <p className="text-xs text-muted-foreground line-through">₹{variant.mrp}</p>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Pricing Display */}
                    <div className="flex items-center justify-between mt-4">
                        <div className="flex flex-col">
                            <div className="flex items-baseline gap-2">
                                {(() => {
                                    // Use selected variant price if available, otherwise use product price
                                    const displayPrice = selectedVariant?.price ?? product.price;
                                    const displayMrp = selectedVariant?.mrp ?? product.mrp;
                                    const displayUnit = selectedVariant?.variant_name ?? product.unit;
                                    const discount = displayMrp ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100) : 0;

                                    return (
                                        <>
                                            <span className="text-3xl font-bold text-primary">₹{displayPrice}</span>
                                            {displayMrp && displayMrp > displayPrice && (
                                                <span className="text-lg text-muted-foreground line-through">₹{displayMrp}</span>
                                            )}
                                            <span className="text-muted-foreground">/ {displayUnit}</span>
                                            {discount > 0 && !selectedVariant && (
                                                <span className="ml-2 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-semibold rounded">
                                                    {discount}% OFF
                                                </span>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Price per 100g for weighted items */}
                            {(() => {
                                let grams = 0;
                                let priceToUse = 0;

                                if (selectedVariant) {
                                    // Variant: variant_value is numeric, variant_unit is 'g', 'kg', etc.
                                    priceToUse = selectedVariant.price;
                                    const variantUnit = selectedVariant.variant_unit.toLowerCase();
                                    const variantValue = selectedVariant.variant_value;

                                    if (variantUnit === 'kg') {
                                        grams = variantValue * 1000;
                                    } else if (variantUnit === 'g') {
                                        grams = variantValue;
                                    }
                                } else {
                                    // Product: unit is like '500g', '1kg', '250gm' - parse it
                                    priceToUse = product.price;
                                    const unitStr = product.unit.toLowerCase();
                                    const match = unitStr.match(/^(\d*\.?\d+)\s*(kg|g|gm|gram|grams)?$/);

                                    if (match) {
                                        const value = parseFloat(match[1]);
                                        const unit = match[2] || 'piece';

                                        if (unit === 'kg') {
                                            grams = value * 1000;
                                        } else if (['g', 'gm', 'gram', 'grams'].includes(unit)) {
                                            grams = value;
                                        }
                                    }
                                }

                                // Show per 100g price if we have valid grams
                                if (grams > 0) {
                                    const pricePer100g = (priceToUse / grams) * 100;
                                    return (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            ₹{pricePer100g.toFixed(2)} per 100g
                                        </p>
                                    );
                                }

                                // For dozen/pack items with variant
                                if (selectedVariant) {
                                    const variantUnit = selectedVariant.variant_unit.toLowerCase();
                                    if (['dozen', 'pack', 'box', 'pcs', 'pieces'].includes(variantUnit) && selectedVariant.variant_value > 1) {
                                        const pricePerUnit = selectedVariant.price / selectedVariant.variant_value;
                                        return (
                                            <p className="text-sm text-muted-foreground mt-1">
                                                ₹{pricePerUnit.toFixed(2)} per piece
                                            </p>
                                        );
                                    }
                                }

                                return null;
                            })()}
                        </div>
                        {averageRating && (
                            <div className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full">
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                <span className="font-bold text-sm">{averageRating}</span>
                                <span className="text-xs text-muted-foreground">({reviews.length})</span>
                            </div>
                        )}
                    </div>
                </div>

                {product.description && (
                    <p className="text-muted-foreground text-sm">{product.description}</p>
                )}

                {/* Quantity Selector */}
                {!isOutOfStock && (
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">Qty:</span>
                        <div className="flex items-center gap-2 bg-muted rounded-full p-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                                <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center font-semibold">{quantity}</span>
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        {isLowStock && <span className="text-xs text-red-500">Only {product.stock_quantity} left</span>}
                    </div>
                )}

                {/* Action Button */}
                <div className="flex gap-3">
                    <Button className="flex-1 h-12" onClick={addToCart} disabled={isOutOfStock || addingToCart}>
                        <ShoppingCart className="h-4 w-4 mr-2" />Add to Cart
                    </Button>
                </div>

                {/* Highlights */}
                <Card>
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Tag className="h-4 w-4 text-primary" /> Highlights
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex items-start gap-2">
                                <Box className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <div><p className="text-muted-foreground text-xs">Brand</p><p className="font-medium">PremasShop</p></div>
                            </div>
                            <div className="flex items-start gap-2">
                                <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <div><p className="text-muted-foreground text-xs">Type</p><p className="font-medium">Grocery</p></div>
                            </div>
                            <div className="flex items-start gap-2">
                                <Leaf className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <div><p className="text-muted-foreground text-xs">Diet</p><p className="font-medium">Veg</p></div>
                            </div>
                            <div className="flex items-start gap-2">
                                <Scale className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <div><p className="text-muted-foreground text-xs">Unit</p><p className="font-medium">{product.unit}</p></div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Information */}
                <Card>
                    <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setShowInfo(!showInfo)}>
                        <CardTitle className="text-base flex items-center justify-between">
                            <span className="flex items-center gap-2"><Info className="h-4 w-4 text-primary" /> Information</span>
                            {showInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </CardTitle>
                    </CardHeader>
                    {showInfo && (
                        <CardContent className="px-4 pb-4 pt-0 space-y-3 text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs mb-1">Disclaimer</p>
                                <p className="text-xs leading-relaxed">Images are for representational purposes. Check label for details before consuming.</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs mb-1">Customer Care</p>
                                <p className="text-xs">support@premasshop.com</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs mb-1">Seller</p>
                                <p className="text-xs font-medium">PremasShop Local Vendors</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs mb-1">Country of Origin</p>
                                <p className="text-xs">India</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs mb-1">Shelf Life</p>
                                <p className="text-xs">As per product packaging</p>
                            </div>
                        </CardContent>
                    )}
                </Card>

                {/* Reviews */}
                <Card>
                    <CardHeader className="py-3 px-4">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Star className="h-4 w-4 text-primary" /> Reviews
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                        {reviews.length > 0 ? (
                            <div className="space-y-4">
                                {reviews.map(review => (
                                    <div key={review.id} className="border-b last:border-0 pb-3 last:pb-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                                                    <User className="h-3 w-3 text-muted-foreground" />
                                                </div>
                                                <span className="text-sm font-medium">{review.profiles?.full_name || 'Anonymous'}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center gap-1 mb-1">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <Star key={star} className={`h-3 w-3 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                                            ))}
                                        </div>
                                        {review.review_text && <p className="text-sm text-muted-foreground">{review.review_text}</p>}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center py-6 text-center">
                                <div className="flex gap-1 mb-2">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <Star key={i} className="h-5 w-5 text-muted-foreground/30" />
                                    ))}
                                </div>
                                <p className="text-muted-foreground text-sm">No reviews yet</p>
                                <p className="text-xs text-muted-foreground mt-1">Be the first to review!</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Frequently Bought Together */}
                {frequentlyBought.length > 0 && (
                    <div className="pt-2">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5 text-primary" />
                            Frequently bought together
                        </h2>
                        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                            {frequentlyBought.map(relProduct => (
                                <Card key={relProduct.id} className="flex-shrink-0 w-36 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/product/${relProduct.id}`)}>
                                    <CardContent className="p-0">
                                        <div className="aspect-square bg-muted relative">
                                            {relProduct.image_url ? (
                                                <img src={relProduct.image_url} alt={relProduct.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Package className="h-8 w-8 text-muted-foreground" />
                                                </div>
                                            )}
                                            {relProduct.discount_percent && relProduct.discount_percent > 0 && (
                                                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-green-500 text-white text-xs font-bold">
                                                    {relProduct.discount_percent}% OFF
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-2">
                                            <p className="text-sm font-medium truncate">{relProduct.name}</p>
                                            {relProduct.discount_percent && relProduct.discount_percent > 0 ? (
                                                <div className="flex items-center gap-1">
                                                    <p className="text-sm font-bold text-primary">
                                                        ₹{Math.round(relProduct.price * (100 - relProduct.discount_percent) / 100)}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground line-through">₹{relProduct.price}</p>
                                                </div>
                                            ) : (
                                                <p className="text-sm font-bold text-primary">₹{relProduct.price}</p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Address Dialog for Buy Now */}
            <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-primary" /> Delivery Address
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm font-medium">{product?.name}</p>
                            <p className="text-xs text-muted-foreground">Qty: {quantity} × ₹{product?.price} = ₹{(quantity * (product?.price || 0)).toFixed(0)}</p>
                        </div>
                        <RadioGroup value={addressOption} onValueChange={(v) => setAddressOption(v as 'saved' | 'new')}>
                            {savedAddress && (
                                <div className="flex items-start gap-2 p-3 border rounded-lg">
                                    <RadioGroupItem value="saved" id="saved" className="mt-1" />
                                    <Label htmlFor="saved" className="flex-1 cursor-pointer">
                                        <p className="text-sm font-medium">Saved Address</p>
                                        <p className="text-xs text-muted-foreground mt-1">{savedAddress}</p>
                                    </Label>
                                </div>
                            )}
                            <div className="flex items-start gap-2 p-3 border rounded-lg">
                                <RadioGroupItem value="new" id="new" className="mt-1" />
                                <Label htmlFor="new" className="flex-1 cursor-pointer">
                                    <p className="text-sm font-medium">New Address</p>
                                </Label>
                            </div>
                        </RadioGroup>
                        {addressOption === 'new' && (
                            <Textarea placeholder="Enter full delivery address" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} className="min-h-[80px]" />
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={confirmOrder} className="w-full h-12">
                            <Zap className="h-4 w-4 mr-2" /> Confirm Order • ₹{(quantity * (product?.price || 0)).toFixed(0)}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <BottomNav />
        </div>
    );
}
