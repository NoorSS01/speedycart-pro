import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Card component with enterprise theme system integration
 * 
 * Microinteraction features:
 * - Hover lift and subtle scale
 * - Theme-aware shadow enhancement on hover
 * - Smooth transitions via CSS variables
 * - Reduced motion support
 */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // Base card styles
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      // Transition for smooth hover effects
      "transition-all duration-[var(--theme-duration-normal)] ease-out",
      // Origin for transform
      "origin-center",
      // Hover microinteractions (optional - apply via data attribute or variant)
      // Removed auto-hover to avoid overwhelming UI with too many hovering cards
      // Use data-interactive="true" for interactive cards
      "data-[interactive=true]:hover:-translate-y-[var(--theme-card-hover-lift)]",
      "data-[interactive=true]:hover:scale-[var(--theme-card-hover-scale)]",
      "data-[interactive=true]:hover:shadow-[var(--theme-shadow-hover)]",
      // Focus visible for keyboard navigation
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      // Reduced motion support
      "motion-reduce:transform-none motion-reduce:transition-colors",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
