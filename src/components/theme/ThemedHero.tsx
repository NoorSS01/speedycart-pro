/**
 * Enterprise Theme System - Themed Hero Section
 * 
 * A dynamic hero component that adapts to the active theme.
 * Used on the Shop page and other landing areas to create
 * seasonal atmosphere.
 * 
 * Features:
 * - Theme-aware background styling
 * - Dynamic headline and subheadline colors
 * - Seasonal CTA button variants
 * - Optional decorative corner elements
 * - Responsive design
 */

import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ThemedHeroProps {
    title: string;
    subtitle?: string;
    ctaText?: string;
    ctaAction?: () => void;
    className?: string;
    children?: React.ReactNode;
}

export function ThemedHero({
    title,
    subtitle,
    ctaText,
    ctaAction,
    className,
    children,
}: ThemedHeroProps) {
    const { theme } = useTheme();
    const heroConfig = theme?.contentEmphasis?.hero;

    // If no theme or hero disabled, render minimal version
    if (!theme || !heroConfig?.enabled) {
        return (
            <section className={cn(
                "relative py-12 px-4 bg-gradient-to-br from-primary/10 to-primary/5",
                className
            )}>
                <div className="container mx-auto text-center">
                    <h1 className="text-3xl md:text-4xl font-bold mb-3">{title}</h1>
                    {subtitle && (
                        <p className="text-lg text-muted-foreground mb-6">{subtitle}</p>
                    )}
                    {ctaText && ctaAction && (
                        <Button size="lg" onClick={ctaAction}>
                            {ctaText}
                        </Button>
                    )}
                    {children}
                </div>
            </section>
        );
    }

    // Theme-aware hero
    return (
        <section
            className={cn(
                "relative py-16 px-4 overflow-hidden",
                className
            )}
            style={{
                background: heroConfig.overlayGradient || undefined,
            }}
        >
            {/* Decorative corners */}
            {heroConfig.decorativeElements?.cornerTopLeft && (
                <img
                    src={heroConfig.decorativeElements.cornerTopLeft}
                    alt=""
                    className="absolute top-0 left-0 w-24 h-24 opacity-50 pointer-events-none"
                    aria-hidden="true"
                />
            )}
            {heroConfig.decorativeElements?.cornerTopRight && (
                <img
                    src={heroConfig.decorativeElements.cornerTopRight}
                    alt=""
                    className="absolute top-0 right-0 w-24 h-24 opacity-50 pointer-events-none"
                    aria-hidden="true"
                />
            )}

            <div className="container mx-auto text-center relative z-10">
                <h1
                    className="text-3xl md:text-5xl font-bold mb-4"
                    style={{
                        color: heroConfig.headlineColor
                            ? `hsl(${heroConfig.headlineColor})`
                            : undefined,
                    }}
                >
                    {title}
                </h1>

                {subtitle && (
                    <p
                        className="text-lg md:text-xl mb-8 max-w-2xl mx-auto"
                        style={{
                            color: heroConfig.subheadlineColor
                                ? `hsl(${heroConfig.subheadlineColor})`
                                : undefined,
                        }}
                    >
                        {subtitle}
                    </p>
                )}

                {ctaText && ctaAction && (
                    <Button
                        size="lg"
                        onClick={ctaAction}
                        variant={heroConfig.ctaVariant === 'accent' ? 'secondary' : 'default'}
                        className={cn(
                            "text-lg px-8 py-6",
                            heroConfig.ctaVariant === 'contrast' && "bg-white text-foreground hover:bg-white/90"
                        )}
                    >
                        {ctaText}
                    </Button>
                )}

                {children}
            </div>

            {/* Bottom decorative elements */}
            {heroConfig.decorativeElements?.cornerBottomLeft && (
                <img
                    src={heroConfig.decorativeElements.cornerBottomLeft}
                    alt=""
                    className="absolute bottom-0 left-0 w-24 h-24 opacity-50 pointer-events-none"
                    aria-hidden="true"
                />
            )}
            {heroConfig.decorativeElements?.cornerBottomRight && (
                <img
                    src={heroConfig.decorativeElements.cornerBottomRight}
                    alt=""
                    className="absolute bottom-0 right-0 w-24 h-24 opacity-50 pointer-events-none"
                    aria-hidden="true"
                />
            )}
        </section>
    );
}

/**
 * Themed promotional banner component
 */
interface ThemedBannerProps {
    className?: string;
    onDismiss?: () => void;
}

export function ThemedBanner({ className, onDismiss }: ThemedBannerProps) {
    const { theme } = useTheme();
    const promoConfig = theme?.contentEmphasis?.promo;

    if (!theme || !promoConfig?.bannerEnabled || !promoConfig.bannerText) {
        return null;
    }

    return (
        <div
            className={cn(
                "relative py-2 px-4 text-center text-sm font-medium",
                className
            )}
            style={{
                backgroundColor: promoConfig.bannerBackgroundColor
                    ? `hsl(${promoConfig.bannerBackgroundColor})`
                    : 'hsl(var(--primary))',
                color: promoConfig.bannerTextColor
                    ? `hsl(${promoConfig.bannerTextColor})`
                    : 'hsl(var(--primary-foreground))',
            }}
        >
            <span>{promoConfig.bannerText}</span>

            {promoConfig.bannerDismissible && onDismiss && (
                <button
                    onClick={onDismiss}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition-opacity"
                    aria-label="Dismiss banner"
                >
                    ✕
                </button>
            )}
        </div>
    );
}

/**
 * Theme-styled product badge
 */
interface ThemedBadgeProps {
    className?: string;
}

export function ThemedBadge({ className }: ThemedBadgeProps) {
    const { theme } = useTheme();
    const promoConfig = theme?.contentEmphasis?.promo;

    if (!theme || !promoConfig?.badgeEnabled || !promoConfig.badgeText) {
        return null;
    }

    return (
        <span
            className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                className
            )}
            style={{
                backgroundColor: promoConfig.badgeColor
                    ? `hsl(${promoConfig.badgeColor})`
                    : 'hsl(var(--primary))',
                color: 'white',
            }}
        >
            {promoConfig.badgeText}
        </span>
    );
}

export default ThemedHero;
