import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

/**
 * Fluent 2 TabList: transparent list of text tabs. The selected tab is
 * semibold with a 3px rounded brand indicator at the bottom; hovering an
 * unselected tab shows a neutral indicator.
 *
 * Works as a flex row (default) or when pages pass `grid w-full grid-cols-N`
 * — in grid mode each tab is centered in its column so the indicator stays
 * content-width.
 */
const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-auto items-center gap-1 bg-transparent p-0 text-text-secondary",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex h-10 items-center justify-center justify-self-center gap-1.5 whitespace-nowrap rounded-md bg-transparent px-3 text-body text-text-secondary",
      "transition-colors duration-150 ease-fluent-standard",
      "hover:bg-surface-hover hover:text-text-primary active:bg-surface-pressed",
      "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-text-primary",
      "disabled:pointer-events-none disabled:text-text-disabled",
      "data-[state=active]:font-semibold data-[state=active]:text-text-primary",
      // indicator
      "after:pointer-events-none after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:bg-transparent after:transition-colors after:duration-150 after:content-['']",
      "hover:after:bg-border-default data-[state=active]:after:bg-brand data-[state=active]:hover:after:bg-brand",
      "[&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5 data-[state=active]:[&_svg]:text-brand-foreground",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
