import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogIn, X, ShoppingBag, Tag, Bell } from 'lucide-react';

const AUTH_POPUP_SHOWN_KEY = 'speedycart_auth_popup_shown';

export default function AuthRecommendationPopup() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (loading) return;

        // Don't show if user is already authenticated
        if (user) {
            setIsVisible(false);
            return;
        }

        // Check if we've already shown the popup in this session
        const alreadyShown = sessionStorage.getItem(AUTH_POPUP_SHOWN_KEY);
        if (alreadyShown) {
            return;
        }

        // Wait for PWA prompt to potentially show first (1.5 seconds delay)
        const timer = setTimeout(() => {
            setIsVisible(true);
            sessionStorage.setItem(AUTH_POPUP_SHOWN_KEY, 'true');
        }, 2000);

        return () => clearTimeout(timer);
    }, [user, loading]);

    const handleSignIn = () => {
        setIsVisible(false);
        navigate('/auth');
    };

    const handleDismiss = () => {
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="relative w-full max-w-sm bg-card rounded-2xl shadow-2xl border overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                {/* Close button */}
                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted transition-colors z-10"
                    aria-label="Close"
                >
                    <X className="h-5 w-5 text-muted-foreground" />
                </button>

                {/* Header with gradient */}
                <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-6 text-white">
                    <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-4">
                        <LogIn className="h-7 w-7" />
                    </div>
                    <h2 className="text-xl font-bold mb-1">Sign in for a better experience!</h2>
                    <p className="text-sm text-white/80">Unlock exclusive features and personalized shopping</p>
                </div>

                {/* Benefits */}
                <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                            <ShoppingBag className="h-4 w-4 text-green-600" />
                        </div>
                        <span>Track your orders in real-time</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                            <Tag className="h-4 w-4 text-orange-600" />
                        </div>
                        <span>Get exclusive coupons & offers</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Bell className="h-4 w-4 text-blue-600" />
                        </div>
                        <span>Receive delivery notifications</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 pt-2 space-y-2">
                    <Button onClick={handleSignIn} className="w-full h-11 text-base font-semibold">
                        <LogIn className="h-5 w-5 mr-2" />
                        Sign In
                    </Button>
                    <button
                        onClick={handleDismiss}
                        className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Continue browsing as guest
                    </button>
                </div>
            </div>
        </div>
    );
}
