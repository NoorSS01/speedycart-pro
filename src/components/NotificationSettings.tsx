import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Bell,
    BellOff,
    BellRing,
    Clock,
    TrendingUp,
    Package,
    AlertTriangle,
    Send,
    Loader2,
    Smartphone,
    Volume2,
    Vibrate,
    Gift,
    Truck,
    ShoppingCart,
    CheckCircle,
} from 'lucide-react';

export function NotificationSettings() {
    const { user } = useAuth();
    const {
        isSupported,
        isSubscribed,
        loading,
        preferences,
        checkSubscription,
        subscribe,
        unsubscribe,
        updatePreferences,
        loadPreferences,
        sendTestNotification,
    } = usePushNotifications();

    const [localPrefs, setLocalPrefs] = useState(preferences);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (user) {
            loadPreferences(user.id);
            checkSubscription();
        }
    }, [user, loadPreferences, checkSubscription]);

    useEffect(() => {
        setLocalPrefs(preferences);
    }, [preferences]);

    const handleToggleNotifications = async () => {
        if (!user) return;

        if (isSubscribed) {
            await unsubscribe(user.id);
        } else {
            await subscribe(user.id);
        }
    };

    const handlePreferenceChange = async (key: keyof typeof localPrefs, value: boolean | string) => {
        if (!user) return;

        const newPrefs = { ...localPrefs, [key]: value };
        setLocalPrefs(newPrefs);
        setHasChanges(true);

        // Auto-save after a short delay
        setTimeout(() => {
            updatePreferences(user.id, { [key]: value });
            setHasChanges(false);
        }, 500);
    };

    if (!isSupported) {
        return (
            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
                <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                            <BellOff className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-amber-800 dark:text-amber-300">
                                Notifications Not Supported
                            </h3>
                            <p className="text-sm text-amber-700 dark:text-amber-400">
                                Your browser doesn't support push notifications. Try using Chrome or Edge.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const notificationTypes = [
        {
            key: 'orderUpdates',
            icon: ShoppingCart,
            title: 'Order Updates',
            description: 'Status changes for your orders',
            color: 'blue',
            bgColor: 'bg-blue-50/50 dark:bg-blue-950/20',
            borderColor: 'border-blue-200 dark:border-blue-800',
            iconBg: 'bg-blue-100 dark:bg-blue-900/50',
            iconColor: 'text-blue-600 dark:text-blue-400',
        },
        {
            key: 'dailyReminders',
            icon: Clock,
            title: 'Daily Reminders',
            description: 'Morning check-in notifications',
            color: 'purple',
            bgColor: 'bg-purple-50/50 dark:bg-purple-950/20',
            borderColor: 'border-purple-200 dark:border-purple-800',
            iconBg: 'bg-purple-100 dark:bg-purple-900/50',
            iconColor: 'text-purple-600 dark:text-purple-400',
        },
        {
            key: 'profitAlerts',
            icon: TrendingUp,
            title: 'Profit Alerts',
            description: 'Daily sales & profit summary',
            color: 'green',
            bgColor: 'bg-green-50/50 dark:bg-green-950/20',
            borderColor: 'border-green-200 dark:border-green-800',
            iconBg: 'bg-green-100 dark:bg-green-900/50',
            iconColor: 'text-green-600 dark:text-green-400',
        },
        {
            key: 'lowStockAlerts',
            icon: AlertTriangle,
            title: 'Low Stock Alerts',
            description: 'When products are running low',
            color: 'orange',
            bgColor: 'bg-orange-50/50 dark:bg-orange-950/20',
            borderColor: 'border-orange-200 dark:border-orange-800',
            iconBg: 'bg-orange-100 dark:bg-orange-900/50',
            iconColor: 'text-orange-600 dark:text-orange-400',
        },
    ];

    return (
        <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${isSubscribed
                                ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                                : 'bg-gradient-to-br from-gray-400 to-gray-500'
                            }`}>
                            {isSubscribed ? (
                                <BellRing className="h-6 w-6 text-white" />
                            ) : (
                                <BellOff className="h-6 w-6 text-white" />
                            )}
                        </div>
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                Push Notifications
                                <Badge variant={isSubscribed ? 'default' : 'secondary'} className="font-normal">
                                    {isSubscribed ? (
                                        <><CheckCircle className="h-3 w-3 mr-1" />Enabled</>
                                    ) : 'Disabled'}
                                </Badge>
                            </CardTitle>
                            <CardDescription>
                                Get real-time alerts for orders, profits, and reminders
                            </CardDescription>
                        </div>
                    </div>

                    <Button
                        onClick={handleToggleNotifications}
                        disabled={loading}
                        variant={isSubscribed ? 'outline' : 'default'}
                        className={isSubscribed ? '' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'}
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : isSubscribed ? (
                            <BellOff className="h-4 w-4 mr-2" />
                        ) : (
                            <Bell className="h-4 w-4 mr-2" />
                        )}
                        {isSubscribed ? 'Disable' : 'Enable Notifications'}
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
                {/* Notification Types */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                            Notification Types
                        </h4>
                        {hasChanges && (
                            <Badge variant="outline" className="animate-pulse">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Saving...
                            </Badge>
                        )}
                    </div>

                    <div className="grid gap-3">
                        {notificationTypes.map((type) => {
                            const Icon = type.icon;
                            const isEnabled = localPrefs[type.key as keyof typeof localPrefs] as boolean;

                            return (
                                <div
                                    key={type.key}
                                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isEnabled && isSubscribed ? `${type.bgColor} ${type.borderColor}` : 'bg-muted/30 border-transparent'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isEnabled && isSubscribed ? type.iconBg : 'bg-muted'
                                            }`}>
                                            <Icon className={`h-5 w-5 ${isEnabled && isSubscribed ? type.iconColor : 'text-muted-foreground'
                                                }`} />
                                        </div>
                                        <div>
                                            <Label className="text-base font-medium cursor-pointer">
                                                {type.title}
                                            </Label>
                                            <p className="text-sm text-muted-foreground">
                                                {type.description}
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={isEnabled}
                                        onCheckedChange={(checked) => handlePreferenceChange(type.key as keyof typeof localPrefs, checked)}
                                        disabled={!isSubscribed || loading}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                <Separator />

                {/* Additional Preferences */}
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Additional Preferences
                    </h4>

                    <div className="grid gap-3 sm:grid-cols-2">
                        {/* Promotional Alerts */}
                        <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${localPrefs.promotionalAlerts && isSubscribed
                                ? 'bg-pink-50/50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800'
                                : 'bg-muted/30 border-transparent'
                            }`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${localPrefs.promotionalAlerts && isSubscribed
                                        ? 'bg-pink-100 dark:bg-pink-900/50'
                                        : 'bg-muted'
                                    }`}>
                                    <Gift className={`h-5 w-5 ${localPrefs.promotionalAlerts && isSubscribed
                                            ? 'text-pink-600 dark:text-pink-400'
                                            : 'text-muted-foreground'
                                        }`} />
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">Offers & Sales</Label>
                                    <p className="text-xs text-muted-foreground">Flash sales, discounts</p>
                                </div>
                            </div>
                            <Switch
                                checked={localPrefs.promotionalAlerts as boolean}
                                onCheckedChange={(checked) => handlePreferenceChange('promotionalAlerts', checked)}
                                disabled={!isSubscribed || loading}
                            />
                        </div>

                        {/* Delivery Updates */}
                        <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${localPrefs.deliveryUpdates && isSubscribed
                                ? 'bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800'
                                : 'bg-muted/30 border-transparent'
                            }`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${localPrefs.deliveryUpdates && isSubscribed
                                        ? 'bg-cyan-100 dark:bg-cyan-900/50'
                                        : 'bg-muted'
                                    }`}>
                                    <Truck className={`h-5 w-5 ${localPrefs.deliveryUpdates && isSubscribed
                                            ? 'text-cyan-600 dark:text-cyan-400'
                                            : 'text-muted-foreground'
                                        }`} />
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">Delivery Updates</Label>
                                    <p className="text-xs text-muted-foreground">Tracking info</p>
                                </div>
                            </div>
                            <Switch
                                checked={localPrefs.deliveryUpdates as boolean}
                                onCheckedChange={(checked) => handlePreferenceChange('deliveryUpdates', checked)}
                                disabled={!isSubscribed || loading}
                            />
                        </div>
                    </div>
                </div>

                {/* Reminder Time */}
                {isSubscribed && localPrefs.dailyReminders && (
                    <>
                        <Separator />
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                Reminder Schedule
                            </h4>
                            <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-800">
                                <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                <div className="flex-1">
                                    <Label htmlFor="reminderTime" className="text-sm font-medium">
                                        Daily reminder time
                                    </Label>
                                    <p className="text-xs text-muted-foreground">When should we remind you?</p>
                                </div>
                                <Input
                                    id="reminderTime"
                                    type="time"
                                    value={localPrefs.reminderTime as string}
                                    onChange={(e) => handlePreferenceChange('reminderTime', e.target.value)}
                                    className="w-28"
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </>
                )}

                {/* Sound & Vibration (if subscribed) */}
                {isSubscribed && (
                    <>
                        <Separator />
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                Notification Style
                            </h4>
                            <div className="flex gap-3">
                                <Button
                                    variant={localPrefs.soundEnabled ? 'default' : 'outline'}
                                    size="sm"
                                    className="flex-1 gap-2"
                                    onClick={() => handlePreferenceChange('soundEnabled', !localPrefs.soundEnabled)}
                                >
                                    <Volume2 className="h-4 w-4" />
                                    Sound {localPrefs.soundEnabled ? 'On' : 'Off'}
                                </Button>
                                <Button
                                    variant={localPrefs.vibrationEnabled ? 'default' : 'outline'}
                                    size="sm"
                                    className="flex-1 gap-2"
                                    onClick={() => handlePreferenceChange('vibrationEnabled', !localPrefs.vibrationEnabled)}
                                >
                                    <Vibrate className="h-4 w-4" />
                                    Vibration {localPrefs.vibrationEnabled ? 'On' : 'Off'}
                                </Button>
                            </div>
                        </div>
                    </>
                )}

                {/* Test Notification */}
                {isSubscribed && (
                    <>
                        <Separator />
                        <Button
                            onClick={sendTestNotification}
                            variant="outline"
                            className="w-full"
                            disabled={loading}
                        >
                            <Send className="h-4 w-4 mr-2" />
                            Send Test Notification
                        </Button>
                    </>
                )}

                {/* Status Info */}
                <div className="pt-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Smartphone className="h-4 w-4" />
                        <span>
                            {isSubscribed
                                ? 'Notifications will be sent to this device'
                                : 'Enable notifications to receive alerts on this device'}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default NotificationSettings;