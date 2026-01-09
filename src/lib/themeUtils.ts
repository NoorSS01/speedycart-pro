/**
 * Enterprise Theme System - Utility Functions
 * 
 * This module provides essential utilities for theme operations:
 * - HSL color parsing and manipulation
 * - Contrast ratio calculations (WCAG compliance)
 * - CSS variable generation from theme tokens
 * - Performance tier detection
 * - Reduced motion detection
 */

import {
    Theme,
    ThemeColorPalette,
    ThemeMicrointeractions,
    HSLColor,
    DEFAULT_MICROINTERACTIONS,
} from './themeTokens';

// =============================================================================
// HSL COLOR UTILITIES
// =============================================================================

/**
 * Parsed HSL color components
 */
export interface HSLComponents {
    h: number; // 0-360
    s: number; // 0-100
    l: number; // 0-100
}

/**
 * Parse HSL string "H S% L%" to components
 * @param hsl - HSL string like "142 76% 36%"
 * @returns Parsed components or null if invalid
 */
export function parseHSL(hsl: HSLColor): HSLComponents | null {
    if (!hsl || typeof hsl !== 'string') return null;

    // Handle both "H S% L%" and "H S L" formats
    const cleaned = hsl.replace(/%/g, '').trim();
    const parts = cleaned.split(/\s+/);

    if (parts.length < 3) return null;

    const h = parseFloat(parts[0]);
    const s = parseFloat(parts[1]);
    const l = parseFloat(parts[2]);

    if (isNaN(h) || isNaN(s) || isNaN(l)) return null;

    return {
        h: ((h % 360) + 360) % 360, // Normalize hue to 0-360
        s: Math.max(0, Math.min(100, s)),
        l: Math.max(0, Math.min(100, l)),
    };
}

/**
 * Convert HSL components back to string
 * @param components - HSL components
 * @returns HSL string "H S% L%"
 */
export function toHSLString(components: HSLComponents): HSLColor {
    return `${Math.round(components.h)} ${Math.round(components.s)}% ${Math.round(components.l)}%`;
}

/**
 * Convert HSL to CSS hsl() function string
 * @param hsl - HSL string "H S% L%"
 * @returns CSS hsl() string
 */
export function toHSLFunction(hsl: HSLColor): string {
    const parsed = parseHSL(hsl);
    if (!parsed) return 'hsl(0, 0%, 0%)';
    return `hsl(${parsed.h}, ${parsed.s}%, ${parsed.l}%)`;
}

/**
 * Adjust lightness of an HSL color
 * @param hsl - Original HSL string
 * @param amount - Amount to adjust (-100 to +100)
 * @returns New HSL string
 */
export function adjustLightness(hsl: HSLColor, amount: number): HSLColor {
    const parsed = parseHSL(hsl);
    if (!parsed) return hsl;

    return toHSLString({
        ...parsed,
        l: Math.max(0, Math.min(100, parsed.l + amount)),
    });
}

/**
 * Adjust saturation of an HSL color
 * @param hsl - Original HSL string
 * @param amount - Amount to adjust (-100 to +100)
 * @returns New HSL string
 */
export function adjustSaturation(hsl: HSLColor, amount: number): HSLColor {
    const parsed = parseHSL(hsl);
    if (!parsed) return hsl;

    return toHSLString({
        ...parsed,
        s: Math.max(0, Math.min(100, parsed.s + amount)),
    });
}

/**
 * Shift hue of an HSL color
 * @param hsl - Original HSL string
 * @param degrees - Degrees to shift (-360 to +360)
 * @returns New HSL string
 */
export function shiftHue(hsl: HSLColor, degrees: number): HSLColor {
    const parsed = parseHSL(hsl);
    if (!parsed) return hsl;

    return toHSLString({
        ...parsed,
        h: (parsed.h + degrees + 360) % 360,
    });
}

/**
 * Create a complementary color (180° hue shift)
 */
export function complementary(hsl: HSLColor): HSLColor {
    return shiftHue(hsl, 180);
}

/**
 * Create an analogous color (+30° hue shift)
 */
export function analogous(hsl: HSLColor): HSLColor {
    return shiftHue(hsl, 30);
}

/**
 * Create a triadic color (+120° hue shift)
 */
export function triadic(hsl: HSLColor): HSLColor {
    return shiftHue(hsl, 120);
}

// =============================================================================
// CONTRAST & ACCESSIBILITY
// =============================================================================

/**
 * Convert HSL to RGB (for luminance calculation)
 */
export function hslToRGB(hsl: HSLColor): { r: number; g: number; b: number } | null {
    const parsed = parseHSL(hsl);
    if (!parsed) return null;

    const { h, s, l } = parsed;
    const sNorm = s / 100;
    const lNorm = l / 100;

    const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = lNorm - c / 2;

    let r = 0, g = 0, b = 0;

    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    return {
        r: Math.round((r + m) * 255),
        g: Math.round((g + m) * 255),
        b: Math.round((b + m) * 255),
    };
}

/**
 * Calculate relative luminance (WCAG formula)
 * @param hsl - HSL color string
 * @returns Luminance value 0-1
 */
export function getRelativeLuminance(hsl: HSLColor): number {
    const rgb = hslToRGB(hsl);
    if (!rgb) return 0;

    const rsRGB = rgb.r / 255;
    const gsRGB = rgb.g / 255;
    const bsRGB = rgb.b / 255;

    const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors (WCAG)
 * @param color1 - First HSL color
 * @param color2 - Second HSL color
 * @returns Contrast ratio (1 to 21)
 */
export function getContrastRatio(color1: HSLColor, color2: HSLColor): number {
    const lum1 = getRelativeLuminance(color1);
    const lum2 = getRelativeLuminance(color2);

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast meets WCAG AA requirements
 * @param foreground - Foreground HSL color
 * @param background - Background HSL color
 * @param isLargeText - Whether text is large (18pt+ or 14pt+ bold)
 * @returns Whether contrast is sufficient
 */
export function meetsWCAGAA(
    foreground: HSLColor,
    background: HSLColor,
    isLargeText = false
): boolean {
    const ratio = getContrastRatio(foreground, background);
    return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Check if contrast meets WCAG AAA requirements
 */
export function meetsWCAGAAA(
    foreground: HSLColor,
    background: HSLColor,
    isLargeText = false
): boolean {
    const ratio = getContrastRatio(foreground, background);
    return isLargeText ? ratio >= 4.5 : ratio >= 7;
}

/**
 * Suggest a foreground color that meets contrast requirements
 * @param background - Background HSL color
 * @param preferLight - Prefer light foreground (default: auto-detect)
 * @returns Suggested foreground HSL color
 */
export function suggestForeground(
    background: HSLColor,
    preferLight?: boolean
): HSLColor {
    const bgLum = getRelativeLuminance(background);
    const shouldBeLight = preferLight ?? bgLum < 0.5;

    // Start with white or black
    let fg = shouldBeLight ? '0 0% 100%' : '0 0% 0%';

    // Check if it meets contrast
    if (meetsWCAGAA(fg, background)) {
        return fg;
    }

    // Adjust until it meets contrast
    const parsed = parseHSL(background);
    if (!parsed) return fg;

    // Use the background hue but adjust lightness dramatically
    const targetL = shouldBeLight ? 95 : 5;
    return toHSLString({ h: parsed.h, s: Math.min(parsed.s, 20), l: targetL });
}

// =============================================================================
// CSS VARIABLE GENERATION
// =============================================================================

/**
 * Convert camelCase to kebab-case
 */
function toKebabCase(str: string): string {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Generate CSS variable declarations from color palette
 * @param palette - Theme color palette
 * @returns CSS variable string
 */
export function generateColorVariables(palette: ThemeColorPalette): string {
    const lines: string[] = [];

    const colorMap: Record<string, keyof ThemeColorPalette> = {
        '--background': 'background',
        '--foreground': 'foreground',
        '--card': 'card',
        '--card-foreground': 'cardForeground',
        '--popover': 'popover',
        '--popover-foreground': 'popoverForeground',
        '--primary': 'primary',
        '--primary-foreground': 'primaryForeground',
        '--secondary': 'secondary',
        '--secondary-foreground': 'secondaryForeground',
        '--muted': 'muted',
        '--muted-foreground': 'mutedForeground',
        '--accent': 'accent',
        '--accent-foreground': 'accentForeground',
        '--destructive': 'destructive',
        '--destructive-foreground': 'destructiveForeground',
        '--border': 'border',
        '--input': 'input',
        '--ring': 'ring',
        '--success': 'success',
        '--warning': 'warning',
        '--info': 'info',
    };

    for (const [cssVar, key] of Object.entries(colorMap)) {
        if (palette[key]) {
            lines.push(`${cssVar}: ${palette[key]};`);
        }
    }

    return lines.join('\n');
}

/**
 * Generate microinteraction CSS variables
 */
export function generateMicrointeractionVariables(
    micro: ThemeMicrointeractions
): string {
    const lines: string[] = [
        `--theme-duration-instant: ${micro.durations.instant}ms;`,
        `--theme-duration-fast: ${micro.durations.fast}ms;`,
        `--theme-duration-normal: ${micro.durations.normal}ms;`,
        `--theme-duration-slow: ${micro.durations.slow}ms;`,
        `--theme-duration-atmospheric: ${micro.durations.atmospheric}ms;`,
        `--theme-timing: ${micro.timingFunction};`,
        `--theme-button-hover-scale: ${micro.buttonHoverScale};`,
        `--theme-button-hover-lift: ${micro.buttonHoverLift}px;`,
        `--theme-button-press-scale: ${micro.buttonPressScale};`,
        `--theme-card-hover-scale: ${micro.cardHoverScale};`,
        `--theme-card-hover-lift: ${micro.cardHoverLift}px;`,
        `--theme-card-hover-shadow-blur: ${micro.cardHoverShadowBlur}px;`,
        `--theme-focus-ring-width: ${micro.focusRingWidth}px;`,
        `--theme-focus-ring-offset: ${micro.focusRingOffset}px;`,
        `--theme-shimmer-duration: ${micro.shimmerDuration}ms;`,
    ];

    return lines.join('\n');
}

/**
 * Apply theme CSS variables to document root
 * @param theme - Complete theme object
 */
export function applyThemeToDom(theme: Theme): void {
    const root = document.documentElement;
    const style = root.style;

    // Apply color palette
    const colorVars = generateColorVariables(theme.colors);
    colorVars.split('\n').forEach(line => {
        const [name, value] = line.split(':').map(s => s.trim().replace(';', ''));
        if (name && value) {
            style.setProperty(name, value);
        }
    });

    // Apply extended colors
    if (theme.extendedColors.backgroundGradient) {
        style.setProperty('--theme-gradient', theme.extendedColors.backgroundGradient);
    }
    if (theme.extendedColors.seasonalAccent) {
        style.setProperty('--theme-seasonal-accent', theme.extendedColors.seasonalAccent);
    }
    if (theme.extendedColors.promoBadge) {
        style.setProperty('--theme-promo-badge', theme.extendedColors.promoBadge);
    }

    // Apply microinteractions
    const microVars = generateMicrointeractionVariables(theme.microinteractions);
    microVars.split('\n').forEach(line => {
        const [name, value] = line.split(':').map(s => s.trim().replace(';', ''));
        if (name && value) {
            style.setProperty(name, value);
        }
    });

    // Apply typography
    if (theme.typography.fontFamily) {
        style.setProperty('--theme-font-family', theme.typography.fontFamily);
    }

    // Add theme class for CSS-based targeting
    root.dataset.theme = theme.metadata.id;
    root.dataset.themeType = theme.metadata.type;
}

/**
 * Remove all theme CSS variables from document root
 */
export function removeThemeFromDom(): void {
    const root = document.documentElement;
    const style = root.style;

    // Remove all --theme-* variables
    const propsToRemove: string[] = [];
    for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        if (prop.startsWith('--theme-') || prop.startsWith('--')) {
            propsToRemove.push(prop);
        }
    }

    // Note: We don't remove the base shadcn variables, only theme overrides
    // For a clean reset, we just remove our custom ones
    propsToRemove
        .filter(p => p.startsWith('--theme-'))
        .forEach(prop => style.removeProperty(prop));

    // Remove data attributes
    delete root.dataset.theme;
    delete root.dataset.themeType;
}

// =============================================================================
// PERFORMANCE & DEVICE DETECTION
// =============================================================================

/**
 * Performance tier based on device capabilities
 */
export type PerformanceTier = 'high' | 'medium' | 'low';

/**
 * Detect device performance tier
 * Uses heuristics: memory, hardware concurrency, connection
 */
export function detectPerformanceTier(): PerformanceTier {
    // TypeScript doesn't know about navigator.deviceMemory
    const nav = navigator as any;

    // Check memory (Chrome/Edge)
    const memory = nav.deviceMemory;
    if (memory !== undefined) {
        if (memory >= 8) return 'high';
        if (memory >= 4) return 'medium';
        return 'low';
    }

    // Check hardware concurrency (CPU cores)
    const cores = navigator.hardwareConcurrency;
    if (cores !== undefined) {
        if (cores >= 8) return 'high';
        if (cores >= 4) return 'medium';
        return 'low';
    }

    // Check connection type
    const connection = nav.connection;
    if (connection) {
        const effectiveType = connection.effectiveType;
        if (effectiveType === '4g') return 'high';
        if (effectiveType === '3g') return 'medium';
        return 'low';
    }

    // Default to medium
    return 'medium';
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if page is currently visible
 */
export function isPageVisible(): boolean {
    if (typeof document === 'undefined') return true;
    return document.visibilityState === 'visible';
}

/**
 * Subscribe to visibility changes
 */
export function onVisibilityChange(callback: (visible: boolean) => void): () => void {
    if (typeof document === 'undefined') return () => { };

    const handler = () => callback(isPageVisible());
    document.addEventListener('visibilitychange', handler);

    return () => document.removeEventListener('visibilitychange', handler);
}

// =============================================================================
// THEME VALIDATION
// =============================================================================

/**
 * Validate that a theme's colors meet accessibility requirements
 * @param theme - Theme to validate
 * @returns List of accessibility issues
 */
export function validateThemeAccessibility(theme: Theme): string[] {
    const issues: string[] = [];
    const { colors, accessibility } = theme;

    // Check primary text on background
    const primaryContrast = getContrastRatio(colors.foreground, colors.background);
    if (primaryContrast < accessibility.minContrastNormal) {
        issues.push(
            `Foreground/background contrast is ${primaryContrast.toFixed(2)}, ` +
            `needs ${accessibility.minContrastNormal}:1`
        );
    }

    // Check primary button text
    const primaryBtnContrast = getContrastRatio(colors.primaryForeground, colors.primary);
    if (primaryBtnContrast < accessibility.minContrastNormal) {
        issues.push(
            `Primary button contrast is ${primaryBtnContrast.toFixed(2)}, ` +
            `needs ${accessibility.minContrastNormal}:1`
        );
    }

    // Check card text
    const cardContrast = getContrastRatio(colors.cardForeground, colors.card);
    if (cardContrast < accessibility.minContrastNormal) {
        issues.push(
            `Card text contrast is ${cardContrast.toFixed(2)}, ` +
            `needs ${accessibility.minContrastNormal}:1`
        );
    }

    // Check muted text (can use large text ratio)
    const mutedContrast = getContrastRatio(colors.mutedForeground, colors.background);
    if (mutedContrast < accessibility.minContrastLarge) {
        issues.push(
            `Muted text contrast is ${mutedContrast.toFixed(2)}, ` +
            `needs ${accessibility.minContrastLarge}:1`
        );
    }

    return issues;
}

// =============================================================================
// THEME SCHEDULING
// =============================================================================

/**
 * Check if a theme is currently within its scheduled time window
 * @param theme - Theme with schedule
 * @returns Whether the theme is currently active based on schedule
 */
export function isThemeScheduledNow(theme: Theme): boolean {
    const { schedule } = theme;
    const now = new Date();

    // If no schedule, always active
    if (!schedule.startsAt && !schedule.endsAt) {
        return true;
    }

    // Check start time
    if (schedule.startsAt) {
        const start = new Date(schedule.startsAt);
        if (now < start) return false;
    }

    // Check end time
    if (schedule.endsAt) {
        const end = new Date(schedule.endsAt);
        if (now > end) return false;
    }

    return true;
}
