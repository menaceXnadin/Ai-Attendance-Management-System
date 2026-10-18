import * as React from "react"
import { Eye20Regular, EyeOff20Regular } from "@fluentui/react-icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { fluentFieldClasses } from "@/components/ui/input"

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
            "flex h-8 px-2.5 py-1 pr-9",
            fluentFieldClasses,
            className
          )}
          ref={ref}
          {...props}
        />
        <Button
          type="button"
          variant="subtle"
          size="icon-sm"
          className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2 text-text-muted hover:bg-transparent hover:text-text-primary"
          onClick={togglePasswordVisibility}
          aria-label={showPassword ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff20Regular aria-hidden="true" />
          ) : (
            <Eye20Regular aria-hidden="true" />
          )}
        </Button>
      </div>
    )
  }
)

PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
