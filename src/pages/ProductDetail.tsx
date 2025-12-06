import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
    User
} from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { Skeleton } from '@/components/ui/skeleton';

interface Product {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    stock_quantity: number;
    unit: string;
    category_id: string | null;
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

    useEffect(() => {
        if (id) {
            fetchProduct();
            fetchReviews();
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

        const { data: existingItem } = await supabase
            .from('cart_items')
            .select('*')
            .eq('user_id', user.id)
            .eq('product_id', product.id)
            .single();

        if (existingItem) {
            const newQty = existingItem.quantity + quantity;
            if (newQty > product.stock_quantity) {
                toast.error(`Only ${product.stock_quantity} available (${existingItem.quantity} in cart)`);
                setAddingToCart(false);
                return;
            }
            await supabase
                .from('cart_items')
                .update({ quantity: newQty })
                .eq('id', existingItem.id);
        } else {
            await supabase
                .from('cart_items')
                .insert({ user_id: user.id, product_id: product.id, quantity });
        }

        toast.success(`Added ${quantity} to cart`);
        setAddingToCart(false);
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
            price: product.price
        });

        // Update stock
        const newStock = Math.max(0, freshProduct.stock_quantity - quantity);
        await supabase.from('products').update({ stock_quantity: newStock }).eq('id', product.id);

        setShowAddressDialog(false);
        setNewAddress('');
        toast.success('🎉 Order placed successfully!');
        navigate('/orders');
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
                <BottomNav cartItemCount={0} />
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
            {/* Header */}
            <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleShare}>
                        <Share2 className="h-5 w-5" />
                    </Button>
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
                    <div className="flex items-center justify-between mt-1">
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-primary">₹{product.price}</span>
                            <span className="text-muted-foreground">/ {product.unit}</span>
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

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 h-12" onClick={addToCart} disabled={isOutOfStock || addingToCart}>
                        <ShoppingCart className="h-4 w-4 mr-2" />Add to Cart
                    </Button>
                    <Button className="flex-1 h-12" onClick={handleBuyNow} disabled={isOutOfStock || addingToCart}>
                        <Zap className="h-4 w-4 mr-2" />Buy Now
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

                {/* Related Products */}
                {relatedProducts.length > 0 && (
                    <div className="pt-2">
                        <h2 className="text-lg font-semibold mb-4">You might also like</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {relatedProducts.map(relProduct => (
                                <Card key={relProduct.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/product/${relProduct.id}`)}>
                                    <CardContent className="p-0">
                                        <div className="aspect-square bg-muted">
                                            {relProduct.image_url ? (
                                                <img src={relProduct.image_url} alt={relProduct.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Package className="h-8 w-8 text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-2">
                                            <p className="text-sm font-medium truncate">{relProduct.name}</p>
                                            <p className="text-sm font-bold text-primary">₹{relProduct.price}</p>
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
