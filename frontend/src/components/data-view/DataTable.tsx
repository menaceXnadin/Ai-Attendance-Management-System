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
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import {
  ArrowSort16Regular,
  ArrowSortDown16Regular,
  ArrowSortUp16Regular,
  Search16Regular,
} from '@fluentui/react-icons';
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
  /* ---- optional Fluent DataGrid toolbar ---- */
  /** Controlled search value; the search box renders when `onSearchChange` is set. */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Extra toolbar content shown after the search box (filters, chips…). */
  toolbar?: React.ReactNode;
  /** Right-aligned toolbar actions (buttons). */
  actions?: React.ReactNode;
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
  className,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search',
  toolbar,
  actions,
}: DataTableProps<T>) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const hasToolbar = Boolean(onSearchChange || toolbar || actions);

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-lg border bg-surface-default shadow [--dt-stroke:transparent] dark:[--dt-stroke:var(--border-subtle)] border-[color:var(--dt-stroke)]",
        className
      )}
    >
      {hasToolbar && (
        <div className="flex flex-col gap-2 border-b border-border-subtle px-3 py-2.5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {onSearchChange && (
              <div className="relative w-full sm:w-64">
                <Search16Regular
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={searchValue ?? ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="pl-8"
                />
              </div>
            )}
            {toolbar}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
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
                        className={cn(
                          "group/sort -mx-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 transition-colors duration-150 hover:bg-surface-hover hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-text-primary",
                          isSorted && "text-text-primary"
                        )}
                      >
                        <span>{col.header}</span>
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ArrowSortUp16Regular className="text-brand-foreground" aria-hidden="true" />
                          ) : (
                            <ArrowSortDown16Regular className="text-brand-foreground" aria-hidden="true" />
                          )
                        ) : (
                          <ArrowSort16Regular
                            className="text-text-muted opacity-0 transition-opacity group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100"
                            aria-hidden="true"
                          />
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
                <TableCell colSpan={columns.length} className="p-0">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    isFiltered={isFiltered}
                    actionLabel={isFiltered ? "Clear filters" : undefined}
                    onAction={isFiltered ? onClearFilters : undefined}
                    className="rounded-none bg-transparent"
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
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.target !== e.currentTarget) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    tabIndex={onRowClick ? 0 : undefined}
                    className={cn(
                      onRowClick &&
                        "cursor-pointer focus-visible:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-text-primary",
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
