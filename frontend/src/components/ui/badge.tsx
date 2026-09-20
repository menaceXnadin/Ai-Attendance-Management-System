import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 tabular-nums",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-primary text-primary-foreground",
        secondary:
          "border border-border bg-surface-subtle text-text-secondary",
        destructive:
          "border border-status-error-border bg-status-error-subtle text-status-error",
        success:
          "border border-status-success-border bg-status-success-subtle text-status-success",
        warning:
          "border border-status-warning-border bg-status-warning-subtle text-status-warning",
        info:
          "border border-status-info-border bg-status-info-subtle text-status-info",
        outline: "border border-border text-text-primary bg-surface-default",
      },
      shape: {
        rounded: "rounded",
        pill: "rounded-full px-2.5",
      }
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
