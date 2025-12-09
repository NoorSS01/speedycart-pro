import { cn } from "@/lib/utils";

/**
 * Professional Skeleton Component
 * Inspired by YouTube, Netflix loading patterns
 * - Subtle, slow shimmer animation
 * - Soft gradient for premium feel
 * - Reduced visual noise
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-skeleton-pulse bg-muted/80 rounded-md",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
