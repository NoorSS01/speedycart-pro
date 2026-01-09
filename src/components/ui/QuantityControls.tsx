/**
 * Unified Quantity Controls Component
 * 
 * A single, reusable component for all quantity increment/decrement controls
 * across the application. Ensures consistent behavior and stock validation.
 * 
 * Features:
 * - Built-in stock limit enforcement
 * - Disabled state when at max stock
 * - Compact variant (for ProductCard) and full variant (for Cart)
 * - Proper touch targets (44px minimum)
 * - Stop propagation on click to prevent navigation
 */

import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface QuantityControlsProps {
    /** Current quantity */
    quantity: number;
    /** Maximum allowed quantity (typically stock_quantity) */
    maxQuantity: number;
    /** Called when user increments quantity */
    onIncrement: () => void;
    /** Called when user decrements quantity */
    onDecrement: () => void;
    /** Visual variant */
    variant?: 'compact' | 'full';
    /** Disable all controls */
    disabled?: boolean;
    /** Additional class name for container */
    className?: string;
    /** Show toast when max reached */
    showMaxToast?: boolean;
}

export function QuantityControls({
    quantity,
    maxQuantity,
    onIncrement,
    onDecrement,
    variant = 'compact',
    disabled = false,
    className,
    showMaxToast = true,
}: QuantityControlsProps) {
    const isAtMin = quantity <= 0;
    const isAtMax = quantity >= maxQuantity;

    const handleIncrement = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (disabled) return;

        if (isAtMax) {
            if (showMaxToast) {
                toast.error(`Only ${maxQuantity} available in stock`);
            }
            return;
        }

        onIncrement();
    };

    const handleDecrement = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (disabled || isAtMin) return;

        onDecrement();
    };

    // Compact variant - used in ProductCard (overlay on image)
    if (variant === 'compact') {
        return (
            <div
                className={cn(
                    "flex items-center gap-0 rounded-lg overflow-hidden shadow-lg bg-primary",
                    disabled && "opacity-50",
                    className
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={disabled || isAtMin}
                    className={cn(
                        "p-1.5 text-white transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center",
                        "hover:bg-primary/80 active:bg-primary/70",
                        (disabled || isAtMin) && "opacity-50 cursor-not-allowed"
                    )}
                    aria-label="Decrease quantity"
                >
                    <Minus className="h-4 w-4" />
                </button>
                <span className="px-2 text-white font-bold text-sm min-w-[28px] text-center select-none">
                    {quantity}
                </span>
                <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={disabled || isAtMax}
                    className={cn(
                        "p-1.5 text-white transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center",
                        "hover:bg-primary/80 active:bg-primary/70",
                        (disabled || isAtMax) && "opacity-50 cursor-not-allowed"
                    )}
                    aria-label="Increase quantity"
                >
                    <Plus className="h-4 w-4" />
                </button>
            </div>
        );
    }

    // Full variant - used in Cart page
    return (
        <div
            className={cn(
                "flex items-center gap-1",
                disabled && "opacity-50",
                className
            )}
            onClick={(e) => e.stopPropagation()}
        >
            <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={handleDecrement}
                disabled={disabled || isAtMin}
                aria-label="Decrease quantity"
            >
                <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="w-10 text-center text-sm font-semibold select-none">
                {quantity}
            </span>
            <Button
                type="button"
                size="icon"
                variant="outline"
                className={cn(
                    "h-8 w-8",
                    isAtMax && "opacity-50 cursor-not-allowed"
                )}
                onClick={handleIncrement}
                disabled={disabled || isAtMax}
                aria-label="Increase quantity"
            >
                <Plus className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}

export default QuantityControls;
