/**
 * Core Web Vitals Tracking
 * 
 * Measures and reports key performance metrics:
 * - LCP (Largest Contentful Paint): Loading performance
 * - FID (First Input Delay): Interactivity
 * - CLS (Cumulative Layout Shift): Visual stability
 * - TTFB (Time to First Byte): Server response
 * - INP (Interaction to Next Paint): Responsiveness
 * 
 * Usage:
 * Import and call initWebVitals() in main.tsx for automatic tracking.
 */

import { logger } from './logger';

// Metric thresholds based on Google's recommendations
const THRESHOLDS = {
    LCP: { good: 2500, needsImprovement: 4000 },
    FID: { good: 100, needsImprovement: 300 },
    CLS: { good: 0.1, needsImprovement: 0.25 },
    TTFB: { good: 800, needsImprovement: 1800 },
    INP: { good: 200, needsImprovement: 500 },
};

type MetricName = 'LCP' | 'FID' | 'CLS' | 'TTFB' | 'INP' | 'FCP';

interface WebVitalMetric {
    name: MetricName;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    delta: number;
    id: string;
}

type MetricHandler = (metric: WebVitalMetric) => void;

/**
 * Get rating based on metric value and thresholds
 */
function getRating(name: MetricName, value: number): 'good' | 'needs-improvement' | 'poor' {
    const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
    if (!threshold) return 'good';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.needsImprovement) return 'needs-improvement';
    return 'poor';
}

/**
 * Default handler: logs metrics to our structured logger
 */
const defaultHandler: MetricHandler = (metric) => {
    const logMethod = metric.rating === 'poor' ? 'warn' : 'info';

    logger[logMethod](`Web Vital: ${metric.name}`, {
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
    }, 'web-vitals');
};

/**
 * Observer for Largest Contentful Paint
 */
function observeLCP(handler: MetricHandler): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };

        if (lastEntry) {
            const value = lastEntry.startTime;
            handler({
                name: 'LCP',
                value,
                rating: getRating('LCP', value),
                delta: value,
                id: `lcp-${Date.now()}`,
            });
        }
    });

    try {
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
        // LCP not supported
    }
}

/**
 * Observer for First Input Delay
 */
function observeFID(handler: MetricHandler): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries() as (PerformanceEntry & { processingStart: number; startTime: number })[];
        const firstEntry = entries[0];

        if (firstEntry) {
            const value = firstEntry.processingStart - firstEntry.startTime;
            handler({
                name: 'FID',
                value,
                rating: getRating('FID', value),
                delta: value,
                id: `fid-${Date.now()}`,
            });
        }
    });

    try {
        observer.observe({ type: 'first-input', buffered: true });
    } catch {
        // FID not supported
    }
}

/**
 * Observer for Cumulative Layout Shift
 */
function observeCLS(handler: MetricHandler): void {
    if (!('PerformanceObserver' in window)) return;

    let clsValue = 0;
    let sessionValue = 0;
    let sessionEntries: PerformanceEntry[] = [];

    const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries() as (PerformanceEntry & { hadRecentInput: boolean; value: number; startTime: number })[];

        for (const entry of entries) {
            if (!entry.hadRecentInput) {
                const firstSessionEntry = sessionEntries[0] as (PerformanceEntry & { startTime: number }) | undefined;
                const lastSessionEntry = sessionEntries[sessionEntries.length - 1] as (PerformanceEntry & { startTime: number }) | undefined;

                if (
                    sessionValue &&
                    lastSessionEntry &&
                    entry.startTime - lastSessionEntry.startTime < 1000 &&
                    firstSessionEntry &&
                    entry.startTime - firstSessionEntry.startTime < 5000
                ) {
                    sessionValue += entry.value;
                    sessionEntries.push(entry);
                } else {
                    sessionValue = entry.value;
                    sessionEntries = [entry];
                }

                if (sessionValue > clsValue) {
                    clsValue = sessionValue;
                    handler({
                        name: 'CLS',
                        value: clsValue,
                        rating: getRating('CLS', clsValue),
                        delta: entry.value,
                        id: `cls-${Date.now()}`,
                    });
                }
            }
        }
    });

    try {
        observer.observe({ type: 'layout-shift', buffered: true });
    } catch {
        // CLS not supported
    }
}

/**
 * Measure Time to First Byte
 */
function measureTTFB(handler: MetricHandler): void {
    if (!('performance' in window)) return;

    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    if (navEntry) {
        const value = navEntry.responseStart - navEntry.requestStart;
        handler({
            name: 'TTFB',
            value,
            rating: getRating('TTFB', value),
            delta: value,
            id: `ttfb-${Date.now()}`,
        });
    }
}

/**
 * Observer for First Contentful Paint
 */
function observeFCP(handler: MetricHandler): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const fcpEntry = entries.find((e) => e.name === 'first-contentful-paint') as PerformanceEntry & { startTime: number } | undefined;

        if (fcpEntry) {
            handler({
                name: 'FCP',
                value: fcpEntry.startTime,
                rating: fcpEntry.startTime <= 1800 ? 'good' : fcpEntry.startTime <= 3000 ? 'needs-improvement' : 'poor',
                delta: fcpEntry.startTime,
                id: `fcp-${Date.now()}`,
            });
        }
    });

    try {
        observer.observe({ type: 'paint', buffered: true });
    } catch {
        // FCP not supported
    }
}

/**
 * Initialize all Web Vitals observers
 * Call this once in main.tsx
 */
export function initWebVitals(customHandler?: MetricHandler): void {
    const handler = customHandler || defaultHandler;

    // Wait for page to be fully loaded
    if (document.readyState === 'complete') {
        startObserving(handler);
    } else {
        window.addEventListener('load', () => startObserving(handler));
    }
}

function startObserving(handler: MetricHandler): void {
    // Delay slightly to not impact initial load
    setTimeout(() => {
        measureTTFB(handler);
        observeFCP(handler);
        observeLCP(handler);
        observeFID(handler);
        observeCLS(handler);

        logger.info('Web Vitals tracking initialized');
    }, 0);
}

/**
 * Get current performance metrics snapshot
 */
export function getPerformanceSnapshot(): {
    loadTime: number;
    domInteractive: number;
    resources: number;
} {
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType('resource');

    return {
        loadTime: navEntry?.loadEventEnd || 0,
        domInteractive: navEntry?.domInteractive || 0,
        resources: resources.length,
    };
}

export type { WebVitalMetric, MetricHandler, MetricName };
