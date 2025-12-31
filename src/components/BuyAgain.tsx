import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
            // Get user's orders first
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

            // Fetch product details with default variants for proper pricing
            const { data: productsData } = await supabase
                .from('products')
                .select(`
                    id, name, price, mrp, image_url, unit,
                    product_variants!left(id, variant_name, variant_value, variant_unit, price, mrp, is_default)
                `)
                .in('id', productIds.slice(0, 10))
                .eq('is_active', true);

            if (productsData) {
                // Process to add default_variant
                const processedProducts = productsData.map((product: any) => {
                    const variants = product.product_variants || [];
                    const defaultVariant = variants.find((v: any) => v.is_default) || variants[0] || null;
                    return {
                        ...product,
                        default_variant: defaultVariant
                    };
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
        <div className="container mx-auto px-4 py-6">
            {/* Header with See All */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                    Buy Again
                </h2>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary hover:text-primary/80"
                    onClick={() => navigate('/orders')}
                >
                    View Orders <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            </div>

            {/* Product Cards - matching Shop.tsx style */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {products.map((product) => {
                    // Use variant pricing if available
                    const variant = product.default_variant;
                    const displayPrice = variant?.price ?? product.price;
                    const displayMrp = variant?.mrp ?? product.mrp;
                    const discount = displayMrp && displayMrp > displayPrice
                        ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100)
                        : 0;

                    return (
                        <Card
                            key={product.id}
                            className="overflow-hidden rounded-2xl border-2 border-border/40 hover:border-primary/40 hover:shadow-xl transition-all cursor-pointer bg-card/90"
                            onClick={() => navigate(`/product/${product.id}`)}
                        >
                            {/* Discount Badge */}
                            {discount > 0 && (
                                <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold shadow-lg">
                                    {discount}% OFF
                                </div>
                            )}

                            <CardContent className="p-0">
                                {/* Image */}
                                <div className="aspect-square bg-muted flex items-center justify-center">
                                    {product.image_url ? (
                                        <img
                                            src={product.image_url}
                                            alt={product.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <Package className="h-12 w-12 text-muted-foreground" />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-3">
                                    <h3 className="font-medium text-sm line-clamp-2 mb-1">
                                        {product.name}
                                    </h3>

                                    {/* Variant display */}
                                    {variant && (
                                        <span className="text-[10px] text-muted-foreground block mb-1">
                                            {formatVariantDisplay(variant)}
                                        </span>
                                    )}

                                    {/* Price and MRP */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            {displayMrp && displayMrp > displayPrice ? (
                                                <>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-bold text-base text-primary">₹{displayPrice}</span>
                                                        <span className="text-xs text-muted-foreground line-through">₹{displayMrp}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <span className="font-bold text-base text-primary">₹{displayPrice}</span>
                                            )}
                                            <span className="text-[10px] text-muted-foreground block">
                                                /{variant ? formatVariantDisplay(variant) : product.unit}
                                            </span>
                                        </div>

                                        {/* Add Button */}
                                        <Button
                                            size="sm"
                                            className="h-8 px-3 rounded-lg shadow-md"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onAddToCart(product.id);
                                            }}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
