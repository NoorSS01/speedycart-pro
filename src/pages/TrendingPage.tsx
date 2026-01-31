import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useTrendingProducts } from '@/hooks/useTrendingProducts';
import ProductCard from '@/components/ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';

/**
 * Trending Page Component
 * Shows all trending products with proper header.
 * Navigated from "See all" button in TrendingSection.
 */
export default function TrendingPage() {
    const navigate = useNavigate();
    const { getItemQuantity, updateQuantity, addToCart: contextAddToCart } = useCart();
    const { products, isLoading, error } = useTrendingProducts(50); // Fetch more for full page

    const handleAddToCart = async (productId: string) => {
        await contextAddToCart(productId, null);
    };

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
                <div className="container mx-auto px-4 py-4 flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-lg font-bold">Trending Now</h1>
                </div>
            </header>

            {/* Content */}
            <div className="container mx-auto px-4 py-6">
                {isLoading ? (
                    <div className="grid grid-cols-3 gap-3">
                        {Array.from({ length: 12 }).map((_, i) => (
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
                ) : error || products.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">No trending products found</p>
                        <Button onClick={() => navigate('/shop')} className="mt-4">
                            Back to Shop
                        </Button>
                    </div>
                ) : (
                    <>
                        <p className="text-muted-foreground mb-4">{products.length} trending products</p>
                        <div className="grid grid-cols-3 gap-3">
                            {products.map((product, index) => (
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
                                        onAddToCart={() => handleAddToCart(product.id)}
                                        cartQuantity={getItemQuantity(product.id, null)}
                                        onQuantityChange={(id, qty) => updateQuantity(id, null, qty)}
                                    />
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <BottomNav />
        </div>
    );
}
