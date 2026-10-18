import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUndo16Regular,
  CalendarCancel16Regular,
  CalendarCheckmark16Regular,
  CheckmarkCircle16Regular,
  Clock16Regular,
  DataUsage16Regular,
  DismissCircle16Regular,
  ErrorCircle16Regular,
  History16Regular,
  Info16Regular,
  MoreHorizontal20Regular,
  People24Regular,
  QuestionCircle16Regular,
  Save16Regular,
  Search16Regular,
  ShieldCheckmark16Regular,
  Warning16Regular,
} from '@fluentui/react-icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import {
  api,
  parseApiError,
  type RecordStatus,
  type RegisterEntry,
  type RegisterResult,
  type RegisterStudent,
} from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';
import FaceAttemptsPanel from '@/components/face-admin/FaceAttemptsPanel';
import { PresenceCodeButton } from '@/components/face-admin/PresenceCodeDialog';
import ConfirmHeldDialog from './ConfirmHeldDialog';
import MetricsExclusionDialog from './MetricsExclusionDialog';
import RecordAuditDialog from './RecordAuditDialog';
import SessionStatusDialog from './SessionStatusDialog';
import { entryErrors, errorField, isEntryValidationError, legacyFailure } from './errors';
import {
  MessageBar,
  RecordStatusBadge,
  SessionStatusBadge,
  formatDateLabel,
  formatDateTime,
  formatTimeRange,
  getInitials,
  localToday,
  sourceLabel,
} from './shared';

const MARK_OPTIONS: Array<{
  status: RecordStatus;
  label: string;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  selected: string;
}> = [
  { status: 'present', label: 'Present', Icon: CheckmarkCircle16Regular, selected: 'bg-status-success-subtle text-status-success' },
  { status: 'late', label: 'Late', Icon: Clock16Regular, selected: 'bg-status-warning-subtle text-status-warning' },
  { status: 'absent', label: 'Absent', Icon: DismissCircle16Regular, selected: 'bg-status-error-subtle text-status-error' },
  { status: 'excused', label: 'Excused', Icon: ShieldCheckmark16Regular, selected: 'bg-status-info-subtle text-status-info' },
];

/** Segmented Present / Late / Absent / Excused control. `value === null` = not marked. */
export const StatusSegmentedControl: React.FC<{
  value: RecordStatus | null;
  onChange: (status: RecordStatus) => void;
  disabled?: boolean;
  label: string;
}> = ({ value, onChange, disabled, label }) => (
  <div
    className="inline-flex overflow-hidden rounded-md border border-border-default bg-surface-default"
    role="radiogroup"
    aria-label={label}
  >
    {MARK_OPTIONS.map(({ status, label: optionLabel, Icon, selected }) => {
      const isSelected = value === status;
      return (
        <button
          key={status}
          type="button"
          role="radio"
          aria-checked={isSelected}
          disabled={disabled}
          onClick={() => onChange(status)}
          title={optionLabel}
          className={`inline-flex h-7 items-center gap-1 border-r border-border-default px-2 text-caption-strong transition-colors duration-150 ease-fluent-standard last:border-r-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-text-primary disabled:cursor-not-allowed disabled:opacity-50 ${
            isSelected ? selected : 'text-text-secondary hover:bg-surface-hover'
          }`}
        >
          <Icon aria-hidden />
          <span className="hidden sm:inline">{optionLabel}</span>
        </button>
      );
    })}
  </div>
);

export interface SessionRegisterProps {
  sessionId: number;
  /** Called after any successful write (register, cancel/restore, exclusion). */
  onChanged?: () => void;
  /** Pre-select "mark everyone still unmarked as absent" (unrecorded resolution). */
  defaultMarkRemainingAbsent?: boolean;
  /** The admin already confirmed the session was held (unrecorded resolution flow). */
  preconfirmedHeld?: boolean;
  /** Hide the session header (when the parent already shows it). */
  hideHeader?: boolean;
  className?: string;
}

type ConfirmState = { message?: string; missing?: number | null } | null;

/** Students listed only because they hold a record but are no longer in the cohort roster. */
const isOffRoster = (s: RegisterStudent) => (s as RegisterStudent & { in_roster?: boolean }).in_roster === false;

/**
 * One class session's register (contract v1): loads
 * `GET /attendance/sessions/{id}/register`, tracks edits locally and submits
 * ONLY the changed rows via `POST /attendance/sessions/{id}/register`.
 * Unmarked students stay "Not marked" — nothing is ever pre-filled as absent.
 */
const SessionRegister: React.FC<SessionRegisterProps> = ({
  sessionId,
  onChanged,
  defaultMarkRemainingAbsent = false,
  preconfirmedHeld = false,
  hideHeader = false,
  className,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [edits, setEdits] = useState<Record<number, RecordStatus>>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [reason, setReason] = useState('');
  const [markRemainingAbsent, setMarkRemainingAbsent] = useState(defaultMarkRemainingAbsent);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [search, setSearch] = useState('');
  const [auditFor, setAuditFor] = useState<{ recordId: number; name: string } | null>(null);
  const [exclusionFor, setExclusionFor] = useState<{ recordId: number; excluded: boolean; name: string } | null>(null);
  const [statusDialog, setStatusDialog] = useState<'cancel' | 'uncancel' | null>(null);

  const query = useQuery({
    queryKey: ['session-register', sessionId],
    queryFn: () => api.sessions.getRegister(sessionId),
  });

  useEffect(() => {
    setEdits({});
    setRowErrors({});
    setReason('');
    setFormError(null);
    setMarkRemainingAbsent(defaultMarkRemainingAbsent);
  }, [sessionId, defaultMarkRemainingAbsent]);

  const session = query.data?.session;
  const students = useMemo<RegisterStudent[]>(() => query.data?.students ?? [], [query.data]);
  const isCancelled = session?.status === 'cancelled';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name?.toLowerCase().includes(q) || String(s.student_number ?? '').toLowerCase().includes(q)
    );
  }, [students, search]);

  const effective = (s: RegisterStudent): RecordStatus | null => edits[s.student_id] ?? s.status;

  const changedEntries = useMemo<RegisterEntry[]>(
    () =>
      students
        .filter((s) => edits[s.student_id] !== undefined && edits[s.student_id] !== s.status)
        .map((s) => ({ student_id: s.student_id, status: edits[s.student_id] })),
    [students, edits]
  );

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, excused: 0, unmarked: 0 };
    students.forEach((s) => {
      const st = edits[s.student_id] ?? s.status;
      if (st) c[st] += 1;
      else if (!isOffRoster(s)) c.unmarked += 1;
    });
    return c;
  }, [students, edits]);

  const setRowStatus = (student: RegisterStudent, status: RecordStatus) => {
    setEdits((prev) => {
      const next = { ...prev };
      if (status === student.status) delete next[student.student_id];
      else next[student.student_id] = status;
      return next;
    });
    setRowErrors((prev) => {
      if (!(student.student_id in prev)) return prev;
      const next = { ...prev };
      delete next[student.student_id];
      return next;
    });
  };

  const undoRow = (student: RegisterStudent) => {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[student.student_id];
      return next;
    });
  };

  const bulkSet = (status: RecordStatus, onlyUnmarked: boolean) => {
    setEdits((prev) => {
      const next = { ...prev };
      filtered.forEach((s) => {
        if (isOffRoster(s)) return;
        const current = prev[s.student_id] ?? s.status;
        if (onlyUnmarked && current) return;
        if (status === s.status) delete next[s.student_id];
        else next[s.student_id] = status;
      });
      return next;
    });
  };

  const needsReasonHint = useMemo(
    () =>
      changedEntries.some((e) => {
        if (e.status === 'excused') return true;
        const original = students.find((s) => s.student_id === e.student_id);
        return original?.source === 'student_face' || original?.source === 'teacher';
      }),
    [changedEntries, students]
  );

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['session-register', sessionId] });
    void queryClient.invalidateQueries({ queryKey: ['class-sessions'] });
    void queryClient.invalidateQueries({ queryKey: ['unrecorded-sessions'] });
    void queryClient.invalidateQueries({ queryKey: ['auto-absent-status'] });
  };

  const handleFailure = (info: ReturnType<typeof parseApiError>) => {
    if (info.code === 'confirm_held') {
      setConfirm({ message: info.message, missing: errorField<number>(info, 'students_without_record') ?? null });
      return;
    }
    if (info.code === 'session_cancelled') {
      setFormError('This session is cancelled. Restore it before recording attendance.');
      void query.refetch();
      return;
    }
    if (isEntryValidationError(info)) {
      const map: Record<number, string> = {};
      let general: string | null = null;
      entryErrors(info).forEach((e) => {
        if (typeof e.student_id === 'number') map[e.student_id] = e.message || e.code;
        else general = e.message || e.code;
      });
      setRowErrors(map);
      const n = Object.keys(map).length;
      setFormError(
        general ??
          (n > 0
            ? `${n} row${n === 1 ? '' : 's'} could not be saved. Nothing was written — fix the highlighted rows and submit again.`
            : info.message)
      );
      return;
    }
    setFormError(info.message);
  };

  const submit = async (confirmHeld = false) => {
    if (changedEntries.length === 0 && !markRemainingAbsent) {
      setFormError('There are no changes to submit.');
      return;
    }
    setSaving(true);
    setFormError(null);
    setRowErrors({});
    try {
      const result: RegisterResult = await api.sessions.submitRegister(sessionId, {
        entries: changedEntries,
        reason: reason.trim() || undefined,
        mark_remaining_absent: markRemainingAbsent || undefined,
        confirm_held: confirmHeld || preconfirmedHeld || undefined,
      });
      const legacy = legacyFailure(result);
      if (legacy) {
        handleFailure(legacy);
        return;
      }
      const rows = Array.isArray(result?.results) ? result.results : [];
      const created = rows.filter((r) => r.outcome === 'created').length || Number(result?.created ?? 0);
      const updated = rows.filter((r) => r.outcome === 'updated').length || Number(result?.updated ?? 0);
      toast({
        title: 'Register submitted',
        description:
          rows.length || created || updated
            ? `${created} created, ${updated} updated${result?.unchanged ? `, ${result.unchanged} unchanged` : ''}.`
            : typeof result?.message === 'string' && result.message
              ? result.message
              : 'Attendance saved.',
      });
      setEdits({});
      setReason('');
      setMarkRemainingAbsent(false);
      invalidateAll();
      onChanged?.();
    } catch (err) {
      handleFailure(parseApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (query.isLoading) return <LoadingState rows={6} columns={4} className={className} />;
  if (query.isError || !session) {
    return (
      <ErrorState
        className={className}
        title="Couldn't load the register"
        message={query.isError ? parseApiError(query.error).message : 'Session not found.'}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const pendingChanges = changedEntries.length;
  const subjectLabel = [session.subject_name, session.subject_code ? `(${session.subject_code})` : null]
    .filter(Boolean)
    .join(' ');
  // Presence codes exist only for today's sessions (the server answers 409 not_today otherwise).
  const isToday = !!session.session_date && session.session_date.slice(0, 10) === localToday();

  return (
    <section className={`overflow-hidden rounded-lg bg-surface-default shadow ${className ?? ''}`}>
      {!hideHeader && (
        <header className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-subheading text-text-primary">{subjectLabel || 'Class register'}</h3>
              <SessionStatusBadge session={session} />
            </div>
            <p className="text-caption text-text-muted">
              {[
                formatDateLabel(session.session_date),
                formatTimeRange(session.start_time, session.end_time),
                session.faculty_name,
                session.semester ? `Semester ${session.semester}` : null,
                session.teacher_name ? `Teacher: ${session.teacher_name}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {(session.submitted_at || session.finalized_at) && (
              <p className="text-caption text-text-muted">
                {session.submitted_at ? `Submitted ${formatDateTime(session.submitted_at)}` : ''}
                {session.submitted_at && session.finalized_at ? ' · ' : ''}
                {session.finalized_at ? `Finalized ${formatDateTime(session.finalized_at)}` : ''}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!isCancelled && isToday && (
              <PresenceCodeButton
                sessionId={sessionId}
                sessionLabel={[subjectLabel, formatTimeRange(session.start_time, session.end_time)].filter(Boolean).join(' · ')}
              />
            )}
            {isCancelled ? (
              <Button variant="outline" size="sm" onClick={() => setStatusDialog('uncancel')}>
                <CalendarCheckmark16Regular aria-hidden />
                Restore session
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setStatusDialog('cancel')}>
                <CalendarCancel16Regular aria-hidden />
                Mark not held
              </Button>
            )}
          </div>
        </header>
      )}

      <div className="space-y-2 px-5 pt-4 empty:hidden">
        {isCancelled && (
          <MessageBar
            tone="info"
            icon={<Info16Regular />}
            actions={
              hideHeader ? (
                <Button variant="outline" size="sm" onClick={() => setStatusDialog('uncancel')}>
                  Restore
                </Button>
              ) : undefined
            }
          >
            <strong className="font-semibold">This session is cancelled</strong>
            {session.cancellation_reason ? ` — ${session.cancellation_reason}` : ''}. It is excluded from metrics;
            existing records are kept. Restore it to record attendance.
          </MessageBar>
        )}
        {session.review_required && !isCancelled && (
          <MessageBar tone="warning" icon={<Warning16Regular />}>
            <strong className="font-semibold">Review required</strong>
            {session.review_reason ? ` — ${session.review_reason}` : ''}. A calendar event now covers this session but
            it already has attendance records. Keep it (submit the register) or mark it as not held.
          </MessageBar>
        )}
        {session.status === 'scheduled' && !isCancelled && (
          <MessageBar tone="info" icon={<Info16Regular />}>
            Attendance hasn't been recorded for this session yet. Submitting the register marks it as{' '}
            <strong className="font-semibold">held</strong>; students left unmarked are marked absent automatically
            after the grace period.
          </MessageBar>
        )}
      </div>

      <div className="px-5 pt-4">
        <FaceAttemptsPanel sessionId={sessionId} isToday={isToday} variant="embedded" />
      </div>

      {students.length === 0 ? (
        <EmptyState
          icon={<People24Regular aria-hidden />}
          title="No students on this roster"
          description="No active students were enrolled in this cohort on the session date."
        />
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex flex-col gap-3 px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1.5 text-caption-strong tabular-nums">
              <Badge variant="success" shape="pill">Present {counts.present}</Badge>
              <Badge variant="warning" shape="pill">Late {counts.late}</Badge>
              <Badge variant="destructive" shape="pill">Absent {counts.absent}</Badge>
              <Badge variant="info" shape="pill">Excused {counts.excused}</Badge>
              <Badge variant="outline" shape="pill">Not marked {counts.unmarked}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-56">
                <Search16Regular
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
                  aria-hidden
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter students"
                  aria-label="Filter students"
                  className="pl-8"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isCancelled}>
                    Bulk mark
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => bulkSet('present', true)}>Unmarked → Present</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => bulkSet('absent', true)}>Unmarked → Absent</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => bulkSet('present', false)}>Everyone → Present</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => bulkSet('late', false)}>Everyone → Late</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => bulkSet('absent', false)}>Everyone → Absent</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="overflow-x-auto border-t border-border-subtle">
            <Table>
              <TableHeader className="bg-surface-subtle">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Student</TableHead>
                  <TableHead className="w-[200px] px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Recorded</TableHead>
                  <TableHead className="w-[320px] px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Mark</TableHead>
                  <TableHead className="w-[52px] px-2">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const edited = edits[s.student_id] !== undefined && edits[s.student_id] !== s.status;
                  const rowError = rowErrors[s.student_id];
                  return (
                    <TableRow
                      key={s.student_id}
                      className={`border-b border-border-subtle ${
                        rowError
                          ? 'bg-status-error-subtle hover:bg-status-error-subtle'
                          : edited
                            ? 'bg-brand-subtle hover:bg-brand-subtle'
                            : 'hover:bg-surface-hover'
                      }`}
                    >
                      <TableCell className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          <span
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-subtle text-caption-strong text-brand-foreground"
                            aria-hidden
                          >
                            {getInitials(s.name || '?')}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-body-strong text-text-primary">
                              {s.name}
                              {edited && (
                                <span className="ml-2 rounded-full border border-brand-stroke px-1.5 py-px align-middle text-overline text-brand-foreground">
                                  Changed
                                </span>
                              )}
                            </p>
                            <p className="font-mono text-caption text-text-muted">
                              {s.student_number}
                              {isOffRoster(s) && <span className="ml-2 font-sans">· Not on this session's roster</span>}
                            </p>
                            {rowError && (
                              <p className="mt-0.5 flex items-center gap-1 text-caption text-status-error" role="alert">
                                <ErrorCircle16Regular className="size-3.5 shrink-0" aria-hidden />
                                {rowError}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        <div className="flex flex-col items-start gap-0.5">
                          <RecordStatusBadge status={s.status} />
                          {s.source && <span className="text-caption text-text-muted">{sourceLabel(s.source)}</span>}
                          {s.excluded_from_metrics && (
                            <Badge variant="secondary" className="gap-1">
                              <DataUsage16Regular aria-hidden />
                              Excluded from metrics
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        <StatusSegmentedControl
                          value={effective(s)}
                          onChange={(st) => setRowStatus(s, st)}
                          disabled={isCancelled || saving || isOffRoster(s)}
                          label={`Attendance for ${s.name}`}
                        />
                      </TableCell>
                      <TableCell className="px-2 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {edited && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Undo change for ${s.name}`}
                              title="Undo change"
                              onClick={() => undoRow(s)}
                            >
                              <ArrowUndo16Regular aria-hidden />
                            </Button>
                          )}
                          {s.record_id !== null && s.record_id !== undefined && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" aria-label={`Record actions for ${s.name}`}>
                                  <MoreHorizontal20Regular aria-hidden />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() => setAuditFor({ recordId: s.record_id as number, name: s.name })}
                                >
                                  <History16Regular className="mr-2" aria-hidden />
                                  View history
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() =>
                                    setExclusionFor({
                                      recordId: s.record_id as number,
                                      excluded: s.excluded_from_metrics,
                                      name: s.name,
                                    })
                                  }
                                >
                                  <DataUsage16Regular className="mr-2" aria-hidden />
                                  {s.excluded_from_metrics ? 'Include in metrics' : 'Exclude from metrics'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="px-4 py-6 text-center text-body text-text-muted">
                      No students match “{search}”.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Submission */}
          {!isCancelled && (
            <div className="space-y-3 border-t border-border-subtle bg-surface-subtle px-5 py-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`register-reason-${sessionId}`} className="text-body-strong text-text-primary">
                    Reason {needsReasonHint ? <span className="text-status-error">*</span> : <span className="font-normal text-text-muted">(optional)</span>}
                  </label>
                  <Input
                    id={`register-reason-${sessionId}`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Applied to every change that needs one"
                    className="bg-surface-default"
                  />
                  <p className="flex items-start gap-1 text-caption text-text-muted">
                    <QuestionCircle16Regular className="mt-px size-3.5 shrink-0" aria-hidden />
                    Required for Excused, for changing a face check-in, for overriding a teacher's record, or for edits
                    after the teacher edit window.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-body text-text-primary lg:pb-6">
                  <Checkbox
                    checked={markRemainingAbsent}
                    onCheckedChange={(v) => setMarkRemainingAbsent(v === true)}
                    disabled={saving}
                  />
                  Mark everyone still unmarked as absent
                </label>
              </div>

              {formError && (
                <MessageBar tone="error" role="alert" icon={<ErrorCircle16Regular />}>
                  {formError}
                </MessageBar>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-caption text-text-muted tabular-nums">
                  {pendingChanges > 0
                    ? `${pendingChanges} change${pendingChanges === 1 ? '' : 's'} will be sent — unchanged rows are not resubmitted.`
                    : markRemainingAbsent
                      ? `${counts.unmarked} unmarked student${counts.unmarked === 1 ? '' : 's'} will be marked absent.`
                      : 'No changes yet.'}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEdits({});
                      setRowErrors({});
                      setFormError(null);
                    }}
                    disabled={saving || pendingChanges === 0}
                  >
                    Reset
                  </Button>
                  <Button
                    onClick={() => void submit(false)}
                    disabled={saving || (pendingChanges === 0 && !markRemainingAbsent)}
                  >
                    <Save16Regular aria-hidden />
                    {saving ? 'Submitting…' : 'Submit register'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmHeldDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        message={confirm?.message}
        studentsWithoutRecord={confirm?.missing ?? null}
        onConfirm={() => {
          setConfirm(null);
          void submit(true);
        }}
      />
      <RecordAuditDialog
        open={auditFor !== null}
        onOpenChange={(open) => !open && setAuditFor(null)}
        recordId={auditFor?.recordId ?? null}
        subject={auditFor?.name}
      />
      <MetricsExclusionDialog
        open={exclusionFor !== null}
        onOpenChange={(open) => !open && setExclusionFor(null)}
        recordId={exclusionFor?.recordId ?? null}
        excluded={exclusionFor?.excluded ?? false}
        subject={exclusionFor?.name}
        onDone={() => {
          invalidateAll();
          onChanged?.();
        }}
      />
      {statusDialog && (
        <SessionStatusDialog
          mode={statusDialog}
          session={{ ...session, recorded_count: students.filter((s) => s.status).length }}
          open={statusDialog !== null}
          onOpenChange={(open) => !open && setStatusDialog(null)}
          onDone={() => {
            invalidateAll();
            onChanged?.();
          }}
        />
      )}
    </section>
  );
};

export default SessionRegister;
