import { useState, useEffect, useCallback, useRef } from 'react';
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

// Module-level flag for table availability
let viewsTableAvailable: boolean | null = null;
let viewsTableChecked = false;

/**
 * Advanced Recommendation System
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
 * 
 * Improvements from Review:
 * - Reduced random factor to 0-2 pts for consistency
 * - Seeded randomness with user_id + date for daily determinism
 * - Structured logging for debugging recommendation reasons
 * - Cached table availability checks
 */
export function useRecommendations(): RecommendationResult {
    const { user } = useAuth();
    const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
    const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const isMountedRef = useRef(true);

    // Simple hash function for deterministic daily randomness
    const hashCode = (str: string): number => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    };

    // Seeded random function for daily consistency
    const getSeededRandom = useCallback((productId: string): number => {
        const dailySeed = user
            ? `${user.id}-${new Date().toDateString()}`
            : new Date().toDateString();
        const hash = hashCode(`${dailySeed}-${productId}`);
        return (hash % 100) / 100 * 2; // 0-2 pts (reduced from 0-5)
    }, [user]);

    // Track product view (silent, never blocks UI)
    const trackView = useCallback(async (productId: string) => {
        if (!user) return;

        // Skip if we know table doesn't exist
        if (viewsTableAvailable === false) return;

        try {
            const { data: existing, error: selectError } = await supabase
                .from('user_product_views')
                .select('id, view_count')
                .eq('user_id', user.id)
                .eq('product_id', productId)
                .maybeSingle();

            if (selectError && !viewsTableChecked) {
                logger.debug('user_product_views table check failed', { error: selectError });
                viewsTableAvailable = false;
                viewsTableChecked = true;
                return;
            }

            viewsTableAvailable = true;
            viewsTableChecked = true;

            if (existing) {
                await supabase
                    .from('user_product_views')
                    .update({
                        view_count: (existing.view_count || 1) + 1,
                        last_viewed_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
            } else {
                await supabase
                    .from('user_product_views')
                    .insert({
                        user_id: user.id,
                        product_id: productId,
                        view_count: 1,
                        first_viewed_at: new Date().toISOString(),
                        last_viewed_at: new Date().toISOString()
                    });
            }
        } catch (e) {
            // Silent fail - tracking should never break UX
            if (!viewsTableChecked) {
                viewsTableAvailable = false;
                viewsTableChecked = true;
            }
        }
    }, [user]);

    // Calculate trending products (cross-user popularity)
    const calculateTrending = useCallback(async (): Promise<Map<string, number>> => {
        const trendingScores = new Map<string, number>();

        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

            const { data: recentOrders } = await supabase
                .from('order_items')
                .select('product_id, quantity, created_at')
                .gte('created_at', sevenDaysAgo);

            if (recentOrders) {
                const now = Date.now();

                recentOrders.forEach((item) => {
                    // Apply time decay
                    const itemDate = new Date(item.created_at || Date.now()).getTime();
                    const daysAgo = (now - itemDate) / (1000 * 60 * 60 * 24);
                    const decay = Math.exp(-daysAgo / 7);

                    const current = trendingScores.get(item.product_id) || 0;
                    // Hybrid: 70% order count + 30% quantity contribution
                    const score = decay * (0.7 + 0.3 * Math.min(item.quantity / 5, 1));
                    trendingScores.set(item.product_id, current + score);
                });
            }

            // Normalize to 0-20 scale
            const maxTrending = Math.max(...Array.from(trendingScores.values()), 1);
            trendingScores.forEach((value, key) => {
                trendingScores.set(key, (value / maxTrending) * 20);
            });

        } catch (e) {
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
                .eq('is_active', true)
                .gt('stock_quantity', 0)
                .order('created_at', { ascending: false });

            if (!allProductsData || allProductsData.length === 0) {
                if (isMountedRef.current) setIsLoading(false);
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

            if (!isMountedRef.current) return;

            // 2. Calculate trending scores (works even without user)
            const trendingScores = await calculateTrending();

            // 3. If no user, show trending only
            if (!user) {
                const sorted = [...productsWithVariants].sort((a, b) => {
                    const scoreA = trendingScores.get(a.id) || 0;
                    const scoreB = trendingScores.get(b.id) || 0;
                    // Tiebreaker: product ID for determinism
                    if (scoreB === scoreA) return a.id.localeCompare(b.id);
                    return scoreB - scoreA;
                });
                if (isMountedRef.current) {
                    setTrendingProducts(sorted.slice(0, 10));
                    setRecommendedProducts([]);
                    setIsLoading(false);
                }
                return;
            }

            // 4. Get user's view history (only if table is available)
            let viewHistory: any[] = [];
            if (viewsTableAvailable !== false) {
                try {
                    const { data, error } = await supabase
                        .from('user_product_views')
                        .select('product_id, view_count, last_viewed_at')
                        .eq('user_id', user.id)
                        .order('last_viewed_at', { ascending: false })
                        .limit(50);

                    if (!error && data) {
                        viewHistory = data;
                        viewsTableAvailable = true;
                    } else if (!viewsTableChecked) {
                        viewsTableAvailable = false;
                    }
                    viewsTableChecked = true;
                } catch (e) {
                    if (!viewsTableChecked) {
                        viewsTableAvailable = false;
                        viewsTableChecked = true;
                    }
                }
            }

            if (!isMountedRef.current) return;

            // 5. Get user's order history for category affinity
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
                .limit(30);

            if (!isMountedRef.current) return;

            // 6. Build scoring maps
            const categoryScores: Record<string, number> = {};
            const recentlyPurchasedIds = new Set<string>();
            const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

            // Process order history for category affinity (35 pts max)
            if (orderHistory) {
                orderHistory.forEach(order => {
                    const orderDate = new Date(order.created_at || Date.now());
                    order.order_items?.forEach((item: any) => {
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
                viewHistory.forEach((view, index) => {
                    // Recency decay for views
                    const recencyFactor = Math.exp(-index / 20);
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
                    return { product, score: -1, reasons: ['recently_purchased'], scoreBreakdown: {} };
                }

                let score = 0;
                const reasons: string[] = [];
                const scoreBreakdown: Record<string, number> = {};

                // Category affinity (35 pts)
                const categoryScore = product.category_id ? (categoryScores[product.category_id] || 0) : 0;
                if (categoryScore > 0) {
                    score += categoryScore;
                    scoreBreakdown.category = categoryScore;
                    reasons.push('category_match');
                }

                // Direct view history (25 pts)
                const viewScore = viewScores[product.id] || 0;
                if (viewScore > 0) {
                    score += viewScore;
                    scoreBreakdown.views = viewScore;
                    reasons.push('viewed');
                }

                // Trending score (20 pts)
                const trendingScore = trendingScores.get(product.id) || 0;
                score += trendingScore;
                scoreBreakdown.trending = trendingScore;
                if (trendingScore > 5) reasons.push('trending');

                // Freshness bonus (10 pts) - products created in last 7 days
                const productAge = Date.now() - new Date(product.created_at || 0).getTime();
                let freshnessScore = 0;
                if (productAge < 7 * 24 * 60 * 60 * 1000) {
                    freshnessScore = 10;
                    reasons.push('new');
                } else if (productAge < 14 * 24 * 60 * 60 * 1000) {
                    freshnessScore = 5;
                }
                score += freshnessScore;
                scoreBreakdown.freshness = freshnessScore;

                // Small seeded random factor for variety (0-2 pts) - deterministic per day
                const randomScore = getSeededRandom(product.id);
                score += randomScore;
                scoreBreakdown.random = randomScore;

                // Log for debugging (only top products)
                if (score > 30) {
                    logger.debug('Product recommendation scored', {
                        product_id: product.id,
                        product_name: product.name,
                        reasons,
                        score_breakdown: scoreBreakdown,
                        total_score: score
                    });
                }

                return { product, score, reasons, scoreBreakdown };
            });

            // 10. Sort with deterministic tiebreaker
            const sorted = scoredProducts
                .filter(p => p.score >= 0)
                .sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    // Tiebreaker: product ID for determinism
                    return a.product.id.localeCompare(b.product.id);
                });

            // Apply category diversity (max 40% from any single category)
            const categoryCounts: Record<string, number> = {};
            const maxPerCategory = 4; // Max 4 out of 10 from same category

            const diversified = sorted.filter(({ product }) => {
                const catId = product.category_id || 'uncategorized';
                categoryCounts[catId] = (categoryCounts[catId] || 0) + 1;
                return categoryCounts[catId] <= maxPerCategory;
            }).slice(0, 12);

            if (isMountedRef.current) {
                setRecommendedProducts(diversified.map(d => d.product));
            }

            // Also set trending (top products by trending score only)
            const trendingOnly = [...productsWithVariants]
                .filter(p => !recentlyPurchasedIds.has(p.id))
                .sort((a, b) => {
                    const scoreA = trendingScores.get(a.id) || 0;
                    const scoreB = trendingScores.get(b.id) || 0;
                    if (scoreB !== scoreA) return scoreB - scoreA;
                    return a.id.localeCompare(b.id); // Deterministic tiebreaker
                })
                .slice(0, 8);

            if (isMountedRef.current) {
                setTrendingProducts(trendingOnly);
            }

        } catch (e) {
            logger.error('Recommendations error', { error: e });
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, [user, calculateTrending, getSeededRandom]);

    useEffect(() => {
        isMountedRef.current = true;
        fetchRecommendations();

        return () => {
            isMountedRef.current = false;
        };
    }, [fetchRecommendations]);

    return { recommendedProducts, trendingProducts, isLoading, trackView };
}
