import React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { ArrowUp, ArrowDown, ArrowsVertical } from '@carbon/icons-react';
import { cn } from '@/lib/utils';

export interface ColumnDef<T> {
  id: string;
  header: string | React.ReactNode;
  accessorKey?: keyof T;
  cell?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  isFiltered?: boolean;
  onClearFilters?: () => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnId: string) => void;
  onRowClick?: (row: T) => void;
  keyExtractor?: (row: T, index: number) => string | number;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  error = null,
  onRetry,
  emptyTitle = "No data available",
  emptyDescription = "There are no records to display.",
  isFiltered = false,
  onClearFilters,
  sortColumn,
  sortDirection,
  onSort,
  onRowClick,
  keyExtractor,
  className
}: DataTableProps<T>) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  return (
    <div className={cn("w-full overflow-hidden rounded-lg border border-border bg-surface-default", className)}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => {
                const isSorted = sortColumn === col.id;
                const ariaSort = !col.sortable
                  ? undefined
                  : isSorted
                  ? sortDirection === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none';

                return (
                  <TableHead
                    key={col.id}
                    aria-sort={ariaSort}
                    className={cn(
                      col.align === 'right' && "text-right",
                      col.align === 'center' && "text-center",
                      col.headerClassName
                    )}
                  >
                    {col.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.id)}
                        className="inline-flex items-center gap-1.5 hover:text-text-primary focus:outline-none focus:text-text-primary"
                      >
                        <span>{col.header}</span>
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp size={14} className="text-action-primary" aria-hidden="true" />
                          ) : (
                            <ArrowDown size={14} className="text-action-primary" aria-hidden="true" />
                          )
                        ) : (
                          <ArrowsVertical size={14} className="text-text-muted/60" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, rIdx) => (
                <TableRow key={`skeleton-row-${rIdx}`} className="hover:bg-transparent">
                  {columns.map((col, cIdx) => (
                    <TableCell key={`skeleton-cell-${rIdx}-${cIdx}`} className={col.className}>
                      <Skeleton className="h-4 w-3/4" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="p-8 text-center">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    isFiltered={isFiltered}
                    actionLabel={isFiltered ? "Clear filters" : undefined}
                    onAction={isFiltered ? onClearFilters : undefined}
                  />
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => {
                const key = keyExtractor ? keyExtractor(row, index) : index;
                return (
                  <TableRow
                    key={key}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      onRowClick && "cursor-pointer focus-within:bg-surface-subtle",
                      "group"
                    )}
                  >
                    {columns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn(
                          col.align === 'right' && "text-right",
                          col.align === 'center' && "text-center",
                          col.className
                        )}
                      >
                        {col.cell
                          ? col.cell(row, index)
                          : col.accessorKey
                          ? String((row as Record<string, unknown>)[col.accessorKey as string] ?? '')
                          : null}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
