import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, Plus, Package, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatVariantDisplay } from '@/lib/formatUnit';

interface FlashDeal {
    id: string;
    name: string;
    title: string;
    badge_text: string | null;
    badge_color: string;
    start_time: string;
    end_time: string;
    background_color: string;
    text_color: string;
    timer_bg_color: string;
    timer_text_color: string;
    filter_type: string;
    filter_config: Record<string, any>;
    max_products: number;
    show_see_all: boolean;
}

interface Product {
    id: string;
    name: string;
    price: number;
    mrp: number | null;
    image_url: string | null;
    unit: string;
    discount_percent: number | null;
    default_variant?: {
        price: number;
        mrp: number | null;
        variant_name: string;
        variant_value: number;
        variant_unit: string;
    } | null;
}

interface FlashDealsProps {
    onAddToCart: (productId: string) => void;
}

export default function FlashDeals({ onAddToCart }: FlashDealsProps) {
    const navigate = useNavigate();
    const [deals, setDeals] = useState<FlashDeal[]>([]);
    const [products, setProducts] = useState<Record<string, Product[]>>({});
    const [countdowns, setCountdowns] = useState<Record<string, { h: number; m: number; s: number }>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDeals();
    }, []);

    // Countdown timer
    useEffect(() => {
        const interval = setInterval(() => {
            const newCountdowns: Record<string, { h: number; m: number; s: number }> = {};

            deals.forEach(deal => {
                const endTime = new Date(deal.end_time).getTime();
                const now = Date.now();
                const diff = endTime - now;

                if (diff > 0) {
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                    newCountdowns[deal.id] = { h: hours, m: minutes, s: seconds };
                } else {
                    newCountdowns[deal.id] = { h: 0, m: 0, s: 0 };
                }
            });

            setCountdowns(newCountdowns);
        }, 1000);

        return () => clearInterval(interval);
    }, [deals]);

    const fetchDeals = async () => {
        try {
            const { data } = await supabase
                .from('flash_deals' as any)
                .select('*')
                .eq('is_active', true)
                .lte('start_time', new Date().toISOString())
                .gte('end_time', new Date().toISOString())
                .order('display_order', { ascending: true });

            if (data) {
                const flashDeals = data as unknown as FlashDeal[];
                setDeals(flashDeals);

                // Fetch products for each deal
                const productsMap: Record<string, Product[]> = {};
                for (const deal of flashDeals) {
                    const prods = await fetchDealProducts(deal);
                    productsMap[deal.id] = prods;
                }
                setProducts(productsMap);
            }
        } catch (error) {
            console.log('Flash deals not available:', error);
        }
        setLoading(false);
    };

    const fetchDealProducts = async (deal: FlashDeal): Promise<Product[]> => {
        try {
            let query = supabase
                .from('products')
                .select(`
                    id, name, price, mrp, image_url, unit, discount_percent,
                    product_variants!left(price, mrp, variant_name, variant_value, variant_unit, is_default)
                `)
                .eq('is_active', true);

            switch (deal.filter_type) {
                case 'discount':
                    const minDiscount = deal.filter_config?.min_discount || 0;
                    query = query.gte('discount_percent', minDiscount);
                    break;
                case 'category':
                    const categoryIds = deal.filter_config?.category_ids || [];
                    if (categoryIds.length > 0) {
                        query = query.in('category_id', categoryIds);
                    }
                    break;
                case 'manual':
                    const productIds = deal.filter_config?.product_ids || [];
                    if (productIds.length > 0) {
                        query = query.in('id', productIds);
                    }
                    break;
            }

            const { data } = await query.limit(deal.max_products).order('discount_percent', { ascending: false });

            if (data) {
                return data.map((p: any) => ({
                    ...p,
                    default_variant: p.product_variants?.find((v: any) => v.is_default) || p.product_variants?.[0] || null
                }));
            }
        } catch (error) {
            console.error('Error fetching deal products:', error);
        }
        return [];
    };

    if (loading || deals.length === 0) return null;

    return (
        <div className="space-y-6">
            {deals.map(deal => {
                const dealProducts = products[deal.id] || [];
                const countdown = countdowns[deal.id] || { h: 0, m: 0, s: 0 };

                if (dealProducts.length === 0) return null;

                return (
                    <div key={deal.id} className="mx-4">
                        {/* Header */}
                        <div
                            className="rounded-t-2xl p-4"
                            style={{ backgroundColor: deal.background_color, color: deal.text_color }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Zap className="h-5 w-5 fill-current" />
                                    <span className="font-bold text-lg">{deal.title}</span>
                                    {deal.badge_text && (
                                        <span
                                            className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                            style={{ backgroundColor: deal.badge_color, color: '#ffffff' }}
                                        >
                                            {deal.badge_text}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Countdown Timer */}
                            <div className="flex items-center gap-2 text-sm">
                                <span>Offer ends at</span>
                                <div className="flex gap-1">
                                    <span
                                        className="px-2 py-1 rounded font-mono font-bold text-sm"
                                        style={{ backgroundColor: deal.timer_bg_color, color: deal.timer_text_color }}
                                    >
                                        {String(countdown.h).padStart(2, '0')}
                                    </span>
                                    <span className="font-bold">:</span>
                                    <span
                                        className="px-2 py-1 rounded font-mono font-bold text-sm"
                                        style={{ backgroundColor: deal.timer_bg_color, color: deal.timer_text_color }}
                                    >
                                        {String(countdown.m).padStart(2, '0')}
                                    </span>
                                    <span className="font-bold">:</span>
                                    <span
                                        className="px-2 py-1 rounded font-mono font-bold text-sm"
                                        style={{ backgroundColor: deal.timer_bg_color, color: deal.timer_text_color }}
                                    >
                                        {String(countdown.s).padStart(2, '0')}
                                    </span>
                                </div>
                                <span className="text-xs opacity-70">HH : MM : SS</span>
                            </div>
                        </div>

                        {/* Products */}
                        <div className="bg-background rounded-b-2xl border border-t-0 p-3">
                            <div
                                className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
                                style={{ scrollbarWidth: 'none' }}
                            >
                                {dealProducts.map((product) => {
                                    const variant = product.default_variant;
                                    const displayPrice = variant?.price ?? product.price;
                                    const displayMrp = variant?.mrp ?? product.mrp;
                                    const discount = displayMrp && displayMrp > displayPrice
                                        ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100)
                                        : product.discount_percent || 0;

                                    return (
                                        <Card
                                            key={product.id}
                                            className="min-w-[130px] max-w-[130px] overflow-hidden border shadow-sm hover:shadow-md transition-shadow cursor-pointer flex-shrink-0"
                                            onClick={() => navigate(`/product/${product.id}`)}
                                        >
                                            <div className="relative aspect-square bg-muted">
                                                {product.image_url ? (
                                                    <img
                                                        src={product.image_url}
                                                        alt={product.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Package className="h-8 w-8 text-muted-foreground" />
                                                    </div>
                                                )}
                                                {/* Add Button */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onAddToCart(product.id);
                                                    }}
                                                    className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:bg-primary/90"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <CardContent className="p-2">
                                                <div className="flex items-center gap-1 mb-1">
                                                    <span className="font-bold text-primary text-sm">₹{displayPrice}</span>
                                                    {displayMrp && displayMrp > displayPrice && (
                                                        <span className="text-[10px] line-through text-muted-foreground">₹{displayMrp}</span>
                                                    )}
                                                </div>
                                                {discount > 0 && (
                                                    <span className="text-[10px] text-green-600 font-semibold">
                                                        ₹{(displayMrp || 0) - displayPrice} OFF
                                                    </span>
                                                )}
                                                <p className="text-xs font-medium line-clamp-2 mt-1">{product.name}</p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {variant ? formatVariantDisplay(variant) : product.unit}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>

                            {/* See All */}
                            {deal.show_see_all && (
                                <button
                                    onClick={() => navigate(`/shop?flash=${deal.id}`)}
                                    className="w-full text-center text-primary font-semibold text-sm py-2 mt-2 flex items-center justify-center gap-1 hover:underline"
                                >
                                    See all <ChevronRight className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
