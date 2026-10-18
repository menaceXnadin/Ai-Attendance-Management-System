import React from 'react';
import { ArrowClockwise16Regular, ErrorCircle24Regular } from '@fluentui/react-icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Fluent 2 error state: neutral surface with an error-tinted icon chip,
 * subheading title, muted message and an outline retry button.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Failed to load data",
  message = "An error occurred while fetching information. Please try again.",
  onRetry,
  className
}) => {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-border-subtle bg-surface-default px-6 py-10 text-center",
        className
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-status-error-subtle text-status-error">
        <ErrorCircle24Regular aria-hidden="true" />
      </div>
      <h3 className="text-subheading text-text-primary">{title}</h3>
      <p className="mt-1 max-w-sm text-body text-text-muted">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-5">
          <ArrowClockwise16Regular aria-hidden="true" />
          Try Again
        </Button>
      )}
    </div>
  );
};
