import React from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import {
  CalendarLtr24Regular,
  ChevronLeft16Regular,
  ChevronRight16Regular,
} from '@fluentui/react-icons';

interface AttendanceRecord {
  id: string;
  date: string;
  /** `null`/unknown values render as a neutral pill ("Not marked" / "Cancelled"). */
  status: 'present' | 'absent' | 'late' | 'excused' | 'cancelled' | null;
  studentName: string;
  studentRollNo: string;
  studentId: string;
  className: string;
}

interface AttendanceTableProps {
  loading: boolean;
  records: AttendanceRecord[];
  searchQuery?: string;
  statusFilter?: string;
  selectedClass?: string;
  classes?: Array<{id: string; name: string}>;
  currentPage?: number;
  pageSize?: number;
  totalRecords?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

const NEUTRAL_PILL = 'bg-surface-subtle text-text-muted border-border-default';

const STATUS_PILL: Record<string, string> = {
  present: 'bg-status-success-subtle text-status-success border-status-success-border',
  absent: 'bg-status-error-subtle text-status-error border-status-error-border',
  late: 'bg-status-warning-subtle text-status-warning border-status-warning-border',
  excused: 'bg-status-info-subtle text-status-info border-status-info-border',
  cancelled: NEUTRAL_PILL,
};

const statusLabel = (status: AttendanceRecord['status']) =>
  status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Not marked';

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

const AttendanceTable: React.FC<AttendanceTableProps> = ({
  loading,
  records,
  searchQuery = '',
  statusFilter = 'all',
  selectedClass = '',
  classes = [],
  currentPage = 1,
  pageSize = 10,
  totalRecords = 0,
  onPageChange,
  onPageSizeChange
}) => {
  // Server already returns paginated records; just render provided page
  const paginatedRecords = records;
  const total = totalRecords ?? records.length;
  const totalPages = Math.max(1, Math.ceil(total / (pageSize || 1)));

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-12 text-body text-text-muted">
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-brand-subtle border-t-brand"
          aria-hidden
        />
        <span>Loading attendance records...</span>
      </div>
    );
  }

  if (!loading && total === 0) {
    const isFiltered = searchQuery || statusFilter !== 'all' || (selectedClass && selectedClass !== 'all');
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
          <CalendarLtr24Regular aria-hidden />
        </div>
        <p className="text-subheading text-text-primary">
          {isFiltered
            ? 'No records match your filters'
            : 'No attendance records found for the selected criteria'}
        </p>
        <p className="mt-1 text-body text-text-muted">
          {isFiltered
            ? 'Try adjusting your search or filters'
            : 'Try selecting a different class or date'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-default">
      <div className="max-h-[640px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-surface-subtle">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Student</TableHead>
              <TableHead className="px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Roll No</TableHead>
              <TableHead className="px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Class</TableHead>
              <TableHead className="px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Date</TableHead>
              <TableHead className="px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRecords.map((record) => (
              <TableRow key={record.id} className="border-b border-border-subtle hover:bg-surface-hover">
                <TableCell className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-subtle text-caption-strong text-brand-foreground"
                      aria-hidden
                    >
                      {getInitials(record.studentName)}
                    </span>
                    <span className="truncate text-body-strong text-text-primary">{record.studentName}</span>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-2.5 text-body text-text-secondary">{record.studentRollNo}</TableCell>
                <TableCell className="px-4 py-2.5 text-body text-text-secondary">{record.className}</TableCell>
                <TableCell className="px-4 py-2.5 text-body text-text-secondary">{format(new Date(record.date), 'PP')}</TableCell>
                <TableCell className="px-4 py-2.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-caption-strong ${
                      (record.status && STATUS_PILL[record.status]) || NEUTRAL_PILL
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                    {statusLabel(record.status)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-border-subtle bg-surface-default px-4 py-3 sm:flex-row">
          <div className="flex flex-wrap items-center gap-4 text-body text-text-secondary">
            <div className="flex items-center gap-2">
              <label htmlFor="attendance-page-size" className="text-caption text-text-muted">Show</label>
              <select
                id="attendance-page-size"
                value={pageSize}
                onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
                className="h-8 cursor-pointer rounded-md border border-border-default bg-surface-default px-2 text-body text-text-primary transition-colors duration-150 ease-fluent-standard hover:border-border-strong focus:border-brand-stroke focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-caption text-text-muted">entries</span>
            </div>

            <div className="text-caption text-text-muted tabular-nums">
              <span>Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, total)} of {total}</span>
              {searchQuery && totalRecords && totalRecords > total && (
                <span className="ml-1">({totalRecords} total)</span>
              )}
            </div>
          </div>

          <nav className="flex items-center gap-1" aria-label="Pagination">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange?.(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft16Regular aria-hidden />
              Previous
            </Button>

            <div className="flex items-center gap-0.5">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                const isCurrent = currentPage === pageNum;

                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => onPageChange?.(pageNum)}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`h-8 min-w-8 rounded-md px-2 text-body tabular-nums transition-colors duration-150 ease-fluent-standard ${
                      isCurrent
                        ? 'bg-brand-subtle font-semibold text-brand-foreground'
                        : 'text-text-secondary hover:bg-surface-hover'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange?.(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight16Regular aria-hidden />
            </Button>
          </nav>
        </div>
      )}
    </div>
  );
};

export default AttendanceTable;
