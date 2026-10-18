import React from 'react';
import { DocumentBulletList24Regular, SearchInfo24Regular } from '@fluentui/react-icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description?: string;
  isFiltered?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  /** Optional custom icon (24px Fluent icon recommended). */
  icon?: React.ReactNode;
}

/** Fluent 2 empty state: neutral icon chip, subheading title, muted body. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  isFiltered = false,
  actionLabel,
  onAction,
  className,
  icon,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg bg-surface-default px-6 py-10 text-center',
        className
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-text-muted [&_svg]:size-6">
        {icon ??
          (isFiltered ? (
            <SearchInfo24Regular aria-hidden="true" />
          ) : (
            <DocumentBulletList24Regular aria-hidden="true" />
          ))}
      </div>
      <h3 className="text-subheading text-text-primary">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-body text-text-muted">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button
          variant={isFiltered ? 'outline' : 'default'}
          onClick={onAction}
          className="mt-5"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
