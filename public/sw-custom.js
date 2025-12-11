// PremasShop Custom Service Worker
// Handles push notifications, caching, and deep linking

// CACHE VERSION - Increment this on each deploy to force update
const CACHE_VERSION = 'v1-' + Date.now();
const CACHE_NAME = 'premasshop-cache-' + CACHE_VERSION;

// Files to cache on install (minimal - just for offline fallback)
const STATIC_ASSETS = [
    '/dist/index.html'
];

// Install event - cache essential assets and skip waiting
self.addEventListener('install', (event) => {
    console.log('[SW] Installing new service worker:', CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting()) // Take over immediately
    );
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating new service worker:', CACHE_VERSION);
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((cacheName) => cacheName.startsWith('premasshop-cache-') && cacheName !== CACHE_NAME)
                    .map((cacheName) => {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
            );
        }).then(() => {
            console.log('[SW] Claiming all clients');
            return self.clients.claim(); // Take control of all pages immediately
        })
    );
});

// Fetch event - Network First strategy for all requests
self.addEventListener('fetch', (event) => {
    // Only handle same-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // For navigation requests (HTML), always go network-first
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Cache the latest version
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                    return response;
                })
                .catch(() => {
                    // Fallback to cache if offline
                    return caches.match('/dist/index.html');
                })
        );
        return;
    }

    // For assets (JS, CSS), also network-first to always get latest
    if (event.request.url.includes('/dist/assets/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
        return;
    }
});

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
        icon: data.icon || '/dist/logo-icon.svg',
        badge: '/dist/logo-icon.svg',
        vibrate: data.vibrate !== false ? [200, 100, 200] : undefined,
        tag: data.tag || `premasshop-${Date.now()}`,
        renotify: true,
        requireInteraction: data.requireInteraction || false,
        timestamp: data.timestamp || Date.now(),
        data: {
            url: data.url || '/',
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
                options.actions = [
                    { action: 'view', title: '📦 View Order' },
                    { action: 'accept', title: '✅ Accept' },
                ];
                options.tag = 'new-order';
                options.requireInteraction = true;
            } else {
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
    let urlToOpen = data.url || '/';

    // Handle different actions
    switch (action) {
        case 'view':
        case 'track':
            urlToOpen = data.url || '/';
            break;

        case 'accept':
            urlToOpen = '/admin';
            break;

        case 'snooze':
            event.waitUntil(
                self.registration.showNotification('⏰ Reminder Snoozed', {
                    body: 'We\'ll remind you again in 30 minutes.',
                    icon: '/dist/logo-icon.svg',
                    tag: 'snooze-confirm',
                    requireInteraction: false,
                })
            );
            return;

        case 'dismiss':
            return;

        default:
            urlToOpen = data.url || '/';
    }

    // Focus existing window or open new one
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.navigate(urlToOpen).then(() => client.focus());
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Handle notification close events
self.addEventListener('notificationclose', (event) => {
    const data = event.notification.data || {};
    console.log('Notification dismissed:', {
        type: data.type,
        tag: event.notification.tag,
        timestamp: Date.now(),
    });
});

// Background sync
self.addEventListener('sync', (event) => {
    if (event.tag === 'send-pending-actions') {
        event.waitUntil(processPendingActions());
    }
});

async function processPendingActions() {
    console.log('Processing pending actions...');
}

// Periodic background sync
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-notifications') {
        event.waitUntil(checkForNewNotifications());
    }
});

async function checkForNewNotifications() {
    console.log('Checking for new notifications...');
}

// Handle messages from the main app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
