import * as React from "react";
import { ChevronLeft20Regular, ChevronRight20Regular } from "@fluentui/react-icons";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/** Fluent 2 date picker calendar. */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 text-text-primary", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-3",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-body-strong text-text-primary",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "subtle", size: "icon-sm" }),
          "h-7 w-7 p-0"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "w-9 rounded-md text-caption-strong text-text-muted",
        row: "flex w-full mt-1",
        cell: "h-9 w-9 text-center text-body p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-brand-subtle/50 [&:has([aria-selected])]:bg-brand-subtle first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-brand text-brand-on font-semibold hover:bg-brand-hover hover:text-brand-on focus:bg-brand focus:text-brand-on",
        day_today:
          "font-semibold text-brand-foreground underline decoration-2 underline-offset-4 aria-selected:text-brand-on aria-selected:no-underline",
        day_outside:
          "day-outside text-text-muted aria-selected:bg-brand-subtle/50 aria-selected:text-text-muted",
        day_disabled: "text-text-disabled",
        day_range_middle:
          "aria-selected:bg-brand-subtle aria-selected:text-text-primary aria-selected:font-normal",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft20Regular className="size-4" aria-hidden />,
        IconRight: ({ ..._props }) => <ChevronRight20Regular className="size-4" aria-hidden />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
