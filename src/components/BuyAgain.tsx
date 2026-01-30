import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Heart, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ProductCard from '@/components/ProductCard';

interface ProductVariant {
    id: string;
    variant_name: string;
    variant_value: number;
    variant_unit: string;
    price: number;
    mrp: number | null;
    is_default: boolean | null;
}

interface BuyAgainProduct {
    id: string;
    name: string;
    price: number;
    mrp: number | null;
    image_url: string | null;
    unit: string;
    discount_percent?: number | null;
    default_variant?: ProductVariant | null;
    // Scoring metadata
    purchaseCount?: number;
    lastPurchasedAt?: Date;
    buyAgainScore?: number;
}

interface BuyAgainProps {
    onAddToCart: (productId: string) => void;
}

/**
 * Buy Again Component
 * Shows products the user has previously purchased, weighted by recency and frequency.
 * 
 * Algorithm:
 * 1. Query DELIVERED orders only (not pending/cancelled)
 * 2. Calculate recency score: exp(-days/30) with 30-day half-life
 * 3. Calculate frequency score: purchase_count / max_purchases_for_user (normalized to [0,1])
 * 4. Final score: 60% recency + 40% frequency
 * 
 * Design Decisions:
 * - Only delivered orders count (ensures real successful purchases)
 * - Frequency is normalized per-user (fair for both power users and occasional buyers)
 * - Recency has higher weight (users more likely to repurchase recent items)
 * - Excludes out-of-stock and inactive products
 */
export default function BuyAgain({ onAddToCart }: BuyAgainProps) {
    const { user } = useAuth();
    const { getItemQuantity, updateQuantity } = useCart();
    const navigate = useNavigate();
    const [products, setProducts] = useState<BuyAgainProduct[]>([]);
    const [loading, setLoading] = useState(true);

    const isMountedRef = useRef(true);

    const fetchBuyAgainProducts = useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        try {
            // Try RPC function first (optimized server-side calculation)
            const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
                'get_buy_again_products',
                { p_user_id: user.id, p_limit: 12 }
            );

            if (!rpcError && rpcData && rpcData.length > 0) {
                // RPC returns optimally scored products
                const processedProducts: BuyAgainProduct[] = rpcData.map((p: any) => ({
                    id: p.product_id,
                    name: p.name,
                    price: p.price,
                    mrp: p.mrp,
                    image_url: p.image_url,
                    unit: p.unit,
                    discount_percent: null,
                    default_variant: null,
                    purchaseCount: p.purchase_count,
                    lastPurchasedAt: new Date(p.last_purchased_at),
                    buyAgainScore: p.buy_again_score
                }));

                // Fetch variants for these products
                const productIds = processedProducts.map(p => p.id);
                const { data: variants } = await supabase
                    .from('product_variants')
                    .select('*')
                    .in('product_id', productIds)
                    .eq('is_default', true);

                if (variants) {
                    processedProducts.forEach(product => {
                        const defaultVariant = variants.find(v => v.product_id === product.id);
                        if (defaultVariant) {
                            product.default_variant = defaultVariant as ProductVariant;
                        }
                    });
                }

                if (isMountedRef.current) {
                    setProducts(processedProducts);
                    setLoading(false);
                }
                return;
            }

            // Fallback: Calculate client-side
            // Step 1: Get DELIVERED orders only
            const { data: userOrders } = await supabase
                .from('orders')
                .select('id, created_at')
                .eq('user_id', user.id)
                .eq('status', 'delivered') // CRITICAL: Only delivered orders
                .order('created_at', { ascending: false })
                .limit(50); // Look at last 50 delivered orders

            if (!userOrders || userOrders.length === 0) {
                if (isMountedRef.current) {
                    setProducts([]);
                    setLoading(false);
                }
                return;
            }

            const orderIds = userOrders.map(o => o.id);
            const orderDates = new Map(userOrders.map(o => [o.id, new Date(o.created_at || Date.now())]));

            // Step 2: Get ordered products
            const { data: orderItems } = await supabase
                .from('order_items')
                .select('product_id, order_id, quantity')
                .in('order_id', orderIds);

            if (!orderItems || orderItems.length === 0) {
                if (isMountedRef.current) {
                    setProducts([]);
                    setLoading(false);
                }
                return;
            }

            // Step 3: Calculate per-product scores
            interface ProductPurchaseData {
                purchaseCount: number;
                totalQuantity: number;
                lastPurchased: Date;
            }

            const productData = new Map<string, ProductPurchaseData>();
            const now = Date.now();

            orderItems.forEach(item => {
                const orderDate = orderDates.get(item.order_id) || new Date();
                const existing = productData.get(item.product_id);

                if (existing) {
                    productData.set(item.product_id, {
                        purchaseCount: existing.purchaseCount + 1,
                        totalQuantity: existing.totalQuantity + item.quantity,
                        lastPurchased: orderDate > existing.lastPurchased ? orderDate : existing.lastPurchased
                    });
                } else {
                    productData.set(item.product_id, {
                        purchaseCount: 1,
                        totalQuantity: item.quantity,
                        lastPurchased: orderDate
                    });
                }
            });

            // Step 4: Calculate scores (normalized per user)
            const maxPurchases = Math.max(...Array.from(productData.values()).map(d => d.purchaseCount), 1);

            const scoredProducts = Array.from(productData.entries()).map(([productId, data]) => {
                const daysSincePurchase = (now - data.lastPurchased.getTime()) / (1000 * 60 * 60 * 24);
                // Recency: 30-day half-life
                const recencyScore = Math.exp(-daysSincePurchase / 30);
                // Frequency: Normalized to [0,1] per user
                const frequencyScore = Math.min(data.purchaseCount / maxPurchases, 1);
                // Final score: 60% recency + 40% frequency
                const finalScore = recencyScore * 0.6 + frequencyScore * 0.4;

                return {
                    productId,
                    ...data,
                    recencyScore,
                    frequencyScore,
                    finalScore
                };
            });

            // Sort by final score
            scoredProducts.sort((a, b) => b.finalScore - a.finalScore);
            const topProductIds = scoredProducts.slice(0, 12).map(p => p.productId);

            if (topProductIds.length === 0) {
                if (isMountedRef.current) {
                    setProducts([]);
                    setLoading(false);
                }
                return;
            }

            // Step 5: Fetch product details (only active and in-stock)
            const { data: productsData } = await supabase
                .from('products')
                .select(`
                    id, name, price, mrp, image_url, unit, discount_percent,
                    product_variants!left(id, variant_name, variant_value, variant_unit, price, mrp, is_default)
                `)
                .in('id', topProductIds)
                .eq('is_active', true)
                .gt('stock_quantity', 0);

            if (!productsData || productsData.length === 0) {
                if (isMountedRef.current) {
                    setProducts([]);
                    setLoading(false);
                }
                return;
            }

            // Build final list maintaining score order
            const productMap = new Map(productsData.map(p => [p.id, p]));
            const finalProducts: BuyAgainProduct[] = [];

            scoredProducts.forEach(scored => {
                const product = productMap.get(scored.productId);
                if (product && finalProducts.length < 10) {
                    const variants = product.product_variants || [];
                    const defaultVariant = variants.find((v: any) => v.is_default) || variants[0] || null;

                    finalProducts.push({
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        mrp: product.mrp,
                        image_url: product.image_url,
                        unit: product.unit || 'piece',
                        discount_percent: product.discount_percent,
                        default_variant: defaultVariant,
                        purchaseCount: scored.purchaseCount,
                        lastPurchasedAt: scored.lastPurchased,
                        buyAgainScore: scored.finalScore
                    });
                }
            });

            if (isMountedRef.current) {
                setProducts(finalProducts);
            }
        } catch (error) {
            logger.error('BuyAgain fetch error', { error });
            if (isMountedRef.current) {
                setProducts([]);
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [user]);

    useEffect(() => {
        isMountedRef.current = true;

        if (user) {
            fetchBuyAgainProducts();
        } else {
            setLoading(false);
        }

        return () => {
            isMountedRef.current = false;
        };
    }, [user, fetchBuyAgainProducts]);

    // Don't render if loading, not logged in, or no products
    if (loading || !user || products.length === 0) return null;

    return (
        <div className="py-4">
            {/* Header */}
            <div className="flex items-center justify-between px-4 mb-3">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <Heart className="h-5 w-5 text-red-500 fill-red-500" />
                    Buy Again
                </h2>
                <button
                    onClick={() => navigate('/orders')}
                    className="text-primary text-sm font-medium flex items-center gap-1 hover:underline"
                >
                    View Orders <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {/* Horizontal Scroll Cards */}
            <div
                className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide"
                style={{ scrollbarWidth: 'none' }}
            >
                {products.map((product) => (
                    <div key={product.id} className="flex-shrink-0 w-[150px]">
                        <ProductCard
                            product={product}
                            onAddToCart={onAddToCart}
                            cartQuantity={getItemQuantity(product.id, null)}
                            onQuantityChange={(id, qty) => updateQuantity(id, null, qty)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
