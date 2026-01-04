import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { ArrowLeft, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ProductCard from '@/components/ProductCard';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';

interface FlashDeal {
    id: string;
    name: string;
    title: string;
    badge_text: string | null;
    badge_color: string | null;
    start_time: string;
    end_time: string;
    background_color: string;
    text_color: string;
    timer_bg_color: string;
    timer_text_color: string;
    filter_type: string;
    filter_config: Record<string, any>;
    max_products: number;
}

interface Product {
    id: string;
    name: string;
    price: number;
    mrp: number | null;
    image_url: string | null;
    unit: string | null;
    discount_percent: number | null;
    default_variant?: {
        price: number;
        mrp: number | null;
        variant_name: string;
        variant_value: number;
        variant_unit: string | null;
    } | null;
}

export default function FlashDealsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { refreshCart } = useCart();

    const [deal, setDeal] = useState<FlashDeal | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0 });

    useEffect(() => {
        if (id) fetchDeal();
    }, [id]);

    useEffect(() => {
        if (!deal) return;

        const interval = setInterval(() => {
            const endTime = new Date(deal.end_time).getTime();
            const now = Date.now();
            const diff = endTime - now;

            if (diff > 0) {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setCountdown({ h: hours, m: minutes, s: seconds });
            } else {
                setCountdown({ h: 0, m: 0, s: 0 });
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [deal]);

    const fetchDeal = async () => {
        try {
            const { data: dealData } = await supabase
                .from('flash_deals')
                .select('*')
                .eq('id', id)
                .single();

            if (dealData) {
                setDeal(dealData);
                await fetchProducts(dealData);
            }
        } catch (error) {
            logger.error('Failed to fetch flash deal', { error });
        }
        setLoading(false);
    };

    const fetchProducts = async (dealData: FlashDeal) => {
        try {
            let query = supabase
                .from('products')
                .select('id, name, price, mrp, image_url, unit, discount_percent, product_variants!left(price, mrp, variant_name, variant_value, variant_unit, is_default)')
                .eq('is_active', true);

            switch (dealData.filter_type) {
                case 'discount': {
                    const minDiscount = dealData.filter_config?.min_discount || 0;
                    query = query.gte('discount_percent', minDiscount);
                    break;
                }
                case 'category': {
                    const categoryIds = dealData.filter_config?.category_ids || [];
                    if (categoryIds.length > 0) {
                        query = query.in('category_id', categoryIds);
                    }
                    break;
                }
                case 'manual': {
                    const productIds = dealData.filter_config?.product_ids || [];
                    if (productIds.length > 0) {
                        query = query.in('id', productIds);
                    }
                    break;
                }
            }

            const { data } = await query.order('discount_percent', { ascending: false });

            if (data) {
                const processed = data.map(p => ({
                    ...p,
                    default_variant: p.product_variants?.find(v => v.is_default) || p.product_variants?.[0] || null
                }));
                setProducts(processed);
            }
        } catch (error) {
            logger.error('Failed to fetch flash deal products', { error });
        }
    };

    const handleAddToCart = async (productId: string) => {
        if (!user) {
            navigate('/auth');
            return;
        }

        try {
            const { data: existing } = await supabase
                .from('cart_items')
                .select('id, quantity')
                .eq('user_id', user.id)
                .eq('product_id', productId)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from('cart_items')
                    .update({ quantity: existing.quantity + 1 })
                    .eq('id', existing.id);
            } else {
                await supabase
                    .from('cart_items')
                    .insert({ user_id: user.id, product_id: productId, quantity: 1 });
            }

            refreshCart();
            toast.success('Added to cart');
        } catch (error) {
            toast.error('Failed to add to cart');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background pb-20">
                <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
                    <div className="container mx-auto px-4 py-4">
                        <Skeleton className="h-8 w-40" />
                    </div>
                </header>
                <div className="container mx-auto px-4 py-6">
                    <Skeleton className="h-32 rounded-2xl mb-6" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
                    </div>
                </div>
            </div>
        );
    }

    if (!deal) {
        return (
            <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
                <div className="text-center">
                    <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Deal not found or expired</p>
                    <Button onClick={() => navigate('/shop')} className="mt-4">
                        Go to Shop
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
                <div className="container mx-auto px-4 py-4 flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-lg font-bold">Flash Deals</h1>
                </div>
            </header>

            <div
                className="mx-4 mt-4 rounded-2xl p-6"
                style={{ backgroundColor: deal.background_color, color: deal.text_color }}
            >
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <Zap className="h-8 w-8 fill-current" />
                        <div>
                            <h2 className="text-2xl font-bold">{deal.title}</h2>
                            {deal.badge_text && (
                                <span
                                    className="inline-block mt-1 text-sm px-3 py-1 rounded-full font-semibold"
                                    style={{ backgroundColor: deal.badge_color, color: '#ffffff' }}
                                >
                                    {deal.badge_text}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm opacity-80">Ends in</span>
                        <div className="flex gap-1">
                            <span
                                className="px-3 py-2 rounded font-mono font-bold text-lg"
                                style={{ backgroundColor: deal.timer_bg_color, color: deal.timer_text_color }}
                            >
                                {String(countdown.h).padStart(2, '0')}
                            </span>
                            <span className="font-bold text-lg">:</span>
                            <span
                                className="px-3 py-2 rounded font-mono font-bold text-lg"
                                style={{ backgroundColor: deal.timer_bg_color, color: deal.timer_text_color }}
                            >
                                {String(countdown.m).padStart(2, '0')}
                            </span>
                            <span className="font-bold text-lg">:</span>
                            <span
                                className="px-3 py-2 rounded font-mono font-bold text-lg"
                                style={{ backgroundColor: deal.timer_bg_color, color: deal.timer_text_color }}
                            >
                                {String(countdown.s).padStart(2, '0')}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-6">
                <p className="text-muted-foreground mb-4">{products.length} products available</p>

                {products.length === 0 ? (
                    <div className="text-center py-12">
                        <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">No products in this deal</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {products.map(product => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                onAddToCart={handleAddToCart}
                            />
                        ))}
                    </div>
                )}
            </div>

            <BottomNav />
        </div>
    );
}
