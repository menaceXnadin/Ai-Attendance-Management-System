import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Checkmark12Filled } from "@fluentui/react-icons"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-transparent text-brand-on transition-colors duration-150 ease-fluent-standard hover:border-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary disabled:cursor-not-allowed disabled:border-text-disabled data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:hover:border-brand-hover data-[state=checked]:hover:bg-brand-hover data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand disabled:data-[state=checked]:border-text-disabled disabled:data-[state=checked]:bg-text-disabled",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Checkmark12Filled className="size-3" aria-hidden />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
