import { TrendingUp, Flame, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useTrendingProducts } from '@/hooks/useTrendingProducts';
import ProductCard from '@/components/ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface TrendingSectionProps {
    onAddToCart: (productId: string) => void;
}

// Maximum products shown in grid (3 cols × 2 rows)
const GRID_CAPACITY = 6;
// Total products to fetch (more than grid to know if "See all" should show)
const FETCH_COUNT = 12;

/**
 * Trending Section Component
 * Shows products that are trending based on recent purchase activity.
 * 
 * Layout:
 * - 2-row grid: fills first row (3 products), then second row
 * - "See all" button only shows when more products exist beyond the grid
 */
export default function TrendingSection({ onAddToCart }: TrendingSectionProps) {
    const navigate = useNavigate();
    const { getItemQuantity, updateQuantity } = useCart();
    const { products, isLoading, error } = useTrendingProducts(FETCH_COUNT);

    // Loading state with 2-row skeleton
    if (isLoading) {
        return (
            <div className="py-4 px-4">
                <div className="flex items-center gap-2 mb-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-6 w-32" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i}>
                            <div className="rounded-2xl border-2 border-border/40 bg-card overflow-hidden">
                                <Skeleton className="aspect-square w-full" />
                                <div className="p-2 space-y-1">
                                    <Skeleton className="h-3 w-3/4" />
                                    <Skeleton className="h-4 w-12" />
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

    // Only show "See all" if there are more products than what fits in the grid
    const hasMoreProducts = products.length > GRID_CAPACITY;
    const displayedProducts = products.slice(0, GRID_CAPACITY);

    return (
        <div className="py-4 px-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
                    <TrendingUp className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-lg font-bold flex items-center gap-1">
                    Trending Now
                    <Flame className="h-4 w-4 text-orange-500 ml-1" />
                </h2>
            </div>

            {/* 2-Row Grid: fills row by row (3 per row) */}
            <div className="grid grid-cols-3 gap-3">
                {displayedProducts.map((product, index) => (
                    <div key={product.id} className="relative">
                        {/* Trending rank badge for top 3 */}
                        {index < 3 && (
                            <div className="absolute top-1 left-1 z-10 w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-md text-white text-[10px] font-bold">
                                {index + 1}
                            </div>
                        )}
                        <ProductCard
                            product={{
                                id: product.id,
                                name: product.name,
                                price: product.price,
                                mrp: product.mrp ?? null,
                                image_url: product.image_url,
                                unit: product.unit || '1 unit',
                                discount_percent: product.discount_percent ?? null,
                                default_variant: product.default_variant ?? null,
                                stock_quantity: product.stock_quantity ?? undefined,
                            }}
                            onAddToCart={() => onAddToCart(product.id)}
                            cartQuantity={getItemQuantity(product.id, null)}
                            onQuantityChange={(id, qty) => updateQuantity(id, null, qty)}
                        />
                    </div>
                ))}
            </div>

            {/* See All Button - Only show if more products exist */}
            {hasMoreProducts && (
                <Button
                    className="w-full mt-3 h-10 text-sm font-medium bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => navigate('/trending')}
                >
                    See all
                    <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            )}
        </div>
    );
}
