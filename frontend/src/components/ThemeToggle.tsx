import * as React from 'react';
import { WeatherMoon20Regular, WeatherSunny20Regular } from '@fluentui/react-icons';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

export interface ThemeToggleProps {
  className?: string;
  variant?: 'ghost' | 'outline' | 'secondary' | 'subtle';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className,
  variant = 'subtle',
  size = 'icon-sm',
}) => {
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={toggleTheme}
      className={cn("relative", className)}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <WeatherSunny20Regular className="size-5" aria-hidden="true" />
      ) : (
        <WeatherMoon20Regular className="size-5" aria-hidden="true" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
};

export default ThemeToggle;
