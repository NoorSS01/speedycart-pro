import { useState, useRef, ReactNode, TouchEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: ReactNode;
    className?: string;
}

export default function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const PULL_THRESHOLD = 70;
    const MAX_PULL = 120;

    const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
        const container = containerRef.current;
        if (!container) return;

        // Only enable pull if at top of scroll
        if (container.scrollTop <= 0 && !isRefreshing) {
            startY.current = e.touches[0].clientY;
        }
    };

    const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
        if (startY.current === null || isRefreshing) return;

        const container = containerRef.current;
        if (!container) return;

        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;

        // Only allow pull down when at top
        if (diff > 0 && container.scrollTop <= 0) {
            // Apply resistance
            const distance = Math.min(diff * 0.5, MAX_PULL);
            setPullDistance(distance);
        } else {
            setPullDistance(0);
        }
    };

    const handleTouchEnd = async () => {
        if (startY.current === null) return;

        startY.current = null;

        if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
            setIsRefreshing(true);
            setPullDistance(60);

            try {
                await onRefresh();
            } catch (error) {
                logger.error('Refresh failed', { error });
            } finally {
                setPullDistance(0);
                // Small delay before hiding spinner
                await new Promise(r => setTimeout(r, 200));
                setIsRefreshing(false);
            }
        } else {
            setPullDistance(0);
        }
    };

    const showSpinner = pullDistance > 15 || isRefreshing;
    const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
    const isReady = pullDistance >= PULL_THRESHOLD;

    return (
        <div
            ref={containerRef}
            className={cn("relative overflow-y-auto overflow-x-hidden", className)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
                WebkitOverflowScrolling: 'touch',
                touchAction: pullDistance > 0 ? 'none' : 'auto'
            }}
        >
            {/* Pull indicator */}
            <div
                className="absolute left-1/2 z-50 pointer-events-none"
                style={{
                    transform: `translateX(-50%)`,
                    top: Math.max(pullDistance * 0.6 - 20, 10),
                    opacity: showSpinner ? 1 : 0,
                    transition: startY.current !== null ? 'opacity 0.1s' : 'all 0.25s ease-out'
                }}
            >
                <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shadow-lg border backdrop-blur-sm",
                    isReady || isRefreshing
                        ? "bg-primary/20 border-primary/40"
                        : "bg-background/90 border-border/60"
                )}>
                    <Loader2
                        className={cn(
                            "h-5 w-5 transition-all",
                            isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"
                        )}
                        style={{
                            transform: isRefreshing ? 'none' : `rotate(${progress * 270}deg)`,
                            opacity: Math.max(progress, 0.3)
                        }}
                    />
                </div>
            </div>

            {/* Content */}
            <div
                style={{
                    transform: `translateY(${pullDistance * 0.4}px)`,
                    transition: startY.current !== null ? 'none' : 'transform 0.25s ease-out'
                }}
            >
                {children}
            </div>
        </div>
    );
}
