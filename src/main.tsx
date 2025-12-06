import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA Version - Change this on each deploy to force SW update
const SW_VERSION = '2.0.3';

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
            console.log('ServiceWorker registered:', registration.scope, 'version:', SW_VERSION);

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
                                console.log('New content available, refreshing...');
                                // Reload after a short delay to let SW take over
                                setTimeout(() => window.location.reload(), 500);
                            }
                        }
                    });
                }
            });

            // Listen for controller change and reload
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('Controller changed, page will reload');
            });
        } catch (error) {
            console.log('ServiceWorker registration failed:', error);
        }
    });
}

createRoot(document.getElementById("root")!).render(<App />);
