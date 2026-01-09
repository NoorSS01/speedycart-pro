import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import "./index.css";
import { logger } from "./lib/logger";
import { initWebVitals } from "./lib/webVitals";
import { initExternalLoggers } from "./lib/integrations/external-loggers";

// Initialize Core Web Vitals tracking
initWebVitals();

// Initialize External Logging (Sentry/LogTail)
initExternalLoggers().forEach(handler => logger.addExternalHandler(handler));

// PWA Version - Change this on each deploy to force SW update
const SW_VERSION = '2.0.4';

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            // First, unregister any existing service workers to force fresh registration
            const existingRegistrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of existingRegistrations) {
                // Check if there's a waiting worker and activate it
                if (registration.waiting) {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
            }

            // Register with version query param to bust cache
            const swUrl = `/dist/sw-custom.js?v=${SW_VERSION}`;
            const registration = await navigator.serviceWorker.register(swUrl, {
                updateViaCache: 'none' // Tell browser to never cache the service worker file
            });
            logger.info('ServiceWorker registered:', { scope: registration.scope, version: SW_VERSION });

            // Check for updates immediately
            registration.update();

            // Check for updates periodically
            setInterval(() => registration.update(), 30000);

            // When a new service worker is found, activate it immediately
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                // New content is available, tell SW to skip waiting
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                                logger.info('New content available, refreshing...');
                                // Reload after a short delay to let SW take over
                                setTimeout(() => window.location.reload(), 500);
                            }
                        }
                    });
                }
            });

            // Listen for controller change and reload
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                logger.info('Controller changed, page will reload');
            });
        } catch (error) {
            logger.error('ServiceWorker registration failed', { error });
        }
    });
}

createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
);

