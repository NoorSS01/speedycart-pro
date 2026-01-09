
import { LogEntry } from '../logger';

/**
 * Sentry Logging Handler
 * 
 * Sends error logs to Sentry if configured.
 * Requires @sentry/react to be installed and initialized.
 * 
 * To enable:
 * 1. npm install @sentry/react
 * 2. Initialize Sentry in main.tsx
 * 3. Uncomment the implementation below
 */
export const sentryHandler = (entry: LogEntry) => {
    // Check if Sentry is available on window (if loaded via CDN) or imported
    // This is a placeholder for the actual integration

    if (entry.level === 'error' || entry.level === 'warn') {
        const event = {
            message: entry.message,
            level: entry.level,
            extra: {
                timestamp: entry.timestamp,
                correlationId: entry.correlationId,
                ...entry.context
            }
        };

        // Example: Sentry.captureMessage(entry.message, { ... })
        // For now, we just acknowledge it's ready for integration
        if (import.meta.env.VITE_SENTRY_DSN) {
            console.debug('[Sentry Integration] Would send:', event);
        }
    }
};

/**
 * LogTail Logging Handler
 * 
 * Sends logs to LogTail/BetterStack
 */
export const logTailHandler = (entry: LogEntry) => {
    // Placeholder for LogTail HTTP ingestion
    if (import.meta.env.VITE_LOGTAIL_TOKEN) {
        // fetch('https://in.logtail.com', { ... })
        console.debug('[LogTail Integration] Would send:', entry);
    }
};

/**
 * Initialize external loggers based on environment
 */
export const initExternalLoggers = () => {
    const handlers = [];

    if (import.meta.env.VITE_SENTRY_DSN || import.meta.env.VITE_ENABLE_SENTRY === 'true') {
        handlers.push(sentryHandler);
    }

    if (import.meta.env.VITE_LOGTAIL_TOKEN) {
        handlers.push(logTailHandler);
    }

    return handlers;
};
