import React from 'react';
import { WarningAlt, Renew } from '@carbon/icons-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Failed to load data",
  message = "An error occurred while fetching information. Please try again.",
  onRetry,
  className
}) => {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center rounded-lg border border-status-error-border bg-status-error-subtle/30", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-status-error-subtle text-status-error mb-3">
        <WarningAlt size={24} aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-status-error mb-1">{title}</h3>
      <p className="text-xs text-text-muted max-w-sm mb-4">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2 border-border-strong text-text-primary">
          <Renew size={16} aria-hidden="true" />
          Try Again
        </Button>
      )}
    </div>
  );
};
