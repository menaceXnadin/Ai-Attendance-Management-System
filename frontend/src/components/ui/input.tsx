import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Fluent 2 input: neutral stroke with a darker accessible bottom stroke and a
 * brand bottom accent on focus (no glow ring).
 */
export const fluentFieldClasses =
  "w-full rounded-md border border-border-default border-b-border-strong bg-surface-default text-body text-text-primary shadow-none transition-[border-color,box-shadow] duration-150 ease-fluent-standard placeholder:text-text-muted hover:border-border-strong/50 hover:border-b-border-strong focus-visible:outline-none focus-visible:border-b-brand focus-visible:shadow-[inset_0_-1px_0_0_var(--brand)] disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-surface-subtle disabled:text-text-disabled disabled:placeholder:text-text-disabled aria-[invalid=true]:border-b-status-error"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-8 px-2.5 py-1",
          fluentFieldClasses,
          "file:mr-2 file:border-0 file:bg-transparent file:text-body-strong file:text-text-primary",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
