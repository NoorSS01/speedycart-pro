import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Package,
    Plus,
    Minus,
    ShoppingCart,
    Zap,
    Share2
} from 'lucide-react';
import BottomNav from '@/components/BottomNav';

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

export default function ProductDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [product, setProduct] = useState<Product | null>(null);
    const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);
    const [addingToCart, setAddingToCart] = useState(false);

    useEffect(() => {
        if (id) {
            fetchProduct();
        }
    }, [id]);

    const fetchProduct = async () => {
        if (!id) return;

        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (!error && data) {
            setProduct(data);
            // Fetch related products from same category
            if (data.category_id) {
                fetchRelatedProducts(data.category_id, data.id);
            }
        }
        setLoading(false);
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

    const addToCart = async () => {
        if (!user || !product) {
            toast.error('Please sign in to add items to cart');
            navigate('/auth');
            return;
        }

        if (quantity > product.stock_quantity) {
            toast.error(`Only ${product.stock_quantity} available`);
            return;
        }

        setAddingToCart(true);

        // Check if item already in cart
        const { data: existingItem } = await supabase
            .from('cart_items')
            .select('*')
            .eq('user_id', user.id)
            .eq('product_id', product.id)
            .single();

        if (existingItem) {
            const newQty = existingItem.quantity + quantity;
            if (newQty > product.stock_quantity) {
                toast.error(`Only ${product.stock_quantity} available (${existingItem.quantity} already in cart)`);
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

        toast.success(`Added ${quantity} ${product.name} to cart`);
        setAddingToCart(false);
    };

    const buyNow = async () => {
        await addToCart();
        // Navigate to shop and open cart
        navigate('/shop');
        setTimeout(() => window.dispatchEvent(new Event('openCart')), 100);
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
                // User cancelled share
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Package className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-4">
                <Package className="h-16 w-16 text-muted-foreground" />
                <p className="text-muted-foreground text-center">Product not found</p>
                <Button onClick={() => navigate('/shop')}>Back to Shop</Button>
            </div>
        );
    }

    const isOutOfStock = product.stock_quantity <= 0;
    const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 5;

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
                    <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-24 w-24 text-muted-foreground" />
                    </div>
                )}
                {isLowStock && (
                    <Badge className="absolute top-4 right-4 bg-red-500 text-white">
                        Only {product.stock_quantity} left!
                    </Badge>
                )}
                {isOutOfStock && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Badge variant="destructive" className="text-lg px-4 py-2">Out of Stock</Badge>
                    </div>
                )}
            </div>

            {/* Product Info */}
            <div className="container mx-auto px-4 py-4">
                <div className="space-y-3">
                    <h1 className="text-2xl font-bold">{product.name}</h1>

                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-primary">₹{product.price}</span>
                        <span className="text-muted-foreground">/ {product.unit}</span>
                    </div>

                    {product.description && (
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            {product.description}
                        </p>
                    )}

                    {/* Quantity Selector */}
                    {!isOutOfStock && (
                        <div className="flex items-center gap-3 py-2">
                            <span className="text-sm text-muted-foreground">Qty:</span>
                            <div className="flex items-center gap-2 bg-muted rounded-full p-1">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-full"
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                >
                                    <Minus className="h-4 w-4" />
                                </Button>
                                <span className="w-8 text-center font-semibold">{quantity}</span>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-full"
                                    onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                            {isLowStock && (
                                <span className="text-xs text-red-500">Only {product.stock_quantity} left</span>
                            )}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="outline"
                            className="flex-1 h-12"
                            onClick={addToCart}
                            disabled={isOutOfStock || addingToCart}
                        >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Add to Cart
                        </Button>
                        <Button
                            className="flex-1 h-12"
                            onClick={buyNow}
                            disabled={isOutOfStock || addingToCart}
                        >
                            <Zap className="h-4 w-4 mr-2" />
                            Buy Now
                        </Button>
                    </div>
                </div>
            </div>

            {/* Related Products */}
            {relatedProducts.length > 0 && (
                <div className="container mx-auto px-4 py-6">
                    <h2 className="text-lg font-semibold mb-4">You might also like</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {relatedProducts.map(relProduct => (
                            <Card
                                key={relProduct.id}
                                className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => navigate(`/product/${relProduct.id}`)}
                            >
                                <CardContent className="p-0">
                                    <div className="aspect-square bg-muted">
                                        {relProduct.image_url ? (
                                            <img
                                                src={relProduct.image_url}
                                                alt={relProduct.name}
                                                className="w-full h-full object-cover"
                                            />
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

            <BottomNav />
        </div>
    );
}
