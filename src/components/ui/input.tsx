import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Input component with enterprise theme integration
 * Uses CSS variables for theme-controlled focus transitions
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base styles
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm",
          // Ring offset for focus
          "ring-offset-background",
          // Themed transition for focus states
          "transition-all duration-[var(--theme-duration-fast)]",
          // File input styles
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          // Placeholder
          "placeholder:text-muted-foreground",
          // Focus states with themed ring
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          // Focus border glow (subtle)
          "focus-visible:border-primary/50",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Reduced motion
          "motion-reduce:transition-colors",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

