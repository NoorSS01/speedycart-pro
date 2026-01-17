import { cn } from '@/lib/utils';
import { Bike, PartyPopper, Sparkles } from 'lucide-react';
import { useAppSettingsOptional } from '@/contexts/AppSettingsContext';

interface FreeDeliveryBannerProps {
    threshold?: number; // Fallback if not using context
    cartTotal?: number;
    className?: string;
}

/**
 * Free Delivery Progress Banner
 * Floating banner above bottom nav showing progress towards free delivery
 * Uses app settings context for threshold, falls back to prop
 */
export default function FreeDeliveryBanner({
    threshold: propThreshold = 499,
    cartTotal = 0,
    className
}: FreeDeliveryBannerProps) {
    const appSettings = useAppSettingsOptional();

    // Use context threshold if available, otherwise use prop
    const threshold = appSettings?.freeDeliveryThreshold ?? propThreshold;
    const isFreeDelivery = cartTotal >= threshold;
    const remaining = Math.max(threshold - cartTotal, 0);
    const progressPercent = Math.min((cartTotal / threshold) * 100, 100);

    // Don't show if cart is empty
    if (cartTotal === 0) {
        return null;
    }

    return (
        <div
            className={cn(
                "fixed bottom-20 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 animate-in slide-in-from-bottom-4",
                className
            )}
        >
            <div
                className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-full shadow-lg backdrop-blur-sm",
                    isFreeDelivery
                        ? "bg-gradient-to-r from-green-600 to-emerald-500 text-white"
                        : "bg-gray-900/95 text-white"
                )}
            >
                {/* Icon */}
                <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full",
                    isFreeDelivery ? "bg-white/20" : "bg-primary/20"
                )}>
                    {isFreeDelivery ? (
                        <PartyPopper className="h-4 w-4 text-white" />
                    ) : (
                        <Bike className="h-4 w-4 text-primary" />
                    )}
                </div>

                {/* Text Content */}
                <div className="flex items-center gap-2">
                    {isFreeDelivery ? (
                        <>
                            <span className="font-semibold text-sm">Free delivery unlocked!</span>
                            <Sparkles className="h-4 w-4 text-yellow-300 animate-pulse" />
                        </>
                    ) : (
                        <>
                            <span className="text-sm">
                                Add <span className="font-bold text-primary">₹{remaining.toFixed(0)}</span> more for
                            </span>
                            <span className="font-semibold text-sm text-green-400">FREE delivery</span>
                        </>
                    )}
                </div>

                {/* Progress indicator (only when not unlocked) */}
                {!isFreeDelivery && (
                    <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary to-green-400 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
