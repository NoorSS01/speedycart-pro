import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
    Check,
    X,
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
        await updatePreferences(user.id, { [key]: value });
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

    return (
        <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-4">
                <div className="flex items-center justify-between">
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
                                    {isSubscribed ? 'Enabled' : 'Disabled'}
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
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Notification Types
                    </h4>

                    <div className="grid gap-4">
                        {/* Daily Reminders */}
                        <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${localPrefs.dailyReminders && isSubscribed
                            ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800'
                            : 'bg-muted/30 border-transparent'
                            }`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${localPrefs.dailyReminders && isSubscribed
                                    ? 'bg-blue-100 dark:bg-blue-900/50'
                                    : 'bg-muted'
                                    }`}>
                                    <Clock className={`h-5 w-5 ${localPrefs.dailyReminders && isSubscribed
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-muted-foreground'
                                        }`} />
                                </div>
                                <div>
                                    <Label className="text-base font-medium cursor-pointer">
                                        Daily Entry Reminders
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        Get reminded to check your shop daily
                                    </p>
                                </div>
                            </div>
                            <Switch
                                checked={localPrefs.dailyReminders}
                                onCheckedChange={(checked) => handlePreferenceChange('dailyReminders', checked)}
                                disabled={!isSubscribed || loading}
                            />
                        </div>

                        {/* Profit Alerts */}
                        <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${localPrefs.profitAlerts && isSubscribed
                            ? 'bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                            : 'bg-muted/30 border-transparent'
                            }`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${localPrefs.profitAlerts && isSubscribed
                                    ? 'bg-green-100 dark:bg-green-900/50'
                                    : 'bg-muted'
                                    }`}>
                                    <TrendingUp className={`h-5 w-5 ${localPrefs.profitAlerts && isSubscribed
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-muted-foreground'
                                        }`} />
                                </div>
                                <div>
                                    <Label className="text-base font-medium cursor-pointer">
                                        Profit Alerts
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        Daily summary of your earnings and profits
                                    </p>
                                </div>
                            </div>
                            <Switch
                                checked={localPrefs.profitAlerts}
                                onCheckedChange={(checked) => handlePreferenceChange('profitAlerts', checked)}
                                disabled={!isSubscribed || loading}
                            />
                        </div>

                        {/* Order Updates */}
                        <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${localPrefs.orderUpdates && isSubscribed
                            ? 'bg-purple-50/50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800'
                            : 'bg-muted/30 border-transparent'
                            }`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${localPrefs.orderUpdates && isSubscribed
                                    ? 'bg-purple-100 dark:bg-purple-900/50'
                                    : 'bg-muted'
                                    }`}>
                                    <Package className={`h-5 w-5 ${localPrefs.orderUpdates && isSubscribed
                                        ? 'text-purple-600 dark:text-purple-400'
                                        : 'text-muted-foreground'
                                        }`} />
                                </div>
                                <div>
                                    <Label className="text-base font-medium cursor-pointer">
                                        Order Updates
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        New orders, deliveries, and status changes
                                    </p>
                                </div>
                            </div>
                            <Switch
                                checked={localPrefs.orderUpdates}
                                onCheckedChange={(checked) => handlePreferenceChange('orderUpdates', checked)}
                                disabled={!isSubscribed || loading}
                            />
                        </div>

                        {/* Low Stock Alerts */}
                        <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${localPrefs.lowStockAlerts && isSubscribed
                            ? 'bg-orange-50/50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800'
                            : 'bg-muted/30 border-transparent'
                            }`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${localPrefs.lowStockAlerts && isSubscribed
                                    ? 'bg-orange-100 dark:bg-orange-900/50'
                                    : 'bg-muted'
                                    }`}>
                                    <AlertTriangle className={`h-5 w-5 ${localPrefs.lowStockAlerts && isSubscribed
                                        ? 'text-orange-600 dark:text-orange-400'
                                        : 'text-muted-foreground'
                                        }`} />
                                </div>
                                <div>
                                    <Label className="text-base font-medium cursor-pointer">
                                        Low Stock Alerts
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        Get notified when products are running low
                                    </p>
                                </div>
                            </div>
                            <Switch
                                checked={localPrefs.lowStockAlerts}
                                onCheckedChange={(checked) => handlePreferenceChange('lowStockAlerts', checked)}
                                disabled={!isSubscribed || loading}
                            />
                        </div>
                    </div>
                </div>

                {/* Reminder Time */}
                {isSubscribed && localPrefs.dailyReminders && (
                    <div className="space-y-3 pt-2">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                            Reminder Schedule
                        </h4>
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            <div className="flex-1">
                                <Label htmlFor="reminderTime" className="text-sm">
                                    Daily reminder time
                                </Label>
                                <Input
                                    id="reminderTime"
                                    type="time"
                                    value={localPrefs.reminderTime}
                                    onChange={(e) => handlePreferenceChange('reminderTime', e.target.value)}
                                    className="w-32 mt-1"
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Test Notification */}
                {isSubscribed && (
                    <div className="pt-4 border-t">
                        <Button
                            onClick={sendTestNotification}
                            variant="outline"
                            className="w-full"
                            disabled={loading}
                        >
                            <Send className="h-4 w-4 mr-2" />
                            Send Test Notification
                        </Button>
                    </div>
                )}

                {/* Status Info */}
                <div className="pt-4 border-t">
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