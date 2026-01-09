import { cn } from "@/lib/utils";

/**
 * Professional Skeleton Component with Theme Integration
 * 
 * Inspired by YouTube, Netflix loading patterns:
 * - Subtle, slow shimmer animation
 * - Soft gradient for premium feel
 * - Reduced visual noise
 * - Theme-controlled animation duration
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Base styles
        "bg-muted/80 rounded-md",
        // Animation with theme-controlled duration
        "animate-skeleton-pulse",
        // Inline style for theme variable (fallback in className)
        "motion-reduce:animate-none",
        className
      )}
      style={{
        // Theme-controlled shimmer duration
        animationDuration: 'var(--theme-shimmer-duration, 2000ms)',
      }}
      {...props}
    />
  );
}

export { Skeleton };

