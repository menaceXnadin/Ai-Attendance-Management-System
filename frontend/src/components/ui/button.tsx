import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Fluent 2 (Microsoft Teams) button.
 *
 * Variants
 *  - default      brand filled (Fluent "primary")
 *  - outline      neutral bordered (Fluent default / "secondary" button)
 *  - secondary    neutral filled on a subtle surface
 *  - ghost        transparent, neutral hover, primary text
 *  - subtle       transparent, neutral hover, secondary text (Fluent "subtle")
 *  - destructive  filled danger
 *  - link         brand text link
 *
 * Icons inside are 16px (20px for `lg` / `icon`) unless the icon carries its
 * own `size-*` class.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent",
    "text-body font-semibold select-none",
    "transition-colors duration-150 ease-fluent-standard",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-text-primary",
    "disabled:pointer-events-none disabled:cursor-not-allowed",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-brand text-brand-on hover:bg-brand-hover active:bg-brand-pressed disabled:bg-surface-subtle disabled:text-text-disabled disabled:border-border-subtle",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80 disabled:bg-surface-subtle disabled:text-text-disabled disabled:border-border-subtle",
        outline:
          "bg-surface-default border-border-default text-text-primary hover:bg-surface-hover active:bg-surface-pressed disabled:bg-surface-subtle disabled:text-text-disabled disabled:border-border-subtle",
        secondary:
          "bg-surface-subtle border-border-subtle text-text-primary hover:bg-surface-hover active:bg-surface-pressed disabled:bg-surface-subtle disabled:text-text-disabled",
        ghost:
          "bg-transparent text-text-primary hover:bg-surface-hover active:bg-surface-pressed disabled:bg-transparent disabled:text-text-disabled",
        subtle:
          "bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary active:bg-surface-pressed disabled:bg-transparent disabled:text-text-disabled",
        link:
          "border-0 bg-transparent font-normal text-brand-foreground underline-offset-4 hover:text-brand-foreground-hover hover:underline disabled:text-text-disabled",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 px-2 text-caption-strong",
        lg: "h-10 px-4 [&_svg:not([class*='size-'])]:size-5",
        icon: "h-8 w-8 p-0 [&_svg:not([class*='size-'])]:size-5",
        "icon-sm": "h-7 w-7 p-0",
      },
    },
    compoundVariants: [
      { variant: "link", size: "default", className: "h-auto px-0" },
      { variant: "link", size: "sm", className: "h-auto px-0" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
