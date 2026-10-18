import * as React from 'react';
import { cn } from '@/lib/utils';

const spinnerSizes = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-10 w-10 border-[3px]',
} as const;

export interface FluentSpinnerProps {
  size?: keyof typeof spinnerSizes;
  className?: string;
}

/** Fluent 2 spinner: brand arc on a tinted track. */
export const FluentSpinner: React.FC<FluentSpinnerProps> = ({ size = 'md', className }) => (
  <span
    aria-hidden="true"
    className={cn(
      'inline-block shrink-0 animate-spin rounded-full border-brand-subtle border-t-brand-foreground',
      spinnerSizes[size],
      className
    )}
  />
);

export interface FullPageLoaderProps {
  /** Primary label under the spinner. */
  title: string;
  /** Optional secondary caption. */
  caption?: string;
  className?: string;
}

/** Centered full-viewport loading state on the app canvas (used by route guards). */
export const FullPageLoader: React.FC<FullPageLoaderProps> = ({ title, caption, className }) => (
  <div
    role="status"
    aria-live="polite"
    className={cn('flex min-h-dvh items-center justify-center bg-surface-canvas px-4', className)}
  >
    <div className="flex flex-col items-center gap-4 text-center">
      <FluentSpinner size="lg" />
      <div>
        <p className="text-body-strong text-text-primary">{title}</p>
        {caption && <p className="mt-1 text-caption text-text-muted">{caption}</p>}
      </div>
    </div>
  </div>
);

export default FullPageLoader;
