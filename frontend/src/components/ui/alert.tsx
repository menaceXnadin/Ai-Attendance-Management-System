import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Fluent 2 MessageBar. Tinted status background + matching stroke; the icon
 * (first child svg) takes the status color while text stays primary.
 */
const alertVariants = cva(
  "relative w-full rounded-md border px-3 py-2.5 text-body text-text-primary [&>svg~*]:pl-7 [&>svg]:absolute [&>svg]:left-3 [&>svg]:top-3 [&>svg]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-border-subtle bg-surface-subtle [&>svg]:text-text-secondary",
        destructive:
          "border-status-error-border bg-status-error-subtle [&>svg]:text-status-error",
        success:
          "border-status-success-border bg-status-success-subtle [&>svg]:text-status-success",
        warning:
          "border-status-warning-border bg-status-warning-subtle [&>svg]:text-status-warning",
        info: "border-status-info-border bg-status-info-subtle [&>svg]:text-status-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-0.5 text-body-strong text-text-primary", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-body text-text-primary [&_p]:leading-5", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
