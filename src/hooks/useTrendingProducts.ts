import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface ProductVariant {
    price: number;
    mrp: number | null;
    variant_name: string;
    variant_value: number;
    variant_unit: string | null;
    is_default?: boolean;
}

interface Product {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    category_id: string | null;
    stock_quantity: number;
    unit: string;
    discount_percent?: number | null;
    mrp?: number | null;
    default_variant?: ProductVariant | null;
}

interface TrendingProduct extends Product {
    trendScore?: number;
    orderCount?: number;
}

interface TrendingResult {
    products: TrendingProduct[];
    isLoading: boolean;
    error: string | null;
}

/**
 * Trending Products Hook
 * Shows products that are popular across all users in a time window.
 * 
 * Algorithm:
 * 1. Query delivered order items from last 7 days
 * 2. Apply time decay: exp(-days_ago / 7) to weight recent orders higher
 * 3. Hybrid scoring: 70% order count (reach) + 30% quantity (demand)
 * 4. Fallback to 30-day window if insufficient data
 * 5. Ultimate fallback to newest products
 * 
 * Design Decisions:
 * - 1 order × 10 quantity ≠ 10 orders × 1 quantity
 * - We weight order count higher because reach > volume for trending
 * - Only delivered orders count (ensures real purchases)
 * - Time decay prevents stale spikes from dominating
 * 
 * Performance:
 * - Results are cached for 5 minutes to reduce load
 * - Uses RPC function when available for optimized query
 */

// Cache for trending products (avoid excessive queries)
let cachedTrending: TrendingProduct[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useTrendingProducts(limit: number = 10): TrendingResult {
    const [products, setProducts] = useState<TrendingProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isMountedRef = useRef(true);

    const fetchTrending = useCallback(async () => {
        // Check cache first
        if (cachedTrending && Date.now() - cacheTimestamp < CACHE_DURATION) {
            setProducts(cachedTrending.slice(0, limit));
            setIsLoading(false);
            return;
        }

        setError(null);

        try {
            // Skip RPC - use client-side query to include product_variants
            // The RPC function doesn't return variant data needed for proper unit display

            // Calculate client-side with variants included
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            // Get delivered orders' items from last 7 days
            const { data: orderItems, error: itemsError } = await supabase
                .from('order_items')
                .select(`
                    product_id,
                    quantity,
                    created_at,
                    orders!inner(status)
                `)
                .gte('created_at', sevenDaysAgo.toISOString())
                .eq('orders.status', 'delivered');

            if (itemsError) {
                // Try without the orders join (simpler query)
                const { data: simpleItems } = await supabase
                    .from('order_items')
                    .select('product_id, quantity, created_at')
                    .gte('created_at', sevenDaysAgo.toISOString());

                if (!simpleItems || simpleItems.length === 0) {
                    // Try 30-day window as fallback
                    await fetchWithExtendedWindow();
                    return;
                }

                await processOrderItems(simpleItems);
                return;
            }

            if (!orderItems || orderItems.length < 5) {
                // Not enough data in 7 days, try 30-day window
                await fetchWithExtendedWindow();
                return;
            }

            await processOrderItems(orderItems);

        } catch (e) {
            logger.error('Trending products error', { error: e });
            if (isMountedRef.current) {
                setError('Failed to load trending products');
                setProducts([]);
                setIsLoading(false);
            }
        }
    }, [limit]);

    const processOrderItems = async (orderItems: any[]) => {
        // Calculate time-decay weighted scores
        const productScores = new Map<string, { orderCount: number; quantity: number; score: number }>();
        const now = Date.now();

        orderItems.forEach(item => {
            const itemDate = new Date(item.created_at).getTime();
            const daysAgo = (now - itemDate) / (1000 * 60 * 60 * 24);
            const decay = Math.exp(-daysAgo / 7); // 7-day half-life

            const current = productScores.get(item.product_id) || { orderCount: 0, quantity: 0, score: 0 };
            productScores.set(item.product_id, {
                orderCount: current.orderCount + 1,
                quantity: current.quantity + item.quantity,
                score: current.score + decay
            });
        });

        // Calculate final scores with hybrid formula
        const scoredProducts = Array.from(productScores.entries()).map(([productId, data]) => ({
            productId,
            // Normalize: order count dominates (70%), quantity contributes (30%)
            finalScore: data.score * 0.7 + Math.log1p(data.quantity) * 0.3,
            ...data
        }));

        // Sort by score descending
        scoredProducts.sort((a, b) => b.finalScore - a.finalScore);
        const topProductIds = scoredProducts.slice(0, limit + 5).map(p => p.productId);

        if (topProductIds.length === 0) {
            await fetchNewestProducts();
            return;
        }

        // Fetch full product details with variants
        const { data: productsData } = await supabase
            .from('products')
            .select('*, product_variants!left(price, mrp, variant_name, variant_value, variant_unit, is_default)')
            .in('id', topProductIds)
            .eq('is_active', true)
            .gt('stock_quantity', 0);

        if (!productsData || productsData.length === 0) {
            await fetchNewestProducts();
            return;
        }

        // Maintain score order
        const productMap = new Map(productsData.map(p => [p.id, p]));
        const trendingProducts: TrendingProduct[] = [];

        topProductIds.forEach(id => {
            const product = productMap.get(id) as any;
            const scoreData = scoredProducts.find(s => s.productId === id);
            if (product && trendingProducts.length < limit) {
                // Extract default variant from product_variants array
                const defaultVariant = product.product_variants?.find((v: any) => v.is_default) || product.product_variants?.[0] || null;
                trendingProducts.push({
                    ...product,
                    default_variant: defaultVariant,
                    trendScore: scoreData?.finalScore,
                    orderCount: scoreData?.orderCount
                } as TrendingProduct);
            }
        });

        // Update cache
        cachedTrending = trendingProducts;
        cacheTimestamp = Date.now();

        if (isMountedRef.current) {
            setProducts(trendingProducts);
            setIsLoading(false);
        }
    };

    const fetchWithExtendedWindow = async () => {
        // 30-day fallback
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const { data: recentItems } = await supabase
            .from('order_items')
            .select('product_id, quantity, created_at')
            .gte('created_at', thirtyDaysAgo.toISOString());

        if (recentItems && recentItems.length > 0) {
            await processOrderItems(recentItems);
        } else {
            await fetchNewestProducts();
        }
    };

    const fetchNewestProducts = async () => {
        // Ultimate fallback: newest products with slight shuffle
        const { data: newestProducts } = await supabase
            .from('products')
            .select('*, product_variants!left(price, mrp, variant_name, variant_value, variant_unit, is_default)')
            .eq('is_active', true)
            .gt('stock_quantity', 0)
            .order('created_at', { ascending: false })
            .limit(limit + 5);

        if (newestProducts && newestProducts.length > 0) {
            // Daily-seeded shuffle for variety
            const dailySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
            const shuffled = shuffleWithSeed(newestProducts, dailySeed);

            const result = shuffled.slice(0, limit).map((p: any) => {
                const defaultVariant = p.product_variants?.find((v: any) => v.is_default) || p.product_variants?.[0] || null;
                return {
                    ...p,
                    default_variant: defaultVariant,
                    trendScore: 0,
                    orderCount: 0
                };
            }) as TrendingProduct[];

            cachedTrending = result;
            cacheTimestamp = Date.now();

            if (isMountedRef.current) {
                setProducts(result);
            }
        }

        if (isMountedRef.current) {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        isMountedRef.current = true;
        fetchTrending();

        return () => {
            isMountedRef.current = false;
        };
    }, [fetchTrending]);

    return { products, isLoading, error };
}

// Deterministic shuffle with seed (for consistent daily ordering)
function shuffleWithSeed<T>(array: T[], seed: number): T[] {
    const result = [...array];
    let currentSeed = seed;

    for (let i = result.length - 1; i > 0; i--) {
        // Simple seeded random
        currentSeed = (currentSeed * 1103515245 + 12345) & 0x7fffffff;
        const j = currentSeed % (i + 1);
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
}
