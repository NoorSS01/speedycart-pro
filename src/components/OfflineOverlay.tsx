import { WifiOff, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Offline Overlay Component
 * 
 * Displays a full-screen overlay when the user's device is offline.
 * Minimal design per user request - just shows "You're offline" with retry button.
 */
export default function OfflineOverlay() {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isRetrying, setIsRetrying] = useState(false);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleRetry = () => {
        setIsRetrying(true);
        setTimeout(() => {
            window.location.reload();
        }, 500);
    };

    if (!isOffline) return null;

    return (
        <div
            className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-6"
            role="alert"
            aria-live="assertive"
        >
            {/* WiFi Off Icon */}
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                <WifiOff className="h-10 w-10 text-muted-foreground" />
            </div>

            {/* Simple Title */}
            <h1 className="text-xl font-semibold text-foreground mb-6">
                You're offline
            </h1>

            {/* Retry Button */}
            <Button
                onClick={handleRetry}
                disabled={isRetrying}
                size="lg"
                className="min-w-[140px] gap-2"
            >
                {isRetrying ? (
                    <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Retrying...
                    </>
                ) : (
                    <>
                        <RefreshCw className="h-4 w-4" />
                        Retry
                    </>
                )}
            </Button>
        </div>
    );
}
