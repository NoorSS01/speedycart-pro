/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascade failures by monitoring external service calls
 * and "opening" the circuit when failure rates exceed thresholds.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests fail fast
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 * 
 * Usage:
 * const breaker = new CircuitBreaker('supabase-db', { failureThreshold: 5 });
 * const result = await breaker.execute(() => supabase.from('products').select('*'));
 */

import { logger } from './logger';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
    /** Number of failures before opening circuit (default: 5) */
    failureThreshold: number;
    /** Time in ms before attempting recovery (default: 30000) */
    recoveryTimeout: number;
    /** Number of successful calls in half-open before closing (default: 2) */
    successThreshold: number;
    /** Timeout for individual calls in ms (default: 10000) */
    callTimeout: number;
    /** Enable monitoring/logging (default: true) */
    enableMetrics: boolean;
}

export interface CircuitBreakerMetrics {
    name: string;
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailure?: Date;
    lastSuccess?: Date;
    totalCalls: number;
    failedCalls: number;
    openedCount: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeout: 30000,
    successThreshold: 2,
    callTimeout: 10000,
    enableMetrics: true,
};

export class CircuitBreaker {
    private name: string;
    private config: CircuitBreakerConfig;
    private state: CircuitState = 'CLOSED';
    private failureCount = 0;
    private successCount = 0;
    private lastFailureTime?: Date;
    private lastSuccessTime?: Date;
    private nextAttemptTime?: Date;
    private totalCalls = 0;
    private failedCalls = 0;
    private openedCount = 0;

    constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
        this.name = name;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Execute a function through the circuit breaker
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        this.totalCalls++;

        // Check if circuit is open
        if (this.state === 'OPEN') {
            if (this.shouldAttemptRecovery()) {
                this.transitionTo('HALF_OPEN');
            } else {
                this.logRejection();
                throw new CircuitBreakerError(
                    `Circuit breaker '${this.name}' is OPEN`,
                    this.getMetrics()
                );
            }
        }

        try {
            // Execute with timeout
            const result = await this.executeWithTimeout(fn);
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure(error);
            throw error;
        }
    }

    /**
     * Execute function with timeout
     */
    private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
        return Promise.race([
            fn(),
            new Promise<never>((_, reject) =>
                setTimeout(
                    () => reject(new Error(`Circuit breaker '${this.name}' call timed out`)),
                    this.config.callTimeout
                )
            ),
        ]);
    }

    /**
     * Handle successful call
     */
    private onSuccess(): void {
        this.lastSuccessTime = new Date();
        this.successCount++;
        this.failureCount = 0;

        if (this.state === 'HALF_OPEN') {
            if (this.successCount >= this.config.successThreshold) {
                this.transitionTo('CLOSED');
            }
        }

        if (this.config.enableMetrics) {
            logger.debug(`Circuit '${this.name}' call succeeded`, {
                state: this.state,
                successCount: this.successCount,
            });
        }
    }

    /**
     * Handle failed call
     */
    private onFailure(error: unknown): void {
        this.lastFailureTime = new Date();
        this.failureCount++;
        this.failedCalls++;
        this.successCount = 0;

        if (this.state === 'HALF_OPEN') {
            // Failed in half-open, go back to open
            this.transitionTo('OPEN');
        } else if (this.state === 'CLOSED') {
            if (this.failureCount >= this.config.failureThreshold) {
                this.transitionTo('OPEN');
            }
        }

        if (this.config.enableMetrics) {
            logger.warn(`Circuit '${this.name}' call failed`, {
                state: this.state,
                failureCount: this.failureCount,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * Transition to a new state
     */
    private transitionTo(newState: CircuitState): void {
        const oldState = this.state;
        this.state = newState;

        if (newState === 'OPEN') {
            this.openedCount++;
            this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
            this.successCount = 0;

            logger.warn(`Circuit '${this.name}' OPENED`, {
                failureCount: this.failureCount,
                nextAttempt: this.nextAttemptTime.toISOString(),
            });
        } else if (newState === 'HALF_OPEN') {
            this.successCount = 0;
            logger.info(`Circuit '${this.name}' attempting recovery (HALF_OPEN)`);
        } else if (newState === 'CLOSED') {
            this.failureCount = 0;
            this.successCount = 0;
            logger.info(`Circuit '${this.name}' recovered (CLOSED)`, {
                previousState: oldState,
            });
        }
    }

    /**
     * Check if we should attempt recovery
     */
    private shouldAttemptRecovery(): boolean {
        if (!this.nextAttemptTime) return true;
        return Date.now() >= this.nextAttemptTime.getTime();
    }

    /**
     * Log rejection when circuit is open
     */
    private logRejection(): void {
        if (this.config.enableMetrics) {
            logger.debug(`Circuit '${this.name}' rejected call (OPEN)`, {
                nextAttempt: this.nextAttemptTime?.toISOString(),
            });
        }
    }

    /**
     * Get current metrics
     */
    getMetrics(): CircuitBreakerMetrics {
        return {
            name: this.name,
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailure: this.lastFailureTime,
            lastSuccess: this.lastSuccessTime,
            totalCalls: this.totalCalls,
            failedCalls: this.failedCalls,
            openedCount: this.openedCount,
        };
    }

    /**
     * Get current state
     */
    getState(): CircuitState {
        return this.state;
    }

    /**
     * Force the circuit to a specific state (for testing/admin)
     */
    forceState(state: CircuitState): void {
        logger.warn(`Circuit '${this.name}' force-set to ${state}`);
        this.transitionTo(state);
    }

    /**
     * Reset the circuit breaker to initial state
     */
    reset(): void {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttemptTime = undefined;
        logger.info(`Circuit '${this.name}' reset`);
    }
}

/**
 * Custom error for circuit breaker rejections
 */
export class CircuitBreakerError extends Error {
    readonly metrics: CircuitBreakerMetrics;

    constructor(message: string, metrics: CircuitBreakerMetrics) {
        super(message);
        this.name = 'CircuitBreakerError';
        this.metrics = metrics;
    }
}

// Global registry of circuit breakers for monitoring
const circuitBreakerRegistry = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker
 */
export function getCircuitBreaker(
    name: string,
    config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
    if (!circuitBreakerRegistry.has(name)) {
        circuitBreakerRegistry.set(name, new CircuitBreaker(name, config));
    }
    return circuitBreakerRegistry.get(name)!;
}

/**
 * Get all circuit breaker metrics
 */
export function getAllCircuitBreakerMetrics(): CircuitBreakerMetrics[] {
    return Array.from(circuitBreakerRegistry.values()).map((cb) => cb.getMetrics());
}

/**
 * Reset all circuit breakers (for testing)
 */
export function resetAllCircuitBreakers(): void {
    circuitBreakerRegistry.forEach((cb) => cb.reset());
}

export default CircuitBreaker;
