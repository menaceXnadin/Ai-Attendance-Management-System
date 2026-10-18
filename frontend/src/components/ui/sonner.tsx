import { Toaster as Sonner, toast } from "sonner"
import {
  CheckmarkCircle20Filled,
  ErrorCircle20Filled,
  Info20Filled,
  Warning20Filled,
} from "@fluentui/react-icons"

import { useTheme } from "@/hooks/useTheme"

type ToasterProps = React.ComponentProps<typeof Sonner>

/** Fluent 2 toast: neutral raised surface, status conveyed by the icon. */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CheckmarkCircle20Filled className="text-status-success" aria-hidden />,
        error: <ErrorCircle20Filled className="text-status-error" aria-hidden />,
        warning: <Warning20Filled className="text-status-warning" aria-hidden />,
        info: <Info20Filled className="text-status-info" aria-hidden />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-lg group-[.toaster]:border group-[.toaster]:border-transparent group-[.toaster]:bg-surface-raised group-[.toaster]:text-text-primary group-[.toaster]:shadow-lg dark:group-[.toaster]:border-border-subtle group-[.toaster]:font-sans",
          title: "group-[.toast]:text-body-strong group-[.toast]:text-text-primary",
          description: "group-[.toast]:text-caption group-[.toast]:text-text-secondary",
          actionButton:
            "group-[.toast]:rounded-md group-[.toast]:bg-brand group-[.toast]:text-brand-on group-[.toast]:font-semibold",
          cancelButton:
            "group-[.toast]:rounded-md group-[.toast]:bg-surface-subtle group-[.toast]:text-text-secondary",
          closeButton:
            "group-[.toast]:border-border-subtle group-[.toast]:bg-surface-raised group-[.toast]:text-text-secondary",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
