import { useState, useRef, useEffect, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
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

    const PULL_THRESHOLD = 60;
    const MAX_PULL = 100;

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let pulling = false;
        let startYPos = 0;

        const handleTouchStart = (e: TouchEvent) => {
            if (container.scrollTop <= 0 && !isRefreshing) {
                startYPos = e.touches[0].clientY;
                pulling = true;
                startY.current = startYPos;
                setIsPulling(true);
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!pulling || isRefreshing) return;

            const currentY = e.touches[0].clientY;
            const diff = currentY - startY.current;

            if (diff > 0 && container.scrollTop <= 0) {
                e.preventDefault();
                const distance = Math.min(diff * 0.4, MAX_PULL);
                setPullDistance(distance);
            }
        };

        const handleTouchEnd = async () => {
            if (!pulling) return;
            pulling = false;

            const distance = pullDistance;

            if (distance >= PULL_THRESHOLD && !isRefreshing) {
                setIsRefreshing(true);
                setPullDistance(50); // Keep at fixed position while refreshing

                try {
                    await onRefresh();
                } finally {
                    // Smooth exit animation
                    setPullDistance(0);
                    setTimeout(() => {
                        setIsRefreshing(false);
                    }, 300);
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
    }, [isRefreshing, pullDistance, onRefresh]);

    const showSpinner = pullDistance > 20 || isRefreshing;
    const spinnerProgress = Math.min(pullDistance / PULL_THRESHOLD, 1);

    return (
        <div
            ref={containerRef}
            className={cn("relative", className)}
            style={{
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch'
            }}
        >
            {/* Native-style spinner indicator */}
            <div
                className="absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                style={{
                    top: 8,
                    opacity: showSpinner ? 1 : 0,
                    transform: `translateX(-50%) translateY(${Math.min(pullDistance * 0.5, 30)}px)`,
                    transition: isPulling ? 'opacity 0.15s' : 'all 0.3s ease-out'
                }}
            >
                <div className="w-10 h-10 rounded-full bg-background/95 shadow-lg border border-border/50 flex items-center justify-center backdrop-blur-sm">
                    <Loader2
                        className={cn(
                            "h-5 w-5 text-primary transition-all",
                            isRefreshing && "animate-spin"
                        )}
                        style={{
                            opacity: spinnerProgress,
                            transform: `rotate(${spinnerProgress * 180}deg)`
                        }}
                    />
                </div>
            </div>

            {/* Content with pull effect */}
            <div
                style={{
                    transform: `translateY(${pullDistance * 0.3}px)`,
                    transition: isPulling ? 'none' : 'transform 0.3s ease-out'
                }}
            >
                {children}
            </div>
        </div>
    );
}
