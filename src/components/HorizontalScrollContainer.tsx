import { useRef, useState, useEffect, ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HorizontalScrollContainerProps {
    children: ReactNode;
    className?: string;
    showButtons?: boolean;
}

export default function HorizontalScrollContainer({
    children,
    className = '',
    showButtons = true
}: HorizontalScrollContainerProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScrollability = () => {
        const el = scrollRef.current;
        if (!el) return;

        setCanScrollLeft(el.scrollLeft > 10);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    };

    useEffect(() => {
        checkScrollability();
        const el = scrollRef.current;
        if (el) {
            el.addEventListener('scroll', checkScrollability);
            window.addEventListener('resize', checkScrollability);

            // Check after content loads
            const timer = setTimeout(checkScrollability, 100);

            return () => {
                el.removeEventListener('scroll', checkScrollability);
                window.removeEventListener('resize', checkScrollability);
                clearTimeout(timer);
            };
        }
    }, [children]);

    const scroll = (direction: 'left' | 'right') => {
        const el = scrollRef.current;
        if (!el) return;

        const scrollAmount = el.clientWidth * 0.7;
        el.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    };

    return (
        <div className="relative group">
            {/* Scroll Buttons - Subtle, less distracting */}
            {showButtons && canScrollLeft && (
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 
                        w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm 
                        border border-border/50 shadow-sm
                        flex items-center justify-center
                        opacity-0 group-hover:opacity-100 transition-opacity duration-200
                        hover:bg-background hover:shadow-md"
                    aria-label="Scroll left"
                >
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </button>
            )}

            {showButtons && canScrollRight && (
                <button
                    onClick={() => scroll('right')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 
                        w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm 
                        border border-border/50 shadow-sm
                        flex items-center justify-center
                        opacity-0 group-hover:opacity-100 transition-opacity duration-200
                        hover:bg-background hover:shadow-md"
                    aria-label="Scroll right"
                >
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
            )}

            {/* Scroll Container */}
            <div
                ref={scrollRef}
                className={`flex overflow-x-auto scrollbar-hide ${className}`}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {children}
            </div>
        </div>
    );
}
