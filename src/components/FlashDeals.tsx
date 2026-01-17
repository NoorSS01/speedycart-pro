import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { logger } from '@/lib/logger';
import { ChevronRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ProductCard from '@/components/ProductCard';
import HorizontalScrollContainer from '@/components/HorizontalScrollContainer';

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
    show_see_all: boolean;
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

interface FlashDealsProps {
    onAddToCart: (productId: string) => void;
}

export default function FlashDeals({ onAddToCart }: FlashDealsProps) {
    const navigate = useNavigate();
    const { getItemQuantity, updateQuantity } = useCart();
    const [deals, setDeals] = useState<FlashDeal[]>([]);
    const [products, setProducts] = useState<Record<string, Product[]>>({});
    const [countdowns, setCountdowns] = useState<Record<string, { h: number; m: number; s: number }>>({});
    const [loading, setLoading] = useState(true);

    const fetchDealProducts = useCallback(async (deal: FlashDeal): Promise<Product[]> => {
        try {
            let query = supabase
                .from('products')
                .select(`
                    id, name, price, mrp, image_url, unit, discount_percent,
                    product_variants!left(price, mrp, variant_name, variant_value, variant_unit, is_default)
                `)
                .eq('is_active', true);

            switch (deal.filter_type) {
                case 'discount': {
                    const minDiscount = deal.filter_config?.min_discount || 0;
                    query = query.gte('discount_percent', minDiscount);
                    break;
                }
                case 'category': {
                    const categoryIds = deal.filter_config?.category_ids || [];
                    if (categoryIds.length > 0) {
                        query = query.in('category_id', categoryIds);
                    }
                    break;
                }
                case 'manual': {
                    const productIds = deal.filter_config?.product_ids || [];
                    if (productIds.length > 0) {
                        query = query.in('id', productIds);
                    }
                    break;
                }
            }

            const { data } = await query.limit(deal.max_products).order('discount_percent', { ascending: false });

            if (data) {
                return data.map(p => ({
                    ...p,
                    default_variant: p.product_variants?.find(v => v.is_default) || p.product_variants?.[0] || null
                })) as unknown as Product[];
            }
        } catch (error) {
            logger.error('Error fetching deal products', { error });
        }
        return [];
    }, []);

    const fetchDeals = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('flash_deals')
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
            logger.debug('Flash deals not available');
        }
        setLoading(false);
    }, [fetchDealProducts]);

    useEffect(() => {
        fetchDeals();
    }, [fetchDeals]);

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
                                            style={{ backgroundColor: deal.badge_color || undefined, color: '#ffffff' }}
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
                            <HorizontalScrollContainer className="gap-3 pb-2">
                                {dealProducts.map((product) => (
                                    <div key={product.id} className="flex-shrink-0 w-[calc((100vw-48px)/3)] min-w-[100px] max-w-[120px]">
                                        <ProductCard
                                            product={product}
                                            onAddToCart={onAddToCart}
                                            cartQuantity={getItemQuantity(product.id, null)}
                                            onQuantityChange={(id, qty) => updateQuantity(id, null, qty)}
                                        />
                                    </div>
                                ))}
                            </HorizontalScrollContainer>

                            {/* See All */}
                            {deal.show_see_all && (
                                <button
                                    onClick={() => navigate(`/flash-deals/${deal.id}`)}
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
