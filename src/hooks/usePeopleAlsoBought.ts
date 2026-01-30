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

interface PeopleAlsoBoughtResult {
    products: Product[];
    isLoading: boolean;
    error: string | null;
}

// Module-level cache for table availability
// Shared with FBT hook to avoid duplicate checks
let coTableAvailable: boolean | null = null;
let coTableCheckDone = false;

/**
 * People Also Bought Hook
 * Shows products that other customers who viewed/bought this product also purchased.
 * 
 * Differences from Frequently Bought Together:
 * - PAB shows 6-8 products (larger selection)
 * - PAB focuses on cross-user interest patterns
 * - PAB excludes products already shown in FBT (via excludeProductIds)
 * 
 * Data Sources (in priority order):
 * 1. Co-purchase data from product_co_purchases table
 * 2. Same category products as fallback
 * 3. Popular products as final fallback
 * 
 * Performance:
 * - Caches table availability to prevent repeated failed queries
 * - Uses deduplication to work alongside FBT
 */
export function usePeopleAlsoBought(
    productId: string | undefined,
    excludeProductIds: string[] = [] // IDs to exclude (typically from FBT)
): PeopleAlsoBoughtResult {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isMountedRef = useRef(true);

    const fetchRecommendations = useCallback(async () => {
        if (!productId) {
            setIsLoading(false);
            setError(null);
            return;
        }

        setError(null);

        try {
            // Get current product for category fallback
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
            const addedIds = new Set<string>([productId, ...excludeProductIds]);
            const PAB_LIMIT = 8; // PAB shows more items than FBT

            // Step 1: Try co-purchase data (most relevant)
            if (coTableAvailable !== false) {
                try {
                    // Query co-purchase pairs for this product
                    const { data: pairs, error: tableError } = await supabase
                        .from('product_co_purchases')
                        .select('co_product_id, co_purchase_count')
                        .eq('product_id', productId)
                        .order('co_purchase_count', { ascending: false })
                        .limit(PAB_LIMIT + excludeProductIds.length); // Fetch extra to account for exclusions

                    if (tableError) {
                        if (!coTableCheckDone) {
                            logger.debug('product_co_purchases not available for PAB');
                            coTableAvailable = false;
                            coTableCheckDone = true;
                        }
                    } else if (pairs && pairs.length > 0) {
                        coTableAvailable = true;
                        coTableCheckDone = true;

                        // Filter out excluded IDs
                        const pabIds = pairs
                            .map(p => p.co_product_id)
                            .filter(id => !addedIds.has(id));

                        if (pabIds.length > 0) {
                            const { data: pabProducts } = await supabase
                                .from('products')
                                .select('*')
                                .in('id', pabIds)
                                .eq('is_active', true)
                                .gt('stock_quantity', 0)
                                .limit(PAB_LIMIT);

                            if (pabProducts) {
                                // Maintain order from co_purchase_count ranking
                                const productMap = new Map(pabProducts.map(p => [p.id, p]));
                                pabIds.forEach(id => {
                                    const product = productMap.get(id);
                                    if (product && !addedIds.has(id) && recommendations.length < PAB_LIMIT) {
                                        recommendations.push(product as Product);
                                        addedIds.add(id);
                                    }
                                });
                            }
                        }
                    }
                } catch (e) {
                    if (!coTableCheckDone) {
                        coTableAvailable = false;
                        coTableCheckDone = true;
                    }
                }
            }

            if (!isMountedRef.current) return;

            // Step 2: Fill with same category products if needed
            if (recommendations.length < PAB_LIMIT && currentProduct.category_id) {
                const needed = PAB_LIMIT - recommendations.length;

                const { data: categoryProducts } = await supabase
                    .from('products')
                    .select('*')
                    .eq('category_id', currentProduct.category_id)
                    .eq('is_active', true)
                    .gt('stock_quantity', 0)
                    .neq('id', productId)
                    .order('created_at', { ascending: false })
                    .limit(needed + 4); // Fetch extra in case some are excluded

                if (categoryProducts) {
                    categoryProducts.forEach(p => {
                        if (!addedIds.has(p.id) && recommendations.length < PAB_LIMIT) {
                            recommendations.push(p as Product);
                            addedIds.add(p.id);
                        }
                    });
                }
            }

            if (!isMountedRef.current) return;

            // Step 3: Fill with popular products from other categories
            if (recommendations.length < 4) {
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

                const { data: recentOrders } = await supabase
                    .from('order_items')
                    .select('product_id')
                    .gte('created_at', sevenDaysAgo);

                if (recentOrders && recentOrders.length > 0) {
                    const productCounts = recentOrders.reduce((acc: Record<string, number>, item) => {
                        if (!addedIds.has(item.product_id)) {
                            acc[item.product_id] = (acc[item.product_id] || 0) + 1;
                        }
                        return acc;
                    }, {});

                    const popularIds = Object.entries(productCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, PAB_LIMIT - recommendations.length)
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
                                if (!addedIds.has(p.id) && recommendations.length < PAB_LIMIT) {
                                    recommendations.push(p as Product);
                                    addedIds.add(p.id);
                                }
                            });
                        }
                    }
                }
            }

            if (isMountedRef.current) {
                setProducts(recommendations);
            }
        } catch (e) {
            logger.error('People also bought error', { error: e });
            if (isMountedRef.current) {
                setError('Failed to load recommendations');
                setProducts([]);
            }
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, [productId, excludeProductIds]);

    useEffect(() => {
        isMountedRef.current = true;
        fetchRecommendations();

        return () => {
            isMountedRef.current = false;
        };
    }, [fetchRecommendations]);

    return { products, isLoading, error };
}
