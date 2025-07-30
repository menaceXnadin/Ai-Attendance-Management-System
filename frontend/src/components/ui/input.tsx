import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-[#2d3656] bg-[#232946] text-[#FFFFFF] px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[#b0b8d1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm shadow-sm",
          // Autofill styles to maintain theme consistency
          "[-webkit-autofill]:!bg-[#232946] [-webkit-autofill]:!text-[#FFFFFF] [-webkit-autofill]:shadow-[inset_0_0_0px_1000px_#232946]",
          "[-webkit-autofill:hover]:!bg-[#232946] [-webkit-autofill:hover]:!text-[#FFFFFF] [-webkit-autofill:hover]:shadow-[inset_0_0_0px_1000px_#232946]",
          "[-webkit-autofill:focus]:!bg-[#232946] [-webkit-autofill:focus]:!text-[#FFFFFF] [-webkit-autofill:focus]:shadow-[inset_0_0_0px_1000px_#232946]",
          "[-webkit-autofill:active]:!bg-[#232946] [-webkit-autofill:active]:!text-[#FFFFFF] [-webkit-autofill:active]:shadow-[inset_0_0_0px_1000px_#232946]",
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
