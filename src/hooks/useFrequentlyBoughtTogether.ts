import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
}

/**
 * Frequently Bought Together Hook
 * Professional approach used by Amazon, Flipkart, etc.
 * 
 * Data Sources (in priority order):
 * 1. Purchase pairs data - products actually bought together
 * 2. Same category products - related by type
 * 3. Trending/Popular products - fallback when data insufficient
 * 
 * Rules:
 * - Never show the current product
 * - Only in-stock products
 * - Limit to 6-8 products for optimal UX
 * - Mix of data sources for variety
 */
export function useFrequentlyBoughtTogether(productId: string | undefined): FrequentlyBoughtResult {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchRecommendations = useCallback(async () => {
        if (!productId) {
            setIsLoading(false);
            return;
        }

        try {
            // Step 1: Get current product details
            const { data: currentProduct } = await supabase
                .from('products')
                .select('id, category_id')
                .eq('id', productId)
                .single();

            if (!currentProduct) {
                setIsLoading(false);
                return;
            }

            const recommendations: Product[] = [];
            const addedIds = new Set<string>([productId]);

            // Step 2: Get products from purchase_pairs (most relevant)
            try {
                const { data: pairs } = await (supabase as any)
                    .from('purchase_pairs')
                    .select(`
                        product_a_id,
                        product_b_id,
                        pair_count
                    `)
                    .or(`product_a_id.eq.${productId},product_b_id.eq.${productId}`)
                    .order('pair_count', { ascending: false })
                    .limit(10);

                if (pairs && pairs.length > 0) {
                    // Get paired product IDs
                    const pairedIds = pairs.map((p: any) =>
                        p.product_a_id === productId ? p.product_b_id : p.product_a_id
                    ).filter((id: string) => !addedIds.has(id));

                    if (pairedIds.length > 0) {
                        const { data: pairedProducts } = await supabase
                            .from('products')
                            .select('*')
                            .in('id', pairedIds)
                            .gt('stock_quantity', 0)
                            .limit(4);

                        if (pairedProducts) {
                            pairedProducts.forEach(p => {
                                if (!addedIds.has(p.id)) {
                                    recommendations.push(p as Product);
                                    addedIds.add(p.id);
                                }
                            });
                        }
                    }
                }
            } catch (e) {
                // purchase_pairs table might not exist yet
            }

            // Step 3: Get same category products (if need more)
            if (recommendations.length < 6 && currentProduct.category_id) {
                const { data: categoryProducts } = await supabase
                    .from('products')
                    .select('*')
                    .eq('category_id', currentProduct.category_id)
                    .gt('stock_quantity', 0)
                    .neq('id', productId)
                    .order('created_at', { ascending: false })
                    .limit(4);

                if (categoryProducts) {
                    categoryProducts.forEach(p => {
                        if (!addedIds.has(p.id) && recommendations.length < 8) {
                            recommendations.push(p as Product);
                            addedIds.add(p.id);
                        }
                    });
                }
            }

            // Step 4: Fallback to popular/trending products
            if (recommendations.length < 4) {
                // Get recently ordered products (trending)
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

                const { data: recentOrders } = await supabase
                    .from('order_items')
                    .select('product_id')
                    .gte('created_at', sevenDaysAgo);

                if (recentOrders && recentOrders.length > 0) {
                    // Count frequency
                    const productCounts = recentOrders.reduce((acc: Record<string, number>, item: any) => {
                        if (!addedIds.has(item.product_id)) {
                            acc[item.product_id] = (acc[item.product_id] || 0) + 1;
                        }
                        return acc;
                    }, {});

                    // Sort by frequency
                    const popularIds = Object.entries(productCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 6 - recommendations.length)
                        .map(([id]) => id);

                    if (popularIds.length > 0) {
                        const { data: popularProducts } = await supabase
                            .from('products')
                            .select('*')
                            .in('id', popularIds)
                            .gt('stock_quantity', 0);

                        if (popularProducts) {
                            popularProducts.forEach(p => {
                                if (!addedIds.has(p.id) && recommendations.length < 8) {
                                    recommendations.push(p as Product);
                                    addedIds.add(p.id);
                                }
                            });
                        }
                    }
                }
            }

            // Step 5: Ultimate fallback - newest products
            if (recommendations.length < 4) {
                const { data: newestProducts } = await supabase
                    .from('products')
                    .select('*')
                    .gt('stock_quantity', 0)
                    .order('created_at', { ascending: false })
                    .limit(8);

                if (newestProducts) {
                    newestProducts.forEach(p => {
                        if (!addedIds.has(p.id) && recommendations.length < 8) {
                            recommendations.push(p as Product);
                            addedIds.add(p.id);
                        }
                    });
                }
            }

            setProducts(recommendations);
        } catch (e) {
            console.error('Frequently bought error:', e);
        } finally {
            setIsLoading(false);
        }
    }, [productId]);

    useEffect(() => {
        fetchRecommendations();
    }, [fetchRecommendations]);

    return { products, isLoading };
}
