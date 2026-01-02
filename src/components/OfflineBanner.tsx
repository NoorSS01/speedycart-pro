import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
    const { isOnline } = useNetworkStatus();

    if (isOnline) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white py-2 px-4 flex items-center justify-center gap-2 shadow-lg">
            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-medium">
                You're offline. Some features may not be available.
            </span>
        </div>
    );
}
