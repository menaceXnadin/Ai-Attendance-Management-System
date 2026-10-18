import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Fluent 2 Spinner                                                    */
/* ------------------------------------------------------------------ */

type SpinnerSize = 'sm' | 'md' | 'lg';

const spinnerSizes: Record<SpinnerSize, string> = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-10 w-10 border-4',
};

export interface SpinnerProps {
  size?: SpinnerSize;
  /** Visible label rendered below (or beside, with `labelPosition="after"`). */
  label?: string;
  labelPosition?: 'below' | 'after';
  className?: string;
}

/** Brand ring spinner with optional label (Fluent `Spinner`). */
export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  label,
  labelPosition = 'below',
  className,
}) => (
  <div
    role="status"
    aria-live="polite"
    className={cn(
      'inline-flex items-center justify-center',
      labelPosition === 'below' ? 'flex-col gap-3' : 'flex-row gap-2',
      className
    )}
  >
    <span
      aria-hidden="true"
      className={cn(
        'inline-block shrink-0 animate-spin rounded-full border-brand-subtle-hover border-t-brand-foreground [animation-duration:1.2s]',
        spinnerSizes[size]
      )}
    />
    {label ? (
      <span className="text-body text-text-secondary">{label}</span>
    ) : (
      <span className="sr-only">Loading</span>
    )}
  </div>
);

/* ------------------------------------------------------------------ */
/* LoadingState                                                        */
/* ------------------------------------------------------------------ */

interface LoadingStateProps {
  rows?: number;
  columns?: number;
  className?: string;
  /**
   * `skeleton` (default) renders a table-shaped shimmer; `spinner` renders a
   * centered Fluent spinner with `label`.
   */
  variant?: 'skeleton' | 'spinner';
  label?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  rows = 5,
  columns = 4,
  className,
  variant = 'skeleton',
  label = 'Loading…',
}) => {
  if (variant === 'spinner') {
    return (
      <div
        className={cn(
          'flex w-full items-center justify-center rounded-lg bg-surface-default px-6 py-12',
          className
        )}
      >
        <Spinner size="md" label={label} />
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        'w-full overflow-hidden rounded-lg border border-border-subtle bg-surface-default',
        className
      )}
    >
      <div className="flex h-9 items-center gap-4 border-b border-border-subtle bg-surface-subtle px-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={`r-${r}`}
          className="flex items-center gap-4 border-b border-border-subtle px-3 py-3 last:border-b-0"
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={`c-${r}-${c}`} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
};
