import { cn } from '@/lib/utils';
import { Bike, PartyPopper, Sparkles } from 'lucide-react';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FreeDeliveryBannerProps {
    threshold?: number; // Fallback if not using context
    cartTotal?: number; // Optional prop, will use context if not provided
    className?: string;
}

/**
 * Free Delivery Progress Banner
 * Floating banner above bottom nav showing progress towards free delivery
 * Uses app settings context for threshold value from admin settings
 * Now calculates cart total from CartContext for real-time updates
 */
export default function FreeDeliveryBanner({
    threshold: propThreshold = 499,
    cartTotal: propCartTotal,
    className
}: FreeDeliveryBannerProps) {
    const { freeDeliveryThreshold: contextThreshold } = useAppSettings();
    const { guestCartItems, cartItemCount } = useCart();
    const { user } = useAuth();
    const [calculatedCartTotal, setCalculatedCartTotal] = useState(0);

    // Use context threshold (from admin settings), fall back to prop if not set
    const threshold = contextThreshold || propThreshold;

    // Calculate cart total from CartContext for real-time updates
    useEffect(() => {
        const calculateTotal = async () => {
            if (!user) {
                // Guest user: calculate from guestCartItems
                const total = guestCartItems.reduce((sum, item) => {
                    const price = item.variantData?.price ?? item.productData?.price ?? 0;
                    return sum + price * item.quantity;
                }, 0);
                setCalculatedCartTotal(total);
            } else {
                // Authenticated user: fetch from database
                const { data } = await supabase
                    .from('cart_items')
                    .select('quantity, products(price), product_variants(price)')
                    .eq('user_id', user.id);

                if (data) {
                    const total = data.reduce((sum, item) => {
                        const products = item.products as { price: number } | null;
                        const variants = item.product_variants as { price: number } | null;
                        const price = variants?.price ?? products?.price ?? 0;
                        return sum + price * item.quantity;
                    }, 0);
                    setCalculatedCartTotal(total);
                }
            }
        };

        calculateTotal();
    }, [user, guestCartItems, cartItemCount]); // Re-run when cart changes

    // Use prop if provided, otherwise use calculated total
    const cartTotal = propCartTotal ?? calculatedCartTotal;
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
