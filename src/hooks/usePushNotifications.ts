import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// VAPID Public Key - Generate your own at https://vapidkeys.com/
// Store the private key securely on your server
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

interface NotificationPreferences {
    dailyReminders: boolean;
    profitAlerts: boolean;
    orderUpdates: boolean;
    lowStockAlerts: boolean;
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
    const [isSupported, setIsSupported] = useState(() =>
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
            console.error('Error checking subscription:', error);
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

            // Get service worker registration
            const registration = await navigator.serviceWorker.ready;

            // Subscribe to push
            const pushSubscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });

            // Extract subscription data
            const subscriptionJson = pushSubscription.toJSON();
            const subscriptionData: PushSubscriptionData = {
                endpoint: subscriptionJson.endpoint || '',
                p256dh: subscriptionJson.keys?.p256dh || '',
                auth: subscriptionJson.keys?.auth || '',
            };

            // Save to Supabase
            const { error } = await (supabase as any)
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
                    reminder_time: preferences.reminderTime + ':00',
                }, {
                    onConflict: 'user_id,endpoint',
                });

            if (error) {
                console.error('Error saving subscription:', error);
                toast.error('Failed to save notification preferences');
                setLoading(false);
                return false;
            }

            setSubscription(pushSubscription);
            setIsSubscribed(true);
            toast.success('🔔 Notifications enabled successfully!');
            setLoading(false);
            return true;

        } catch (error) {
            console.error('Error subscribing to push:', error);
            toast.error('Failed to enable notifications');
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
            await (supabase as any)
                .from('push_subscriptions')
                .delete()
                .eq('user_id', userId);

            setSubscription(null);
            setIsSubscribed(false);
            toast.success('Notifications disabled');
            setLoading(false);
            return true;

        } catch (error) {
            console.error('Error unsubscribing:', error);
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
        setLoading(true);
        const updatedPrefs = { ...preferences, ...newPreferences };
        setPreferences(updatedPrefs);

        try {
            const { error } = await (supabase as any)
                .from('push_subscriptions')
                .update({
                    daily_reminders: updatedPrefs.dailyReminders,
                    profit_alerts: updatedPrefs.profitAlerts,
                    order_updates: updatedPrefs.orderUpdates,
                    low_stock_alerts: updatedPrefs.lowStockAlerts,
                    reminder_time: updatedPrefs.reminderTime + ':00',
                })
                .eq('user_id', userId);

            if (error) throw error;

            toast.success('Preferences updated');
            setLoading(false);
            return true;

        } catch (error) {
            console.error('Error updating preferences:', error);
            toast.error('Failed to update preferences');
            setLoading(false);
            return false;
        }
    }, [preferences]);

    // Load preferences from database
    const loadPreferences = useCallback(async (userId: string) => {
        try {
            const { data, error } = await (supabase as any)
                .from('push_subscriptions')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (data && !error) {
                setPreferences({
                    dailyReminders: data.daily_reminders,
                    profitAlerts: data.profit_alerts,
                    orderUpdates: data.order_updates,
                    lowStockAlerts: data.low_stock_alerts,
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
        await registration.showNotification('PremasShop Test', {
            body: '🎉 Push notifications are working!',
            icon: '/dist/icons/icon.svg',
            badge: '/dist/icons/icon.svg',
            tag: 'test-notification',
            vibrate: [200, 100, 200],
            data: {
                url: '/dist/',
            },
        });

        toast.success('Test notification sent!');
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
    };
}

export default usePushNotifications;
