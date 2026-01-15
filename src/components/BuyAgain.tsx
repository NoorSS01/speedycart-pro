import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Heart, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ProductCard from '@/components/ProductCard';

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
    discount_percent?: number | null;
    default_variant?: ProductVariant | null;
}

interface BuyAgainProps {
    onAddToCart: (productId: string) => void;
}

export default function BuyAgain({ onAddToCart }: BuyAgainProps) {
    const { user } = useAuth();
    const { getItemQuantity, updateQuantity } = useCart();
    const navigate = useNavigate();
    const [products, setProducts] = useState<BuyAgainProduct[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchBuyAgainProducts = useCallback(async () => {
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
                    id, name, price, mrp, image_url, unit, discount_percent,
                    product_variants!left(id, variant_name, variant_value, variant_unit, price, mrp, is_default)
                `)
                .in('id', productIds.slice(0, 10))
                .eq('is_active', true);

            if (productsData) {
                const processedProducts = productsData.map(product => {
                    const variants = product.product_variants || [];
                    const defaultVariant = variants.find(v => v.is_default) || variants[0] || null;
                    return { ...product, default_variant: defaultVariant };
                });
                setProducts(processedProducts as BuyAgainProduct[]);
            }
        } catch (error) {
            logger.error('BuyAgain fetch error', { error });
        }
        setLoading(false);
    }, [user]);

    useEffect(() => {
        if (user) {
            fetchBuyAgainProducts();
        } else {
            setLoading(false);
        }
    }, [user, fetchBuyAgainProducts]);

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

            {/* Horizontal Scroll Cards */}
            <div
                className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide"
                style={{ scrollbarWidth: 'none' }}
            >
                {products.map((product) => (
                    <div key={product.id} className="flex-shrink-0 w-[150px]">
                        <ProductCard
                            product={product}
                            onAddToCart={onAddToCart}
                            cartQuantity={getItemQuantity(product.id, null)}
                            onQuantityChange={(id, qty) => updateQuantity(id, null, qty)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
