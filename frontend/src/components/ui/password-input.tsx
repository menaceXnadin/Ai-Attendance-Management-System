import * as React from "react"
import { View, ViewOff } from "@carbon/icons-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const PasswordInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)

    const togglePasswordVisibility = () => {
      setShowPassword((prev) => !prev)
    }

    return (
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          className={cn(
            "flex h-9 w-full rounded-md border border-border bg-surface-default px-3 py-1.5 pr-10 text-sm text-text-primary shadow-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          ref={ref}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-0.5 top-1/2 -translate-y-1/2 h-8 w-8 text-text-muted hover:text-text-primary hover:bg-transparent"
          onClick={togglePasswordVisibility}
          aria-label={showPassword ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {showPassword ? (
            <ViewOff size={16} aria-hidden="true" />
          ) : (
            <View size={16} aria-hidden="true" />
          )}
        </Button>
      </div>
    )
  }
)

PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
