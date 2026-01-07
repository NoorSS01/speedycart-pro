/**
 * Health Check Service
 * 
 * Provides health status checks for all critical services:
 * - Supabase Database
 * - Supabase Auth
 * - Storage Service
 * 
 * Returns structured health object for monitoring and admin dashboards.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from './logger';

export type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ServiceHealth {
    status: ServiceStatus;
    latencyMs?: number;
    message?: string;
    lastChecked: string;
}

export interface HealthCheckResult {
    overall: ServiceStatus;
    services: {
        database: ServiceHealth;
        auth: ServiceHealth;
        storage: ServiceHealth;
    };
    timestamp: string;
    version?: string;
}

// Timeout for individual health checks (ms)
const HEALTH_CHECK_TIMEOUT = 5000;

/**
 * Check database connectivity by performing a simple query
 */
async function checkDatabase(): Promise<ServiceHealth> {
    const startTime = performance.now();
    const lastChecked = new Date().toISOString();

    try {
        // Use Promise.race for timeout
        const result = await Promise.race([
            supabase.from('products').select('id').limit(1),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), HEALTH_CHECK_TIMEOUT)
            ),
        ]);

        const latencyMs = Math.round(performance.now() - startTime);

        if ('error' in result && result.error) {
            return {
                status: 'degraded',
                latencyMs,
                message: result.error.message,
                lastChecked,
            };
        }

        // Consider latency > 2s as degraded
        const status: ServiceStatus = latencyMs > 2000 ? 'degraded' : 'healthy';

        return {
            status,
            latencyMs,
            lastChecked,
        };
    } catch (error) {
        const latencyMs = Math.round(performance.now() - startTime);
        return {
            status: 'unhealthy',
            latencyMs,
            message: error instanceof Error ? error.message : 'Unknown error',
            lastChecked,
        };
    }
}

/**
 * Check authentication service status
 */
async function checkAuth(): Promise<ServiceHealth> {
    const startTime = performance.now();
    const lastChecked = new Date().toISOString();

    try {
        // Check if we can get the current session (doesn't require auth)
        const result = await Promise.race([
            supabase.auth.getSession(),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), HEALTH_CHECK_TIMEOUT)
            ),
        ]);

        const latencyMs = Math.round(performance.now() - startTime);

        if ('error' in result && result.error) {
            return {
                status: 'degraded',
                latencyMs,
                message: result.error.message,
                lastChecked,
            };
        }

        const status: ServiceStatus = latencyMs > 2000 ? 'degraded' : 'healthy';

        return {
            status,
            latencyMs,
            lastChecked,
        };
    } catch (error) {
        const latencyMs = Math.round(performance.now() - startTime);
        return {
            status: 'unhealthy',
            latencyMs,
            message: error instanceof Error ? error.message : 'Unknown error',
            lastChecked,
        };
    }
}

/**
 * Check storage service status by listing buckets
 */
async function checkStorage(): Promise<ServiceHealth> {
    const startTime = performance.now();
    const lastChecked = new Date().toISOString();

    try {
        const result = await Promise.race([
            supabase.storage.listBuckets(),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), HEALTH_CHECK_TIMEOUT)
            ),
        ]);

        const latencyMs = Math.round(performance.now() - startTime);

        if ('error' in result && result.error) {
            // Storage might not be configured - treat as degraded, not unhealthy
            return {
                status: 'degraded',
                latencyMs,
                message: result.error.message,
                lastChecked,
            };
        }

        const status: ServiceStatus = latencyMs > 2000 ? 'degraded' : 'healthy';

        return {
            status,
            latencyMs,
            lastChecked,
        };
    } catch (error) {
        const latencyMs = Math.round(performance.now() - startTime);
        return {
            status: 'unhealthy',
            latencyMs,
            message: error instanceof Error ? error.message : 'Unknown error',
            lastChecked,
        };
    }
}

/**
 * Calculate overall health status based on individual service statuses
 */
function calculateOverallStatus(services: HealthCheckResult['services']): ServiceStatus {
    const statuses = Object.values(services).map((s) => s.status);

    if (statuses.every((s) => s === 'healthy')) {
        return 'healthy';
    }

    if (statuses.some((s) => s === 'unhealthy')) {
        return 'unhealthy';
    }

    if (statuses.some((s) => s === 'degraded')) {
        return 'degraded';
    }

    return 'unknown';
}

/**
 * Run all health checks and return comprehensive result
 */
export async function runHealthCheck(): Promise<HealthCheckResult> {
    const correlationId = logger.setCorrelationId();
    logger.info('Starting health check', { correlationId });

    try {
        // Run all checks in parallel
        const [database, auth, storage] = await Promise.all([
            checkDatabase(),
            checkAuth(),
            checkStorage(),
        ]);

        const services = { database, auth, storage };
        const overall = calculateOverallStatus(services);

        const result: HealthCheckResult = {
            overall,
            services,
            timestamp: new Date().toISOString(),
            version: import.meta.env.VITE_APP_VERSION || '1.0.0',
        };

        logger.info('Health check completed', {
            correlationId,
            overall,
            dbLatency: database.latencyMs,
            authLatency: auth.latencyMs,
            storageLatency: storage.latencyMs,
        });

        return result;
    } catch (error) {
        logger.error('Health check failed', { correlationId, error });
        throw error;
    } finally {
        logger.clearCorrelationId();
    }
}

/**
 * Quick database-only health check for fast status checks
 */
export async function quickHealthCheck(): Promise<boolean> {
    try {
        const dbHealth = await checkDatabase();
        return dbHealth.status === 'healthy';
    } catch {
        return false;
    }
}

export default { runHealthCheck, quickHealthCheck };
