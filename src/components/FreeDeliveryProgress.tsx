import { cn } from '@/lib/utils';

interface FreeDeliveryProgressProps {
    threshold?: number; // Free delivery threshold in rupees
    cartTotal?: number; // Cart total in rupees (passed from parent)
    className?: string;
}

// Custom Scooty/Bike SVG Icon Component
function ScootyIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            {/* Wheels */}
            <circle cx="5" cy="17" r="3" />
            <circle cx="19" cy="17" r="3" />
            {/* Body/Frame */}
            <path d="M5 17h2l2-4h6l1 4h3" />
            {/* Handlebar */}
            <path d="M15 9l2-3h2" />
            {/* Seat */}
            <path d="M8 13h5" />
            {/* Rider silhouette */}
            <circle cx="11" cy="7" r="2" />
            <path d="M11 9v3" />
        </svg>
    );
}

/**
 * Free Delivery Progress Icon Component
 * Shows a scooty icon with fill progress toward free delivery threshold
 * PM Spec: Small delivery icon with fill progress, shows remaining amount
 * Visible for ALL users (authenticated or not) when cart has items
 */
export default function FreeDeliveryProgress({
    threshold = 499,
    cartTotal = 0,
    className
}: FreeDeliveryProgressProps) {
    // Calculate fill percentage (0-100)
    const fillPercent = Math.min((cartTotal / threshold) * 100, 100);
    const isFreeDelivery = cartTotal >= threshold;
    const remaining = Math.max(threshold - cartTotal, 0);

    // Don't show if cart is empty (works for both guest and authenticated)
    if (cartTotal === 0) {
        return null;
    }

    return (
        <div
            className={cn(
                "relative flex items-center gap-1.5 px-2 py-1 rounded-full transition-all duration-300",
                isFreeDelivery
                    ? "bg-green-100 dark:bg-green-900/30"
                    : "bg-muted/50",
                className
            )}
            title={isFreeDelivery ? "Free delivery!" : `Add ₹${remaining.toFixed(0)} more for free delivery`}
        >
            {/* Scooty icon with fill overlay */}
            <div className="relative w-5 h-5">
                {/* Background scooty (gray) */}
                <ScootyIcon className="absolute inset-0 h-5 w-5 text-muted-foreground/30" />

                {/* Filled scooty (clipped based on progress) */}
                <div
                    className="absolute inset-0 overflow-hidden transition-all duration-500"
                    style={{ width: `${fillPercent}%` }}
                >
                    <ScootyIcon
                        className={cn(
                            "h-5 w-5 transition-colors",
                            isFreeDelivery ? "text-green-600" : "text-primary"
                        )}
                    />
                </div>
            </div>

            {/* Progress text - compact */}
            <span
                className={cn(
                    "text-xs font-medium tabular-nums transition-colors",
                    isFreeDelivery ? "text-green-600" : "text-muted-foreground"
                )}
            >
                {isFreeDelivery ? (
                    "FREE"
                ) : (
                    `₹${remaining.toFixed(0)}`
                )}
            </span>
        </div>
    );
}

