import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Fluent 2 badge. Status variants use the tinted `-subtle` background with a
 * matching `-border` stroke and status foreground; `brand` is the tinted
 * Teams purple; `default` is filled brand.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap border px-1.5 py-0.5 text-caption-strong tabular-nums transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-text-primary [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand text-brand-on",
        brand: "border-transparent bg-brand-subtle text-brand-foreground",
        secondary: "border-border-subtle bg-surface-subtle text-text-secondary",
        destructive:
          "border-status-error-border bg-status-error-subtle text-status-error",
        success:
          "border-status-success-border bg-status-success-subtle text-status-success",
        warning:
          "border-status-warning-border bg-status-warning-subtle text-status-warning",
        info: "border-status-info-border bg-status-info-subtle text-status-info",
        outline: "border-border-default bg-transparent text-text-secondary",
      },
      shape: {
        rounded: "rounded",
        pill: "rounded-full px-2",
      },
    },
    defaultVariants: {
      variant: "default",
      shape: "rounded",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, shape, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, shape }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
