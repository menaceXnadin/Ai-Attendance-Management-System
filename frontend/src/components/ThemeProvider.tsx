import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "dark",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export { ThemeProviderContext };

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  // Debug log
  console.log("ThemeProvider initializing with defaultTheme:", defaultTheme);
  console.log("Current localStorage:", localStorage.getItem(storageKey));
  
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first
    const storedTheme = localStorage.getItem(storageKey);
    console.log("Initial stored theme:", storedTheme);
    
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }
    // Use default if no valid theme in localStorage
    return defaultTheme;
  });

  useEffect(() => {
    console.log("Theme effect running with theme:", theme);
    const root = window.document.documentElement;
    
    console.log("Before removing classes:", root.classList.toString());
    root.classList.remove("light", "dark");
    console.log("After removing classes:", root.classList.toString());
    
    root.classList.add(theme);
    console.log("After adding theme class:", root.classList.toString());
    
    // Force repaint
    document.body.style.display = 'none';
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    document.body.offsetHeight; // Trigger reflow
    document.body.style.display = '';
  }, [theme]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      console.log("setTheme called with:", newTheme);
      localStorage.setItem(storageKey, newTheme);
      console.log("localStorage updated:", localStorage.getItem(storageKey));
      setTheme(newTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}
