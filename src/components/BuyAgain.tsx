import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Heart, Package, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatVariantDisplay } from '@/lib/formatUnit';

interface ProductVariant {
    id: string;
    variant_name: string;
    variant_value: number;
    variant_unit: string;
    price: number;
    mrp: number | null;
    is_default: boolean | null;
}

interface BuyAgainProduct {
    id: string;
    name: string;
    price: number;
    mrp: number | null;
    image_url: string | null;
    unit: string;
    default_variant?: ProductVariant | null;
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
            const { data: userOrders } = await supabase
                .from('orders')
                .select('id')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (!userOrders || userOrders.length === 0) {
                setLoading(false);
                return;
            }

            const orderIds = userOrders.map(o => o.id);

            const { data: orderItems } = await supabase
                .from('order_items')
                .select('product_id')
                .in('order_id', orderIds);

            if (!orderItems || orderItems.length === 0) {
                setLoading(false);
                return;
            }

            const productIds = [...new Set(orderItems.map(item => item.product_id))];

            const { data: productsData } = await supabase
                .from('products')
                .select(`
                    id, name, price, mrp, image_url, unit,
                    product_variants!left(id, variant_name, variant_value, variant_unit, price, mrp, is_default)
                `)
                .in('id', productIds.slice(0, 10))
                .eq('is_active', true);

            if (productsData) {
                const processedProducts = productsData.map((product: any) => {
                    const variants = product.product_variants || [];
                    const defaultVariant = variants.find((v: any) => v.is_default) || variants[0] || null;
                    return { ...product, default_variant: defaultVariant };
                });
                setProducts(processedProducts as BuyAgainProduct[]);
            }
        } catch (error) {
            console.error('BuyAgain fetch error:', error);
        }
        setLoading(false);
    };

    if (loading || !user || products.length === 0) return null;

    return (
        <div className="py-4">
            {/* Header */}
            <div className="flex items-center justify-between px-4 mb-3">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                    Buy Again
                </h2>
                <button
                    onClick={() => navigate('/orders')}
                    className="text-primary text-sm font-medium flex items-center gap-1 hover:underline"
                >
                    View Orders <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {/* Horizontal Scroll Cards - Smaller Design */}
            <div
                className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide"
                style={{ scrollbarWidth: 'none' }}
            >
                {products.map((product) => {
                    const variant = product.default_variant;
                    const displayPrice = variant?.price ?? product.price;
                    const displayMrp = variant?.mrp ?? product.mrp;
                    const discount = displayMrp && displayMrp > displayPrice
                        ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100)
                        : 0;

                    return (
                        <Card
                            key={product.id}
                            className="min-w-[110px] max-w-[110px] overflow-hidden border shadow-sm hover:shadow-md transition-shadow cursor-pointer flex-shrink-0 bg-card"
                            onClick={() => navigate(`/product/${product.id}`)}
                        >
                            {/* Image */}
                            <div className="relative h-20 bg-muted">
                                {product.image_url ? (
                                    <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Package className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                )}
                                {/* Discount Badge */}
                                {discount > 0 && (
                                    <div className="absolute top-1 left-1 bg-green-500 text-white text-[8px] font-bold px-1 py-0.5 rounded">
                                        {discount}%
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <CardContent className="p-1.5">
                                {/* Name */}
                                <p className="text-[10px] font-medium line-clamp-1 mb-0.5">
                                    {product.name}
                                </p>

                                {/* Price and Add */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-bold text-primary">₹{displayPrice}</span>
                                        {displayMrp && displayMrp > displayPrice && (
                                            <span className="text-[8px] line-through text-muted-foreground ml-1">₹{displayMrp}</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onAddToCart(product.id);
                                        }}
                                        className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shadow hover:bg-primary/90"
                                    >
                                        <Plus className="h-3 w-3" />
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
