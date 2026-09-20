import * as React from 'react';
import { Sun, Moon } from '@carbon/icons-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

export interface ThemeToggleProps {
  className?: string;
  variant?: 'ghost' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className,
  variant = 'ghost',
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
      className={cn(
        "relative rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-action-primary",
        className
      )}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <Sun size={18} className="transition-transform duration-200" aria-hidden="true" />
      ) : (
        <Moon size={18} className="transition-transform duration-200" aria-hidden="true" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
};

export default ThemeToggle;
