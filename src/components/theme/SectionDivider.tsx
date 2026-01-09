/**
 * Enterprise Theme System - Section Dividers
 * 
 * Seasonal section dividers that can be used between content sections 
 * to add visual separation with theme-aware styling.
 * 
 * Features:
 * - Theme-aware colors
 * - Multiple variants (line, wave, gradient, decorated)
 * - Reduced motion support
 * - Optional text labels
 */

import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Snowflake, Sun, CloudRain, Flower } from 'lucide-react';

interface SectionDividerProps {
    variant?: 'line' | 'wave' | 'gradient' | 'decorated';
    className?: string;
    label?: string;
}

// Get seasonal icon based on theme name
const getSeasonalIcon = (themeName?: string) => {
    switch (themeName) {
        case 'Winter Wonderland':
            return Snowflake;
        case 'Summer Vibes':
            return Sun;
        case 'Monsoon Magic':
            return CloudRain;
        case 'Spring Bloom':
            return Flower;
        default:
            return null;
    }
};

export function SectionDivider({
    variant = 'line',
    className,
    label,
}: SectionDividerProps) {
    const { theme, reducedMotion } = useTheme();
    const themeName = theme?.metadata?.name;
    const SeasonalIcon = getSeasonalIcon(themeName);

    // Base styles
    const baseClass = "w-full my-8";

    if (variant === 'line') {
        return (
            <div className={cn(baseClass, "flex items-center gap-4", className)}>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                {label && (
                    <span className="text-sm text-muted-foreground">{label}</span>
                )}
                {SeasonalIcon && !label && (
                    <SeasonalIcon className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            </div>
        );
    }

    if (variant === 'wave') {
        return (
            <div className={cn(baseClass, "relative h-8 overflow-hidden", className)}>
                <svg
                    viewBox="0 0 1200 40"
                    className="absolute inset-0 w-full h-full"
                    preserveAspectRatio="none"
                >
                    <path
                        d="M0,20 Q150,0 300,20 T600,20 T900,20 T1200,20"
                        fill="none"
                        stroke="hsl(var(--border))"
                        strokeWidth="1"
                        className={cn(!reducedMotion && "animate-wave")}
                    />
                </svg>
                {SeasonalIcon && (
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2">
                        <SeasonalIcon className="h-4 w-4 text-primary" />
                    </div>
                )}
            </div>
        );
    }

    if (variant === 'gradient') {
        return (
            <div
                className={cn(
                    baseClass,
                    "h-1 rounded-full",
                    "bg-gradient-to-r from-transparent via-primary/30 to-transparent",
                    className
                )}
            />
        );
    }

    if (variant === 'decorated') {
        return (
            <div className={cn(baseClass, "flex items-center justify-center gap-3", className)}>
                {/* Left decoration */}
                <div className="flex items-center gap-1">
                    <div className="w-8 h-px bg-border" />
                    <div className="w-2 h-2 rounded-full bg-primary/30" />
                    <div className="w-4 h-px bg-border" />
                </div>

                {/* Center icon or label */}
                {SeasonalIcon ? (
                    <SeasonalIcon className="h-5 w-5 text-primary" />
                ) : label ? (
                    <span className="text-sm font-medium text-muted-foreground">{label}</span>
                ) : (
                    <div className="w-3 h-3 rotate-45 border border-primary/50" />
                )}

                {/* Right decoration */}
                <div className="flex items-center gap-1">
                    <div className="w-4 h-px bg-border" />
                    <div className="w-2 h-2 rounded-full bg-primary/30" />
                    <div className="w-8 h-px bg-border" />
                </div>
            </div>
        );
    }

    return null;
}

/**
 * Simple themed horizontal rule
 */
export function ThemedHr({ className }: { className?: string }) {
    return (
        <hr className={cn(
            "border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent my-6",
            className
        )} />
    );
}

export default SectionDivider;
