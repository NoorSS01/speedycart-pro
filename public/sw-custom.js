// PremasShop Custom Service Worker
// Handles push notifications, click actions, and deep linking

// Listen for push events from the server
self.addEventListener('push', (event) => {
    if (!event.data) return;

    let data;
    try {
        data = event.data.json();
    } catch (e) {
        data = {
            title: 'PremasShop',
            body: event.data.text(),
            type: 'general',
        };
    }

    // Build notification options
    const options = {
        body: data.body || 'You have a new notification',
        icon: data.icon || '/dist/icons/icon.svg',
        badge: '/dist/icons/icon.svg',
        vibrate: data.vibrate !== false ? [200, 100, 200] : undefined,
        tag: data.tag || `premasshop-${Date.now()}`,
        renotify: true,
        requireInteraction: data.requireInteraction || false,
        timestamp: data.timestamp || Date.now(),
        data: {
            url: data.url || '/dist/',
            type: data.type || 'general',
            ...data.data,
        },
        actions: [],
    };

    // Add image if provided
    if (data.image) {
        options.image = data.image;
    }

    // Add type-specific actions and styling
    switch (data.type) {
        case 'order_status':
            if (data.body?.includes('New order')) {
                // New order for admin
                options.actions = [
                    { action: 'view', title: '📦 View Order' },
                    { action: 'accept', title: '✅ Accept' },
                ];
                options.tag = 'new-order';
                options.requireInteraction = true;
            } else {
                // Order update for customer
                options.actions = [
                    { action: 'track', title: '📍 Track Order' },
                    { action: 'dismiss', title: '✕ Dismiss' },
                ];
            }
            break;

        case 'low_stock':
            options.actions = [
                { action: 'view', title: '📦 View Stock' },
                { action: 'dismiss', title: '✕ Later' },
            ];
            options.tag = 'low-stock';
            options.requireInteraction = true;
            break;

        case 'profit_summary':
            options.actions = [
                { action: 'view', title: '📊 View Details' },
                { action: 'dismiss', title: '✕ Dismiss' },
            ];
            options.tag = 'profit-summary';
            break;

        case 'daily_reminder':
            options.actions = [
                { action: 'view', title: '🛒 Open Shop' },
                { action: 'snooze', title: '⏰ Snooze' },
            ];
            options.tag = 'daily-reminder';
            break;

        case 'broadcast':
            options.actions = [
                { action: 'view', title: '👀 View Now' },
                { action: 'dismiss', title: '✕ Dismiss' },
            ];
            break;

        default:
            options.actions = [
                { action: 'view', title: '👀 View' },
                { action: 'dismiss', title: '✕ Dismiss' },
            ];
    }

    event.waitUntil(
        self.registration.showNotification(data.title || 'PremasShop', options)
    );
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const action = event.action;
    const data = event.notification.data || {};
    const type = data.type || 'general';

    // Default URL
    let urlToOpen = data.url || '/dist/';

    // Handle different actions
    switch (action) {
        case 'view':
        case 'track':
            urlToOpen = data.url || '/dist/';
            break;

        case 'accept':
            // For accepting orders, go to admin with specific order
            urlToOpen = '/dist/admin';
            break;

        case 'snooze':
            // Snooze reminder for 30 minutes
            // Note: This would need backend support to actually reschedule
            event.waitUntil(
                self.registration.showNotification('⏰ Reminder Snoozed', {
                    body: 'We\'ll remind you again in 30 minutes.',
                    icon: '/dist/icons/icon.svg',
                    tag: 'snooze-confirm',
                    requireInteraction: false,
                })
            );
            return;

        case 'dismiss':
            // Just close the notification
            return;

        default:
            // Clicking on notification body
            urlToOpen = data.url || '/dist/';
    }

    // Focus existing window or open new one
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Try to find an existing window
            for (const client of clientList) {
                if (client.url.includes('/dist/') && 'focus' in client) {
                    return client.navigate(urlToOpen).then(() => client.focus());
                }
            }
            // Open new window if none exists
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Handle notification close events (for analytics)
self.addEventListener('notificationclose', (event) => {
    const data = event.notification.data || {};

    // Log dismissed notification for analytics
    console.log('Notification dismissed:', {
        type: data.type,
        tag: event.notification.tag,
        timestamp: Date.now(),
    });
});

// Background sync for offline notification queue
self.addEventListener('sync', (event) => {
    if (event.tag === 'send-pending-actions') {
        event.waitUntil(processPendingActions());
    }
});

async function processPendingActions() {
    // Process any queued actions from offline usage
    console.log('Processing pending actions...');
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-notifications') {
        event.waitUntil(checkForNewNotifications());
    }
});

async function checkForNewNotifications() {
    // Check for new notifications periodically
    console.log('Checking for new notifications...');
}

// Handle messages from the main app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
