import { useState, useRef, ReactNode } from 'react';
import { Trash2 } from 'lucide-react';

interface SwipeableCardProps {
    children: ReactNode;
    onDismiss: () => void;
    dismissThreshold?: number;
}

export function SwipeableCard({
    children,
    onDismiss,
    dismissThreshold = 100
}: SwipeableCardProps) {
    const [offsetX, setOffsetX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startXRef = useRef(0);
    const cardRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        startXRef.current = e.touches[0].clientX;
        setIsDragging(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;

        const currentX = e.touches[0].clientX;
        const diff = currentX - startXRef.current;

        // Only allow left swipe (negative direction)
        if (diff < 0) {
            setOffsetX(Math.max(diff, -dismissThreshold - 50));
        } else {
            setOffsetX(0);
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);

        if (Math.abs(offsetX) > dismissThreshold) {
            // Animate out and dismiss
            setOffsetX(-window.innerWidth);
            setTimeout(onDismiss, 200);
        } else {
            // Snap back
            setOffsetX(0);
        }
    };

    const progress = Math.min(Math.abs(offsetX) / dismissThreshold, 1);

    return (
        <div className="relative overflow-hidden rounded-lg">
            {/* Delete indicator background */}
            <div
                className="absolute inset-0 bg-destructive flex items-center justify-end pr-6 rounded-lg"
                style={{ opacity: progress }}
            >
                <div className="text-white flex items-center gap-2">
                    <Trash2 className="h-5 w-5" />
                    <span className="font-medium text-sm">Remove</span>
                </div>
            </div>

            {/* Swipeable content */}
            <div
                ref={cardRef}
                className="relative bg-card transition-transform duration-200 ease-out"
                style={{
                    transform: `translateX(${offsetX}px)`,
                    transitionDuration: isDragging ? '0ms' : '200ms'
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {children}
            </div>
        </div>
    );
}

export default SwipeableCard;
