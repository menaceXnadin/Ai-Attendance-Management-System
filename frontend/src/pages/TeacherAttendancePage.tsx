import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowSync20Regular,
  ArrowUndo16Regular,
  Book20Regular,
  CalendarCancel16Regular,
  CalendarLtr20Regular,
  CheckmarkCircle16Regular,
  CheckmarkCircle20Regular,
  ChevronDown16Regular,
  Clock16Regular,
  DismissCircle16Regular,
  DismissCircle20Regular,
  ErrorCircle16Regular,
  Info16Regular,
  LockClosed16Regular,
  People20Regular,
  Prohibited20Regular,
  Save20Regular,
  ScanPerson16Regular,
  Warning16Regular,
  Warning20Regular,
} from '@fluentui/react-icons';
import { useToast } from '@/hooks/use-toast';
import TeacherSidebar from '@/components/TeacherSidebar';
import SessionCancelDialog, { type SessionCancelMode } from '@/components/SessionCancelDialog';
import FaceAttemptsPanel from '@/components/face-admin/FaceAttemptsPanel';
import { PresenceCodeButton } from '@/components/face-admin/PresenceCodeDialog';
import {
  api,
  getErrorDetailField,
  parseApiError,
  type ApiEntryError,
  type RecordStatus,
  type TeacherRosterSession,
  type TeacherRosterStudent,
} from '@/integrations/api/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { localDateString, parseLocalDate } from '@/utils/metricsDisplay';

/** Server `edit_block_reason` codes → sentences for the read-only banner. */
const EDIT_BLOCK_MESSAGES: Record<string, string> = {
  no_session: 'There is no class session for this subject on the selected date.',
  session_cancelled: 'This class was cancelled. Restore it before recording attendance.',
  session_not_started: 'This class has not started yet. Attendance opens shortly before the start time.',
  edit_window_closed: 'The teacher edit window for this class has closed. Ask an administrator to make corrections.',
};

interface Subject {
  id: number;
  name: string;
  code: string;
  semesters: number[];
}

type MarkableStatus = Extract<RecordStatus, 'present' | 'late' | 'absent'>;
type Draft = Record<number, RecordStatus | null>;

/** Segmented status control options (Teams meeting attendance style). Excused is admin-only (§13.8). */
const STATUS_OPTIONS: ReadonlyArray<{
  value: MarkableStatus;
  label: string;
  title: string;
  icon: typeof CheckmarkCircle16Regular;
  selected: string;
}> = [
  {
    value: 'present',
    label: 'Present',
    title: 'Mark Present',
    icon: CheckmarkCircle16Regular,
    selected: 'bg-status-success-subtle text-status-success ring-1 ring-inset ring-status-success-border',
  },
  {
    value: 'late',
    label: 'Late',
    title: 'Mark Late',
    icon: Clock16Regular,
    selected: 'bg-status-warning-subtle text-status-warning ring-1 ring-inset ring-status-warning-border',
  },
  {
    value: 'absent',
    label: 'Absent',
    title: 'Mark Absent',
    icon: DismissCircle16Regular,
    selected: 'bg-status-error-subtle text-status-error ring-1 ring-inset ring-status-error-border',
  },
];

const VALID_STATUSES: ReadonlySet<string> = new Set(['present', 'late', 'absent', 'excused']);

/** Server status → draft status. Anything that is not a real record (legacy `no_data`, `system_inactive`, null) is "not marked". */
const toRecordStatus = (s: unknown): RecordStatus | null => {
  const v = typeof s === 'string' ? s.toLowerCase() : '';
  return VALID_STATUSES.has(v) ? (v as RecordStatus) : null;
};

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

const formatStatus = (status: string) =>
  (status.charAt(0).toUpperCase() + status.slice(1)).replace(/_/g, ' ');

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');

const getStatusBadgeColor = (status: RecordStatus | null) => {
  switch (status) {
    case 'present':
      return 'bg-status-success-subtle text-status-success border-status-success-border';
    case 'late':
      return 'bg-status-warning-subtle text-status-warning border-status-warning-border';
    case 'absent':
      return 'bg-status-error-subtle text-status-error border-status-error-border';
    case 'excused':
      return 'bg-status-info-subtle text-status-info border-status-info-border';
    default:
      return 'bg-surface-subtle text-text-muted border-border-subtle';
  }
};

const SESSION_STATUS_META: Record<string, { label: string; variant: 'info' | 'success' | 'destructive' | 'secondary' }> = {
  scheduled: { label: 'Not taken yet', variant: 'info' },
  held: { label: 'Held', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

const describeEntryError = (e: ApiEntryError) => e.message || formatStatus(e.code || 'invalid');

const TeacherAttendancePage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = localDateString();

  // Selection
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [semesterFilter, setSemesterFilter] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  // Register editing
  const [draft, setDraft] = useState<Draft>({});
  const [batchReason, setBatchReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [serverNeedsReason, setServerNeedsReason] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  // Dialogs
  const [confirmHeld, setConfirmHeld] = useState<{ open: boolean; withoutRecord: number | null }>({
    open: false,
    withoutRecord: null,
  });
  const [markRemainingAbsent, setMarkRemainingAbsent] = useState(true);
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; mode: SessionCancelMode }>({
    open: false,
    mode: 'cancel',
  });
  const [cancelBusy, setCancelBusy] = useState(false);

  // Teacher's subjects (from dashboard)
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: () => api.teacher.getDashboard(),
  });

  const allSubjects = (dashboardData?.subjects || []) as Subject[];
  const filteredSubjects = semesterFilter
    ? allSubjects.filter((s) => s.semesters.includes(semesterFilter))
    : allSubjects;
  const allSemesters = Array.from(new Set(allSubjects.flatMap((s) => s.semesters))).sort((a, b) => a - b);

  const selectedSubjectData = selectedSubject ? allSubjects.find((s) => s.id === selectedSubject) : null;
  const semesterForFetch = selectedSubjectData?.semesters[0] || null;

  // Register for subject/date (+ chosen session slot)
  const {
    data: attendanceData,
    isLoading: studentsLoading,
    isFetching: studentsFetching,
    refetch: refetchStudents,
  } = useQuery({
    queryKey: ['teacher-subject-attendance', selectedSubject, semesterForFetch, selectedDate, selectedSessionId],
    queryFn: async () => {
      if (!selectedSubject || !semesterForFetch) return null;
      return api.teacher.getSubjectStudentsWithAttendance(
        selectedSubject,
        semesterForFetch,
        selectedDate,
        selectedSessionId
      );
    },
    enabled: !!(selectedSubject && semesterForFetch),
  });

  const students: TeacherRosterStudent[] = useMemo(() => attendanceData?.students ?? [], [attendanceData]);
  const session: TeacherRosterSession | null = attendanceData?.session ?? null;
  const sessionSlots: TeacherRosterSession[] = attendanceData?.sessions ?? [];
  const activeSessionId = session?.id ?? selectedSessionId ?? null;
  const isCancelled = session ? session.status === 'cancelled' : !!attendanceData?.is_cancelled;
  const cancellationReason = session?.cancellation_reason ?? attendanceData?.cancellation_reason ?? null;
  const isPastSession = selectedDate < today;
  // Presence codes and live attempt refresh only apply to today's class (server answers 409 not_today otherwise).
  const isSessionToday = (session?.session_date?.slice(0, 10) ?? selectedDate) === today;
  // Server says whether edits will be accepted (future class, outside edit window, ...)
  const canEdit = attendanceData?.can_edit !== false && !isCancelled;
  const editBlockCode = attendanceData?.edit_block_reason ?? null;
  const editBlockReason = editBlockCode ? EDIT_BLOCK_MESSAGES[editBlockCode] ?? editBlockCode.replace(/_/g, ' ') : null;

  // Server truth per student
  const original = useMemo(() => {
    const map: Record<number, { status: RecordStatus | null; source: TeacherRosterStudent['source'] }> = {};
    students.forEach((s) => {
      map[s.id] = { status: toRecordStatus(s.attendance_status), source: s.source ?? null };
    });
    return map;
  }, [students]);

  // Reset when the selection changes
  useEffect(() => {
    setSelectedSubject(null);
  }, [semesterFilter]);

  useEffect(() => {
    setSelectedSessionId(null);
  }, [selectedSubject, selectedDate]);

  useEffect(() => {
    const initial: Draft = {};
    students.forEach((s) => {
      initial[s.id] = toRecordStatus(s.attendance_status);
    });
    setDraft(initial);
    setRowErrors({});
    setBatchReason('');
    setReasonError(null);
    setServerNeedsReason(false);
  }, [students]);

  // Only rows the teacher actually changed are sent (§13.8)
  const changedRows = useMemo(
    () =>
      students
        .filter((s) => {
          const next = draft[s.id] ?? null;
          return next !== null && next !== (original[s.id]?.status ?? null);
        })
        .map((s) => ({ student_id: s.id, status: draft[s.id] as RecordStatus })),
    [students, draft, original]
  );

  const faceOverrides = changedRows.filter(
    (r) => original[r.student_id]?.source === 'student_face' && original[r.student_id]?.status !== null
  );
  const reasonRequired = faceOverrides.length > 0 || serverNeedsReason;
  const showReasonField = reasonRequired || (isPastSession && changedRows.length > 0);

  const handleAttendanceChange = (studentId: number, status: MarkableStatus) => {
    setDraft((prev) => ({ ...prev, [studentId]: status }));
    setRowErrors((prev) => {
      if (!(studentId in prev)) return prev;
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
  };

  const fillUnmarked = (status: MarkableStatus) => {
    setDraft((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        if ((next[s.id] ?? null) === null) next[s.id] = status;
      });
      return next;
    });
  };

  const resetChanges = () => {
    const initial: Draft = {};
    students.forEach((s) => {
      initial[s.id] = original[s.id]?.status ?? null;
    });
    setDraft(initial);
    setRowErrors({});
    setReasonError(null);
  };

  const submitRegister = async (opts: { confirm_held?: boolean; mark_remaining_absent?: boolean } = {}) => {
    if (!selectedSubject || !semesterForFetch) return;
    if (changedRows.length === 0 && !opts.mark_remaining_absent && !opts.confirm_held) {
      toast({ title: 'Nothing to save', description: 'Change at least one student before saving.' });
      return;
    }
    const reason = batchReason.trim();
    if (reasonRequired && !reason) {
      setReasonError(
        faceOverrides.length > 0
          ? 'A reason is required when changing a face-verified check-in.'
          : 'A reason is required for some of these changes.'
      );
      return;
    }

    const facultyId = students[0]?.faculty_id || dashboardData?.teacher?.faculty_id || 0;
    setSaving(true);
    setRowErrors({});
    setReasonError(null);
    try {
      const result = await api.teacher.bulkMarkAttendance({
        subject_id: selectedSubject,
        semester: semesterForFetch,
        faculty_id: facultyId,
        date: selectedDate,
        session_id: activeSessionId ?? undefined,
        attendance_records: changedRows,
        reason: reason || undefined,
        confirm_held: opts.confirm_held || undefined,
        mark_remaining_absent: opts.mark_remaining_absent || undefined,
      });
      const rows = Array.isArray(result?.results) ? result.results : [];
      const created = rows.filter((r) => r.outcome === 'created').length;
      const updated = rows.filter((r) => r.outcome === 'updated').length;
      toast({
        title: 'Attendance saved',
        description: rows.length
          ? `${created} recorded, ${updated} updated${opts.mark_remaining_absent ? ', remaining students marked absent' : ''}.`
          : result?.message || 'The register was submitted.',
      });
      setConfirmHeld({ open: false, withoutRecord: null });
      await refetchStudents();
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-attendance'] });
    } catch (err) {
      const info = parseApiError(err);
      if (info.status === 400 && info.code === 'invalid_entries') {
        const map: Record<number, string> = {};
        let needsReason = false;
        (info.errors ?? []).forEach((e) => {
          if (typeof e.student_id === 'number') map[e.student_id] = describeEntryError(e);
          if (/reason/i.test(e.code || '')) needsReason = true;
        });
        setRowErrors(map);
        if (needsReason) {
          setServerNeedsReason(true);
          setReasonError('Add a reason for the highlighted changes, then save again.');
        }
        toast({
          title: 'Some rows need attention',
          description: `${Object.keys(map).length || 'Some'} entr${Object.keys(map).length === 1 ? 'y was' : 'ies were'} rejected. Nothing was saved.`,
          variant: 'destructive',
        });
      } else if (info.status === 409 && info.code === 'confirm_held') {
        const n = getErrorDetailField<number>(info, 'students_without_record');
        setMarkRemainingAbsent(true);
        setConfirmHeld({ open: true, withoutRecord: typeof n === 'number' ? n : null });
      } else if (info.status === 409 && info.code === 'session_cancelled') {
        toast({
          title: 'Class is cancelled',
          description: 'This session was cancelled. Restore it before taking attendance.',
          variant: 'destructive',
        });
        void refetchStudents();
      } else if (info.code === 'ambiguous_session' || info.code === 'session_not_found') {
        toast({
          title: info.code === 'ambiguous_session' ? 'Choose a session' : 'Session not found',
          description:
            info.code === 'ambiguous_session'
              ? 'This subject has more than one class that day. Pick the session above, then save again.'
              : 'No class session exists for this subject on that date.',
          variant: 'destructive',
        });
        void refetchStudents();
      } else {
        toast({ title: 'Could not save attendance', description: info.message, variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancelConfirm = async ({ reason, notifyStudents }: { reason: string; notifyStudents: boolean }) => {
    if (!activeSessionId) return;
    setCancelBusy(true);
    try {
      if (cancelDialog.mode === 'cancel') {
        await api.teacher.cancelClass({
          session_id: activeSessionId,
          date: selectedDate,
          reason,
          notify_students: notifyStudents,
        });
        toast({ title: 'Class cancelled', description: 'The session is excluded from attendance metrics.' });
      } else {
        await api.teacher.uncancelClass({ session_id: activeSessionId, reason });
        toast({ title: 'Class restored', description: 'You can take attendance for this session again.' });
      }
      setCancelDialog((d) => ({ ...d, open: false }));
      await refetchStudents();
      queryClient.invalidateQueries({ queryKey: ['teacher-dashboard'] });
    } catch (err) {
      toast({
        title: cancelDialog.mode === 'cancel' ? 'Could not cancel class' : 'Could not restore class',
        description: parseApiError(err).message,
        variant: 'destructive',
      });
    } finally {
      setCancelBusy(false);
    }
  };

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, excused: 0, unmarked: 0 };
    students.forEach((s) => {
      const st = draft[s.id] ?? null;
      if (st === null) c.unmarked += 1;
      else c[st] += 1;
    });
    return c;
  }, [students, draft]);

  const showRoster = !!selectedSubject && !isCancelled;
  const readOnly = !canEdit;
  const selectedDateObj = parseLocalDate(selectedDate);
  const sessionLabel = selectedSubjectData
    ? `${selectedSubjectData.name}${session ? ` · ${hhmm(session.start_time)}–${hhmm(session.end_time)}` : ''}, ${format(selectedDateObj, 'EEE MMM d')}`
    : '';
  const sessionMeta = session ? SESSION_STATUS_META[session.status] ?? SESSION_STATUS_META.scheduled : null;

  return (
    <TeacherSidebar>
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Header */}
        <div className="page-header !mb-2">
          <div>
            <h1 className="text-page-title text-text-primary">Mark Attendance</h1>
            <p className="mt-1 text-body text-text-muted">
              Record attendance for students in your assigned subjects
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-default px-3 py-1.5">
            <CalendarLtr20Regular className="text-brand-foreground" aria-hidden />
            <div>
              <p className="text-caption text-text-muted">Selected Date</p>
              <p className="text-body-strong text-text-primary">{format(selectedDateObj, 'EEEE, MMMM d, yyyy')}</p>
            </div>
          </div>
        </div>

        {/* Selection toolbar */}
        <section className="rounded-lg bg-surface-default shadow">
          <div className="flex items-start gap-3 border-b border-border-subtle px-5 py-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
              <Book20Regular aria-hidden />
            </div>
            <div>
              <h2 className="text-subheading text-text-primary">Select Subject & Date</h2>
              <p className="text-caption text-text-muted">
                Choose a date, optionally filter by semester, then select the subject to mark attendance
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
            {/* Date Selection */}
            <div className="space-y-1.5">
              <label className="text-body-strong text-text-primary">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    <span className="flex items-center gap-2">
                      <CalendarLtr20Regular className="text-text-muted" aria-hidden />
                      <span>{format(selectedDateObj, 'MMMM dd, yyyy')}</span>
                    </span>
                    <ChevronDown16Regular className="text-text-muted" aria-hidden />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDateObj}
                    onSelect={(date) => {
                      if (date) setSelectedDate(localDateString(date));
                    }}
                    disabled={{ after: new Date() }}
                    showOutsideDays={false}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Semester Filter (Optional) */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-body-strong text-text-primary">
                Filter by Semester <span className="text-caption font-normal text-text-muted">(Optional)</span>
              </label>
              <Select
                value={semesterFilter === null ? 'all' : semesterFilter.toString()}
                onValueChange={(value) => setSemesterFilter(value === 'all' ? null : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Semesters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Semesters</SelectItem>
                  {allSemesters.map((semester: number) => (
                    <SelectItem key={semester} value={semester.toString()}>
                      Semester {semester}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject Selection */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-body-strong text-text-primary">
                Subject
                {filteredSubjects.length > 0 && (
                  <Badge variant="secondary" shape="pill" className="px-1.5 py-0 text-overline">
                    {filteredSubjects.length}
                  </Badge>
                )}
              </label>
              <Select
                value={selectedSubject?.toString() || ''}
                onValueChange={(value) => setSelectedSubject(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Subject" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {dashboardLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading subjects...
                    </SelectItem>
                  ) : filteredSubjects.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No subjects available
                    </SelectItem>
                  ) : (
                    filteredSubjects.map((subject: Subject) => (
                      <SelectItem key={subject.id} value={subject.id.toString()}>
                        {/* Mirrored into the trigger by SelectValue: the name truncates so the row never wraps. */}
                        <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                          <span className="min-w-0 truncate font-semibold">{subject.name}</span>
                          <span className="shrink-0 text-text-muted">({subject.code})</span>
                          <span className="shrink-0 text-caption text-text-muted">Sem {subject.semesters.join(', ')}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selected subject + session status */}
          {selectedSubjectData && (
            <div className="space-y-3 rounded-b-lg border-t border-border-subtle bg-surface-subtle px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-caption text-text-muted">Selected Subject</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-body-strong text-text-primary">{selectedSubjectData.name}</p>
                    <Badge variant="outline" className="font-mono">{selectedSubjectData.code}</Badge>
                    <span className="text-caption text-text-muted">Semester {semesterForFetch}</span>
                    {session && (
                      <>
                        <span className="text-caption tabular-nums text-text-secondary">
                          {hhmm(session.start_time)}–{hhmm(session.end_time)}
                        </span>
                        {sessionMeta && (
                          <Badge variant={sessionMeta.variant} shape="pill">
                            {sessionMeta.label}
                          </Badge>
                        )}
                        {session.kind === 'makeup' && (
                          <Badge variant="brand" shape="pill">Make-up</Badge>
                        )}
                        {session.finalized_at && (
                          <Badge variant="secondary" shape="pill" className="gap-1" title="Students with no record were auto-marked absent">
                            <LockClosed16Regular aria-hidden />
                            Finalized
                          </Badge>
                        )}
                        {session.submitted_at && (
                          <span className="text-caption text-text-muted">
                            Submitted {format(new Date(session.submitted_at), 'MMM d, HH:mm')}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  {session && !isCancelled && isSessionToday && (
                    <PresenceCodeButton sessionId={session.id} sessionLabel={sessionLabel} />
                  )}
                  {session && (
                    isCancelled ? (
                      <Button size="sm" variant="outline" onClick={() => setCancelDialog({ open: true, mode: 'uncancel' })}>
                        <ArrowUndo16Regular aria-hidden />
                        Restore class
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setCancelDialog({ open: true, mode: 'cancel' })}>
                        <CalendarCancel16Regular aria-hidden />
                        Cancel class
                      </Button>
                    )
                  )}
                  <div className="flex items-center gap-2 text-text-secondary">
                    <People20Regular className="text-brand-foreground" aria-hidden />
                    <span className="text-subheading tabular-nums text-text-primary">{students.length}</span>
                  </div>
                </div>
              </div>

              {/* Session picker when the subject has several slots that day */}
              {sessionSlots.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-caption-strong text-text-secondary">Session</span>
                  <div role="radiogroup" aria-label="Choose class session" className="inline-flex flex-wrap gap-1">
                    {sessionSlots.map((slot) => {
                      const selected = slot.id === activeSessionId;
                      const meta = SESSION_STATUS_META[slot.status] ?? SESSION_STATUS_META.scheduled;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setSelectedSessionId(slot.id)}
                          className={cn(
                            'inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-caption-strong tabular-nums transition-colors duration-150 ease-fluent-standard',
                            selected
                              ? 'border-brand-stroke bg-brand-subtle text-brand-foreground'
                              : 'border-border-default bg-surface-default text-text-secondary hover:bg-surface-hover'
                          )}
                        >
                          {hhmm(slot.start_time)}–{hhmm(slot.end_time)}
                          <span className="font-normal text-text-muted">· {meta.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Cancellation message bar */}
        {selectedSubject && isCancelled && (
          <div className="flex items-start gap-3 rounded-md border border-status-error-border bg-status-error-subtle px-4 py-3" role="alert">
            <Prohibited20Regular className="mt-0.5 shrink-0 text-status-error" aria-hidden />
            <div className="flex-1 space-y-2">
              <div>
                <h3 className="text-body-strong text-text-primary">Class Cancelled</h3>
                <p className="text-body text-text-primary">
                  This class was cancelled for <span className="font-semibold">{format(selectedDateObj, 'MMMM d, yyyy')}</span>.
                  {' '}Attendance cannot be marked for cancelled classes{session ? ' — restore it first if it was actually held' : ''}.
                </p>
              </div>
              {cancellationReason && (
                <div className="flex items-start gap-2 rounded-md border border-border-subtle bg-surface-default px-3 py-2 text-body text-text-primary">
                  <Warning16Regular className="mt-0.5 shrink-0 text-status-warning" aria-hidden />
                  <div>
                    <span className="font-semibold">Reason:</span> {cancellationReason}
                  </div>
                </div>
              )}
            </div>
            {session && (
              <Button size="sm" variant="outline" onClick={() => setCancelDialog({ open: true, mode: 'uncancel' })}>
                <ArrowUndo16Regular aria-hidden />
                Restore
              </Button>
            )}
          </div>
        )}

        {/* Read-only register (server-provided reason) */}
        {showRoster && readOnly && attendanceData && (
          <div className="flex items-start gap-3 rounded-md border border-status-info-border bg-status-info-subtle px-4 py-3" role="status">
            <LockClosed16Regular className="mt-0.5 shrink-0 text-status-info" aria-hidden />
            <div>
              <p className="text-body-strong text-text-primary">This register is read-only</p>
              <p className="text-body text-text-secondary">
                {editBlockReason || 'Attendance for this session cannot be changed right now.'}
              </p>
            </div>
          </div>
        )}

        {/* Unrecorded past session hint */}
        {showRoster && !readOnly && session?.status === 'scheduled' && isPastSession && (
          <div className="flex items-start gap-3 rounded-md border border-status-warning-border bg-status-warning-subtle px-4 py-3" role="status">
            <Warning20Regular className="mt-0.5 shrink-0 text-status-warning" aria-hidden />
            <div>
              <p className="text-body-strong text-text-primary">No attendance was recorded for this class</p>
              <p className="text-body text-text-secondary">
                If the class was held, mark the students and save. If it did not take place, cancel it with a reason so it is not counted.
              </p>
            </div>
          </div>
        )}

        {/* Face check-in attempts for the selected session */}
        {showRoster && session && (
          <FaceAttemptsPanel key={session.id} sessionId={session.id} isToday={isSessionToday} />
        )}

        {/* Roster */}
        {showRoster && (
          <section className="rounded-lg bg-surface-default shadow">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
                  <People20Regular aria-hidden />
                </div>
                <div>
                  <h2 className="flex items-center gap-2 text-subheading text-text-primary">
                    Student Attendance
                    {students.length > 0 && (
                      <Badge variant="secondary" shape="pill">
                        {students.length} {students.length === 1 ? 'student' : 'students'}
                      </Badge>
                    )}
                    {studentsFetching && !studentsLoading && (
                      <ArrowSync20Regular className="h-4 w-4 animate-spin text-text-muted" aria-label="Refreshing" />
                    )}
                  </h2>
                  {selectedSubjectData && (
                    <p className="text-caption text-text-muted">
                      {selectedSubjectData.name} · {format(selectedDateObj, 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => fillUnmarked('present')} variant="outline" size="sm" disabled={readOnly || counts.unmarked === 0}>
                  <CheckmarkCircle20Regular className="text-status-success" aria-hidden />
                  Mark unmarked present
                </Button>
                <Button onClick={() => fillUnmarked('absent')} variant="outline" size="sm" disabled={readOnly || counts.unmarked === 0}>
                  <DismissCircle20Regular className="text-status-error" aria-hidden />
                  Mark unmarked absent
                </Button>
                {changedRows.length > 0 && (
                  <Button onClick={resetChanges} variant="ghost" size="sm">
                    <ArrowUndo16Regular aria-hidden />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {studentsLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <ArrowSync20Regular className="h-8 w-8 animate-spin text-brand-foreground" aria-hidden />
                <p className="mt-3 text-body text-text-muted">Loading students...</p>
              </div>
            ) : students.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="normal-case tracking-normal text-caption-strong text-text-secondary">Name</TableHead>
                    <TableHead className="normal-case tracking-normal text-caption-strong text-text-secondary">Student ID</TableHead>
                    <TableHead className="hidden normal-case tracking-normal text-caption-strong text-text-secondary lg:table-cell">Email</TableHead>
                    <TableHead className="normal-case tracking-normal text-caption-strong text-text-secondary">Status</TableHead>
                    <TableHead className="text-right normal-case tracking-normal text-caption-strong text-text-secondary">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => {
                    const status = draft[student.id] ?? null;
                    const orig = original[student.id];
                    const changed = status !== null && status !== (orig?.status ?? null);
                    const rowError = rowErrors[student.id];
                    const isFace = orig?.source === 'student_face' && orig.status !== null;
                    const isAuto = orig?.source === 'system_auto';
                    const notEnrolled = student.enrolled === false;
                    const rowLocked = readOnly || notEnrolled;
                    return (
                      <TableRow
                        key={student.id}
                        className={cn('hover:bg-surface-hover', rowError && 'bg-status-error-subtle hover:bg-status-error-subtle')}
                      >
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-3">
                            <div
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-subtle text-caption-strong text-brand-foreground"
                              aria-hidden
                            >
                              {getInitials(student.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-body-strong text-text-primary">{student.name}</p>
                              <p className="truncate text-caption text-text-muted lg:hidden">{student.email}</p>
                              {rowError && (
                                <p className="mt-0.5 flex items-center gap-1 text-caption text-status-error" role="alert">
                                  <ErrorCircle16Regular className="shrink-0" aria-hidden />
                                  {rowError}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 font-mono text-body text-text-secondary">{student.student_id}</TableCell>
                        <TableCell className="hidden py-2.5 text-body text-text-muted lg:table-cell">{student.email}</TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" shape="pill" className={cn('gap-1', getStatusBadgeColor(status))}>
                              {status === 'present' && <CheckmarkCircle16Regular aria-hidden />}
                              {status === 'absent' && <DismissCircle16Regular aria-hidden />}
                              {status === 'late' && <Clock16Regular aria-hidden />}
                              {status ? formatStatus(status) : 'Not marked'}
                            </Badge>
                            {isFace && (
                              <span className="inline-flex items-center gap-0.5 text-caption text-text-muted" title="Checked in with face verification">
                                <ScanPerson16Regular aria-hidden />
                                Face
                              </span>
                            )}
                            {isAuto && !changed && (
                              <span className="text-caption text-text-muted" title="Auto-marked absent after the class ended">Auto</span>
                            )}
                            {notEnrolled && (
                              <span className="text-caption text-text-muted" title="Not enrolled in this class on this date">Not enrolled</span>
                            )}
                            {changed && (
                              <span className="text-caption text-brand-foreground" title={`Was: ${orig?.status ? formatStatus(orig.status) : 'Not marked'}`}>
                                Changed
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <div
                            role="radiogroup"
                            aria-label={`Attendance for ${student.name}`}
                            aria-disabled={rowLocked}
                            className={cn(
                              'inline-flex items-center gap-0.5 rounded-md border border-border-default bg-surface-default p-0.5',
                              rowLocked && 'opacity-60'
                            )}
                          >
                            {STATUS_OPTIONS.map(({ value, label, title, icon: Icon, selected }) => {
                              const isSelected = status === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  role="radio"
                                  aria-checked={isSelected}
                                  title={title}
                                  disabled={rowLocked}
                                  onClick={() => {
                                    if (!isSelected && !rowLocked) handleAttendanceChange(student.id, value);
                                  }}
                                  className={cn(
                                    'inline-flex h-7 items-center gap-1 rounded px-2 text-caption-strong transition-colors duration-150 ease-fluent-standard disabled:cursor-not-allowed',
                                    isSelected ? selected : 'text-text-secondary enabled:hover:bg-surface-hover enabled:hover:text-text-primary'
                                  )}
                                >
                                  <Icon aria-hidden />
                                  <span className="hidden sm:inline">{label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                  <People20Regular className="h-6 w-6" aria-hidden />
                </div>
                <p className="text-subheading text-text-primary">No students found</p>
                <p className="mt-1 text-body text-text-muted">
                  No students are enrolled in this subject for the selected semester.
                </p>
              </div>
            )}

            {/* Batch reason */}
            {students.length > 0 && showReasonField && (
              <div className="space-y-1.5 border-t border-border-subtle px-5 py-3">
                <Label htmlFor="batch-reason" className="text-body-strong text-text-primary">
                  Reason for changes{' '}
                  {reasonRequired ? (
                    <span className="text-status-error" aria-hidden>*</span>
                  ) : (
                    <span className="text-caption font-normal text-text-muted">(optional)</span>
                  )}
                </Label>
                <Textarea
                  id="batch-reason"
                  rows={2}
                  value={batchReason}
                  onChange={(e) => {
                    setBatchReason(e.target.value);
                    if (reasonError) setReasonError(null);
                  }}
                  placeholder={
                    faceOverrides.length > 0
                      ? 'Why are you changing a face-verified check-in?'
                      : 'e.g. Correcting the register after class'
                  }
                  aria-invalid={!!reasonError}
                  aria-describedby="batch-reason-hint"
                />
                <p
                  id="batch-reason-hint"
                  className={cn('flex items-start gap-1 text-caption', reasonError ? 'text-status-error' : 'text-text-muted')}
                >
                  {reasonError ? <ErrorCircle16Regular className="mt-0.5 shrink-0" aria-hidden /> : <Info16Regular className="mt-0.5 shrink-0" aria-hidden />}
                  {reasonError ||
                    (faceOverrides.length > 0
                      ? `${faceOverrides.length} change${faceOverrides.length === 1 ? '' : 's'} override a face-verified check-in. The reason is saved in the audit log.`
                      : 'You are editing a past session. The reason is saved in the audit log.')}
                </p>
              </div>
            )}

            {/* Sticky summary footer */}
            {students.length > 0 && (
              <div className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-b-lg border-t border-border-subtle bg-surface-default px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-body text-text-secondary">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-status-success" aria-hidden />
                    Present: <span className="font-semibold tabular-nums text-text-primary">{counts.present}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-status-error" aria-hidden />
                    Absent: <span className="font-semibold tabular-nums text-text-primary">{counts.absent}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-status-warning" aria-hidden />
                    Late: <span className="font-semibold tabular-nums text-text-primary">{counts.late}</span>
                  </span>
                  {counts.excused > 0 && (
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-status-info" aria-hidden />
                      Excused: <span className="font-semibold tabular-nums text-text-primary">{counts.excused}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-2 text-text-muted">
                    <span className="h-2.5 w-2.5 rounded-full border border-border-strong" aria-hidden />
                    Not marked: <span className="font-semibold tabular-nums">{counts.unmarked}</span>
                  </span>
                </div>
                <Button onClick={() => void submitRegister()} disabled={readOnly || saving || changedRows.length === 0}>
                  {saving ? <ArrowSync20Regular className="animate-spin" aria-hidden /> : <Save20Regular aria-hidden />}
                  {changedRows.length > 0
                    ? `Save ${changedRows.length} change${changedRows.length === 1 ? '' : 's'}`
                    : 'No changes'}
                </Button>
              </div>
            )}
          </section>
        )}

        {/* Instructions */}
        {!selectedSubject && (
          <section className="rounded-lg bg-surface-default px-6 py-12 text-center shadow">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand-subtle text-brand-foreground">
              <Book20Regular className="h-6 w-6" aria-hidden />
            </div>
            <h3 className="text-section-title text-text-primary">Welcome to Attendance Management</h3>
            <p className="mx-auto mt-1 max-w-2xl text-body text-text-muted">
              Select a subject and date to view and mark attendance for your students. Follow the steps below to get started.
            </p>
            <ol className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
              {[
                { title: 'Pick a Date', hint: 'Select the date for attendance' },
                { title: 'Filter Semester', hint: 'Optional step' },
                { title: 'Choose Subject', hint: 'Select from your subjects' },
                { title: 'Mark & Save', hint: 'Only changed rows are saved' },
              ].map((step, i) => (
                <li key={step.title} className="flex items-start gap-3 rounded-md border border-border-subtle bg-surface-subtle p-3">
                  <span
                    className={cn(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-full text-caption-strong tabular-nums',
                      i === 2 ? 'bg-brand text-brand-on' : 'bg-surface-default text-text-secondary ring-1 ring-inset ring-border-default'
                    )}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-body-strong text-text-primary">{step.title}</p>
                    <p className="text-caption text-text-muted">{step.hint}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Confirm-held dialog (409 confirm_held) */}
        <AlertDialog
          open={confirmHeld.open}
          onOpenChange={(open) => !saving && setConfirmHeld((c) => ({ ...c, open }))}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm this class was held</AlertDialogTitle>
              <AlertDialogDescription>
                This class has no attendance yet — confirm it was held and mark remaining students absent?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex items-start gap-3 rounded-md border border-border-subtle bg-surface-subtle p-3">
              <Checkbox
                id="mark-remaining-absent"
                checked={markRemainingAbsent}
                onCheckedChange={(v) => setMarkRemainingAbsent(v === true)}
              />
              <div>
                <Label htmlFor="mark-remaining-absent" className="cursor-pointer text-body-strong text-text-primary">
                  Mark remaining students absent
                </Label>
                <p className="text-caption text-text-muted">
                  {confirmHeld.withoutRecord !== null
                    ? `${confirmHeld.withoutRecord} student${confirmHeld.withoutRecord === 1 ? '' : 's'} currently have no record.`
                    : 'Students without a record will be marked absent by you.'}
                </p>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Go back</AlertDialogCancel>
              <Button
                onClick={() => void submitRegister({ confirm_held: true, mark_remaining_absent: markRemainingAbsent })}
                disabled={saving}
              >
                {saving ? <ArrowSync20Regular className="animate-spin" aria-hidden /> : <CheckmarkCircle20Regular aria-hidden />}
                Confirm held
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <SessionCancelDialog
          open={cancelDialog.open}
          mode={cancelDialog.mode}
          sessionLabel={sessionLabel}
          busy={cancelBusy}
          onOpenChange={(open) => setCancelDialog((d) => ({ ...d, open }))}
          onConfirm={(input) => void handleCancelConfirm(input)}
        />
      </div>
    </TeacherSidebar>
  );
};

export default TeacherAttendancePage;
