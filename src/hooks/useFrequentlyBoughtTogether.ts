import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

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
}

interface FrequentlyBoughtResult {
    products: Product[];
    isLoading: boolean;
    error: string | null;
    productIds: string[]; // Exposed for deduplication with People Also Bought
}

// Module-level cache for table availability
// Prevents repeated failed queries and log spam in production
let coTableAvailable: boolean | null = null;
let coTableCheckDone = false;

/**
 * Frequently Bought Together Hook
 * Professional approach used by Amazon, Flipkart, Zepto, etc.
 * 
 * Data Sources (in priority order):
 * 1. Co-purchase data - products actually bought together in delivered orders
 * 2. Same category products - related by type
 * 3. Trending/Popular products - fallback when data insufficient
 * 
 * Rules:
 * - Never show the current product
 * - Only in-stock, active products
 * - Limit to 4 products for FBT (PAB gets 6-8)
 * - Mix of data sources for variety
 * 
 * Performance:
 * - Caches table availability check to prevent repeated failed queries
 * - Uses RPC function when available for optimized query
 */
export function useFrequentlyBoughtTogether(
    productId: string | undefined,
    excludeIds: string[] = []
): FrequentlyBoughtResult {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Track if component is mounted to prevent state updates after unmount
    const isMountedRef = useRef(true);

    const fetchRecommendations = useCallback(async () => {
        if (!productId) {
            setIsLoading(false);
            setError(null);
            return;
        }

        setError(null);

        try {
            // Step 1: Get current product details
            const { data: currentProduct } = await supabase
                .from('products')
                .select('id, category_id')
                .eq('id', productId)
                .single();

            if (!currentProduct || !isMountedRef.current) {
                setIsLoading(false);
                return;
            }

            const recommendations: Product[] = [];
            const addedIds = new Set<string>([productId, ...excludeIds]);
            const FBT_LIMIT = 4; // FBT shows fewer items than PAB

            // Step 2: Try co-purchase data (most relevant)
            // Only attempt if table availability hasn't been checked or is available
            if (coTableAvailable !== false) {
                try {
                    // Try using the optimized RPC function first
                    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
                        'get_frequently_bought_together',
                        {
                            p_product_id: productId,
                            p_limit: FBT_LIMIT,
                            p_exclude_ids: Array.from(addedIds)
                        }
                    );

                    if (!rpcError && rpcData && rpcData.length > 0) {
                        coTableAvailable = true;
                        coTableCheckDone = true;

                        rpcData.forEach((p: any) => {
                            if (!addedIds.has(p.product_id)) {
                                recommendations.push({
                                    id: p.product_id,
                                    name: p.name,
                                    price: p.price,
                                    mrp: p.mrp,
                                    image_url: p.image_url,
                                    unit: p.unit,
                                    stock_quantity: p.stock_quantity,
                                    category_id: null, // Not needed for display
                                    discount_percent: null
                                });
                                addedIds.add(p.product_id);
                            }
                        });
                    } else if (rpcError) {
                        // RPC not available, try direct table query
                        const { data: pairs, error: tableError } = await supabase
                            .from('product_co_purchases')
                            .select('co_product_id, co_purchase_count')
                            .eq('product_id', productId)
                            .order('co_purchase_count', { ascending: false })
                            .limit(FBT_LIMIT + 2); // Fetch extra in case some are excluded

                        if (tableError) {
                            // Table doesn't exist - cache this to avoid repeated queries
                            if (!coTableCheckDone) {
                                logger.info('product_co_purchases table not available, using fallback strategies');
                                coTableAvailable = false;
                                coTableCheckDone = true;
                            }
                        } else if (pairs && pairs.length > 0) {
                            coTableAvailable = true;
                            coTableCheckDone = true;

                            const pairedIds = pairs
                                .map(p => p.co_product_id)
                                .filter(id => !addedIds.has(id));

                            if (pairedIds.length > 0) {
                                const { data: pairedProducts } = await supabase
                                    .from('products')
                                    .select('*')
                                    .in('id', pairedIds)
                                    .eq('is_active', true)
                                    .gt('stock_quantity', 0)
                                    .limit(FBT_LIMIT);

                                if (pairedProducts) {
                                    pairedProducts.forEach(p => {
                                        if (!addedIds.has(p.id) && recommendations.length < FBT_LIMIT) {
                                            recommendations.push(p as Product);
                                            addedIds.add(p.id);
                                        }
                                    });
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Silently handle - table might not exist yet
                    if (!coTableCheckDone) {
                        coTableAvailable = false;
                        coTableCheckDone = true;
                    }
                }
            }

            if (!isMountedRef.current) return;

            // Step 3: Fill with same category products (if need more)
            if (recommendations.length < FBT_LIMIT && currentProduct.category_id) {
                const { data: categoryProducts } = await supabase
                    .from('products')
                    .select('*')
                    .eq('category_id', currentProduct.category_id)
                    .eq('is_active', true)
                    .gt('stock_quantity', 0)
                    .neq('id', productId)
                    .order('created_at', { ascending: false })
                    .limit(FBT_LIMIT);

                if (categoryProducts) {
                    categoryProducts.forEach(p => {
                        if (!addedIds.has(p.id) && recommendations.length < FBT_LIMIT) {
                            recommendations.push(p as Product);
                            addedIds.add(p.id);
                        }
                    });
                }
            }

            if (!isMountedRef.current) return;

            // Step 4: Fallback to trending products
            if (recommendations.length < 2) {
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

                const { data: recentOrders } = await supabase
                    .from('order_items')
                    .select('product_id')
                    .gte('created_at', sevenDaysAgo);

                if (recentOrders && recentOrders.length > 0) {
                    // Count frequency and apply time decay
                    const productCounts = recentOrders.reduce((acc: Record<string, number>, item) => {
                        if (!addedIds.has(item.product_id)) {
                            acc[item.product_id] = (acc[item.product_id] || 0) + 1;
                        }
                        return acc;
                    }, {});

                    const popularIds = Object.entries(productCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, FBT_LIMIT - recommendations.length)
                        .map(([id]) => id);

                    if (popularIds.length > 0) {
                        const { data: popularProducts } = await supabase
                            .from('products')
                            .select('*')
                            .in('id', popularIds)
                            .eq('is_active', true)
                            .gt('stock_quantity', 0);

                        if (popularProducts) {
                            popularProducts.forEach(p => {
                                if (!addedIds.has(p.id) && recommendations.length < FBT_LIMIT) {
                                    recommendations.push(p as Product);
                                    addedIds.add(p.id);
                                }
                            });
                        }
                    }
                }
            }

            if (!isMountedRef.current) return;

            // Step 5: Ultimate fallback - newest products
            if (recommendations.length < 2) {
                const { data: newestProducts } = await supabase
                    .from('products')
                    .select('*')
                    .eq('is_active', true)
                    .gt('stock_quantity', 0)
                    .order('created_at', { ascending: false })
                    .limit(FBT_LIMIT);

                if (newestProducts) {
                    newestProducts.forEach(p => {
                        if (!addedIds.has(p.id) && recommendations.length < FBT_LIMIT) {
                            recommendations.push(p as Product);
                            addedIds.add(p.id);
                        }
                    });
                }
            }

            if (isMountedRef.current) {
                setProducts(recommendations);
            }
        } catch (e) {
            logger.error('Frequently bought together error', { error: e });
            if (isMountedRef.current) {
                setError('Failed to load recommendations');
                setProducts([]); // Graceful fallback to empty
            }
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, [productId, excludeIds]);

    useEffect(() => {
        isMountedRef.current = true;
        fetchRecommendations();

        return () => {
            isMountedRef.current = false;
        };
    }, [fetchRecommendations]);

    return {
        products,
        isLoading,
        error,
        productIds: products.map(p => p.id) // For deduplication with PAB
    };
}
