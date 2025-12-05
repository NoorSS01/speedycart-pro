import { useState, useRef, useCallback, TouchEvent } from 'react';

interface SwipeState {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    swiping: boolean;
}

interface SwipeHandlers {
    onTouchStart: (e: TouchEvent) => void;
    onTouchMove: (e: TouchEvent) => void;
    onTouchEnd: (e: TouchEvent) => void;
}

interface SwipeOptions {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    onSwipe?: (direction: 'left' | 'right' | 'up' | 'down', distance: number) => void;
    threshold?: number; // Minimum distance for a swipe (default: 50)
    preventScroll?: boolean; // Prevent default scroll behavior
}

interface UseSwipeReturn extends SwipeHandlers {
    direction: 'left' | 'right' | 'up' | 'down' | null;
    distance: number;
    isSwiping: boolean;
}

export function useSwipe(options: SwipeOptions = {}): UseSwipeReturn {
    const {
        onSwipeLeft,
        onSwipeRight,
        onSwipeUp,
        onSwipeDown,
        onSwipe,
        threshold = 50,
        preventScroll = false,
    } = options;

    const [direction, setDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);
    const [distance, setDistance] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);

    const swipeState = useRef<SwipeState>({
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
        swiping: false,
    });

    const onTouchStart = useCallback((e: TouchEvent) => {
        const touch = e.touches[0];
        swipeState.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            endX: touch.clientX,
            endY: touch.clientY,
            swiping: true,
        };
        setIsSwiping(true);
        setDirection(null);
        setDistance(0);
    }, []);

    const onTouchMove = useCallback((e: TouchEvent) => {
        if (!swipeState.current.swiping) return;

        const touch = e.touches[0];
        swipeState.current.endX = touch.clientX;
        swipeState.current.endY = touch.clientY;

        const deltaX = swipeState.current.endX - swipeState.current.startX;
        const deltaY = swipeState.current.endY - swipeState.current.startY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // Determine direction based on larger delta
        if (absX > absY) {
            setDirection(deltaX > 0 ? 'right' : 'left');
            setDistance(absX);
            if (preventScroll) e.preventDefault();
        } else {
            setDirection(deltaY > 0 ? 'down' : 'up');
            setDistance(absY);
        }
    }, [preventScroll]);

    const onTouchEnd = useCallback((e: TouchEvent) => {
        if (!swipeState.current.swiping) return;

        const deltaX = swipeState.current.endX - swipeState.current.startX;
        const deltaY = swipeState.current.endY - swipeState.current.startY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        swipeState.current.swiping = false;
        setIsSwiping(false);

        // Determine final swipe direction
        if (absX > absY && absX > threshold) {
            const dir = deltaX > 0 ? 'right' : 'left';
            if (dir === 'left') onSwipeLeft?.();
            if (dir === 'right') onSwipeRight?.();
            onSwipe?.(dir, absX);
        } else if (absY > absX && absY > threshold) {
            const dir = deltaY > 0 ? 'down' : 'up';
            if (dir === 'up') onSwipeUp?.();
            if (dir === 'down') onSwipeDown?.();
            onSwipe?.(dir, absY);
        }

        // Reset after a short delay
        setTimeout(() => {
            setDirection(null);
            setDistance(0);
        }, 100);
    }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onSwipe, threshold]);

    return {
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        direction,
        distance,
        isSwiping,
    };
}

export default useSwipe;
