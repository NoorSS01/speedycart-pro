/**
 * Enhanced Production-safe Structured Logging Utility
 * 
 * Features:
 * - Correlation IDs for request tracing
 * - Structured JSON output (production) vs pretty console (development)
 * - Performance timing utilities
 * - External service integration hooks (Sentry/LogTail ready)
 * - Log sampling for high-volume events
 * 
 * Usage:
 * - logger.error('Failed to fetch data', { error, context })
 * - logger.warn('API rate limit approaching')
 * - logger.info('User logged in', { userId: '123' })
 * - logger.debug('Cache hit for product:123')
 * - const timer = logger.startTimer('fetchProducts'); await fetch(...); timer.end();
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogContext {
    [key: string]: unknown;
}

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    correlationId?: string;
    context?: LogContext;
    duration?: number;
    component?: string;
}

interface PerformanceTimer {
    end: (additionalContext?: LogContext) => void;
}

// External service hook type (for Sentry, LogTail, etc.)
type ExternalLogHandler = (entry: LogEntry) => void;

const isDevelopment = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

// Generate a short unique ID for correlation
const generateCorrelationId = (): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
};

class Logger {
    private correlationId: string | null = null;
    private externalHandlers: ExternalLogHandler[] = [];
    private sampleRates: Map<string, number> = new Map();
    private sampleCounters: Map<string, number> = new Map();

    /**
     * Set correlation ID for request tracing
     * Useful for tracing a single user action across multiple log entries
     */
    setCorrelationId(id?: string): string {
        this.correlationId = id || generateCorrelationId();
        return this.correlationId;
    }

    /**
     * Clear correlation ID after request completes
     */
    clearCorrelationId(): void {
        this.correlationId = null;
    }

    /**
     * Get current correlation ID
     */
    getCorrelationId(): string | null {
        return this.correlationId;
    }

    /**
     * Register external log handler (e.g., Sentry, LogTail)
     */
    addExternalHandler(handler: ExternalLogHandler): void {
        this.externalHandlers.push(handler);
    }

    /**
     * Set sample rate for a specific log key (0-1)
     * E.g., setSampleRate('product-view', 0.1) logs only 10% of product view events
     */
    setSampleRate(key: string, rate: number): void {
        this.sampleRates.set(key, Math.max(0, Math.min(1, rate)));
        this.sampleCounters.set(key, 0);
    }

    /**
     * Check if a sampled log should be written
     */
    private shouldSample(key?: string): boolean {
        if (!key || !this.sampleRates.has(key)) return true;

        const rate = this.sampleRates.get(key)!;
        const counter = (this.sampleCounters.get(key) || 0) + 1;
        this.sampleCounters.set(key, counter);

        // Use modulo for deterministic sampling
        return counter % Math.ceil(1 / rate) === 0;
    }

    /**
     * Create a log entry object
     */
    private createEntry(
        level: LogLevel,
        message: string,
        context?: LogContext,
        duration?: number
    ): LogEntry {
        return {
            timestamp: new Date().toISOString(),
            level,
            message,
            correlationId: this.correlationId || undefined,
            context,
            duration,
        };
    }

    /**
     * Internal logging method
     */
    private log(
        level: LogLevel,
        message: string,
        context?: LogContext,
        options?: { sampleKey?: string; duration?: number }
    ): void {
        // Production: only log errors and warnings
        if (!isDevelopment && (level === 'info' || level === 'debug')) {
            return;
        }

        // Check sampling
        if (options?.sampleKey && !this.shouldSample(options.sampleKey)) {
            return;
        }

        const entry = this.createEntry(level, message, context, options?.duration);

        // Development: pretty console output
        if (isDevelopment) {
            const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
            const correlationInfo = entry.correlationId ? ` [${entry.correlationId}]` : '';
            const durationInfo = entry.duration !== undefined ? ` (${entry.duration}ms)` : '';

            switch (level) {
                case 'error':
                    console.error(`${prefix}${correlationInfo}${durationInfo}`, message, context || '');
                    break;
                case 'warn':
                    console.warn(`${prefix}${correlationInfo}${durationInfo}`, message, context || '');
                    break;
                case 'info':
                    console.info(`${prefix}${correlationInfo}${durationInfo}`, message, context || '');
                    break;
                case 'debug':
                    console.log(`${prefix}${correlationInfo}${durationInfo}`, message, context || '');
                    break;
            }
        } else {
            // Production: structured JSON output
            const logLine = JSON.stringify(entry);
            switch (level) {
                case 'error':
                    console.error(logLine);
                    break;
                case 'warn':
                    console.warn(logLine);
                    break;
                default:
                    console.log(logLine);
            }
        }

        // Send to external handlers (always for errors, optionally for others)
        if (level === 'error' || level === 'warn') {
            this.externalHandlers.forEach((handler) => {
                try {
                    handler(entry);
                } catch (e) {
                    // Don't let external handler errors break the app
                    console.error('External log handler error:', e);
                }
            });
        }
    }

    /**
     * Log an error
     */
    error(message: string, context?: LogContext): void {
        this.log('error', message, context);
    }

    /**
     * Log a warning
     */
    warn(message: string, context?: LogContext): void {
        this.log('warn', message, context);
    }

    /**
     * Log info
     */
    info(message: string, context?: LogContext, sampleKey?: string): void {
        this.log('info', message, context, { sampleKey });
    }

    /**
     * Log debug info
     */
    debug(message: string, context?: LogContext, sampleKey?: string): void {
        this.log('debug', message, context, { sampleKey });
    }

    /**
     * Start a performance timer
     * @returns Timer object with end() method
     * 
     * Example:
     * const timer = logger.startTimer('fetchProducts');
     * await fetchProducts();
     * timer.end({ productCount: 42 });
     */
    startTimer(operation: string): PerformanceTimer {
        const startTime = performance.now();

        return {
            end: (additionalContext?: LogContext) => {
                const duration = Math.round(performance.now() - startTime);
                this.log('info', `${operation} completed`, additionalContext, { duration });
            },
        };
    }

    /**
     * Log with timing in one call
     * Useful for wrapping async operations
     */
    async timed<T>(
        operation: string,
        fn: () => Promise<T>,
        context?: LogContext
    ): Promise<T> {
        const timer = this.startTimer(operation);
        try {
            const result = await fn();
            timer.end({ ...context, success: true });
            return result;
        } catch (error) {
            timer.end({ ...context, success: false, error: String(error) });
            throw error;
        }
    }
}

export const logger = new Logger();
export type { LogEntry, LogLevel, LogContext, PerformanceTimer, ExternalLogHandler };
