/**
 * Enterprise Theme System - Token Type Definitions
 * 
 * This module defines the complete type structure for themes.
 * Every theme-controlled aspect of the UI is typed here.
 * 
 * Design Principles:
 * 1. All colors use HSL format: "H S% L%" (no commas, ready for CSS)
 * 2. Token names align with shadcn/ui conventions for seamless integration
 * 3. Microinteraction tokens control timing, scale, and feedback intensity
 * 4. Atmosphere tokens configure ambient visual effects
 */

// =============================================================================
// COLOR TOKENS
// =============================================================================

/**
 * HSL color string format: "H S% L%"
 * Example: "142 76% 36%" (green primary)
 */
export type HSLColor = string;

/**
 * Core palette tokens - map directly to shadcn CSS variables
 */
export interface ThemeColorPalette {
    // Backgrounds
    background: HSLColor;
    foreground: HSLColor;
    card: HSLColor;
    cardForeground: HSLColor;
    popover: HSLColor;
    popoverForeground: HSLColor;

    // Primary brand color
    primary: HSLColor;
    primaryForeground: HSLColor;

    // Secondary/supporting color
    secondary: HSLColor;
    secondaryForeground: HSLColor;

    // Muted elements
    muted: HSLColor;
    mutedForeground: HSLColor;

    // Accent for highlights
    accent: HSLColor;
    accentForeground: HSLColor;

    // Destructive actions
    destructive: HSLColor;
    destructiveForeground: HSLColor;

    // Interactive elements
    border: HSLColor;
    input: HSLColor;
    ring: HSLColor;

    // Semantic colors
    success: HSLColor;
    warning: HSLColor;
    info: HSLColor;
}

/**
 * Extended palette for theme-specific accents
 */
export interface ThemeExtendedPalette {
    // Gradient for backgrounds (CSS gradient string)
    backgroundGradient?: string;

    // Seasonal accent (e.g., warm glow for winter, coral for summer)
    seasonalAccent?: HSLColor;

    // Promotional badge color
    promoBadge?: HSLColor;
    promoBadgeForeground?: HSLColor;

    // Overlay colors for atmospheric effects
    overlayWarm?: HSLColor;  // Warm glow spots
    overlayCool?: HSLColor;  // Cool mist overlay
}

// =============================================================================
// MICROINTERACTION TOKENS
// =============================================================================

/**
 * Timing function presets for different emotional tones
 */
export type TimingFunction =
    | 'ease-out'           // Standard, confident
    | 'ease-in-out'        // Smooth, calm
    | 'cubic-bezier(0.34, 1.56, 0.64, 1)'  // Bouncy, playful
    | 'cubic-bezier(0.4, 0, 0.2, 1)'       // Material-style
    | 'spring(1, 80, 10)'  // Spring physics (for framer-motion)
    | string;              // Custom

/**
 * Duration presets (in milliseconds)
 */
export interface ThemeDurations {
    instant: number;    // 0-50ms - Immediate feedback
    fast: number;       // 100-150ms - Snappy interactions
    normal: number;     // 200-300ms - Standard transitions
    slow: number;       // 400-500ms - Deliberate animations
    atmospheric: number; // 1000ms+ - Ambient effects
}

/**
 * Microinteraction configuration for UI elements
 */
export interface ThemeMicrointeractions {
    // Timing
    durations: ThemeDurations;
    timingFunction: TimingFunction;

    // Button interactions
    buttonHoverScale: number;      // e.g., 1.02
    buttonHoverLift: number;       // e.g., -2 (pixels, negative = up)
    buttonPressScale: number;      // e.g., 0.98
    buttonPressDuration: number;   // ms

    // Card interactions
    cardHoverScale: number;        // e.g., 1.01
    cardHoverLift: number;         // e.g., -4
    cardHoverShadowBlur: number;   // e.g., 16
    cardHoverShadowSpread: number; // e.g., 4

    // Focus states
    focusRingWidth: number;        // e.g., 2
    focusRingOffset: number;       // e.g., 2

    // Toggle/switch
    toggleDuration: number;        // ms
    toggleBounce: boolean;         // Enable bounce effect

    // Loading indicators
    loadingPulseScale: number;     // e.g., 1.05
    loadingPulseDuration: number;  // ms

    // Skeleton shimmer
    shimmerDuration: number;       // ms for full sweep
    shimmerAngle: number;          // degrees
}

// =============================================================================
// ATMOSPHERE TOKENS
// =============================================================================

/**
 * Particle effect types available
 */
export type ParticleType =
    | 'none'
    | 'snowfall'
    | 'rain'
    | 'petals'
    | 'leaves'
    | 'sparkles'
    | 'confetti';

/**
 * Particle rendering configuration
 */
export interface ParticleConfig {
    type: ParticleType;

    // Density (particles per 1000px viewport width)
    density: number;

    // Size range (min, max in pixels)
    sizeMin: number;
    sizeMax: number;

    // Speed range (min, max in pixels per second)
    speedMin: number;
    speedMax: number;

    // Opacity range
    opacityMin: number;
    opacityMax: number;

    // Physics
    drift: number;       // Horizontal sway amplitude
    rotation: boolean;   // Enable rotation
    rotationSpeed: number; // Degrees per second

    // Color (for simple shapes like snowflakes, rain)
    color: HSLColor;
    colorVariance: number; // Hue variance for variety
}

/**
 * Ambient overlay configuration
 */
export interface AmbientOverlayConfig {
    enabled: boolean;

    // Gradient wash
    gradientWash?: {
        colors: HSLColor[];
        angle: number;
        opacity: number;
    };

    // Vignette effect
    vignette?: {
        color: HSLColor;
        intensity: number; // 0-1
    };

    // Light glow spots
    glowSpots?: {
        positions: Array<{ x: number; y: number }>; // Percentage positions
        color: HSLColor;
        radius: number;
        blur: number;
        opacity: number;
        animate: boolean;
    };

    // Subtle grain texture
    grain?: {
        opacity: number;
        animate: boolean;
    };
}

/**
 * Complete atmosphere configuration
 */
export interface ThemeAtmosphere {
    particles: ParticleConfig;
    overlay: AmbientOverlayConfig;

    // Performance settings
    performanceTier: 'high' | 'medium' | 'low' | 'static';
    respectReducedMotion: boolean;
    pauseWhenHidden: boolean;
    fpsTarget: number;
}

// =============================================================================
// CONTENT EMPHASIS TOKENS
// =============================================================================

/**
 * Hero section theming
 */
export interface ThemeHeroConfig {
    enabled: boolean;
    backgroundImageUrl?: string;
    overlayGradient?: string;
    headlineColor: HSLColor;
    subheadlineColor: HSLColor;
    ctaVariant: 'primary' | 'accent' | 'contrast';
    decorativeElements?: {
        cornerTopLeft?: string;   // SVG or image URL
        cornerTopRight?: string;
        cornerBottomLeft?: string;
        cornerBottomRight?: string;
    };
}

/**
 * Category emphasis for seasonal highlighting
 */
export interface CategoryEmphasis {
    categoryId: string;
    label: string;           // e.g., "Winter Essentials"
    badgeColor: HSLColor;
    priority: number;        // Display order
}

/**
 * Promotional surface configuration
 */
export interface ThemePromoConfig {
    // Banner
    bannerEnabled: boolean;
    bannerText?: string;
    bannerBackgroundColor?: HSLColor;
    bannerTextColor?: HSLColor;
    bannerDismissible: boolean;

    // Product badges
    badgeEnabled: boolean;
    badgeText?: string;
    badgeColor?: HSLColor;

    // Category highlights
    categoryEmphasis: CategoryEmphasis[];
}

/**
 * Empty state theming
 */
export interface ThemeEmptyStateConfig {
    illustrationVariant: 'default' | 'seasonal';
    seasonalIllustrationUrl?: string;
    messageTemplate?: string; // e.g., "Brrr... nothing here yet!"
}

/**
 * Complete content emphasis configuration
 */
export interface ThemeContentEmphasis {
    hero: ThemeHeroConfig;
    promo: ThemePromoConfig;
    emptyState: ThemeEmptyStateConfig;
}

// =============================================================================
// TYPOGRAPHY TOKENS
// =============================================================================

export interface ThemeTypography {
    // Font family override (null = use default)
    fontFamily?: string;

    // Heading style adjustments
    headingWeight: number;        // e.g., 700
    headingLetterSpacing: string; // e.g., '-0.02em'

    // Body adjustments
    bodyLineHeight: number;       // e.g., 1.6
}

// =============================================================================
// ACCESSIBILITY TOKENS
// =============================================================================

export interface ThemeAccessibility {
    // Minimum contrast ratios (WCAG)
    minContrastNormal: number;    // 4.5:1 for AA
    minContrastLarge: number;     // 3:1 for AA large text

    // Reduced motion alternatives
    reducedMotionDurations: ThemeDurations;
    disableParticles: boolean;
    disableOverlayAnimations: boolean;

    // Focus visibility
    enhancedFocusIndicators: boolean;
}

// =============================================================================
// SCHEDULE & METADATA
// =============================================================================

export interface ThemeSchedule {
    startsAt?: string;  // ISO timestamp
    endsAt?: string;    // ISO timestamp
    timezone?: string;  // e.g., 'Asia/Kolkata'
}

export interface ThemeMetadata {
    id: string;
    name: string;
    description?: string;
    type: 'seasonal' | 'festival' | 'sale' | 'custom';
    version: number;
    parentVersion?: number;
    isActive: boolean;
    isPreview: boolean;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

// =============================================================================
// COMPLETE THEME TYPE
// =============================================================================

/**
 * Complete theme configuration
 * This is the source of truth for all theme-controlled UI aspects
 */
export interface Theme {
    metadata: ThemeMetadata;
    schedule: ThemeSchedule;

    // Visual identity
    colors: ThemeColorPalette;
    extendedColors: ThemeExtendedPalette;
    typography: ThemeTypography;

    // Behavioral
    microinteractions: ThemeMicrointeractions;

    // Atmospheric
    atmosphere: ThemeAtmosphere;

    // Content
    contentEmphasis: ThemeContentEmphasis;

    // Accessibility
    accessibility: ThemeAccessibility;
}

// =============================================================================
// DEFAULTS
// =============================================================================

/**
 * Default microinteraction values (neutral, professional)
 */
export const DEFAULT_MICROINTERACTIONS: ThemeMicrointeractions = {
    durations: {
        instant: 50,
        fast: 150,
        normal: 250,
        slow: 400,
        atmospheric: 1500,
    },
    timingFunction: 'ease-out',

    buttonHoverScale: 1.02,
    buttonHoverLift: -2,
    buttonPressScale: 0.98,
    buttonPressDuration: 100,

    cardHoverScale: 1.01,
    cardHoverLift: -4,
    cardHoverShadowBlur: 16,
    cardHoverShadowSpread: 4,

    focusRingWidth: 2,
    focusRingOffset: 2,

    toggleDuration: 200,
    toggleBounce: false,

    loadingPulseScale: 1.05,
    loadingPulseDuration: 1500,

    shimmerDuration: 2000,
    shimmerAngle: 90,
};

/**
 * Default particle config (none)
 */
export const DEFAULT_PARTICLE_CONFIG: ParticleConfig = {
    type: 'none',
    density: 0,
    sizeMin: 4,
    sizeMax: 8,
    speedMin: 20,
    speedMax: 60,
    opacityMin: 0.3,
    opacityMax: 0.8,
    drift: 10,
    rotation: false,
    rotationSpeed: 0,
    color: '0 0% 100%',
    colorVariance: 0,
};

/**
 * Default atmosphere (static, no effects)
 */
export const DEFAULT_ATMOSPHERE: ThemeAtmosphere = {
    particles: DEFAULT_PARTICLE_CONFIG,
    overlay: {
        enabled: false,
    },
    performanceTier: 'medium',
    respectReducedMotion: true,
    pauseWhenHidden: true,
    fpsTarget: 60,
};

/**
 * Default accessibility settings
 */
export const DEFAULT_ACCESSIBILITY: ThemeAccessibility = {
    minContrastNormal: 4.5,
    minContrastLarge: 3.0,
    reducedMotionDurations: {
        instant: 0,
        fast: 0,
        normal: 0,
        slow: 0,
        atmospheric: 0,
    },
    disableParticles: true,
    disableOverlayAnimations: true,
    enhancedFocusIndicators: true,
};
