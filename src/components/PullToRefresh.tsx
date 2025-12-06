import { useState, useRef, useEffect, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: ReactNode;
    className?: string;
}

export default function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
    const [isPulling, setIsPulling] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const currentY = useRef(0);

    const PULL_THRESHOLD = 80;
    const MAX_PULL = 120;

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleTouchStart = (e: TouchEvent) => {
            // Only start pull if at top of scroll
            if (container.scrollTop === 0) {
                startY.current = e.touches[0].clientY;
                setIsPulling(true);
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isPulling || isRefreshing) return;

            currentY.current = e.touches[0].clientY;
            const diff = currentY.current - startY.current;

            if (diff > 0 && container.scrollTop === 0) {
                e.preventDefault();
                // Apply resistance to pull
                const distance = Math.min(diff * 0.5, MAX_PULL);
                setPullDistance(distance);
            }
        };

        const handleTouchEnd = async () => {
            if (!isPulling) return;

            if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
                setIsRefreshing(true);
                setPullDistance(PULL_THRESHOLD);

                try {
                    await onRefresh();
                } finally {
                    setIsRefreshing(false);
                    setPullDistance(0);
                }
            } else {
                setPullDistance(0);
            }

            setIsPulling(false);
        };

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isPulling, isRefreshing, pullDistance, onRefresh]);

    const showIndicator = pullDistance > 10;
    const isReady = pullDistance >= PULL_THRESHOLD;

    return (
        <div
            ref={containerRef}
            className={cn("relative overflow-auto", className)}
            style={{
                transform: `translateY(${pullDistance}px)`,
                transition: isPulling ? 'none' : 'transform 0.3s ease-out'
            }}
        >
            {/* Pull indicator */}
            <div
                className={cn(
                    "absolute left-1/2 -translate-x-1/2 flex items-center justify-center transition-all duration-200",
                    showIndicator ? "opacity-100" : "opacity-0"
                )}
                style={{
                    top: -50,
                    height: 40
                }}
            >
                <div className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 backdrop-blur-sm border border-primary/20",
                    isReady && "bg-primary/20"
                )}>
                    <RefreshCw
                        className={cn(
                            "h-4 w-4 text-primary transition-transform",
                            isRefreshing && "animate-spin",
                            isReady && !isRefreshing && "rotate-180"
                        )}
                    />
                    <span className="text-xs font-medium text-primary">
                        {isRefreshing ? 'Refreshing...' : isReady ? 'Release to refresh' : 'Pull to refresh'}
                    </span>
                </div>
            </div>

            {children}
        </div>
    );
}
