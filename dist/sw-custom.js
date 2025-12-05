// Custom Service Worker for Push Notifications
// This file extends the auto-generated Workbox service worker

self.addEventListener('push', (event) => {
    if (!event.data) return;

    let data;
    try {
        data = event.data.json();
    } catch (e) {
        data = {
            title: 'PremasShop',
            body: event.data.text(),
        };
    }

    const options = {
        body: data.body || 'You have a new notification',
        icon: '/dist/icons/icon.svg',
        badge: '/dist/icons/icon.svg',
        vibrate: [200, 100, 200],
        tag: data.tag || 'premasshop-notification',
        renotify: true,
        requireInteraction: data.requireInteraction || false,
        data: {
            url: data.url || '/dist/',
            ...data.data,
        },
        actions: data.actions || [],
    };

    // Add specific actions based on notification type
    if (data.type === 'new_order') {
        options.actions = [
            { action: 'view', title: '📦 View Order' },
            { action: 'dismiss', title: '✕ Dismiss' },
        ];
        options.tag = 'new-order';
    } else if (data.type === 'profit_alert') {
        options.actions = [
            { action: 'view', title: '📊 View Stats' },
            { action: 'dismiss', title: '✕ Dismiss' },
        ];
        options.tag = 'profit-alert';
    } else if (data.type === 'low_stock') {
        options.actions = [
            { action: 'view', title: '📦 Manage Stock' },
            { action: 'dismiss', title: '✕ Dismiss' },
        ];
        options.tag = 'low-stock';
    } else if (data.type === 'daily_reminder') {
        options.actions = [
            { action: 'view', title: '🛒 Open Shop' },
            { action: 'dismiss', title: '✕ Later' },
        ];
        options.tag = 'daily-reminder';
    }

    event.waitUntil(
        self.registration.showNotification(data.title || 'PremasShop', options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const action = event.action;
    const data = event.notification.data || {};

    // Determine the URL to open based on action
    let urlToOpen = data.url || '/dist/';

    if (action === 'view') {
        if (data.type === 'new_order') {
            urlToOpen = '/dist/admin';
        } else if (data.type === 'profit_alert') {
            urlToOpen = '/dist/admin';
        } else if (data.type === 'low_stock') {
            urlToOpen = '/dist/admin/stock';
        } else if (data.type === 'daily_reminder') {
            urlToOpen = '/dist/shop';
        }
    } else if (action === 'dismiss') {
        return; // Just close the notification
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there's already a window open
            for (const client of clientList) {
                if (client.url.includes('/dist/') && 'focus' in client) {
                    client.navigate(urlToOpen);
                    return client.focus();
                }
            }
            // Open a new window if none is open
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
    // Analytics: track dismissed notifications
    console.log('Notification dismissed:', event.notification.tag);
});

// Background sync for sending notifications when online
self.addEventListener('sync', (event) => {
    if (event.tag === 'send-pending-notifications') {
        event.waitUntil(sendPendingNotifications());
    }
});

async function sendPendingNotifications() {
    // This would be implemented if you have offline notification queueing
    console.log('Background sync: checking for pending notifications');
}

// Periodic Background Sync for scheduled notifications (if supported)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'daily-reminder-check') {
        event.waitUntil(checkDailyReminder());
    }
});

async function checkDailyReminder() {
    // Check if it's time to send daily reminder
    const now = new Date();
    const hour = now.getHours();

    // Send reminder at 9 AM
    if (hour === 9) {
        self.registration.showNotification('Good Morning! ☀️', {
            body: 'Start your day by checking your shop orders and stock!',
            icon: '/dist/icons/icon.svg',
            badge: '/dist/icons/icon.svg',
            tag: 'daily-reminder',
            vibrate: [200, 100, 200],
            data: {
                url: '/dist/shop',
                type: 'daily_reminder',
            },
            actions: [
                { action: 'view', title: '🛒 Open Shop' },
                { action: 'dismiss', title: '✕ Later' },
            ],
        });
    }
}
