/**
 * Enterprise Theme System - Theme Provider
 * 
 * This is the core provider that:
 * 1. Fetches active theme from database
 * 2. Validates scheduling (respects start/end dates)
 * 3. Applies CSS variables to document root
 * 4. Provides theme context to all components
 * 5. Handles performance tier detection
 * 6. Respects accessibility preferences (reduced motion)
 * 7. Supports preview mode for admin
 * 8. Manages graceful fallback on errors
 */

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
    ReactNode
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import {
    Theme,
    ThemeMetadata,
    ThemeColorPalette,
    ThemeMicrointeractions,
    ThemeAtmosphere,
    ThemeContentEmphasis,
    ThemeTypography,
    ThemeAccessibility,
    ThemeSchedule,
    DEFAULT_MICROINTERACTIONS,
    DEFAULT_ATMOSPHERE,
    DEFAULT_ACCESSIBILITY,
} from '@/lib/themeTokens';
import {
    applyThemeToDom,
    removeThemeFromDom,
    detectPerformanceTier,
    prefersReducedMotion,
    isThemeScheduledNow,
    PerformanceTier,
} from '@/lib/themeUtils';

// =============================================================================
// CONTEXT TYPES
// =============================================================================

interface ThemeContextValue {
    // Current theme state
    theme: Theme | null;
    isLoading: boolean;
    error: string | null;

    // Performance & accessibility
    performanceTier: PerformanceTier;
    reducedMotion: boolean;
    effectiveAtmosphere: ThemeAtmosphere; // Adjusted for device capability

    // Preview mode (for admin)
    isPreviewMode: boolean;
    previewTheme: Theme | null;

    // Actions
    refreshTheme: () => Promise<void>;
    enterPreviewMode: (theme: Theme) => void;
    exitPreviewMode: () => void;

    // Legacy compatibility (for existing components)
    activeTheme: LegacyTheme | null;
}

// Legacy theme structure for backward compatibility with existing components
interface LegacyTheme {
    id: string;
    name: string;
    type: string;
    is_active: boolean;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    background_gradient: string | null;
    animation_type: string | null;
    animation_intensity: string;
    header_banner_url: string | null;
    logo_overlay_url: string | null;
    corner_decoration_url: string | null;
    promo_badge_text: string | null;
    promo_badge_color: string | null;
    glassmorphism_enabled: boolean;
    custom_font: string | null;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// =============================================================================
// DEFAULT THEME (fallback when no theme is active)
// =============================================================================

const DEFAULT_COLORS: ThemeColorPalette = {
    background: '0 0% 100%',
    foreground: '140 4% 16%',
    card: '0 0% 100%',
    cardForeground: '140 4% 16%',
    popover: '0 0% 100%',
    popoverForeground: '140 4% 16%',
    primary: '142 76% 36%',
    primaryForeground: '0 0% 100%',
    secondary: '142 25% 94%',
    secondaryForeground: '142 76% 36%',
    muted: '142 25% 96%',
    mutedForeground: '140 4% 46%',
    accent: '142 50% 45%',
    accentForeground: '0 0% 100%',
    destructive: '0 84% 60%',
    destructiveForeground: '0 0% 100%',
    border: '142 20% 90%',
    input: '142 20% 90%',
    ring: '142 76% 36%',
    success: '142 76% 36%',
    warning: '38 92% 50%',
    info: '199 89% 48%',
};

// =============================================================================
// DATABASE TO THEME CONVERSION
// =============================================================================

/**
 * Convert database row to Theme object
 * Handles JSONB parsing and validation
 */
function parseThemeFromDatabase(row: any): Theme | null {
    if (!row) return null;

    try {
        // Parse JSONB columns (they may already be objects or JSON strings)
        const colorTokens = typeof row.color_tokens === 'string'
            ? JSON.parse(row.color_tokens)
            : (row.color_tokens || {});

        const microConfig = typeof row.microinteraction_config === 'string'
            ? JSON.parse(row.microinteraction_config)
            : (row.microinteraction_config || DEFAULT_MICROINTERACTIONS);

        const atmosConfig = typeof row.atmosphere_config === 'string'
            ? JSON.parse(row.atmosphere_config)
            : (row.atmosphere_config || DEFAULT_ATMOSPHERE);

        const contentEmphasis = typeof row.content_emphasis === 'string'
            ? JSON.parse(row.content_emphasis)
            : (row.content_emphasis || {});

        const typoConfig = typeof row.typography_config === 'string'
            ? JSON.parse(row.typography_config)
            : (row.typography_config || {});

        const accessConfig = typeof row.accessibility_config === 'string'
            ? JSON.parse(row.accessibility_config)
            : (row.accessibility_config || DEFAULT_ACCESSIBILITY);

        // Build metadata
        const metadata: ThemeMetadata = {
            id: row.id,
            name: row.name,
            description: row.description || undefined,
            type: row.type || 'custom',
            version: row.version || 1,
            parentVersion: row.parent_version || undefined,
            isActive: row.is_active ?? false,
            isPreview: row.is_preview ?? false,
            createdBy: row.created_by || undefined,
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.updated_at || new Date().toISOString(),
        };

        // Build schedule
        const schedule: ThemeSchedule = {
            startsAt: row.schedule_starts_at || undefined,
            endsAt: row.schedule_ends_at || undefined,
            timezone: row.schedule_timezone || 'Asia/Kolkata',
        };

        // Build colors - merge with fallback/legacy fields
        const colors: ThemeColorPalette = {
            ...DEFAULT_COLORS,
            ...colorTokens,
            // Legacy field support (if new fields not set)
            primary: colorTokens.primary || row.primary_color?.replace('#', '')
                ? hslFromHex(row.primary_color)
                : DEFAULT_COLORS.primary,
        };

        // Build full theme
        const theme: Theme = {
            metadata,
            schedule,
            colors,
            extendedColors: {
                backgroundGradient: row.background_gradient || undefined,
                promoBadge: row.promo_badge_color
                    ? hslFromHex(row.promo_badge_color)
                    : undefined,
            },
            typography: {
                fontFamily: row.custom_font || typoConfig.fontFamily,
                headingWeight: typoConfig.headingWeight || 700,
                headingLetterSpacing: typoConfig.headingLetterSpacing || '-0.02em',
                bodyLineHeight: typoConfig.bodyLineHeight || 1.6,
            },
            microinteractions: {
                ...DEFAULT_MICROINTERACTIONS,
                ...microConfig,
                durations: {
                    ...DEFAULT_MICROINTERACTIONS.durations,
                    ...(microConfig.durations || {}),
                },
            },
            atmosphere: {
                ...DEFAULT_ATMOSPHERE,
                ...atmosConfig,
                particles: {
                    ...DEFAULT_ATMOSPHERE.particles,
                    ...(atmosConfig.particles || {}),
                    // Map legacy animation_type field
                    type: atmosConfig.particles?.type || row.animation_type || 'none',
                },
                overlay: {
                    ...DEFAULT_ATMOSPHERE.overlay,
                    ...(atmosConfig.overlay || {}),
                },
            },
            contentEmphasis: {
                hero: contentEmphasis.hero || { enabled: false },
                promo: {
                    bannerEnabled: contentEmphasis.promo?.bannerEnabled ?? !!row.promo_badge_text,
                    bannerText: contentEmphasis.promo?.bannerText || row.promo_badge_text,
                    badgeEnabled: contentEmphasis.promo?.badgeEnabled ?? false,
                    badgeText: contentEmphasis.promo?.badgeText,
                    categoryEmphasis: contentEmphasis.promo?.categoryEmphasis || [],
                    ...contentEmphasis.promo,
                },
                emptyState: contentEmphasis.emptyState || { illustrationVariant: 'default' },
            },
            accessibility: {
                ...DEFAULT_ACCESSIBILITY,
                ...accessConfig,
                reducedMotionDurations: {
                    ...DEFAULT_ACCESSIBILITY.reducedMotionDurations,
                    ...(accessConfig.reducedMotionDurations || {}),
                },
            },
        };

        return theme;
    } catch (error) {
        logger.error('Failed to parse theme from database', { error, row });
        return null;
    }
}

/**
 * Convert hex color to HSL string (basic conversion for legacy support)
 */
function hslFromHex(hex: string): string {
    if (!hex) return '';

    // Remove # if present
    hex = hex.replace('#', '');

    // Parse hex
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Convert Theme to legacy format for backward compatibility
 */
function toLegacyTheme(theme: Theme): LegacyTheme {
    return {
        id: theme.metadata.id,
        name: theme.metadata.name,
        type: theme.metadata.type,
        is_active: theme.metadata.isActive,
        primary_color: `hsl(${theme.colors.primary})`,
        secondary_color: `hsl(${theme.colors.secondary})`,
        accent_color: `hsl(${theme.colors.accent})`,
        background_gradient: theme.extendedColors.backgroundGradient || null,
        animation_type: theme.atmosphere.particles.type || null,
        animation_intensity: theme.atmosphere.performanceTier === 'high'
            ? 'high'
            : theme.atmosphere.performanceTier === 'low'
                ? 'low'
                : 'medium',
        header_banner_url: null,
        logo_overlay_url: null,
        corner_decoration_url: null,
        promo_badge_text: theme.contentEmphasis.promo.bannerText || null,
        promo_badge_color: theme.extendedColors.promoBadge
            ? `hsl(${theme.extendedColors.promoBadge})`
            : null,
        glassmorphism_enabled: false,
        custom_font: theme.typography.fontFamily || null,
    };
}

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

interface ThemeProviderProps {
    children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    // Core state
    const [theme, setTheme] = useState<Theme | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Preview mode state
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [previewTheme, setPreviewTheme] = useState<Theme | null>(null);

    // Performance state
    const [performanceTier, setPerformanceTier] = useState<PerformanceTier>('medium');
    const [reducedMotion, setReducedMotion] = useState(false);

    // Detect device capabilities on mount
    useEffect(() => {
        setPerformanceTier(detectPerformanceTier());
        setReducedMotion(prefersReducedMotion());

        // Listen for reduced motion changes
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
        mediaQuery.addEventListener('change', handler);

        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    // Fetch active theme from database
    const fetchActiveTheme = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const now = new Date().toISOString();

            // Query for active, non-preview theme within schedule
            const { data, error: fetchError } = await supabase
                .from('themes')
                .select('*')
                .eq('is_active', true)
                .eq('is_preview', false)
                .or(`schedule_starts_at.is.null,schedule_starts_at.lte.${now}`)
                .or(`schedule_ends_at.is.null,schedule_ends_at.gte.${now}`)
                .maybeSingle();

            if (fetchError) {
                // Table might not have new columns yet - try legacy query
                const { data: legacyData } = await supabase
                    .from('themes')
                    .select('*')
                    .eq('is_active', true)
                    .maybeSingle();

                if (legacyData) {
                    const parsedTheme = parseThemeFromDatabase(legacyData);
                    if (parsedTheme && isThemeScheduledNow(parsedTheme)) {
                        setTheme(parsedTheme);
                        applyThemeToDom(parsedTheme);
                    } else {
                        setTheme(null);
                        removeThemeFromDom();
                    }
                } else {
                    setTheme(null);
                    removeThemeFromDom();
                }
            } else if (data) {
                const parsedTheme = parseThemeFromDatabase(data);
                if (parsedTheme && isThemeScheduledNow(parsedTheme)) {
                    setTheme(parsedTheme);
                    applyThemeToDom(parsedTheme);
                } else {
                    setTheme(null);
                    removeThemeFromDom();
                }
            } else {
                setTheme(null);
                removeThemeFromDom();
            }
        } catch (err) {
            logger.error('Failed to fetch theme', { error: err });
            setError('Failed to load theme');
            setTheme(null);
            removeThemeFromDom();
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchActiveTheme();
    }, [fetchActiveTheme]);

    // Calculate effective atmosphere based on device capability and preferences
    const effectiveAtmosphere = useMemo((): ThemeAtmosphere => {
        const currentTheme = isPreviewMode ? previewTheme : theme;
        if (!currentTheme) return DEFAULT_ATMOSPHERE;

        const { atmosphere, accessibility } = currentTheme;

        // Respect reduced motion preference
        if (reducedMotion && atmosphere.respectReducedMotion) {
            return {
                ...atmosphere,
                particles: { ...atmosphere.particles, type: 'none' },
                overlay: {
                    ...atmosphere.overlay,
                    enabled: atmosphere.overlay.enabled && !accessibility.disableOverlayAnimations,
                },
            };
        }

        // Adjust based on performance tier
        if (performanceTier === 'low') {
            return {
                ...atmosphere,
                particles: {
                    ...atmosphere.particles,
                    density: Math.floor(atmosphere.particles.density * 0.3),
                },
                performanceTier: 'low',
                fpsTarget: 30,
            };
        }

        if (performanceTier === 'medium') {
            return {
                ...atmosphere,
                particles: {
                    ...atmosphere.particles,
                    density: Math.floor(atmosphere.particles.density * 0.6),
                },
                performanceTier: 'medium',
                fpsTarget: 30,
            };
        }

        return atmosphere;
    }, [theme, previewTheme, isPreviewMode, performanceTier, reducedMotion]);

    // Preview mode handlers
    const enterPreviewMode = useCallback((themeToPreview: Theme) => {
        setPreviewTheme(themeToPreview);
        setIsPreviewMode(true);
        applyThemeToDom(themeToPreview);
    }, []);

    const exitPreviewMode = useCallback(() => {
        setIsPreviewMode(false);
        setPreviewTheme(null);

        // Reapply actual theme or remove
        if (theme) {
            applyThemeToDom(theme);
        } else {
            removeThemeFromDom();
        }
    }, [theme]);

    // Build context value
    const value = useMemo((): ThemeContextValue => {
        const currentTheme = isPreviewMode ? previewTheme : theme;

        return {
            theme: currentTheme,
            isLoading,
            error,
            performanceTier,
            reducedMotion,
            effectiveAtmosphere,
            isPreviewMode,
            previewTheme,
            refreshTheme: fetchActiveTheme,
            enterPreviewMode,
            exitPreviewMode,
            // Legacy compatibility
            activeTheme: currentTheme ? toLegacyTheme(currentTheme) : null,
        };
    }, [
        theme,
        previewTheme,
        isPreviewMode,
        isLoading,
        error,
        performanceTier,
        reducedMotion,
        effectiveAtmosphere,
        fetchActiveTheme,
        enterPreviewMode,
        exitPreviewMode,
    ]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Main theme hook - provides full theme context
 */
export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

/**
 * Legacy hook for backward compatibility
 * @deprecated Use useTheme() instead
 */
export function useThemeContext() {
    return useTheme();
}

/**
 * Hook for just the color palette
 */
export function useThemeColors(): ThemeColorPalette {
    const { theme } = useTheme();
    return theme?.colors || DEFAULT_COLORS;
}

/**
 * Hook for microinteraction values
 */
export function useThemeMicrointeractions(): ThemeMicrointeractions {
    const { theme, reducedMotion } = useTheme();
    const micro = theme?.microinteractions || DEFAULT_MICROINTERACTIONS;

    // Return zero-duration interactions if reduced motion is preferred
    if (reducedMotion) {
        return {
            ...micro,
            durations: theme?.accessibility.reducedMotionDurations || {
                instant: 0,
                fast: 0,
                normal: 0,
                slow: 0,
                atmospheric: 0,
            },
            buttonHoverScale: 1,
            buttonHoverLift: 0,
            cardHoverScale: 1,
            cardHoverLift: 0,
        };
    }

    return micro;
}

/**
 * Hook for atmosphere configuration
 */
export function useThemeAtmosphere(): ThemeAtmosphere {
    const { effectiveAtmosphere } = useTheme();
    return effectiveAtmosphere;
}

/**
 * Hook for content emphasis settings
 */
export function useThemeContentEmphasis(): ThemeContentEmphasis | null {
    const { theme } = useTheme();
    return theme?.contentEmphasis || null;
}

export default ThemeProvider;
