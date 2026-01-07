import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface ProductVariant {
    id: string;
    variant_name: string;
    variant_value: number;
    variant_unit: string;
    price: number;
    mrp: number | null;
    is_default: boolean | null;
}

interface Product {
    id: string;
    name: string;
    price: number;
    mrp?: number | null;
    image_url: string | null;
    category_id: string | null;
    stock_quantity: number | null;
    unit: string | null;
    created_at?: string | null;
    discount_percent?: number | null;
    default_variant?: ProductVariant | null;
}

interface RecommendationResult {
    recommendedProducts: Product[];
    trendingProducts: Product[];
    isLoading: boolean;
    trackView: (productId: string) => Promise<void>;
}

/**
 * Advanced AI-Powered Recommendation System
 * Inspired by Netflix, Amazon, and Spotify algorithms
 * 
 * Scoring Factors (Total 100 points max per product):
 * 1. Purchase History (35 pts) - Category affinity from past orders
 * 2. View Behavior (25 pts) - Products user has viewed, weighted by recency
 * 3. Trending Score (20 pts) - Recent popularity across all users
 * 4. Category Diversity (10 pts) - Ensure variety in recommendations
 * 5. Freshness Bonus (10 pts) - New products get a boost
 * 
 * Anti-Pattern Rules:
 * - Don't show recently purchased items (last 14 days)
 * - Cap any single category at 40% of recommendations
 * - Prioritize in-stock items only
 * - Fallback to trending when no user data
 */
export function useRecommendations(): RecommendationResult {
    const { user } = useAuth();
    const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
    const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Track product view (silent, never blocks UI)
    const trackView = useCallback(async (productId: string) => {
        if (!user) return;

        try {
            const { data: existing } = await supabase
                .from('user_product_views')
                .select('id, view_count')
                .eq('user_id', user.id)
                .eq('product_id', productId)
                .single();

            if (existing) {
                const existingData = existing;
                await supabase
                    .from('user_product_views')
                    .update({
                        view_count: (existingData.view_count || 1) + 1,
                        viewed_at: new Date().toISOString()
                    })
                    .eq('id', existingData.id);
            } else {
                await supabase
                    .from('user_product_views')
                    .insert({
                        user_id: user.id,
                        product_id: productId,
                        view_count: 1
                    });
            }
        } catch (e) {
            // Silent fail - tracking should never break UX
            logger.debug('Product view tracking failed', { error: e });
        }
    }, [user]);

    // Calculate trending products (cross-user popularity)
    const calculateTrending = useCallback(async (): Promise<Map<string, number>> => {
        const trendingScores = new Map<string, number>();

        try {
            // Get recent orders from last 7 days for trending calculation
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

            const { data: recentOrders } = await supabase
                .from('order_items')
                .select('product_id, quantity')
                .gte('created_at', sevenDaysAgo);

            if (recentOrders) {
                recentOrders.forEach((item: { product_id: string; quantity: number }) => {
                    const current = trendingScores.get(item.product_id) || 0;
                    trendingScores.set(item.product_id, current + item.quantity);
                });
            }

            // Normalize to 0-20 scale
            const maxTrending = Math.max(...Array.from(trendingScores.values()), 1);
            trendingScores.forEach((value, key) => {
                trendingScores.set(key, (value / maxTrending) * 20);
            });

        } catch (e) {
            // Return empty map on error
            logger.debug('Trending calculation failed', { error: e });
        }

        return trendingScores;
    }, []);

    // Fetch and compute recommendations
    const fetchRecommendations = useCallback(async () => {
        try {
            // 1. Get all in-stock products first
            const { data: allProductsData } = await supabase
                .from('products')
                .select('*')
                .gt('stock_quantity', 0)
                .order('created_at', { ascending: false });

            if (!allProductsData || allProductsData.length === 0) {
                setIsLoading(false);
                return;
            }

            const allProducts = allProductsData as Product[];

            // 1b. Fetch default variants for all products
            const productIds = allProducts.map(p => p.id);
            const { data: defaultVariants } = await supabase
                .from('product_variants')
                .select('*')
                .in('product_id', productIds)
                .eq('is_default', true);

            // Attach default variant to each product
            const productsWithVariants = allProducts.map(product => {
                const defaultVariant = defaultVariants?.find(v => v.product_id === product.id) || null;
                return { ...product, default_variant: defaultVariant };
            });

            // 2. Calculate trending scores (works even without user)
            const trendingScores = await calculateTrending();

            // 3. If no user, show trending only
            if (!user) {
                const sorted = [...productsWithVariants].sort((a, b) => {
                    const scoreA = trendingScores.get(a.id) || 0;
                    const scoreB = trendingScores.get(b.id) || 0;
                    return scoreB - scoreA;
                });
                setTrendingProducts(sorted.slice(0, 10));
                setRecommendedProducts([]);
                setIsLoading(false);
                return;
            }

            // 4. Get user's view history (last 50 views)
            const { data: viewHistory } = await supabase
                .from('user_product_views')
                .select('product_id, view_count, viewed_at')
                .eq('user_id', user.id)
                .order('viewed_at', { ascending: false })
                .limit(50);

            // 5. Get user's order history for category affinity
            const { data: orderHistory } = await supabase
                .from('orders')
                .select(`
                    id,
                    created_at,
                    order_items(product_id, products(category_id))
                `)
                .eq('user_id', user.id)
                .in('status', ['delivered', 'out_for_delivery', 'confirmed'])
                .order('created_at', { ascending: false })
                .limit(30);

            // 6. Build scoring maps
            const categoryScores: Record<string, number> = {};
            const recentlyPurchasedIds = new Set<string>();
            const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);


            // Process order history for category affinity (35 pts max)
            if (orderHistory) {
                orderHistory.forEach(order => {
                    const orderDate = new Date(order.created_at || Date.now());
                    order.order_items?.forEach(item => {
                        const categoryId = item.products?.category_id;
                        if (categoryId) {
                            // Exponential decay based on recency
                            const daysAgo = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
                            const recencyMultiplier = Math.exp(-daysAgo / 30); // 30-day half-life
                            categoryScores[categoryId] = (categoryScores[categoryId] || 0) + (35 * recencyMultiplier);
                        }
                        // Track recently purchased (14 days exclusion)
                        if (orderDate > fourteenDaysAgo) {
                            recentlyPurchasedIds.add(item.product_id);
                        }
                    });
                });
            }

            // 7. Build view scores (25 pts max)
            const viewScores: Record<string, number> = {};

            if (viewHistory && Array.isArray(viewHistory)) {
                viewHistory.forEach((view, index: number) => {
                    // Recency decay for views
                    const recencyFactor = Math.exp(-index / 20); // More recent = higher weight
                    const viewCount = view.view_count ?? 1;
                    const viewScore = Math.min(viewCount * 5 * recencyFactor, 25);
                    viewScores[view.product_id] = viewScore;

                    // Also boost related categories
                    const product = productsWithVariants.find(p => p.id === view.product_id);
                    if (product?.category_id) {
                        categoryScores[product.category_id] =
                            (categoryScores[product.category_id] || 0) + (viewCount * 2 * recencyFactor);
                    }
                });
            }

            // 8. Normalize category scores to max 35
            const maxCategoryScore = Math.max(...Object.values(categoryScores), 1);
            Object.keys(categoryScores).forEach(key => {
                categoryScores[key] = (categoryScores[key] / maxCategoryScore) * 35;
            });

            // 9. Score all products
            const scoredProducts = productsWithVariants.map(product => {
                // Skip recently purchased
                if (recentlyPurchasedIds.has(product.id)) {
                    return { product, score: -1, reasons: ['recently_purchased'] };
                }

                let score = 0;
                const reasons: string[] = [];

                // Category affinity (35 pts)
                if (product.category_id && categoryScores[product.category_id]) {
                    score += categoryScores[product.category_id];
                    reasons.push('category_match');
                }

                // Direct view history (25 pts)
                if (viewScores[product.id]) {
                    score += viewScores[product.id];
                    reasons.push('viewed');
                }

                // Trending score (20 pts)
                const trendingScore = trendingScores.get(product.id) || 0;
                score += trendingScore;
                if (trendingScore > 5) reasons.push('trending');

                // Freshness bonus (10 pts) - products created in last 7 days
                const productAge = Date.now() - new Date(product.created_at || 0).getTime();
                if (productAge < 7 * 24 * 60 * 60 * 1000) {
                    score += 10;
                    reasons.push('new');
                } else if (productAge < 14 * 24 * 60 * 60 * 1000) {
                    score += 5;
                }

                // Small random factor for serendipity (0-5 pts)
                score += Math.random() * 5;

                return { product, score, reasons };
            });

            // 10. Sort and apply diversity rules
            const sorted = scoredProducts
                .filter(p => p.score >= 0)
                .sort((a, b) => b.score - a.score);

            // Apply category diversity (max 40% from any single category)
            const categoryCounts: Record<string, number> = {};
            const maxPerCategory = 4; // Max 4 out of 10 from same category

            const diversified = sorted.filter(({ product }) => {
                const catId = product.category_id || 'uncategorized';
                categoryCounts[catId] = (categoryCounts[catId] || 0) + 1;
                return categoryCounts[catId] <= maxPerCategory;
            }).slice(0, 12);

            setRecommendedProducts(diversified.map(d => d.product));

            // Also set trending (top products by trending score only)
            const trendingOnly = [...productsWithVariants]
                .filter(p => !recentlyPurchasedIds.has(p.id))
                .sort((a, b) => (trendingScores.get(b.id) || 0) - (trendingScores.get(a.id) || 0))
                .slice(0, 8);

            setTrendingProducts(trendingOnly);

        } catch (e) {
            logger.error('Recommendations error', { error: e });
        } finally {
            setIsLoading(false);
        }
    }, [user, calculateTrending]);

    useEffect(() => {
        fetchRecommendations();
    }, [fetchRecommendations]);

    return { recommendedProducts, trendingProducts, isLoading, trackView };
}
