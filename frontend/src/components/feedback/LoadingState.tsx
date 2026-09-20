import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  rows = 5,
  columns = 4,
  className
}) => {
  return (
    <div className={cn("w-full space-y-3 p-4 rounded-lg border border-border bg-surface-default", className)}>
      <div className="flex gap-4 border-b border-border-subtle pb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`r-${r}`} className="flex gap-4 py-2">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={`c-${r}-${c}`} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
};
