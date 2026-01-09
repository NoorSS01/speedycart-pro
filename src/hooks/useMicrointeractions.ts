/**
 * Enterprise Theme System - Microinteraction Engine
 * 
 * This module provides React hooks and utilities for themed microinteractions.
 * Components use these to get consistent, theme-aware hover, press, and focus states.
 * 
 * Features:
 * - Respects reduced motion preferences
 * - Provides CSS-in-JS style objects for direct use
 * - Returns CSS class strings for Tailwind integration
 * - Supports all interaction types: hover, press, focus, loading
 */

import { useMemo, useCallback, CSSProperties } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeMicrointeractions, DEFAULT_MICROINTERACTIONS } from '@/lib/themeTokens';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Interaction state handlers returned by the hook
 */
export interface MicrointeractionHandlers {
    // Button interactions
    buttonStyles: {
        base: CSSProperties;
        hover: CSSProperties;
        active: CSSProperties;
        focus: CSSProperties;
    };

    // Card interactions
    cardStyles: {
        base: CSSProperties;
        hover: CSSProperties;
        focus: CSSProperties;
    };

    // Generic interactive element
    interactiveStyles: {
        base: CSSProperties;
        hover: CSSProperties;
        active: CSSProperties;
    };

    // Loading state
    loadingStyles: CSSProperties;

    // Shimmer animation
    shimmerStyles: CSSProperties;

    // Focus ring
    focusRingStyles: CSSProperties;

    // Transition utility
    getTransition: (properties: string[]) => string;

    // Duration values (for JS animations)
    durations: {
        instant: number;
        fast: number;
        normal: number;
        slow: number;
    };

    // Whether reduced motion is active
    isReducedMotion: boolean;
}

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * Hook providing themed microinteraction styles and handlers
 */
export function useMicrointeractions(): MicrointeractionHandlers {
    const { theme, reducedMotion } = useTheme();

    const micro = useMemo((): ThemeMicrointeractions => {
        if (!theme) return DEFAULT_MICROINTERACTIONS;

        // If reduced motion is preferred, zero out movements
        if (reducedMotion) {
            return {
                ...theme.microinteractions,
                durations: theme.accessibility.reducedMotionDurations,
                buttonHoverScale: 1,
                buttonHoverLift: 0,
                buttonPressScale: 1,
                cardHoverScale: 1,
                cardHoverLift: 0,
            };
        }

        return theme.microinteractions;
    }, [theme, reducedMotion]);

    // Utility to generate transition string
    const getTransition = useCallback((properties: string[]): string => {
        if (reducedMotion) return 'none';
        const duration = `${micro.durations.fast}ms`;
        const timing = micro.timingFunction;
        return properties.map(prop => `${prop} ${duration} ${timing}`).join(', ');
    }, [micro, reducedMotion]);

    // Button styles
    const buttonStyles = useMemo(() => ({
        base: {
            transition: getTransition(['transform', 'box-shadow', 'background-color']),
            willChange: 'transform' as const,
        } as CSSProperties,
        hover: {
            transform: `translateY(${micro.buttonHoverLift}px) scale(${micro.buttonHoverScale})`,
            boxShadow: 'var(--theme-shadow-hover)',
        } as CSSProperties,
        active: {
            transform: `scale(${micro.buttonPressScale})`,
            transition: `transform ${micro.buttonPressDuration}ms ${micro.timingFunction}`,
        } as CSSProperties,
        focus: {
            outline: 'none',
            boxShadow: `0 0 0 ${micro.focusRingOffset}px var(--background), 0 0 0 ${micro.focusRingOffset + micro.focusRingWidth}px hsl(var(--ring))`,
        } as CSSProperties,
    }), [micro, getTransition]);

    // Card styles
    const cardStyles = useMemo(() => ({
        base: {
            transition: getTransition(['transform', 'box-shadow']),
            willChange: 'transform' as const,
        } as CSSProperties,
        hover: {
            transform: `translateY(${micro.cardHoverLift}px) scale(${micro.cardHoverScale})`,
            boxShadow: `0 ${micro.cardHoverShadowBlur}px ${micro.cardHoverShadowBlur * 1.5}px hsl(var(--primary) / 0.1)`,
        } as CSSProperties,
        focus: {
            outline: 'none',
            boxShadow: `0 0 0 ${micro.focusRingWidth}px hsl(var(--ring))`,
        } as CSSProperties,
    }), [micro, getTransition]);

    // Generic interactive element styles
    const interactiveStyles = useMemo(() => ({
        base: {
            transition: getTransition(['transform', 'opacity']),
        } as CSSProperties,
        hover: {
            transform: 'scale(1.02)',
            opacity: 0.9,
        } as CSSProperties,
        active: {
            transform: 'scale(0.98)',
        } as CSSProperties,
    }), [getTransition]);

    // Loading state (pulsing)
    const loadingStyles = useMemo((): CSSProperties => ({
        animation: reducedMotion
            ? 'none'
            : `pulse ${micro.loadingPulseDuration}ms ease-in-out infinite`,
    }), [micro, reducedMotion]);

    // Shimmer animation
    const shimmerStyles = useMemo((): CSSProperties => ({
        animationDuration: reducedMotion ? '0ms' : `${micro.shimmerDuration}ms`,
        backgroundSize: '200% 100%',
        backgroundImage: 'linear-gradient(90deg, transparent 0%, hsl(var(--muted-foreground) / 0.1) 50%, transparent 100%)',
    }), [micro, reducedMotion]);

    // Focus ring styles
    const focusRingStyles = useMemo((): CSSProperties => ({
        outline: 'none',
        boxShadow: `0 0 0 ${micro.focusRingOffset}px var(--background), 0 0 0 ${micro.focusRingOffset + micro.focusRingWidth}px hsl(var(--ring))`,
    }), [micro]);

    // Duration values for JS animations
    const durations = useMemo(() => ({
        instant: reducedMotion ? 0 : micro.durations.instant,
        fast: reducedMotion ? 0 : micro.durations.fast,
        normal: reducedMotion ? 0 : micro.durations.normal,
        slow: reducedMotion ? 0 : micro.durations.slow,
    }), [micro, reducedMotion]);

    return {
        buttonStyles,
        cardStyles,
        interactiveStyles,
        loadingStyles,
        shimmerStyles,
        focusRingStyles,
        getTransition,
        durations,
        isReducedMotion: reducedMotion,
    };
}

// =============================================================================
// UTILITY FUNCTIONS FOR CLASS GENERATION
// =============================================================================

/**
 * Generate Tailwind-compatible classes for themed button hover
 */
export function getButtonHoverClasses(reducedMotion = false): string {
    if (reducedMotion) {
        return 'transition-colors';
    }
    return [
        'transition-all',
        'duration-150',
        'ease-out',
        'hover:-translate-y-0.5',
        'hover:scale-[1.02]',
        'hover:shadow-lg',
        'active:scale-[0.98]',
        'focus-visible:ring-2',
        'focus-visible:ring-ring',
        'focus-visible:ring-offset-2',
    ].join(' ');
}

/**
 * Generate Tailwind-compatible classes for themed card hover
 */
export function getCardHoverClasses(reducedMotion = false): string {
    if (reducedMotion) {
        return 'transition-colors';
    }
    return [
        'transition-all',
        'duration-200',
        'ease-out',
        'hover:-translate-y-1',
        'hover:scale-[1.01]',
        'hover:shadow-xl',
        'focus-visible:ring-2',
        'focus-visible:ring-ring',
    ].join(' ');
}

/**
 * Generate Tailwind-compatible classes for focus states
 */
export function getFocusClasses(): string {
    return [
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-ring',
        'focus-visible:ring-offset-2',
        'focus-visible:ring-offset-background',
    ].join(' ');
}

// =============================================================================
// SPRING ANIMATION UTILITIES (for framer-motion compatibility)
// =============================================================================

/**
 * Spring configuration for bouncy animations
 */
export interface SpringConfig {
    type: 'spring';
    stiffness: number;
    damping: number;
}

export const springConfigs: Record<string, SpringConfig> = {
    // Snappy - for buttons and quick interactions
    snappy: {
        type: 'spring',
        stiffness: 400,
        damping: 30,
    },

    // Gentle - for cards and larger elements
    gentle: {
        type: 'spring',
        stiffness: 200,
        damping: 25,
    },

    // Bouncy - for playful interactions
    bouncy: {
        type: 'spring',
        stiffness: 300,
        damping: 15,
    },

    // Slow - for atmospheric effects
    slow: {
        type: 'spring',
        stiffness: 100,
        damping: 20,
    },
};

/**
 * Get appropriate spring config based on theme mood
 */
export function getSpringConfig(
    themeMood: 'calm' | 'energetic' | 'playful' | 'neutral' = 'neutral'
): SpringConfig {
    switch (themeMood) {
        case 'calm':
            return springConfigs.slow;
        case 'energetic':
            return springConfigs.snappy;
        case 'playful':
            return springConfigs.bouncy;
        default:
            return springConfigs.gentle;
    }
}

export default useMicrointeractions;
