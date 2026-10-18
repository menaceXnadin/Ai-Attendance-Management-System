import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { AttendanceSource, ClassSessionInfo, RecordStatus, SessionStatus } from '@/integrations/api/client';

/* -------------------------------------------------------------------------- */
/* Labels                                                                      */
/* -------------------------------------------------------------------------- */

export const RECORD_STATUS_LABEL: Record<RecordStatus, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  excused: 'Excused',
};

const RECORD_STATUS_VARIANT: Record<RecordStatus, 'success' | 'warning' | 'destructive' | 'info'> = {
  present: 'success',
  late: 'warning',
  absent: 'destructive',
  excused: 'info',
};

export const SOURCE_LABEL: Record<AttendanceSource, string> = {
  teacher: 'Teacher',
  admin: 'Admin',
  student_face: 'Face check-in',
  system_auto: 'Auto-absent',
  legacy: 'Legacy import',
};

export const sourceLabel = (source?: string | null): string =>
  source ? SOURCE_LABEL[source as AttendanceSource] ?? source.replace(/_/g, ' ') : '';

export const isRecordStatus = (value: unknown): value is RecordStatus =>
  value === 'present' || value === 'late' || value === 'absent' || value === 'excused';

/** Status pill; `null` (no record) renders as a neutral "Not marked". */
export const RecordStatusBadge: React.FC<{ status: string | null | undefined; className?: string }> = ({
  status,
  className,
}) => {
  if (isRecordStatus(status)) {
    return (
      <Badge variant={RECORD_STATUS_VARIANT[status]} shape="pill" className={className}>
        {RECORD_STATUS_LABEL[status]}
      </Badge>
    );
  }
  if (status === 'cancelled') {
    return (
      <Badge variant="secondary" shape="pill" className={className}>
        Cancelled
      </Badge>
    );
  }
  return (
    <Badge variant="outline" shape="pill" className={className}>
      Not marked
    </Badge>
  );
};

const SESSION_STATUS_META: Record<SessionStatus, { label: string; variant: 'secondary' | 'success' | 'outline' }> = {
  scheduled: { label: 'Not recorded', variant: 'outline' },
  held: { label: 'Held', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
};

export const SessionStatusBadge: React.FC<{ session: Pick<ClassSessionInfo, 'status'> & { kind?: string }; className?: string }> = ({
  session,
  className,
}) => {
  const meta = SESSION_STATUS_META[session.status] ?? { label: session.status, variant: 'outline' as const };
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      <Badge variant={meta.variant} shape="pill">
        {meta.label}
      </Badge>
      {session.kind === 'makeup' && (
        <Badge variant="brand" shape="pill">
          Make-up
        </Badge>
      )}
    </span>
  );
};

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

/** "HH:MM" from "HH:MM[:SS]". */
export const formatTime = (value?: string | null): string => (value ? value.slice(0, 5) : '');

export const formatTimeRange = (start?: string | null, end?: string | null): string =>
  start || end ? `${formatTime(start)}–${formatTime(end)}` : '';

/** Local calendar date label for a `YYYY-MM-DD` string (no timezone shift). */
export const formatDateLabel = (value?: string | null, opts?: Intl.DateTimeFormatOptions): string => {
  if (!value) return '';
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, opts ?? { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatDateTime = (value?: string | null): string => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
};

/** Today's date as `YYYY-MM-DD` in the browser's local calendar (default for date pickers only). */
export const localToday = (): string => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

/* -------------------------------------------------------------------------- */
/* Message bar                                                                 */
/* -------------------------------------------------------------------------- */

type BarTone = 'info' | 'warning' | 'error' | 'success';

const BAR_CLASS: Record<BarTone, string> = {
  info: 'border-status-info-border bg-status-info-subtle',
  warning: 'border-status-warning-border bg-status-warning-subtle',
  error: 'border-status-error-border bg-status-error-subtle',
  success: 'border-status-success-border bg-status-success-subtle',
};

const BAR_ICON_CLASS: Record<BarTone, string> = {
  info: 'text-status-info',
  warning: 'text-status-warning',
  error: 'text-status-error',
  success: 'text-status-success',
};

/** Fluent MessageBar: tinted surface, status icon, primary text, optional actions. */
export const MessageBar: React.FC<{
  tone: BarTone;
  icon: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  role?: 'status' | 'alert';
}> = ({ tone, icon, children, actions, className, role = 'status' }) => (
  <div
    role={role}
    className={`flex items-start gap-2 rounded-md border px-3 py-2 text-body text-text-primary ${BAR_CLASS[tone]} ${className ?? ''}`}
  >
    <span className={`mt-0.5 shrink-0 ${BAR_ICON_CLASS[tone]}`} aria-hidden>
      {icon}
    </span>
    <div className="min-w-0 flex-1">{children}</div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
);
