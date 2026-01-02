import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AnimatedSearchBarProps {
    value: string;
    onChange: (value: string) => void;
    onFocus?: () => void;
    className?: string;
}

export default function AnimatedSearchBar({ value, onChange, onFocus, className = '' }: AnimatedSearchBarProps) {
    const [productNames, setProductNames] = useState<string[]>([
        'Milk',
        'Bread',
        'Eggs',
        'Fruits',
        'Vegetables',
    ]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    // Fetch random product names on mount
    useEffect(() => {
        fetchProductNames();
    }, []);

    const fetchProductNames = async () => {
        try {
            const { data } = await supabase
                .from('products')
                .select('name')
                .eq('is_active', true)
                .limit(20);

            if (data && data.length > 0) {
                // Get random selection and shuffle
                const names = data.map(p => p.name);
                const shuffled = names.sort(() => Math.random() - 0.5).slice(0, 8);
                setProductNames(shuffled);
            }
        } catch (error) {
            console.log('Could not fetch product names for animation');
        }
    };

    // Animate through product names
    useEffect(() => {
        if (isFocused || value.length > 0 || productNames.length <= 1) return;

        const interval = setInterval(() => {
            setIsAnimating(true);

            setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % productNames.length);
                setIsAnimating(false);
            }, 300); // Half of animation duration
        }, 3000); // Change every 3 seconds

        return () => clearInterval(interval);
    }, [isFocused, value, productNames.length]);

    const handleFocus = useCallback(() => {
        setIsFocused(true);
        onFocus?.();
    }, [onFocus]);

    const handleBlur = useCallback(() => {
        setIsFocused(false);
    }, []);

    const currentProduct = productNames[currentIndex] || 'products';
    const showPlaceholder = !isFocused && value.length === 0;

    return (
        <div className={`relative ${className}`}>
            <div className="relative flex items-center bg-muted/60 rounded-xl border border-border/50 overflow-hidden hover:border-primary/30 transition-colors">
                {/* Search Icon */}
                <div className="pl-4 pr-2 flex items-center">
                    <Search className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Input */}
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    className="w-full py-3 pr-4 bg-transparent outline-none text-foreground placeholder-transparent"
                    placeholder="Search..."
                />

                {/* Animated Placeholder */}
                {showPlaceholder && (
                    <div className="absolute left-12 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
                        {/* Static "Search for" text */}
                        <span className="text-muted-foreground">Search for </span>

                        {/* Animated product name container */}
                        <div className="overflow-hidden h-6 flex items-center">
                            <div
                                className={`transition-all duration-300 ease-in-out ${isAnimating
                                    ? 'transform -translate-y-full opacity-0'
                                    : 'transform translate-y-0 opacity-100'
                                    }`}
                            >
                                <span className="text-foreground font-medium">
                                    "{currentProduct}"
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
