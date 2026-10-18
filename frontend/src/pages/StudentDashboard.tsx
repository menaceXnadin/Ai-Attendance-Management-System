import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Camera20Regular,
  CalendarLtr20Regular,
  CalendarLtr24Regular,
  CheckmarkCircle16Filled,
  CheckmarkCircle20Regular,
  ChevronRight20Regular,
  ClipboardTaskListLtr20Regular,
  Clock16Regular,
  DismissCircle20Regular,
  LockClosed16Regular,
  Location16Regular,
  Pulse20Regular,
  ShieldCheckmark20Regular,
  Warning16Regular,
} from '@fluentui/react-icons';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { useQuery } from '@tanstack/react-query';
import { api, type RecordStatus, type StudentTodayClass } from '@/integrations/api/client';
import StudentSidebar from '@/components/StudentSidebar';
import TodayClassSchedule from '@/components/TodayClassSchedule';
import TermStateBanner from '@/components/TermStateBanner';
import { STUDENT_TODAY_QUERY_KEY } from '@/hooks/useTimeRestrictions';
import { useAttendancePolicy } from '@/hooks/useAttendancePolicy';
import { formatClock, isClassCancelled } from '@/utils/timeRestrictions';
import {
  formatPercent,
  localDateString,
  meetsMinimum,
  metricTone,
  parseLocalDate,
  readMetrics,
  resolveBand,
  TONE_CSS_VAR,
  TONE_TEXT,
  type MetricTone,
} from '@/utils/metricsDisplay';

/* ---------- Presentational helpers (Fluent 2) ---------- */

const ProgressRing: React.FC<{ value: number | null; tone: MetricTone }> = ({ value, tone }) => {
  const size = 56;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value === null || !Number.isFinite(value) ? 0 : Math.max(0, Math.min(100, value));
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 -rotate-90"
      role="img"
      aria-label={value === null ? 'No attendance data yet' : `${formatPercent(value)} attendance`}
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={TONE_CSS_VAR[tone]}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct / 100)}
        style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.1, 0.9, 0.2, 1)' }}
      />
    </svg>
  );
};

interface KpiTileProps {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  icon?: React.ReactNode;
  chipClassName?: string;
  aside?: React.ReactNode;
  footer?: React.ReactNode;
}

const KpiTile: React.FC<KpiTileProps> = ({ label, value, caption, icon, chipClassName, aside, footer }) => (
  <div className="flex flex-col gap-3 rounded-lg bg-surface-default p-4 shadow">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-caption text-text-muted">{label}</p>
        <p className="mt-1 truncate text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{value}</p>
        {caption && <p className="mt-0.5 truncate text-caption text-text-muted">{caption}</p>}
      </div>
      {aside ?? (
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${chipClassName ?? 'bg-brand-subtle text-brand-foreground'}`}>
          {icon}
        </div>
      )}
    </div>
    {footer}
  </div>
);

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const { data: policy } = useAttendancePolicy();

  // Fetch student data from backend
  const { data: studentData, isLoading: isLoadingStudent } = useQuery({
    queryKey: ['current-student', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      try {
        const students = await api.students.getAll();
        const found = students.find((s) => s.email === user.email);
        if (!found) {
          const foundInsensitive = students.find((s) => s.email?.toLowerCase() === user.email?.toLowerCase());
          return foundInsensitive || null;
        }
        return found;
      } catch (error) {
        console.error('Error fetching student data:', error);
        return null;
      }
    },
    enabled: !!user?.email,
  });

  // Fetch attendance summary (§13.12 metrics: percentage/has_data/eligible/band...)
  const { data: attendanceSummary, isLoading: isLoadingAttendance, isError: summaryFailed } = useQuery({
    queryKey: ['attendance-summary', user?.id],
    queryFn: () => api.studentAttendance.getSummary(),
    enabled: !!user?.id,
    retry: 1,
  });

  // Check if attendance has been marked today and get records
  const { data: todayAttendanceData, refetch: refetchTodayAttendance } = useQuery({
    queryKey: ['today-attendance-data', user?.id, studentData?.id],
    queryFn: async () => {
      if (!user?.id || !studentData?.id) return { hasAttendance: false, records: [] };
      try {
        const today = localDateString();
        const response = await api.attendance.getAll({
          studentId: studentData.id,
          date: today,
        });
        const records = response.records || [];
        return { hasAttendance: records.length > 0, records };
      } catch (error) {
        console.error('Error checking today attendance:', error);
        return { hasAttendance: false, records: [] };
      }
    },
    enabled: !!user?.id && !!studentData?.id,
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
    refetchOnWindowFocus: true,
  });

  // Today's classes — same query (and cache) as the check-in card
  const { data: todayContext, isLoading: isLoadingSchedules } = useQuery({
    queryKey: STUDENT_TODAY_QUERY_KEY,
    queryFn: () => api.schedules.getStudentTodayContext(),
    enabled: !!studentData?.semester && !!studentData?.faculty_id,
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
    retry: 1,
  });
  const todaySchedules: StudentTodayClass[] = todayContext?.classes ?? [];
  const todayAttendanceRecords = todayAttendanceData?.records || [];

  /** Server `my_status` first; legacy fallback matches today's records by subject. */
  const myStatusFor = (schedule: StudentTodayClass): RecordStatus | null => {
    if ('my_status' in schedule) return schedule.my_status ?? null;
    const record = todayAttendanceRecords.find((r) => Number(r.subjectId) === schedule.subject_id);
    const st = record ? String(record.status).toLowerCase() : '';
    return ['present', 'late', 'absent', 'excused'].includes(st) ? (st as RecordStatus) : null;
  };
  const verifiedToday = todaySchedules.filter((s) => {
    const st = myStatusFor(s);
    return st === 'present' || st === 'late';
  }).length;

  if (isLoadingStudent || isLoadingAttendance) {
    return (
      <StudentSidebar>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="space-y-3 text-center">
            <div
              className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-brand-subtle border-t-brand"
              role="progressbar"
              aria-label="Loading"
            />
            <p className="text-caption text-text-muted">Loading student portal...</p>
          </div>
        </div>
      </StudentSidebar>
    );
  }

  // Presentation-only derived values (all numbers come from the server)
  const metrics = readMetrics(attendanceSummary);
  const tone = metricTone(metrics, policy);
  const band = resolveBand(metrics, policy);
  const eligible = meetsMinimum(metrics, policy);
  const minimum = policy?.minimum_percentage;
  const termState = attendanceSummary?.term_state ?? policy?.term_state;
  const term = attendanceSummary?.term ?? null;
  const termStart = (attendanceSummary?.semester_start_date as string | undefined) || term?.start_date;
  const termEnd = (attendanceSummary?.semester_end_date as string | undefined) || term?.end_date;
  const termProgress = (() => {
    if (!termStart || !termEnd || termState === 'between_terms') return null;
    const start = parseLocalDate(String(termStart).slice(0, 10));
    const end = parseLocalDate(String(termEnd).slice(0, 10));
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    if (!(totalDays > 0)) return null;
    const elapsedDays = Math.max(0, Math.ceil((Date.now() - start.getTime()) / 86400000));
    return {
      percent: Math.min(100, Math.round((elapsedDays / totalDays) * 100)),
      remainingDays: Math.max(0, totalDays - elapsedDays),
    };
  })();
  const attendedCount = metrics.attended ?? metrics.present + metrics.late;
  const consideredCount = metrics.considered ?? metrics.present + metrics.late + metrics.absent;
  const rateCaption = summaryFailed
    ? 'Attendance summary unavailable'
    : metrics.hasData
      ? `${attendedCount} of ${consideredCount} classes attended`
      : 'No classes recorded yet';
  const rateFooter = (() => {
    if (!metrics.hasData) return { text: 'Shown once classes are recorded', cls: 'text-text-muted', ok: null as boolean | null };
    const provisional = metrics.provisional ? ' · provisional' : '';
    const label = band?.label ? `${band.label} · ` : '';
    if (eligible === true) {
      return { text: `${label}meets ${minimum !== undefined ? `${minimum}% ` : ''}minimum${provisional}`, cls: TONE_TEXT[tone], ok: true };
    }
    if (eligible === false) {
      return { text: `${label}below ${minimum !== undefined ? `${minimum}% ` : 'the '}minimum${provisional}`, cls: TONE_TEXT[tone], ok: false };
    }
    return { text: `${band?.label ?? 'Attendance'}${provisional}`, cls: TONE_TEXT[tone], ok: null };
  })();
  // Face enrolment state from the student payload (`face_encoding` is always null now).
  const faceRegistered = !!studentData?.face_registered;
  const faceDeleted = !faceRegistered && studentData?.face_enrollment_status === 'deleted';
  const displayName = studentData?.name || user?.name || 'Student';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <StudentSidebar>
      <div className="mx-auto max-w-7xl space-y-6 py-2">
        {/* Greeting header */}
        <header className="page-header mb-0">
          <div>
            <h1 className="text-page-title text-text-primary">
              Welcome, {studentData?.name?.split(' ')[0] || user?.name?.split(' ')[0] || 'Student'}
            </h1>
            <p className="mt-1 text-caption text-text-muted">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success" shape="pill" className="gap-1.5 py-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-status-success" aria-hidden />
              <span>Enrollment Active</span>
            </Badge>
          </div>
        </header>

        <TermStateBanner termState={termState} term={term} />

        {/* Attendance health KPIs */}
        <section aria-label="Student Metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label="Attendance Rate"
            value={metrics.hasData ? formatPercent(metrics.percentage) : '—'}
            caption={rateCaption}
            aside={<ProgressRing value={metrics.percentage} tone={tone} />}
            footer={
              <p className={`flex items-center gap-1 text-caption-strong ${rateFooter.cls}`}>
                {rateFooter.ok === true ? (
                  <CheckmarkCircle16Filled className="shrink-0" aria-hidden />
                ) : rateFooter.ok === false ? (
                  <Warning16Regular className="shrink-0" aria-hidden />
                ) : null}
                {rateFooter.text}
                {metrics.unrecorded > 0 && (
                  <span className="font-normal text-text-muted">
                    {' '}({metrics.unrecorded} unrecorded class{metrics.unrecorded === 1 ? '' : 'es'})
                  </span>
                )}
              </p>
            }
          />

          <KpiTile
            label="Present"
            value={metrics.present}
            caption={metrics.late > 0 ? `+ ${metrics.late} late arrival${metrics.late === 1 ? '' : 's'}` : 'Classes attended on time'}
            icon={<CheckmarkCircle20Regular aria-hidden />}
            chipClassName="bg-status-success-subtle text-status-success"
          />

          <KpiTile
            label="Absent"
            value={metrics.absent}
            caption={metrics.excused > 0 ? `Classes missed · ${metrics.excused} excused` : 'Classes missed'}
            icon={<DismissCircle20Regular aria-hidden />}
            chipClassName="bg-status-error-subtle text-status-error"
          />

          <KpiTile
            label="Term Progress"
            value={termProgress ? `${termProgress.percent}%` : termState === 'between_terms' ? 'Break' : '—'}
            caption={
              termProgress
                ? `${termProgress.remainingDays} days remaining`
                : termState === 'between_terms'
                  ? 'Between terms'
                  : 'Term dates unavailable'
            }
            icon={<Pulse20Regular aria-hidden />}
            footer={
              <div className="h-1 w-full overflow-hidden rounded-full bg-border-subtle">
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-500 ease-fluent-decelerate"
                  style={{ width: `${termProgress ? termProgress.percent : 0}%` }}
                />
              </div>
            }
          />
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main column */}
          <div className="min-w-0 space-y-6 lg:col-span-2">
            {/* Today's Class Schedule with Check-in Component */}
            <TodayClassSchedule
              studentData={studentData}
              todayAttendance={todayAttendanceRecords}
              onAttendanceMarked={() => {
                void refetchTodayAttendance?.();
              }}
            />

            {/* Today's Timetable Status Overview */}
            <section aria-label="Today's Timetable Status">
              <Card className="border-0 bg-surface-default shadow">
                <CardHeader className="space-y-0 border-b border-border-subtle px-5 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2">
                      <ClipboardTaskListLtr20Regular className="mt-0.5 shrink-0 text-brand-foreground" aria-hidden />
                      <div>
                        <CardTitle className="text-subheading text-text-primary">
                          Today's Attendance Status
                        </CardTitle>
                        <CardDescription className="mt-0.5 text-caption text-text-muted">
                          {todaySchedules.length} course session{todaySchedules.length === 1 ? '' : 's'} scheduled for today
                        </CardDescription>
                      </div>
                    </div>
                    {verifiedToday > 0 && (
                      <Badge variant="success" shape="pill" className="gap-1 self-start sm:self-auto">
                        <CheckmarkCircle16Filled className="shrink-0" aria-hidden />
                        {verifiedToday} Checked in
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-2">
                  {isLoadingSchedules ? (
                    <div className="py-8 text-center text-caption text-text-muted">
                      Loading timetable...
                    </div>
                  ) : todaySchedules.length > 0 ? (
                    <ul className="space-y-0.5">
                      {todaySchedules.map((schedule) => {
                        const mine = myStatusFor(schedule);
                        const cancelled = isClassCancelled(schedule);
                        let statusText = 'Not recorded';
                        let statusBadgeClass = 'bg-surface-subtle text-text-secondary border-border-default';

                        if (cancelled) {
                          statusText = 'Cancelled';
                          statusBadgeClass = 'bg-surface-subtle text-text-muted border-border-subtle';
                        } else if (mine === 'present') {
                          statusText = 'Present';
                          statusBadgeClass = 'bg-status-success-subtle text-status-success border-status-success-border';
                        } else if (mine === 'late') {
                          statusText = 'Late';
                          statusBadgeClass = 'bg-status-warning-subtle text-status-warning border-status-warning-border';
                        } else if (mine === 'absent') {
                          statusText = 'Absent';
                          statusBadgeClass = 'bg-status-error-subtle text-status-error border-status-error-border';
                        } else if (mine === 'excused') {
                          statusText = 'Excused';
                          statusBadgeClass = 'bg-status-info-subtle text-status-info border-status-info-border';
                        } else if (schedule.checkin_window?.state === 'open') {
                          statusText = 'Check-in open';
                          statusBadgeClass = 'bg-brand-subtle text-brand-foreground border-brand-stroke/50';
                        } else if (schedule.checkin_window?.state === 'not_open') {
                          statusText = 'Upcoming';
                          statusBadgeClass = 'bg-status-info-subtle text-status-info border-status-info-border';
                        }

                        return (
                          <li
                            key={`${schedule.session_id ?? schedule.id}-${schedule.start_time}`}
                            className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover"
                          >
                            <div className="min-w-0 flex-1">
                              <p className={`truncate text-body-strong ${cancelled ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                                {schedule.subject_name}
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-text-muted">
                                <span className="inline-flex items-center gap-1 tabular-nums">
                                  <Clock16Regular className="shrink-0" aria-hidden />
                                  {schedule.time_slot_display || `${formatClock(schedule.start_time)} – ${formatClock(schedule.end_time)}`}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Location16Regular className="shrink-0" aria-hidden />
                                  {schedule.classroom || 'Room N/A'}
                                </span>
                                {cancelled && schedule.cancellation_reason && (
                                  <span className="inline-flex items-center gap-1 text-status-warning">
                                    <Warning16Regular className="shrink-0" aria-hidden />
                                    {schedule.cancellation_reason}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-caption-strong ${statusBadgeClass}`}>
                              {statusText}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center py-8 text-center">
                      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                        <CalendarLtr24Regular aria-hidden />
                      </div>
                      <p className="text-subheading text-text-primary">No classes scheduled today</p>
                      <p className="mt-1 text-body text-text-muted">
                        {todayContext?.day_status === 'holiday'
                          ? 'Today is a holiday.'
                          : todayContext?.day_status === 'weekly_off'
                            ? 'Today is your weekly day off.'
                            : todayContext?.day_status === 'exam'
                              ? 'Regular classes are suspended for exams.'
                              : 'Enjoy your free study hours'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </div>

          {/* Side column */}
          <aside className="space-y-6">
            {/* Profile summary (Student ID + Biometrics) */}
            <Card className="border-0 bg-surface-default shadow">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-subtle text-body-strong text-brand-foreground">
                      {initials}
                    </div>
                    <span
                      className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-presence-available ring-2 ring-[var(--surface-default)]"
                      aria-hidden
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-subheading text-text-primary">{displayName}</p>
                    <p className="truncate text-caption text-text-muted">
                      {studentData?.faculty || 'Enrolled Division'} • Sem {studentData?.semester || 1}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 divide-y divide-border-subtle border-t border-border-subtle">
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="text-body text-text-muted">Student ID</dt>
                    <dd className="truncate font-mono text-body-strong tabular-nums text-text-primary">
                      {studentData?.studentId || studentData?.student_id || 'N/A'}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3 pt-3">
                    <dt className="flex items-center gap-1.5 text-body text-text-muted">
                      <ShieldCheckmark20Regular className="shrink-0" aria-hidden />
                      Biometrics
                    </dt>
                    <dd className="flex flex-col items-end text-right">
                      {faceRegistered ? (
                        <Badge variant="success" shape="pill" className="gap-1">
                          <CheckmarkCircle16Filled className="shrink-0" aria-hidden />
                          Registered
                        </Badge>
                      ) : faceDeleted ? (
                        <Badge variant="warning" shape="pill" className="gap-1">
                          <LockClosed16Regular className="shrink-0" aria-hidden />
                          Locked
                        </Badge>
                      ) : (
                        <Badge variant="warning" shape="pill" className="gap-1">
                          <Clock16Regular className="shrink-0" aria-hidden />
                          Action Needed
                        </Badge>
                      )}
                      <span className="mt-1 text-caption text-text-muted">
                        {faceRegistered
                          ? 'Face check-in enabled'
                          : faceDeleted
                            ? 'Ask an administrator to reset it'
                            : 'Register your face to check in'}
                      </span>
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <section aria-label="Student Services">
              <Card className="border-0 bg-surface-default shadow">
                <CardHeader className="space-y-0 border-b border-border-subtle px-5 py-4">
                  <CardTitle className="text-subheading text-text-primary">
                    Student Services & Portals
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0.5 p-2">
                  <Link
                    to="/student/calendar"
                    className="group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
                      <CalendarLtr20Regular aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-body-strong text-text-primary">
                        Academic Calendar
                      </h3>
                      <p className="mt-0.5 text-caption text-text-muted">
                        Inspect term dates, institutional breaks, and class timetables
                      </p>
                    </div>
                    <ChevronRight20Regular className="shrink-0 text-text-muted transition-colors group-hover:text-text-primary" aria-hidden />
                  </Link>

                  <Link
                    to="/face-registration"
                    className="group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
                      <Camera20Regular aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-body-strong text-text-primary">
                        Face Biometrics Setup
                      </h3>
                      <p className="mt-0.5 text-caption text-text-muted">
                        {faceRegistered
                          ? 'View or delete your face registration'
                          : faceDeleted
                            ? 'Registration locked — an administrator must reset it'
                            : 'Register your face once to check in with the camera'}
                      </p>
                    </div>
                    <ChevronRight20Regular className="shrink-0 text-text-muted transition-colors group-hover:text-text-primary" aria-hidden />
                  </Link>
                </CardContent>
              </Card>
            </section>
          </aside>
        </div>

      </div>
    </StudentSidebar>
  );
};

export default StudentDashboard;
