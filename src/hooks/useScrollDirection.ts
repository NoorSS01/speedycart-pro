import { useState, useEffect, useCallback } from 'react';

interface ScrollState {
    /** Whether scrolling down */
    isScrollingDown: boolean;
    /** Whether at the very top of page */
    isAtTop: boolean;
    /** Whether scrolling up */
    isScrollingUp: boolean;
    /** Current scroll position */
    scrollY: number;
}

/**
 * Hook to detect scroll direction and position
 * Used for hiding/showing navbars based on scroll behavior
 * 
 * PM Spec:
 * - Scroll Down: Top nav hides, bottom nav hides, search stays sticky
 * - Scroll Up: Bottom nav shows, top nav stays hidden
 * - At Page Top: All elements visible
 */
export function useScrollDirection(threshold = 10): ScrollState {
    const [scrollState, setScrollState] = useState<ScrollState>({
        isScrollingDown: false,
        isAtTop: true,
        isScrollingUp: false,
        scrollY: 0,
    });

    const handleScroll = useCallback(() => {
        const currentScrollY = window.scrollY;
        const prevScrollY = scrollState.scrollY;
        const isAtTop = currentScrollY < threshold;

        // Determine direction (with threshold to avoid jitter)
        const diff = currentScrollY - prevScrollY;
        const isScrollingDown = diff > threshold;
        const isScrollingUp = diff < -threshold;

        // Only update if there's a meaningful change
        if (
            isAtTop !== scrollState.isAtTop ||
            (isScrollingDown && !scrollState.isScrollingDown) ||
            (isScrollingUp && !scrollState.isScrollingUp)
        ) {
            setScrollState({
                isScrollingDown,
                isScrollingUp,
                isAtTop,
                scrollY: currentScrollY,
            });
        } else {
            // Just update scroll position for next comparison
            setScrollState(prev => ({ ...prev, scrollY: currentScrollY }));
        }
    }, [scrollState.scrollY, scrollState.isAtTop, scrollState.isScrollingDown, scrollState.isScrollingUp, threshold]);

    useEffect(() => {
        // Use passive listener for performance
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    return scrollState;
}

export default useScrollDirection;
