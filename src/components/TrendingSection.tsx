import { TrendingUp, Flame } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useTrendingProducts } from '@/hooks/useTrendingProducts';
import ProductCard from '@/components/ProductCard';
import HorizontalScrollContainer from '@/components/HorizontalScrollContainer';
import { Skeleton } from '@/components/ui/skeleton';

interface TrendingSectionProps {
    onAddToCart: (productId: string) => void;
}

/**
 * Trending Section Component
 * Shows products that are trending based on recent purchase activity.
 * 
 * Features:
 * - Time-decay weighted scoring (recent orders count more)
 * - Hybrid formula: 70% order count + 30% quantity
 * - Automatic fallback to newest products if insufficient data
 * - 5-minute caching to reduce server load
 * 
 * UX:
 * - Skeleton loading state
 * - Horizontal scroll with consistent card widths
 * - Fire emoji for extra visual appeal
 */
export default function TrendingSection({ onAddToCart }: TrendingSectionProps) {
    const { getItemQuantity, updateQuantity } = useCart();
    const { products, isLoading, error } = useTrendingProducts(10);

    // Loading state
    if (isLoading) {
        return (
            <div className="py-4">
                <div className="flex items-center gap-2 mb-3 px-4">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-6 w-32" />
                </div>
                <div className="flex gap-3 overflow-hidden px-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex-shrink-0 w-[150px]">
                            <div className="rounded-2xl border-2 border-border/40 bg-card overflow-hidden">
                                <Skeleton className="aspect-square w-full" />
                                <div className="p-3 space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-5 w-16" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Error or no products - silent fail (don't show section)
    if (error || products.length === 0) {
        return null;
    }

    return (
        <div className="py-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3 px-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
                    <TrendingUp className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-lg font-bold flex items-center gap-1">
                    Trending Now
                    <Flame className="h-4 w-4 text-orange-500 ml-1" />
                </h2>
            </div>

            {/* Horizontal Scroll Products */}
            <HorizontalScrollContainer className="gap-3">
                {products.map((product, index) => (
                    <div
                        key={product.id}
                        className="flex-shrink-0 w-[150px] relative"
                    >
                        {/* Trending rank badge for top 3 */}
                        {index < 3 && (
                            <div className="absolute -top-1 -left-1 z-10 w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg text-white text-xs font-bold">
                                {index + 1}
                            </div>
                        )}
                        <ProductCard
                            product={{
                                ...product,
                                mrp: product.mrp ?? null,
                                stock_quantity: product.stock_quantity ?? undefined,
                                default_variant: null
                            }}
                            onAddToCart={() => onAddToCart(product.id)}
                            cartQuantity={getItemQuantity(product.id, null)}
                            onQuantityChange={(id, qty) => updateQuantity(id, null, qty)}
                        />
                    </div>
                ))}
            </HorizontalScrollContainer>
        </div>
    );
}
