import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Package, User } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

interface Category {
    id: string;
    name: string;
    image_url: string | null;
}

export default function Categories() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            navigate('/auth');
            return;
        }
        fetchCategories();
    }, [user, authLoading, navigate]);

    const fetchCategories = async () => {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('is_active', true)
            .order('display_order');

        if (!error && data) {
            setCategories(data);
        }
        setLoading(false);
    };

    const handleCategoryClick = (categoryId: string) => {
        navigate(`/shop?category=${categoryId}`);
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-20">
                {/* Header Skeleton */}
                <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur-xl">
                    <div className="container mx-auto px-4 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                                <Skeleton className="h-7 w-32" />
                                <Skeleton className="h-3 w-40 ml-8" />
                            </div>
                            <Skeleton className="h-10 w-10 rounded-full" />
                        </div>
                    </div>
                </header>

                {/* Categories Grid Skeleton */}
                <main className="container mx-auto px-4 py-6">
                    <Skeleton className="h-8 w-40 mb-6" />
                    <div className="grid grid-cols-4 gap-4">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="flex flex-col items-center gap-2">
                                <Skeleton className="w-16 h-16 rounded-2xl" />
                                <Skeleton className="h-3 w-14" />
                            </div>
                        ))}
                    </div>
                </main>

                <BottomNav />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 pb-20">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 shadow-sm">
                <div className="container mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <Package className="h-6 w-6 text-primary" />
                                <h1 className="text-xl font-bold tracking-tight">PremaShop</h1>
                            </div>
                            <p className="text-xs text-muted-foreground font-medium ml-8">
                                ⚡ Rapid Delivery in 14 mins
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20"
                            onClick={() => navigate('/profile')}
                            aria-label="View Profile"
                        >
                            <User className="h-5 w-5 text-primary" />
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-6">
                <h2 className="text-lg font-semibold mb-4">All Categories</h2>

                {/* Categories Grid - Inspired by Design */}
                <div className="grid grid-cols-4 gap-3 sm:gap-4">
                    {categories.map((category) => (
                        <button
                            key={category.id}
                            onClick={() => handleCategoryClick(category.id)}
                            className="flex flex-col items-center gap-2 p-2 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900/40 dark:hover:to-pink-900/40 transition-all duration-200 border border-purple-100/50 dark:border-purple-800/30 active:scale-95"
                        >
                            {/* Category Image */}
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white dark:bg-gray-800 flex items-center justify-center overflow-hidden shadow-sm">
                                {category.image_url ? (
                                    <img
                                        src={category.image_url}
                                        alt={category.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Package className="h-6 w-6 text-primary/60" />
                                )}
                            </div>

                            {/* Category Name */}
                            <span className="text-xs text-center font-medium text-foreground/80 line-clamp-2 leading-tight">
                                {category.name}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Empty State */}
                {categories.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Package className="h-16 w-16 text-muted-foreground/40 mb-4" />
                        <p className="text-muted-foreground">No categories available</p>
                    </div>
                )}
            </main>

            <BottomNav />
        </div>
    );
}
