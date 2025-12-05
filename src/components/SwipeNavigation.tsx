import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSwipe } from '@/hooks/useSwipe';

interface SwipeNavigationProps {
    children: ReactNode;
    routes?: string[]; // Ordered list of routes for swipe navigation
    enabled?: boolean;
}

// Default navigation order for main app pages
const defaultRoutes = ['/', '/shop', '/orders', '/profile'];

export function SwipeNavigation({
    children,
    routes = defaultRoutes,
    enabled = true
}: SwipeNavigationProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [swipeIndicator, setSwipeIndicator] = useState<'left' | 'right' | null>(null);

    const currentIndex = routes.indexOf(location.pathname);

    const swipeHandlers = useSwipe({
        onSwipeLeft: () => {
            if (!enabled || currentIndex === -1) return;
            const nextIndex = currentIndex + 1;
            if (nextIndex < routes.length) {
                setSwipeIndicator('left');
                setTimeout(() => {
                    navigate(routes[nextIndex]);
                    setSwipeIndicator(null);
                }, 150);
            }
        },
        onSwipeRight: () => {
            if (!enabled || currentIndex === -1) return;
            const prevIndex = currentIndex - 1;
            if (prevIndex >= 0) {
                setSwipeIndicator('right');
                setTimeout(() => {
                    navigate(routes[prevIndex]);
                    setSwipeIndicator(null);
                }, 150);
            }
        },
        threshold: 80, // Require longer swipe for navigation
    });

    // Only enable swipe on touch devices
    const isTouchDevice = 'ontouchstart' in window;

    if (!isTouchDevice || !enabled) {
        return <>{children}</>;
    }

    return (
        <div
            {...swipeHandlers}
            className={`transition-transform duration-150 ease-out ${swipeIndicator === 'left' ? 'translate-x-[-10px]' :
                    swipeIndicator === 'right' ? 'translate-x-[10px]' : ''
                }`}
        >
            {children}

            {/* Swipe indicator dots */}
            {currentIndex !== -1 && (
                <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 flex gap-1.5 z-40 md:hidden">
                    {routes.map((route, index) => (
                        <div
                            key={route}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${index === currentIndex
                                    ? 'bg-primary w-4'
                                    : 'bg-muted-foreground/30'
                                }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default SwipeNavigation;
