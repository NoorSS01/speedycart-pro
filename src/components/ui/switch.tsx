import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/**
 * Switch component with enterprise theme integration
 * Uses CSS variables for theme-controlled transition timing
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // Base styles
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
      // Themed transition (uses CSS variables)
      "transition-all duration-[var(--theme-duration-normal)]",
      // State colors
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      // Focus states
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      // Disabled
      "disabled:cursor-not-allowed disabled:opacity-50",
      // Reduced motion
      "motion-reduce:transition-colors",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        // Base styles
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0",
        // Themed transition for smooth slide
        "transition-transform duration-[var(--theme-duration-fast)]",
        // Position based on state
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
        // Reduced motion
        "motion-reduce:transition-none",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };

