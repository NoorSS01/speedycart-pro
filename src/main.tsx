import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/dist/sw-custom.js');
            console.log('ServiceWorker registered:', registration.scope);

            // Check for updates immediately and every 30 seconds
            registration.update();
            setInterval(() => registration.update(), 30000);

            // When a new service worker is found, reload the page to get updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New content is available, reload to get updates
                            console.log('New content available, reloading...');
                            window.location.reload();
                        }
                    });
                }
            });
        } catch (error) {
            console.log('ServiceWorker registration failed:', error);
        }
    });
}

createRoot(document.getElementById("root")!).render(<App />);
