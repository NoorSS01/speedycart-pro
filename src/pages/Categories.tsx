import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, User } from 'lucide-react';
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

    // Fetch categories for all users (guests and authenticated)
    useEffect(() => {
        fetchCategories();
    }, []);

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

    // Handle profile button - redirect to auth if guest, profile if authenticated
    const handleProfileClick = () => {
        if (user) {
            navigate('/profile');
        } else {
            navigate('/auth');
        }
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
                                <img src="/dist/logo.svg" alt="PremaShop" className="h-8 w-auto" />
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
                            onClick={handleProfileClick}
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

                {/* Categories Grid - Circular Icons Style */}
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4 sm:gap-6">
                    {categories.map((category) => (
                        <button
                            key={category.id}
                            onClick={() => handleCategoryClick(category.id)}
                            className="flex flex-col items-center gap-2 group"
                        >
                            {/* Circular Category Image */}
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-transparent group-hover:border-primary transition-all shadow-sm group-hover:shadow-md">
                                {category.image_url ? (
                                    <img
                                        src={category.image_url}
                                        alt={category.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10">
                                        <Package className="h-6 w-6 text-primary/60" />
                                    </div>
                                )}
                            </div>

                            {/* Category Name */}
                            <span className="text-xs text-center font-medium text-muted-foreground group-hover:text-primary transition-colors line-clamp-2 max-w-[70px]">
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
