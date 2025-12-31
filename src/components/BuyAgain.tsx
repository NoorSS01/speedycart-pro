import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatVariantDisplay } from '@/lib/formatUnit';

interface BuyAgainProduct {
    id: string;
    name: string;
    price: number;
    mrp: number | null;
    image_url: string | null;
    unit: string;
    variant_name?: string;
    variant_value?: number;
    variant_unit?: string;
}

interface BuyAgainProps {
    onAddToCart: (productId: string) => void;
}

export default function BuyAgain({ onAddToCart }: BuyAgainProps) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [products, setProducts] = useState<BuyAgainProduct[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchBuyAgainProducts();
        } else {
            setLoading(false);
        }
    }, [user]);

    const fetchBuyAgainProducts = async () => {
        if (!user) return;

        try {
            // Get user's orders first
            const { data: userOrders } = await supabase
                .from('orders')
                .select('id')
                .eq('user_id', user.id)
                .limit(10);

            if (!userOrders || userOrders.length === 0) {
                setLoading(false);
                return;
            }

            const orderIds = userOrders.map(o => o.id);

            // Get order items for those orders
            const { data: orderItems } = await supabase
                .from('order_items')
                .select('product_id')
                .in('order_id', orderIds);

            if (!orderItems || orderItems.length === 0) {
                setLoading(false);
                return;
            }

            // Get unique product IDs
            const productIds = [...new Set(orderItems.map(item => item.product_id))];

            // Fetch product details
            const { data: productsData } = await supabase
                .from('products')
                .select('id, name, price, mrp, image_url, unit')
                .in('id', productIds.slice(0, 10))
                .eq('is_active', true);

            if (productsData) {
                setProducts(productsData as BuyAgainProduct[]);
            }
        } catch (error) {
            console.error('BuyAgain fetch error:', error);
            // Don't crash - just show nothing
        }
        setLoading(false);
    };

    if (loading || !user || products.length === 0) return null;

    return (
        <div className="py-4">
            <div className="flex items-center justify-between px-4 mb-3">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                    Buy Again
                </h2>
            </div>

            <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                {products.map((product) => {
                    const discount = product.mrp && product.mrp > product.price
                        ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
                        : 0;

                    return (
                        <Card
                            key={product.id}
                            className="min-w-[140px] max-w-[140px] overflow-hidden border-2 border-border/40 hover:border-primary/40 cursor-pointer"
                            onClick={() => navigate(`/product/${product.id}`)}
                        >
                            <div className="relative">
                                {product.image_url ? (
                                    <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-full h-24 object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-24 bg-muted flex items-center justify-center text-muted-foreground text-xs">
                                        No Image
                                    </div>
                                )}
                                {discount > 0 && (
                                    <div className="absolute top-1 left-1 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                        {discount}% OFF
                                    </div>
                                )}
                            </div>
                            <CardContent className="p-2">
                                <p className="text-xs font-medium truncate">{product.name}</p>
                                <div className="flex items-center gap-1 mt-1">
                                    <span className="text-sm font-bold text-primary">₹{product.price}</span>
                                    {product.mrp && product.mrp > product.price && (
                                        <span className="text-[10px] text-muted-foreground line-through">₹{product.mrp}</span>
                                    )}
                                </div>
                                <Button
                                    size="sm"
                                    className="w-full h-7 mt-2 text-xs"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAddToCart(product.id);
                                    }}
                                >
                                    <Plus className="h-3 w-3 mr-1" /> ADD
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
