import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Product {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    category_id: string | null;
    stock_quantity: number;
    unit: string;
}

interface UserProductView {
    product_id: string;
    view_count: number;
    viewed_at: string;
}

interface RecommendationResult {
    recommendedProducts: Product[];
    isLoading: boolean;
    trackView: (productId: string) => Promise<void>;
}

/**
 * AI-powered recommendation hook
 * Inspired by Amazon, Netflix, and Spotify algorithms
 * 
 * Scoring factors:
 * - Purchase history (category affinity from orders)
 * - View frequency (more views = higher interest)
 * - Recency (recent views weighted more)
 * - Category similarity
 */
export function useRecommendations(): RecommendationResult {
    const { user } = useAuth();
    const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Track product view
    const trackView = useCallback(async (productId: string) => {
        if (!user) return;

        try {
            // Upsert: increment view_count if exists, create if not
            const { data: existing } = await supabase
                .from('user_product_views' as any)
                .select('id, view_count')
                .eq('user_id', user.id)
                .eq('product_id', productId)
                .single();

            if (existing) {
                await supabase
                    .from('user_product_views' as any)
                    .update({
                        view_count: (existing.view_count || 1) + 1,
                        viewed_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
            } else {
                await supabase
                    .from('user_product_views' as any)
                    .insert({
                        user_id: user.id,
                        product_id: productId,
                        view_count: 1
                    });
            }
        } catch (e) {
            // Silently fail - tracking shouldn't break UX
            console.log('View tracking:', e);
        }
    }, [user]);

    // Fetch recommendations
    const fetchRecommendations = useCallback(async () => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        try {
            // 1. Get user's view history
            const { data: viewHistory } = await supabase
                .from('user_product_views' as any)
                .select('product_id, view_count, viewed_at')
                .eq('user_id', user.id)
                .order('viewed_at', { ascending: false })
                .limit(50);

            // 2. Get user's order history for category affinity
            const { data: orderHistory } = await supabase
                .from('orders')
                .select(`
          id,
          created_at,
          order_items(product_id, products(category_id))
        `)
                .eq('user_id', user.id)
                .eq('status', 'delivered')
                .order('created_at', { ascending: false })
                .limit(20);

            // 3. Get all active products
            const { data: allProducts } = await supabase
                .from('products')
                .select('*')
                .gt('stock_quantity', 0)
                .order('created_at', { ascending: false });

            if (!allProducts) {
                setIsLoading(false);
                return;
            }

            // 4. Build category affinity map from orders
            const categoryScores: Record<string, number> = {};
            const recentlyPurchasedIds = new Set<string>();
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            if (orderHistory) {
                orderHistory.forEach((order: any) => {
                    const orderDate = new Date(order.created_at);
                    order.order_items?.forEach((item: any) => {
                        const categoryId = item.products?.category_id;
                        if (categoryId) {
                            // Weight based on recency
                            const recencyWeight = orderDate > sevenDaysAgo ? 2 : 1;
                            categoryScores[categoryId] = (categoryScores[categoryId] || 0) + (40 * recencyWeight);
                        }
                        // Track recently purchased
                        if (orderDate > sevenDaysAgo) {
                            recentlyPurchasedIds.add(item.product_id);
                        }
                    });
                });
            }

            // 5. Build view score map
            const viewScores: Record<string, number> = {};
            const viewedCategories: Record<string, number> = {};

            if (viewHistory) {
                viewHistory.forEach((view: UserProductView, index: number) => {
                    const recencyFactor = 1 - (index / 50) * 0.5; // 0.5 to 1.0 based on recency
                    const product = allProducts.find(p => p.id === view.product_id);

                    viewScores[view.product_id] = (view.view_count * 25 * recencyFactor);

                    if (product?.category_id) {
                        viewedCategories[product.category_id] =
                            (viewedCategories[product.category_id] || 0) + (view.view_count * 15);
                    }
                });
            }

            // 6. Combine category scores
            Object.keys(viewedCategories).forEach(catId => {
                categoryScores[catId] = (categoryScores[catId] || 0) + viewedCategories[catId];
            });

            // 7. Score all products
            const scoredProducts = allProducts.map(product => {
                let score = 0;

                // Skip recently purchased
                if (recentlyPurchasedIds.has(product.id)) {
                    return { product, score: -1 };
                }

                // Category affinity score
                if (product.category_id && categoryScores[product.category_id]) {
                    score += categoryScores[product.category_id];
                }

                // Direct view history score
                if (viewScores[product.id]) {
                    score += viewScores[product.id];
                }

                // Slight boost for trending/new items (created recently)
                const productAge = Date.now() - new Date(product.created_at || 0).getTime();
                const isNew = productAge < 7 * 24 * 60 * 60 * 1000;
                if (isNew) score += 10;

                return { product, score };
            });

            // 8. Sort by score and apply diversity rules
            const sorted = scoredProducts
                .filter(p => p.score >= 0)
                .sort((a, b) => b.score - a.score);

            // Diversity: max 40% from single category
            const categoryCounts: Record<string, number> = {};
            const maxPerCategory = Math.ceil(10 * 0.4); // 4 max per category for top 10

            const diversified = sorted.filter(({ product }) => {
                const catId = product.category_id || 'uncategorized';
                categoryCounts[catId] = (categoryCounts[catId] || 0) + 1;
                return categoryCounts[catId] <= maxPerCategory;
            }).slice(0, 10);

            setRecommendedProducts(diversified.map(d => d.product));
        } catch (e) {
            console.log('Recommendations fetch error:', e);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchRecommendations();
    }, [fetchRecommendations]);

    return { recommendedProducts, isLoading, trackView };
}
