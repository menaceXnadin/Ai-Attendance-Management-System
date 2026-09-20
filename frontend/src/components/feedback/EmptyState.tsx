import React from 'react';
import { DocumentBlank, SearchLocate } from '@carbon/icons-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description?: string;
  isFiltered?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  isFiltered = false,
  actionLabel,
  onAction,
  className
}) => {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-border bg-surface-default", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-text-muted mb-3">
        {isFiltered ? <SearchLocate size={24} aria-hidden="true" /> : <DocumentBlank size={24} aria-hidden="true" />}
      </div>
      <h3 className="text-sm font-semibold text-text-primary mb-1">{title}</h3>
      {description && <p className="text-xs text-text-muted max-w-sm mb-4">{description}</p>}
      {actionLabel && onAction && (
        <Button variant={isFiltered ? "outline" : "default"} size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
