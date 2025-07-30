import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";



const PasswordInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    const togglePasswordVisibility = () => {
      setShowPassword((prev) => !prev);
    };

    return (
      <div className="relative password-input-container">
        <input
          type={showPassword ? "text" : "password"}
          className={cn(
            "flex h-10 w-full rounded-md border border-[#2d3656] bg-[#232946] text-[#FFFFFF] px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#b0b8d1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-10 shadow-sm",
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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent z-10 transition-all duration-200 hover:scale-105"
          onClick={togglePasswordVisibility}
          aria-label={showPassword ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          <div className="relative w-4 h-4">
            <Eye 
              className={cn(
                "absolute inset-0 h-4 w-4 transition-all duration-300 ease-in-out transform",
                showPassword 
                  ? "opacity-0 scale-75 rotate-12" 
                  : "opacity-100 scale-100 rotate-0"
              )}
              style={{ 
                color: '#475569',
                filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.3))'
              }} 
            />
            <EyeOff 
              className={cn(
                "absolute inset-0 h-4 w-4 transition-all duration-300 ease-in-out transform",
                showPassword 
                  ? "opacity-100 scale-100 rotate-0" 
                  : "opacity-0 scale-75 -rotate-12"
              )}
              style={{ 
                color: '#475569',
                filter: 'drop-shadow(0 0 1px rgba(255,255,255,0.3))'
              }} 
            />
          </div>
        </Button>
        
        {/* Global CSS injection for autofill icon visibility and smooth animations */}
        <style dangerouslySetInnerHTML={{
          __html: `
            .password-input-container input:-webkit-autofill ~ button svg {
              color: #1e293b !important;
              filter: none !important;
            }
            .password-input-container input:-webkit-autofill:hover ~ button svg,
            .password-input-container input:-webkit-autofill:focus ~ button svg,
            .password-input-container input:-webkit-autofill:active ~ button svg {
              color: #0f172a !important;
              filter: none !important;
            }
            .password-input-container button:hover svg {
              color: #1e293b !important;
              transform: scale(1.1);
            }
            .password-input-container button:active {
              transform: scale(0.95);
            }
            .password-input-container button {
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .password-input-container button:hover {
              background: rgba(148, 163, 184, 0.1) !important;
            }
          `
        }} />
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
