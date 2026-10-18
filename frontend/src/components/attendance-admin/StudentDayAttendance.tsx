import React, { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen24Regular,
  DataUsage16Regular,
  ErrorCircle16Regular,
  History16Regular,
  MoreHorizontal20Regular,
  Save16Regular,
} from '@fluentui/react-icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { api, parseApiError, type ClassSessionInfo, type RecordStatus, type RegisterStudent } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';
import ConfirmHeldDialog from './ConfirmHeldDialog';
import MetricsExclusionDialog from './MetricsExclusionDialog';
import RecordAuditDialog from './RecordAuditDialog';
import { StatusSegmentedControl } from './SessionRegister';
import { entryErrors, errorField, isEntryValidationError, legacyFailure } from './errors';
import { MessageBar, RecordStatusBadge, SessionStatusBadge, formatDateLabel, formatTimeRange, sourceLabel } from './shared';

export interface StudentDayAttendanceProps {
  facultyId: number;
  semester: number;
  studentId: number;
  studentName?: string;
  /** `YYYY-MM-DD` */
  date: string;
  onChanged?: () => void;
}

interface Row {
  session: ClassSessionInfo;
  entry: RegisterStudent | null;
  loading: boolean;
  error: string | null;
}

/**
 * "By student" view: every class session of the student's cohort on a date,
 * with the student's own record in each. Saving writes one admin single-record
 * correction per changed session (`POST /attendance`), never a whole-class
 * register submission; a past unrecorded session asks for `confirm_held` first.
 */
const StudentDayAttendance: React.FC<StudentDayAttendanceProps> = ({
  facultyId,
  semester,
  studentId,
  studentName,
  date,
  onChanged,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<number, RecordStatus>>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ ids: number[]; missing: number } | null>(null);
  const [auditFor, setAuditFor] = useState<number | null>(null);
  const [exclusionFor, setExclusionFor] = useState<{ recordId: number; excluded: boolean } | null>(null);

  useEffect(() => {
    setEdits({});
    setRowErrors({});
    setFormError(null);
  }, [studentId, date, facultyId, semester]);

  const sessionsQuery = useQuery({
    queryKey: ['class-sessions', { date, facultyId, semester }],
    queryFn: () => api.sessions.list({ date, faculty_id: facultyId, semester }),
    enabled: Boolean(date && facultyId && semester),
  });
  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);

  const registerQueries = useQueries({
    queries: sessions.map((s) => ({
      queryKey: ['session-register', s.id],
      queryFn: () => api.sessions.getRegister(s.id),
    })),
  });

  const rows: Row[] = sessions.map((session, i) => {
    const q = registerQueries[i];
    return {
      session,
      entry: q?.data?.students?.find((st) => st.student_id === studentId) ?? null,
      loading: Boolean(q?.isLoading),
      error: q?.isError ? parseApiError(q.error).message : null,
    };
  });

  const changed = rows.filter(
    (r) => r.entry && edits[r.session.id] !== undefined && edits[r.session.id] !== r.entry.status
  );

  const setStatus = (row: Row, status: RecordStatus) => {
    setEdits((prev) => {
      const next = { ...prev };
      if (row.entry && status === row.entry.status) delete next[row.session.id];
      else next[row.session.id] = status;
      return next;
    });
  };

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['class-sessions'] });
    sessions.forEach((s) => void queryClient.invalidateQueries({ queryKey: ['session-register', s.id] }));
    void queryClient.invalidateQueries({ queryKey: ['unrecorded-sessions'] });
  };

  const save = async (confirmedIds: number[] = []) => {
    const targets = confirmedIds.length ? changed.filter((r) => confirmedIds.includes(r.session.id)) : changed;
    if (!targets.length) {
      setFormError('There are no changes to save.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const errors: Record<number, string> = {};
    const needConfirm: number[] = [];
    let missing = 0;
    let saved = 0;
    for (const row of targets) {
      const status = edits[row.session.id];
      if (typeof row.session.subject_id !== 'number') {
        errors[row.session.id] = 'This session has no subject reference; open the subject register instead.';
        continue;
      }
      try {
        // Admin single-record write — NOT a register submission, so it never marks
        // the whole class as held unless the admin confirms (409 confirm_held).
        const result = await api.attendance.recordSingle({
          student_id: studentId,
          subject_id: row.session.subject_id,
          date: row.session.session_date ?? date,
          status,
          session_id: row.session.id,
          reason: reason.trim() || undefined,
          confirm_held: confirmedIds.includes(row.session.id) || undefined,
        });
        const legacy = legacyFailure(result);
        if (legacy) throw Object.assign(new Error(legacy.message), { response: { status: 200, data: { detail: legacy.detail } } });
        saved += 1;
        setEdits((prev) => {
          const next = { ...prev };
          delete next[row.session.id];
          return next;
        });
      } catch (err) {
        const info = parseApiError(err);
        if (info.code === 'confirm_held') {
          needConfirm.push(row.session.id);
          missing += errorField<number>(info, 'students_without_record') ?? 0;
        } else if (info.code === 'session_cancelled') {
          errors[row.session.id] = 'Session is cancelled — restore it first.';
        } else if (isEntryValidationError(info)) {
          const mine = entryErrors(info).find((e) => e.student_id === studentId) ?? entryErrors(info)[0];
          errors[row.session.id] = mine?.message || info.message;
        } else {
          errors[row.session.id] = info.message;
        }
      }
    }
    setRowErrors(errors);
    setSaving(false);
    if (saved) {
      toast({ title: 'Attendance saved', description: `${saved} session${saved === 1 ? '' : 's'} updated.` });
      invalidate();
      onChanged?.();
    }
    if (Object.keys(errors).length) {
      setFormError('Some sessions could not be saved. See the highlighted rows.');
    }
    if (needConfirm.length) setConfirm({ ids: needConfirm, missing });
  };

  if (sessionsQuery.isLoading) return <LoadingState rows={4} columns={4} />;
  if (sessionsQuery.isError) {
    return (
      <ErrorState
        title="Couldn't load class sessions"
        message={parseApiError(sessionsQuery.error).message}
        onRetry={() => void sessionsQuery.refetch()}
      />
    );
  }

  return (
    <section className="overflow-hidden rounded-lg bg-surface-default shadow">
      <header className="flex flex-col gap-1 border-b border-border-subtle px-5 py-4">
        <h3 className="text-subheading text-text-primary">
          {studentName ? `${studentName} — ` : ''}classes on {formatDateLabel(date)}
        </h3>
        <p className="text-caption text-text-muted">
          One row per class session of the cohort. Sessions without a record show “Not marked”.
        </p>
      </header>

      {sessions.length === 0 ? (
        <EmptyState
          icon={<BookOpen24Regular aria-hidden />}
          title="No class sessions on this date"
          description="The cohort has no sessions that day — weekly off, holiday, exam day, outside the active term, or nothing on the timetable."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-surface-subtle">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Subject</TableHead>
                  <TableHead className="w-[140px] px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Session</TableHead>
                  <TableHead className="w-[180px] px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Recorded</TableHead>
                  <TableHead className="w-[320px] px-4 text-caption-strong normal-case tracking-normal text-text-secondary">Mark</TableHead>
                  <TableHead className="w-[52px] px-2"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const { session, entry } = row;
                  const cancelled = session.status === 'cancelled';
                  const edited = entry && edits[session.id] !== undefined && edits[session.id] !== entry.status;
                  const err = rowErrors[session.id] ?? row.error;
                  return (
                    <TableRow
                      key={session.id}
                      className={`border-b border-border-subtle ${
                        rowErrors[session.id]
                          ? 'bg-status-error-subtle hover:bg-status-error-subtle'
                          : edited
                            ? 'bg-brand-subtle hover:bg-brand-subtle'
                            : 'hover:bg-surface-hover'
                      }`}
                    >
                      <TableCell className="px-4 py-2">
                        <p className="text-body-strong text-text-primary">{session.subject_name ?? `Subject #${session.subject_id}`}</p>
                        <p className="font-mono text-caption text-text-muted">{session.subject_code}</p>
                        {cancelled && session.cancellation_reason && (
                          <p className="text-caption text-text-muted">Reason: {session.cancellation_reason}</p>
                        )}
                        {err && (
                          <p className="mt-0.5 flex items-center gap-1 text-caption text-status-error" role="alert">
                            <ErrorCircle16Regular className="size-3.5 shrink-0" aria-hidden />
                            {err}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        <p className="text-body tabular-nums text-text-primary">{formatTimeRange(session.start_time, session.end_time)}</p>
                        <SessionStatusBadge session={session} />
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        {row.loading ? (
                          <span className="text-caption text-text-muted">Loading…</span>
                        ) : entry ? (
                          <div className="flex flex-col items-start gap-0.5">
                            <RecordStatusBadge status={entry.status} />
                            {entry.source && <span className="text-caption text-text-muted">{sourceLabel(entry.source)}</span>}
                            {entry.excluded_from_metrics && <Badge variant="secondary">Excluded from metrics</Badge>}
                          </div>
                        ) : (
                          <span className="text-caption text-text-muted">Not on this session's roster</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        {entry && (
                          <StatusSegmentedControl
                            value={edits[session.id] ?? entry.status}
                            onChange={(st) => setStatus(row, st)}
                            disabled={cancelled || saving}
                            label={`Attendance for ${session.subject_name ?? 'session'}`}
                          />
                        )}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-right">
                        {entry?.record_id !== null && entry?.record_id !== undefined && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label="Record actions">
                                <MoreHorizontal20Regular aria-hidden />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setAuditFor(entry.record_id as number)}>
                                <History16Regular className="mr-2" aria-hidden />
                                View history
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() =>
                                  setExclusionFor({ recordId: entry.record_id as number, excluded: entry.excluded_from_metrics })
                                }
                              >
                                <DataUsage16Regular className="mr-2" aria-hidden />
                                {entry.excluded_from_metrics ? 'Include in metrics' : 'Exclude from metrics'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 border-t border-border-subtle bg-surface-subtle px-5 py-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="student-day-reason" className="text-body-strong text-text-primary">
                Reason <span className="font-normal text-text-muted">(applied to changes that need one)</span>
              </label>
              <Input
                id="student-day-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Medical certificate submitted"
                className="bg-surface-default"
              />
            </div>
            {formError && (
              <MessageBar tone="error" role="alert" icon={<ErrorCircle16Regular />}>
                {formError}
              </MessageBar>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-caption text-text-muted tabular-nums">
                {changed.length
                  ? `${changed.length} session${changed.length === 1 ? '' : 's'} changed — only this student's record is written in each.`
                  : 'No changes yet.'}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEdits({})} disabled={saving || !changed.length}>
                  Reset
                </Button>
                <Button onClick={() => void save()} disabled={saving || !changed.length}>
                  <Save16Regular aria-hidden />
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmHeldDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        sessionCount={confirm?.ids.length ?? 1}
        studentsWithoutRecord={confirm?.missing ?? null}
        onConfirm={() => {
          const ids = confirm?.ids ?? [];
          setConfirm(null);
          void save(ids);
        }}
      />
      <RecordAuditDialog
        open={auditFor !== null}
        onOpenChange={(open) => !open && setAuditFor(null)}
        recordId={auditFor}
        subject={studentName}
      />
      <MetricsExclusionDialog
        open={exclusionFor !== null}
        onOpenChange={(open) => !open && setExclusionFor(null)}
        recordId={exclusionFor?.recordId ?? null}
        excluded={exclusionFor?.excluded ?? false}
        subject={studentName}
        onDone={() => {
          invalidate();
          onChanged?.();
        }}
      />
    </section>
  );
};

export default StudentDayAttendance;
