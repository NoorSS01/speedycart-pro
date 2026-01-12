import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { formatVariantDisplay } from '@/lib/formatUnit';
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
    ShoppingCart, Star, Info, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
    Minus, Plus, MapPin, Zap, User, Tag, Box, Package, Leaf, Scale, ArrowLeft,
    Search, X
} from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { Skeleton } from '@/components/ui/skeleton';
import ProductCard from '@/components/ProductCard';
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

// formatVariantDisplay is now imported from @/lib/formatUnit

export default function ProductDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { refreshCart, addToCart: contextAddToCart, getItemQuantity, updateQuantity } = useCart();
    const [product, setProduct] = useState<Product | null>(null);
    const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
    const [reviews, setReviews] = useState<ProductReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);
    const [addingToCart, setAddingToCart] = useState(false);
    const [dialogMode, setDialogMode] = useState<'address' | 'buynow'>('address');
    const [showAddressDialog, setShowAddressDialog] = useState(false);
    const [savedAddress, setSavedAddress] = useState('');
    const [addressOption, setAddressOption] = useState<'saved' | 'new'>('saved');
    const [newAddress, setNewAddress] = useState('');
    const [selectedApartment, setSelectedApartment] = useState<string>('');
    const [blockNumber, setBlockNumber] = useState('');
    const [roomNumber, setRoomNumber] = useState('');
    const [showInfo, setShowInfo] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchSuggestions, setSearchSuggestions] = useState<Product[]>([]);
    const [variants, setVariants] = useState<ProductVariant[]>([]);
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
    const [productImages, setProductImages] = useState<string[]>([]);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
    const [lastOrderId, setLastOrderId] = useState('');
    const { trackView } = useRecommendations();
    const { products: frequentlyBought, isLoading: frequentlyBoughtLoading, error: frequentlyBoughtError } = useFrequentlyBoughtTogether(id);



    // Live search suggestions
    useEffect(() => {
        const searchProducts = async () => {
            if (searchQuery.trim().length < 2) {
                setSearchSuggestions([]);
                return;
            }

            const { data } = await supabase
                .from('products')
                .select('*')
                .ilike('name', `%${searchQuery.trim()}%`)
                .gt('stock_quantity', 0)
                .limit(5);

            if (data) {
                setSearchSuggestions(data.map(p => ({
                    ...p,
                    stock_quantity: p.stock_quantity ?? 0,
                    unit: p.unit || 'piece'
                })));
            }
        };

        const timeoutId = setTimeout(searchProducts, 300); // Debounce
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    const fetchRelatedProducts = useCallback(async (categoryId: string, currentProductId: string) => {
        const { data } = await supabase
            .from('products')
            .select('*')
            .eq('category_id', categoryId)
            .neq('id', currentProductId)
            .gt('stock_quantity', 0)
            .limit(6);

        if (data) {
            setRelatedProducts(data.map(p => ({
                ...p,
                stock_quantity: p.stock_quantity ?? 0,
                unit: p.unit || 'piece'
            })));
        }
    }, []);

    const fetchProduct = useCallback(async () => {
        if (!id) return;

        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (!error && data) {
            setProduct({
                ...data,
                stock_quantity: data.stock_quantity ?? 0,
                unit: data.unit || 'piece'
            });
            // Track view for AI recommendations
            trackView(data.id);
            if (data.category_id) {
                fetchRelatedProducts(data.category_id, data.id);
            }
        }
        setLoading(false);
    }, [id, trackView, fetchRelatedProducts]);

    const fetchReviews = useCallback(async () => {
        if (!id) return;

        // Attempt to fetch reviews - wrapped in try/catch in case table doesn't exist
        try {
            const { data, error } = await supabase
                .from('product_reviews')
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
            logger.info('Product reviews table may not exist yet');
        }
    }, [id]);

    const fetchProductImages = useCallback(async () => {
        if (!id) return;

        try {
            const { data, error } = await supabase
                .from('product_images')
                .select('image_url, display_order')
                .eq('product_id', id)
                .order('display_order', { ascending: true });

            if (data && !error) {
                setProductImages(data.map((img: any) => img.image_url));
            }
        } catch (e) {
            logger.info('Product images table may not exist yet');
        }
    }, [id]);



    const fetchVariants = useCallback(async () => {
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
            logger.info('Product variants table may not exist yet');
        }
    }, [id]);



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

    useEffect(() => {
        if (id) {
            // Reset state when switching to a different product
            setQuantity(1);
            setVariants([]);
            setSelectedVariant(null);
            setProductImages([]);
            setSelectedImageIndex(0);
            setProduct(null);
            setLoading(true);

            // Fetch new product data
            fetchProduct();
            fetchReviews();
            fetchVariants();
            fetchProductImages();
        }
    }, [id, fetchProduct, fetchReviews, fetchVariants, fetchProductImages]);

    useEffect(() => {
        if (user) {
            fetchSavedAddress();
        }
    }, [user]);

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
                logger.error('Cart fetch error', { error: fetchError });
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
                    logger.error('Cart update error', { error: updateError });
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
                    logger.error('Cart insert error', { error: insertError });
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
            logger.error('Unexpected cart error', { error });
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
        setDialogMode('buynow');
        setShowAddressDialog(true);
    };

    const saveAddressOnly = async () => {
        let deliveryAddress = '';
        if (addressOption === 'saved') {
            deliveryAddress = savedAddress;
        } else {
            if (selectedApartment && selectedApartment !== 'Other') {
                // Build structured address
                const parts = [];
                if (blockNumber) parts.push(`Block ${blockNumber}`);
                if (roomNumber) parts.push(`Room ${roomNumber}`);
                const complexDetails = parts.length > 0 ? parts.join(', ') : '';
                deliveryAddress = `${complexDetails ? complexDetails + ', ' : ''}${selectedApartment}, Chandapura-Anekal Road, Bangalore - 562106`;
            } else {
                deliveryAddress = newAddress.trim();
            }
        }
        if (!deliveryAddress) {
            toast.error('Please provide a delivery address');
            return;
        }

        // If user is logged in, save to profile
        if (user) {
            const { error } = await supabase.from('profiles').update({ address: deliveryAddress }).eq('id', user.id);
            if (error) {
                toast.error('Failed to save address');
                return;
            }
        }

        // Update local state
        setSavedAddress(deliveryAddress);
        setNewAddress('');
        setSelectedApartment('');
        setBlockNumber('');
        setRoomNumber('');
        setShowAddressDialog(false);
        toast.success('Delivery address saved');
    };

    const confirmOrder = async () => {
        if (!user || !product) return;

        let deliveryAddress = '';
        if (addressOption === 'saved') {
            deliveryAddress = savedAddress;
        } else {
            if (selectedApartment && selectedApartment !== 'Other') {
                // Build structured address
                const parts = [];
                if (blockNumber) parts.push(`Block ${blockNumber}`);
                if (roomNumber) parts.push(`Room ${roomNumber}`);
                const complexDetails = parts.length > 0 ? parts.join(', ') : '';
                deliveryAddress = `${complexDetails ? complexDetails + ', ' : ''}${selectedApartment}, Chandapura-Anekal Road, Bangalore - 562106`;
            } else {
                deliveryAddress = newAddress.trim();
            }
        }

        if (!deliveryAddress) {
            toast.error('Please provide a delivery address');
            return;
        }

        // Use variant price if selected, otherwise product price
        const unitPrice = selectedVariant?.price ?? product.price;

        // Build single-item cart for atomic RPC call
        const cartItemsPayload = [{
            product_id: product.id,
            variant_id: selectedVariant?.id || null,
            quantity: quantity,
            price: unitPrice
        }];

        try {
            // ATOMIC ORDER PLACEMENT: Single RPC call handles stock validation,
            // order creation, and item insertion in one transaction
            // Note: Cast to any as place_order_atomic is a custom function not in generated types
            const { data, error } = await supabase.rpc('place_order_atomic', {
                p_user_id: user.id,
                p_delivery_address: deliveryAddress,
                p_cart_items: cartItemsPayload,
                p_coupon_id: null as unknown as string,
                p_coupon_discount: 0
            });

            if (error) {
                logger.error('RPC error', { error });
                toast.error('Failed to place order. Please try again.');
                return;
            }

            // Handle response from atomic function
            const result = data as unknown as { success: boolean; order_id?: string; error?: string };

            if (!result.success) {
                toast.error(result.error || 'Failed to place order');
                // Refresh product to check updated stock
                fetchProduct();
                return;
            }

            // Save new address
            if (addressOption === 'new' && newAddress.trim()) {
                await supabase.from('profiles').update({ address: newAddress.trim() }).eq('id', user.id);
                setSavedAddress(newAddress.trim());
            }

            setShowAddressDialog(false);
            setNewAddress('');
            // Show success animation
            setLastOrderId(result.order_id || '');
            setShowOrderConfirmation(true);
        } catch (error) {
            logger.error('Order error', { error });
            toast.error('Failed to place order. Please try again.');
        }
    };

    const handleShare = async () => {
        if (navigator.share && product) {
            try {
                await navigator.share({
                    title: product.name,
                    text: `Check out ${product.name} on PremasShop!`,
                    url: window.location.href
                });
            } catch (err) {
                // Share was cancelled or failed - this is expected behavior
                logger.debug('Share cancelled or not available', { error: err });
            }
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
                        <div className="relative">
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
                                <Button variant="ghost" size="icon" onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchSuggestions([]); }}>
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>

                            {/* Search Suggestions Dropdown */}
                            {searchSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 overflow-hidden">
                                    {searchSuggestions.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                navigate(`/product/${item.id}`);
                                                setShowSearch(false);
                                                setSearchQuery('');
                                                setSearchSuggestions([]);
                                            }}
                                            className="w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left"
                                        >
                                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                                {item.image_url ? (
                                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Package className="h-6 w-6 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{item.name}</p>
                                                <p className="text-sm text-primary font-semibold">₹{item.price}</p>
                                            </div>
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => {
                                            navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
                                            setShowSearch(false);
                                            setSearchQuery('');
                                            setSearchSuggestions([]);
                                        }}
                                        className="w-full p-3 border-t text-sm text-primary font-medium hover:bg-muted transition-colors"
                                    >
                                        See all results for "{searchQuery}"
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0" onClick={() => {
                                setDialogMode('address');
                                setShowAddressDialog(true);
                            }}>
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

            {/* Product Image Gallery */}
            <div className="w-full">
                {/* Main Image with Touch Swipe */}
                <div
                    className="aspect-square bg-muted relative overflow-hidden"
                    onTouchStart={(e) => {
                        const touch = e.touches[0];
                        (e.currentTarget as any).touchStartX = touch.clientX;
                    }}
                    onTouchEnd={(e) => {
                        const touchEndX = e.changedTouches[0].clientX;
                        const touchStartX = (e.currentTarget as any).touchStartX || 0;
                        const diff = touchStartX - touchEndX;

                        const allImages = [product.image_url, ...productImages].filter(Boolean);

                        if (Math.abs(diff) > 50) { // Minimum swipe distance
                            if (diff > 0 && selectedImageIndex < allImages.length - 1) {
                                // Swipe left - next image
                                setSelectedImageIndex(selectedImageIndex + 1);
                            } else if (diff < 0 && selectedImageIndex > 0) {
                                // Swipe right - previous image
                                setSelectedImageIndex(selectedImageIndex - 1);
                            }
                        }
                    }}
                >
                    {(() => {
                        // Build all images array: main image first, then additional images
                        const allImages = [
                            product.image_url,
                            ...productImages
                        ].filter(Boolean) as string[];

                        const currentImage = allImages[selectedImageIndex] || product.image_url;

                        return currentImage ? (
                            <img
                                src={currentImage}
                                alt={product.name}
                                className="w-full h-full object-cover transition-opacity duration-300"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-24 w-24 text-muted-foreground" />
                            </div>
                        );
                    })()}

                    {/* Navigation Arrows */}
                    {(() => {
                        const allImages = [product.image_url, ...productImages].filter(Boolean);
                        return allImages.length > 1 ? (
                            <>
                                {selectedImageIndex > 0 && (
                                    <button
                                        onClick={() => setSelectedImageIndex(selectedImageIndex - 1)}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition-colors"
                                    >
                                        <ChevronLeft className="h-6 w-6" />
                                    </button>
                                )}
                                {selectedImageIndex < allImages.length - 1 && (
                                    <button
                                        onClick={() => setSelectedImageIndex(selectedImageIndex + 1)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition-colors"
                                    >
                                        <ChevronRight className="h-6 w-6" />
                                    </button>
                                )}
                                {/* Dots Indicator */}
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                    {allImages.map((_, index) => (
                                        <button
                                            key={index}
                                            onClick={() => setSelectedImageIndex(index)}
                                            className={`w-2.5 h-2.5 rounded-full transition-all ${selectedImageIndex === index
                                                ? 'bg-white scale-110'
                                                : 'bg-white/50 hover:bg-white/70'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </>
                        ) : null;
                    })()}

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

                {/* Image Thumbnails - Only show if multiple images */}
                {(() => {
                    const allImages = [
                        product.image_url,
                        ...productImages
                    ].filter(Boolean) as string[];

                    return allImages.length > 1 ? (
                        <div className="flex gap-2 p-3 overflow-x-auto bg-muted/50">
                            {allImages.map((img, index) => (
                                <button
                                    key={index}
                                    onClick={() => setSelectedImageIndex(index)}
                                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${selectedImageIndex === index
                                        ? 'border-primary ring-2 ring-primary/20'
                                        : 'border-transparent opacity-70 hover:opacity-100'
                                        }`}
                                >
                                    <img
                                        src={img}
                                        alt={`Product ${index + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                </button>
                            ))}
                        </div>
                    ) : null;
                })()}
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
                                            <p className="font-semibold text-sm">{formatVariantDisplay(variant)}</p>
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
                                    const displayUnit = selectedVariant ? formatVariantDisplay(selectedVariant) : product.unit;
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

                            {/* Price per unit calculation */}
                            {(() => {
                                // Get current price
                                const price = selectedVariant?.price ?? product.price;
                                let quantityInBaseUnit = 0; // in grams or ml
                                let unitType: 'weight' | 'volume' | 'count' | null = null;

                                // Helper function to parse quantity and unit from a string
                                const parseQuantityUnit = (str: string): { qty: number; unit: string } | null => {
                                    if (!str) return null;
                                    str = str.toLowerCase().trim();

                                    // Match patterns: "500g", "1kg", "200ml", "1ltr", "1 kg", etc.
                                    const match = str.match(/(\d+\.?\d*)\s*(kg|g|gm|gram|grams|ltr|l|litre|liter|ml|dozen|pack|pcs|pieces)/);
                                    if (match) {
                                        return { qty: parseFloat(match[1]), unit: match[2] };
                                    }
                                    return null;
                                };

                                // Helper to convert to base units
                                const convertToBase = (qty: number, unit: string): { base: number; type: 'weight' | 'volume' | 'count' } | null => {
                                    unit = unit.toLowerCase();

                                    // Weight -> grams
                                    if (unit === 'kg') return { base: qty * 1000, type: 'weight' };
                                    if (['g', 'gm', 'gram', 'grams'].includes(unit)) return { base: qty, type: 'weight' };

                                    // Volume -> ml
                                    if (['l', 'ltr', 'litre', 'liter'].includes(unit)) return { base: qty * 1000, type: 'volume' };
                                    if (unit === 'ml') return { base: qty, type: 'volume' };

                                    // Count
                                    if (['dozen', 'pack', 'pcs', 'pieces'].includes(unit)) return { base: qty, type: 'count' };

                                    return null;
                                };

                                // PRIORITY 1: If variant is selected, use variant data
                                if (selectedVariant) {
                                    const variantName = selectedVariant.variant_name || '';
                                    const variantUnit = (selectedVariant.variant_unit || '').toLowerCase();
                                    const variantValue = selectedVariant.variant_value || 0;

                                    // Try parsing variant_name first (e.g., "500g", "1kg")
                                    let parsed = parseQuantityUnit(variantName);

                                    // If variant_name is just a number (e.g., "250", "500"), combine with variant_unit
                                    if (!parsed && /^\d+\.?\d*$/.test(variantName.trim()) && variantUnit) {
                                        parsed = { qty: parseFloat(variantName.trim()), unit: variantUnit };
                                    }

                                    // If still no luck, use variant_value and variant_unit
                                    if (!parsed && variantValue > 0 && variantUnit) {
                                        parsed = { qty: variantValue, unit: variantUnit };
                                    }

                                    if (parsed) {
                                        const converted = convertToBase(parsed.qty, parsed.unit);
                                        if (converted) {
                                            quantityInBaseUnit = converted.base;
                                            unitType = converted.type;
                                        }
                                    }
                                }

                                // PRIORITY 2: If no variant or variant didn't work, try product.unit
                                if (!quantityInBaseUnit && product.unit) {
                                    const parsed = parseQuantityUnit(product.unit);
                                    if (parsed) {
                                        const converted = convertToBase(parsed.qty, parsed.unit);
                                        if (converted) {
                                            quantityInBaseUnit = converted.base;
                                            unitType = converted.type;
                                        }
                                    }
                                }

                                // Only show if we have valid data
                                if (!quantityInBaseUnit || quantityInBaseUnit <= 0 || !unitType) return null;

                                // Calculate and display
                                if (unitType === 'weight') {
                                    const pricePer100g = (price / quantityInBaseUnit) * 100;
                                    return (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            ₹{pricePer100g.toFixed(2)} per 100g
                                        </p>
                                    );
                                }

                                if (unitType === 'volume') {
                                    const pricePer100ml = (price / quantityInBaseUnit) * 100;
                                    return (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            ₹{pricePer100ml.toFixed(2)} per 100ml
                                        </p>
                                    );
                                }

                                if (unitType === 'count' && quantityInBaseUnit > 1) {
                                    const pricePerPiece = price / quantityInBaseUnit;
                                    return (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            ₹{pricePerPiece.toFixed(2)} per piece
                                        </p>
                                    );
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
                                <ProductCard
                                    key={relProduct.id}
                                    product={{
                                        ...relProduct,
                                        image_url: relProduct.image_url || null,
                                        unit: relProduct.unit || 'unit',
                                        mrp: relProduct.mrp ?? null,
                                        default_variant: null
                                    }}
                                    onAddToCart={(productId) => contextAddToCart(productId, null)}
                                    cartQuantity={getItemQuantity(relProduct.id, null)}
                                    onQuantityChange={(id, qty) => updateQuantity(id, null, qty)}
                                    compact={true}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Address Dialog for Buy Now & Address Update */}
            <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-primary" />
                            {dialogMode === 'buynow' ? 'Confirm Order' : 'Delivery Address'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {dialogMode === 'buynow' && (
                            <div className="p-3 bg-muted/50 rounded-lg">
                                <p className="text-sm font-medium">{product?.name}</p>
                                <p className="text-xs text-muted-foreground">Qty: {quantity} × ₹{product?.price} = ₹{(quantity * (product?.price || 0)).toFixed(0)}</p>
                            </div>
                        )}
                        <RadioGroup value={addressOption} onValueChange={(v) => setAddressOption(v as 'saved' | 'new')}>
                            {savedAddress && (
                                <div className="flex items-start gap-2 p-3 border rounded-lg">
                                    <RadioGroupItem value="saved" id="saved" className="mt-1" />
                                    <Label htmlFor="saved" className="flex-1 cursor-pointer">
                                        <p className="text-sm font-medium">Saved Address</p>
                                        <p className="text-xs text-muted-foreground mt-1 text-wrap break-words">{savedAddress}</p>
                                    </Label>
                                </div>
                            )}
                            <div className="flex items-start gap-2 p-3 border rounded-lg">
                                <RadioGroupItem value="new" id="new" className="mt-1" />
                                <div className="flex-1">
                                    <Label htmlFor="new" className="cursor-pointer font-medium">New Address</Label>
                                    {addressOption === 'new' && (
                                        <div className="space-y-3 mt-3">
                                            <div>
                                                <Label className="text-xs">Apartment Complex</Label>
                                                <select
                                                    value={selectedApartment}
                                                    onChange={(e) => setSelectedApartment(e.target.value)}
                                                    className="w-full mt-1.5 p-2.5 border rounded-md bg-background text-sm"
                                                >
                                                    <option value="">Select your apartment...</option>
                                                    <option value="VBHC Vaibhava">VBHC Vaibhava</option>
                                                    <option value="Symphony">Symphony</option>
                                                    <option value="Other">Other (Enter manually)</option>
                                                </select>
                                                {selectedApartment && selectedApartment !== 'Other' && (
                                                    <p className="text-[10px] text-muted-foreground mt-1">
                                                        📍 {selectedApartment}, Chandapura-Anekal Road, Bangalore - 562106
                                                    </p>
                                                )}
                                            </div>

                                            {selectedApartment === 'Other' ? (
                                                <Textarea
                                                    placeholder="Enter full address"
                                                    value={newAddress}
                                                    onChange={(e) => setNewAddress(e.target.value)}
                                                    className="min-h-[80px]"
                                                />
                                            ) : (
                                                <>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <Label className="text-xs">Block/Tower</Label>
                                                            <Input
                                                                placeholder="e.g. 51"
                                                                value={blockNumber}
                                                                onChange={(e) => setBlockNumber(e.target.value)}
                                                                className="mt-1 h-9"
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label className="text-xs">Room No.</Label>
                                                            <Input
                                                                placeholder="e.g. 603"
                                                                value={roomNumber}
                                                                onChange={(e) => setRoomNumber(e.target.value)}
                                                                className="mt-1 h-9"
                                                            />
                                                        </div>
                                                    </div>
                                                    {/* Preview */}
                                                    {(selectedApartment && (blockNumber || roomNumber)) && (
                                                        <div className="p-2 bg-muted/50 rounded-lg text-xs">
                                                            <p className="font-medium">Delivery to:</p>
                                                            <p className="text-muted-foreground">
                                                                {blockNumber && `Block ${blockNumber}`}{roomNumber && `, Room ${roomNumber}`}
                                                                <br />
                                                                {selectedApartment}, Chandapura-Anekal Road...
                                                            </p>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </RadioGroup>
                    </div>
                    <DialogFooter>
                        <Button onClick={dialogMode === 'buynow' ? confirmOrder : saveAddressOnly} className="w-full h-12">
                            {dialogMode === 'buynow' ? (
                                <><Zap className="h-4 w-4 mr-2" /> Confirm Order • ₹{(quantity * (product?.price || 0)).toFixed(0)}</>
                            ) : (
                                "Save Address"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <BottomNav />
        </div>
    );
}
