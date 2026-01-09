import { cva } from "class-variance-authority";

/**
 * Button variants with enterprise theme system integration
 * 
 * Microinteraction features:
 * - Smooth transform transitions (scale + translate)
 * - Theme-aware shadow on hover
 * - Reduced motion support via CSS
 * - Focus-visible ring for accessibility
 */
export const buttonVariants = cva(
    // Base classes with full transition support
    [
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium",
        // Transitions - using CSS variables for theme control
        "transition-all duration-[var(--theme-duration-fast)]",
        // Transform origin
        "origin-center",
        // Focus states
        "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Disabled states
        "disabled:pointer-events-none disabled:opacity-50",
        // Icon sizing
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        // Hover microinteractions (scale + lift)
        "hover:-translate-y-[var(--theme-button-hover-lift)] hover:scale-[var(--theme-button-hover-scale)]",
        // Active press state
        "active:scale-[var(--theme-button-press-scale)]",
        // Reduced motion support
        "motion-reduce:transform-none motion-reduce:transition-colors",
    ].join(" "),
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[var(--theme-shadow-hover)]",
                destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-lg",
                outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:shadow-md",
                secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-md",
                ghost: "hover:bg-accent hover:text-accent-foreground",
                link: "text-primary underline-offset-4 hover:underline hover:scale-100 hover:translate-y-0",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 rounded-md px-3",
                lg: "h-11 rounded-md px-8",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);
