import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "group/switch peer inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full border px-[3px] transition-colors duration-150 ease-fluent-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary disabled:cursor-not-allowed data-[state=unchecked]:border-border-strong data-[state=unchecked]:bg-transparent data-[state=unchecked]:hover:border-text-primary data-[state=checked]:border-transparent data-[state=checked]:bg-brand data-[state=checked]:hover:bg-brand-hover disabled:data-[state=unchecked]:border-text-disabled disabled:data-[state=checked]:bg-text-disabled",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-3.5 w-3.5 rounded-full ring-0 transition-transform duration-150 ease-fluent-standard data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-text-secondary group-hover/switch:data-[state=unchecked]:bg-text-primary data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-brand-on group-disabled/switch:data-[state=unchecked]:bg-text-disabled"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
