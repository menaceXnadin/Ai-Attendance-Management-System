import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { useEffect } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // Debug: Log the current theme when the component mounts and when theme changes
  useEffect(() => {
    console.log("ThemeToggle mounted, current theme:", theme);
    console.log("HTML classes:", document.documentElement.classList.toString());
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    console.log(`Toggle clicked: changing from ${theme} to ${newTheme}`);
    setTheme(newTheme);
    
    // Force immediate class update for debugging
    setTimeout(() => {
      console.log("After toggle, HTML classes:", document.documentElement.classList.toString());
    }, 100);
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={toggleTheme}
      className="relative overflow-hidden transition-all border border-blue-400/30 bg-slate-900/20 text-blue-100 hover:bg-slate-800/30 hover:text-teal-300 focus:bg-slate-800/30 focus:text-teal-300"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
