import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

// VAPID Public Key - This should match the one in your Supabase secrets
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

export interface NotificationPreferences {
    dailyReminders: boolean;
    profitAlerts: boolean;
    orderUpdates: boolean;
    lowStockAlerts: boolean;
    newOrderAlerts: boolean;
    deliveryUpdates: boolean;
    promotionalAlerts: boolean;
    soundEnabled: boolean;
    vibrationEnabled: boolean;
    reminderTime: string;
}

interface PushSubscriptionData {
    endpoint: string;
    p256dh: string;
    auth: string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function usePushNotifications() {
    const [isSupported] = useState(() =>
        'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    );
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [loading, setLoading] = useState(false);
    const [preferences, setPreferences] = useState<NotificationPreferences>({
        dailyReminders: true,
        profitAlerts: true,
        orderUpdates: true,
        lowStockAlerts: true,
        newOrderAlerts: true,
        deliveryUpdates: true,
        promotionalAlerts: true,
        soundEnabled: true,
        vibrationEnabled: true,
        reminderTime: '09:00',
    });

    // Check current subscription status
    const checkSubscription = useCallback(async () => {
        if (!isSupported) return false;

        try {
            const registration = await navigator.serviceWorker.ready;
            const existingSubscription = await registration.pushManager.getSubscription();

            if (existingSubscription) {
                setSubscription(existingSubscription);
                setIsSubscribed(true);
                return true;
            }
            return false;
        } catch (error) {
            logger.error('Error checking push subscription', { error });
            return false;
        }
    }, [isSupported]);

    // Request notification permission and subscribe
    const subscribe = useCallback(async (userId: string) => {
        if (!isSupported) {
            toast.error('Push notifications are not supported in this browser');
            return false;
        }

        setLoading(true);

        try {
            // Request permission
            const permission = await Notification.requestPermission();

            if (permission !== 'granted') {
                toast.error('Notification permission denied');
                setLoading(false);
                return false;
            }

            // Get service worker registration with timeout
            const registrationPromise = navigator.serviceWorker.ready;
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Service worker registration timed out')), 10000)
            );

            const registration = await Promise.race([registrationPromise, timeoutPromise]) as ServiceWorkerRegistration;

            // Subscribe to push with timeout
            const subscribePromise = registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
            });
            const subscribeTimeout = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Push subscription timed out')), 10000)
            );

            const pushSubscription = await Promise.race([subscribePromise, subscribeTimeout]) as PushSubscription;

            // Extract subscription data
            const subscriptionJson = pushSubscription.toJSON();
            const subscriptionData: PushSubscriptionData = {
                endpoint: subscriptionJson.endpoint || '',
                p256dh: subscriptionJson.keys?.p256dh || '',
                auth: subscriptionJson.keys?.auth || '',
            };

            // Save to Supabase (optional - works even if table doesn't exist)
            try {
                const { error } = await supabase
                    .from('push_subscriptions')
                    .upsert({
                        user_id: userId,
                        endpoint: subscriptionData.endpoint,
                        p256dh: subscriptionData.p256dh,
                        auth: subscriptionData.auth,
                        daily_reminders: preferences.dailyReminders,
                        profit_alerts: preferences.profitAlerts,
                        order_updates: preferences.orderUpdates,
                        low_stock_alerts: preferences.lowStockAlerts,
                        new_order_alerts: preferences.newOrderAlerts,
                        delivery_updates: preferences.deliveryUpdates,
                        promotional_alerts: preferences.promotionalAlerts,
                        sound_enabled: preferences.soundEnabled,
                        vibration_enabled: preferences.vibrationEnabled,
                        reminder_time: preferences.reminderTime + ':00',
                    }, {
                        onConflict: 'user_id,endpoint',
                    });

                if (error) {
                    console.warn('Could not save subscription to database:', error.message);
                    // Don't fail - notifications still work locally
                }
            } catch (dbError) {
                logger.warn('Database save skipped', { error: dbError });
                // Continue anyway - local notifications will still work
            }

            setSubscription(pushSubscription);
            setIsSubscribed(true);
            toast.success('🔔 Notifications enabled successfully!');
            setLoading(false);
            return true;

        } catch (error: unknown) {
            console.error('Error subscribing to push:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (errorMessage.includes('timed out')) {
                toast.error('Connection timed out. Please try again.');
            } else if (errorMessage.includes('permission')) {
                toast.error('Notification permission was denied');
            } else {
                toast.error(`Failed to enable notifications: ${errorMessage}`);
            }
            setLoading(false);
            return false;
        }
    }, [isSupported, preferences]);

    // Unsubscribe from push notifications
    const unsubscribe = useCallback(async (userId: string) => {
        setLoading(true);

        try {
            if (subscription) {
                await subscription.unsubscribe();
            }

            // Remove from Supabase
            await supabase
                .from('push_subscriptions')
                .delete()
                .eq('user_id', userId);

            setSubscription(null);
            setIsSubscribed(false);
            toast.success('Notifications disabled');
            setLoading(false);
            return true;

        } catch (error) {
            logger.error('Error unsubscribing from push notifications', { error });
            toast.error('Failed to disable notifications');
            setLoading(false);
            return false;
        }
    }, [subscription]);

    // Update notification preferences
    const updatePreferences = useCallback(async (
        userId: string,
        newPreferences: Partial<NotificationPreferences>
    ) => {
        const updatedPrefs = { ...preferences, ...newPreferences };
        setPreferences(updatedPrefs);

        try {
            interface UpdateData {
                daily_reminders?: boolean;
                profit_alerts?: boolean;
                order_updates?: boolean;
                low_stock_alerts?: boolean;
                new_order_alerts?: boolean;
                delivery_updates?: boolean;
                promotional_alerts?: boolean;
                sound_enabled?: boolean;
                vibration_enabled?: boolean;
                reminder_time?: string;
            }
            const updateData: UpdateData = {};

            if ('dailyReminders' in newPreferences) updateData.daily_reminders = newPreferences.dailyReminders;
            if ('profitAlerts' in newPreferences) updateData.profit_alerts = newPreferences.profitAlerts;
            if ('orderUpdates' in newPreferences) updateData.order_updates = newPreferences.orderUpdates;
            if ('lowStockAlerts' in newPreferences) updateData.low_stock_alerts = newPreferences.lowStockAlerts;
            if ('newOrderAlerts' in newPreferences) updateData.new_order_alerts = newPreferences.newOrderAlerts;
            if ('deliveryUpdates' in newPreferences) updateData.delivery_updates = newPreferences.deliveryUpdates;
            if ('promotionalAlerts' in newPreferences) updateData.promotional_alerts = newPreferences.promotionalAlerts;
            if ('soundEnabled' in newPreferences) updateData.sound_enabled = newPreferences.soundEnabled;
            if ('vibrationEnabled' in newPreferences) updateData.vibration_enabled = newPreferences.vibrationEnabled;
            if ('reminderTime' in newPreferences) updateData.reminder_time = newPreferences.reminderTime + ':00';

            const { error } = await supabase
                .from('push_subscriptions')
                .update(updateData)
                .eq('user_id', userId);

            if (error) throw error;

            return true;

        } catch (error) {
            logger.error('Error updating notification preferences', { error });
            toast.error('Failed to update preferences');
            return false;
        }
    }, [preferences]);

    // Load preferences from database
    const loadPreferences = useCallback(async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('push_subscriptions')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (data && !error) {
                setPreferences({
                    dailyReminders: data.daily_reminders ?? true,
                    profitAlerts: data.profit_alerts ?? true,
                    orderUpdates: data.order_updates ?? true,
                    lowStockAlerts: data.low_stock_alerts ?? true,
                    newOrderAlerts: data.new_order_alerts ?? true,
                    deliveryUpdates: data.delivery_updates ?? true,
                    promotionalAlerts: data.promotional_alerts ?? true,
                    soundEnabled: data.sound_enabled ?? true,
                    vibrationEnabled: data.vibration_enabled ?? true,
                    reminderTime: data.reminder_time?.slice(0, 5) || '09:00',
                });
                setIsSubscribed(true);
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }, []);

    // Send a test notification (client-side only)
    const sendTestNotification = useCallback(async () => {
        if (!isSupported || Notification.permission !== 'granted') {
            toast.error('Notifications not enabled');
            return;
        }

        const registration = await navigator.serviceWorker.ready;

        const vibrate = preferences.vibrationEnabled ? [200, 100, 200] : undefined;

        await registration.showNotification('PremasShop Test 🛒', {
            body: '🎉 Push notifications are working! You\'ll receive order updates, alerts, and reminders.',
            icon: '/dist/icons/icon.svg',
            badge: '/dist/icons/icon.svg',
            tag: 'test-notification',
            // @ts-expect-error - vibrate is valid in ServiceWorkerRegistration.showNotification options but missing in TS types
            vibrate,
            requireInteraction: false,
            data: {
                url: '/',
                type: 'test',
            },
            actions: [
                { action: 'view', title: '🛒 Open Shop' },
                { action: 'dismiss', title: '✕ Dismiss' },
            ],
        });

        toast.success('Test notification sent!');
    }, [isSupported, preferences.vibrationEnabled]);

    // Request permission only (for notification bell prompt)
    const requestPermission = useCallback(async () => {
        if (!isSupported) return false;

        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }, [isSupported]);

    // Get permission status
    const getPermissionStatus = useCallback(() => {
        if (!isSupported) return 'unsupported';
        return Notification.permission; // 'granted', 'denied', 'default'
    }, [isSupported]);

    return {
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
        requestPermission,
        getPermissionStatus,
    };
}

export default usePushNotifications;
