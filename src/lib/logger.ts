/**
 * Production-safe logging utility
 * 
 * Development: Logs to console with full details
 * Production: Suppresses debug/info, only shows errors/warnings
 * 
 * Usage:
 * - logger.error('Failed to fetch data', { error, context })
 * - logger.warn('API rate limit approaching')
 * - logger.info('User logged in')
 * - logger.debug('Cache hit for product:123')
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogContext {
    [key: string]: unknown;
}

const isDevelopment = import.meta.env.DEV;

class Logger {
    private log(level: LogLevel, message: string, context?: LogContext): void {
        // Production: only log errors and warnings
        if (!isDevelopment && (level === 'info' || level === 'debug')) {
            return;
        }

        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

        switch (level) {
            case 'error': {
                if (context) {
                    console.error(prefix, message, context);
                } else {
                    console.error(prefix, message);
                }
                break;
            }
            case 'warn': {
                if (context) {
                    console.warn(prefix, message, context);
                } else {
                    console.warn(prefix, message);
                }
                break;
            }
            case 'info': {
                if (context) {
                    console.info(prefix, message, context);
                } else {
                    console.info(prefix, message);
                }
                break;
            }
            case 'debug': {
                if (context) {
                    console.log(prefix, message, context);
                } else {
                    console.log(prefix, message);
                }
                break;
            }
        }
    }

    error(message: string, context?: LogContext): void {
        this.log('error', message, context);
    }

    warn(message: string, context?: LogContext): void {
        this.log('warn', message, context);
    }

    info(message: string, context?: LogContext): void {
        this.log('info', message, context);
    }

    debug(message: string, context?: LogContext): void {
        this.log('debug', message, context);
    }
}

export const logger = new Logger();
