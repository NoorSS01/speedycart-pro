import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/contexts/AuthContext';

export function NotificationBell() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { isSupported, isSubscribed, subscribe, checkSubscription } = usePushNotifications();
    const [showPopover, setShowPopover] = useState(false);
    const [hasAsked, setHasAsked] = useState(false);

    useEffect(() => {
        if (user) {
            checkSubscription();
        }
        // Check if we've already asked
        const asked = localStorage.getItem('notification-asked');
        if (asked) setHasAsked(true);
    }, [user, checkSubscription]);

    const handleEnableNotifications = async () => {
        if (!user) {
            navigate('/auth');
            return;
        }

        const success = await subscribe(user.id);
        if (success) {
            setShowPopover(false);
            localStorage.setItem('notification-asked', 'true');
        }
    };

    const handleMaybeLater = () => {
        setShowPopover(false);
        localStorage.setItem('notification-asked', 'true');
        setHasAsked(true);
    };

    // Don't show if not supported
    if (!isSupported) return null;

    // Already subscribed - show filled bell
    if (isSubscribed) {
        return (
            <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/profile')}
                className="relative text-primary"
            >
                <BellRing className="h-5 w-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" />
            </Button>
        );
    }

    // Not subscribed - show prompt
    return (
        <Popover open={showPopover} onOpenChange={setShowPopover}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                >
                    <Bell className="h-5 w-5" />
                    {!hasAsked && (
                        <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 rounded-t-lg">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Bell className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-foreground">Enable Notifications</h4>
                            <p className="text-sm text-muted-foreground">
                                Stay updated with orders & alerts
                            </p>
                        </div>
                    </div>
                </div>
                <div className="p-4 space-y-3">
                    <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                            <span className="text-green-500">✓</span>
                            New order alerts
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-green-500">✓</span>
                            Daily profit summaries
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-green-500">✓</span>
                            Low stock warnings
                        </li>
                    </ul>
                    <div className="flex gap-2 pt-2">
                        <Button
                            onClick={handleEnableNotifications}
                            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600"
                            size="sm"
                        >
                            Enable
                        </Button>
                        <Button
                            onClick={handleMaybeLater}
                            variant="outline"
                            size="sm"
                        >
                            Later
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export default NotificationBell;
