import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import TeacherSidebar from '@/components/TeacherSidebar';
import SessionCancelDialog, { type SessionCancelMode } from '@/components/SessionCancelDialog';
import { cn } from '@/lib/utils';
import {
  ArrowSync20Regular,
  ArrowUndo16Regular,
  Book20Regular,
  CalendarCancel16Regular,
  CalendarLtr20Regular,
  ChevronRight20Regular,
  ClipboardTaskListLtr20Regular,
  Clock20Regular,
  DataTrending20Regular,
  ErrorCircle20Regular,
  Location16Regular,
  People16Regular,
  People20Regular,
  Person20Regular,
} from '@fluentui/react-icons';
import { api, parseApiError, type SessionStatus, type TermState, type TermSummary } from '@/integrations/api/client';
import TermStateBanner from '@/components/TermStateBanner';
import { localDateString } from '@/utils/metricsDisplay';

interface ScheduleEntry {
  /** Timetable (schedule) id — for make-up sessions this is the session id. */
  id: number;
  schedule_id?: number | null;
  kind?: 'regular' | 'makeup';
  subject_id?: number;
  subject_code?: string;
  faculty_id?: number;
  submitted_at?: string | null;
  subject_name: string;
  start_time: string;
  end_time: string;
  classroom: string;
  semester: number;
  is_cancelled?: boolean;
  cancellation_reason?: string | null;
  // contract v1 additions
  session_id?: number | null;
  session_status?: SessionStatus | null;
  recorded_count?: number | null;
  roster_size?: number | null;
}

interface TeacherDashboardData {
  teacher: {
    id: number;
    teacher_id: string;
    name: string;
    department: string;
    office_location: string;
  };
  stats: {
    total_subjects: number;
    total_classes: number;
    total_students: number;
    classes_today: number;
    unrecorded_sessions?: number;
  };
  attendance_last_7_days: {
    present: number;
    absent: number;
    late: number;
  };
  subjects: Array<{
    id: number;
    name: string;
    code: string;
    credits: number;
    semesters: number[];
  }>;
  today_schedule: ScheduleEntry[];
  date?: string;
  term_state?: TermState;
  term?: TermSummary | null;
}

/** Class "team" tile colours — Fluent categorical palette (static class names for Tailwind JIT). */
const TILE_COLORS = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
  'bg-chart-6',
  'bg-chart-7',
  'bg-chart-8',
];

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

const TeacherDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dashboardData, setDashboardData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; mode: SessionCancelMode }>({
    open: false,
    mode: 'cancel',
  });
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleEntry | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.teacher.getDashboard();
      setDashboardData(response);
      setError(null);
    } catch (err: unknown) {
      console.error('Error fetching dashboard data:', err);
      setError(parseApiError(err).message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const scheduleIdOf = (entry: ScheduleEntry): number | undefined =>
    entry.schedule_id ?? (entry.kind === 'makeup' ? undefined : entry.id);

  const handleOpenCancelDialog = (schedule: ScheduleEntry, mode: SessionCancelMode) => {
    setSelectedSchedule(schedule);
    setCancelDialog({ open: true, mode });
  };

  const handleCancelConfirm = async ({ reason, notifyStudents }: { reason: string; notifyStudents: boolean }) => {
    if (!selectedSchedule) return;
    const today = localDateString();
    try {
      setCancelling(true);
      if (cancelDialog.mode === 'cancel') {
        // Make-up sessions have no timetable row: always prefer session_id.
        await api.teacher.cancelClass({
          schedule_id: selectedSchedule.session_id ? undefined : scheduleIdOf(selectedSchedule),
          session_id: selectedSchedule.session_id ?? undefined,
          date: today,
          reason,
          notify_students: notifyStudents,
        });
        toast({
          title: 'Class cancelled',
          description: `${selectedSchedule.subject_name} has been marked cancelled.`,
        });
      } else {
        await api.teacher.uncancelClass(
          selectedSchedule.session_id
            ? { session_id: selectedSchedule.session_id, reason }
            : { schedule_id: scheduleIdOf(selectedSchedule), subject_id: selectedSchedule.subject_id, date: today, reason }
        );
        toast({
          title: 'Class restored',
          description: `${selectedSchedule.subject_name} is back on today's schedule.`,
        });
      }
      setCancelDialog((d) => ({ ...d, open: false }));
      void fetchDashboardData();
    } catch (err: unknown) {
      console.error('Error updating class session:', err);
      toast({
        title: cancelDialog.mode === 'cancel' ? 'Could not cancel class' : 'Could not restore class',
        description: parseApiError(err).message,
        variant: 'destructive',
      });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <TeacherSidebar>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <ArrowSync20Regular className="h-7 w-7 animate-spin text-brand-foreground mx-auto" aria-hidden />
            <p className="text-caption text-text-muted">Loading teacher workspace...</p>
          </div>
        </div>
      </TeacherSidebar>
    );
  }

  if (error) {
    return (
      <TeacherSidebar>
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg bg-surface-default shadow p-6 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-status-error-subtle text-status-error">
              <ErrorCircle20Regular className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="text-subheading text-text-primary">Workspace Error</h2>
            <p className="mt-1 text-body text-text-muted">{error}</p>
            <Button onClick={fetchDashboardData} className="mt-5 w-full">
              <ArrowSync20Regular aria-hidden />
              Retry Loading
            </Button>
          </div>
        </div>
      </TeacherSidebar>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const { teacher, stats, subjects } = dashboardData;
  const today_schedule = dashboardData.today_schedule ?? [];
  const attendance_last_7_days = {
    present: dashboardData.attendance_last_7_days?.present ?? 0,
    absent: dashboardData.attendance_last_7_days?.absent ?? 0,
    late: dashboardData.attendance_last_7_days?.late ?? 0,
  };

  const isPastEnd = (end: string) => {
    const [hh, mm] = end.split(':').map(Number);
    const endDt = new Date();
    endDt.setHours(hh, mm, 0, 0);
    return now.getTime() > endDt.getTime();
  };

  // Presentation-only: whether the session's start time has passed (for "In progress" label)
  const hasStarted = (start: string) => {
    const [hh, mm] = start.split(':').map(Number);
    const startDt = new Date();
    startDt.setHours(hh, mm, 0, 0);
    return now.getTime() >= startDt.getTime();
  };

  const totalWeeklyAttendance =
    attendance_last_7_days.present + attendance_last_7_days.absent + attendance_last_7_days.late;

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = teacher.name?.split(' ')[0];

  const kpis = [
    { label: 'Assigned Courses', value: stats.total_subjects, hint: 'Active curriculum', icon: Book20Regular },
    { label: 'Weekly Sessions', value: stats.total_classes, hint: 'Teaching slots', icon: CalendarLtr20Regular },
    { label: 'Enrolled Students', value: stats.total_students, hint: 'Across classes', icon: People20Regular },
    {
      label: 'Classes Today',
      value: stats.classes_today,
      hint:
        (stats.unrecorded_sessions ?? 0) > 0
          ? `${stats.unrecorded_sessions} past session${stats.unrecorded_sessions === 1 ? '' : 's'} not recorded`
          : 'Scheduled slots',
      icon: Clock20Regular,
    },
  ];

  const attendanceRows = [
    { key: 'present', label: 'Present', value: attendance_last_7_days.present, dot: 'bg-status-success', text: 'text-status-success' },
    { key: 'absent', label: 'Absent', value: attendance_last_7_days.absent, dot: 'bg-status-error', text: 'text-status-error' },
    { key: 'late', label: 'Late', value: attendance_last_7_days.late, dot: 'bg-status-warning', text: 'text-status-warning' },
  ];

  const quickLinks = [
    { label: 'Full Schedule', hint: 'Inspect weekly timetables', icon: CalendarLtr20Regular, to: '/teacher/schedule' },
    { label: 'Mark Attendance', hint: 'Record live student check-ins', icon: ClipboardTaskListLtr20Regular, to: '/teacher/attendance' },
    { label: 'Teacher Profile', hint: 'Contact and office details', icon: Person20Regular, to: '/teacher/profile' },
  ];

  return (
    <TeacherSidebar>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Greeting header */}
        <div className="page-header !mb-0">
          <div>
            <h1 className="text-page-title text-text-primary">
              {firstName ? `${greeting}, ${firstName}` : greeting}
            </h1>
            <p className="mt-1 text-body text-text-muted">
              {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              <span className="mx-1.5" aria-hidden>·</span>
              {teacher.department || 'Academic Department'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/teacher/schedule')}>
              <CalendarLtr20Regular aria-hidden />
              Full Schedule
            </Button>
          </div>
        </div>

        <TermStateBanner termState={dashboardData.term_state} term={dashboardData.term} />

        {/* KPI tiles */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(({ label, value, hint, icon: Icon }) => (
            <div key={label} className="rounded-lg bg-surface-default p-4 shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-caption text-text-muted">{label}</p>
                  <p className="mt-1 text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{value}</p>
                  <p className="text-caption text-text-muted">{hint}</p>
                </div>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
                  <Icon aria-hidden />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Today's classes + attendance summary */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="border-0 bg-surface-default shadow lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border-subtle px-5 py-4">
              <div>
                <CardTitle className="text-subheading text-text-primary">Today's classes</CardTitle>
                <CardDescription className="mt-0.5 text-caption text-text-muted">
                  Live timetable for today's active and upcoming courses
                </CardDescription>
              </div>
              {today_schedule.length > 0 && (
                <Badge variant="secondary" shape="pill">
                  {today_schedule.length} {today_schedule.length === 1 ? 'class' : 'classes'}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-3">
              {today_schedule.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                    <CalendarLtr20Regular className="h-6 w-6" aria-hidden />
                  </div>
                  <p className="text-subheading text-text-primary">No classes scheduled for today</p>
                  <p className="mt-1 text-body text-text-muted">Check your full weekly schedule for upcoming lectures</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {today_schedule.map((schedule) => {
                    const cancelled = schedule.session_status === 'cancelled' || !!schedule.is_cancelled;
                    const concluded = isPastEnd(schedule.end_time);
                    const live = !cancelled && !concluded && hasStarted(schedule.start_time);
                    const hasSessionInfo = schedule.session_status !== undefined && schedule.session_status !== null;
                    const held = schedule.session_status === 'held';
                    const unrecorded = !cancelled && concluded && schedule.session_status === 'scheduled';
                    const recorded =
                      typeof schedule.recorded_count === 'number' && typeof schedule.roster_size === 'number'
                        ? `${schedule.recorded_count}/${schedule.roster_size} recorded`
                        : null;
                    const canRestore = cancelled;
                    return (
                      <li
                        key={`${schedule.id}-${schedule.session_id ?? schedule.start_time}`}
                        className="flex flex-col gap-3 rounded-md px-3 py-3 transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover sm:flex-row sm:items-center"
                      >
                        {/* Time block */}
                        <div className="flex items-stretch gap-3 sm:w-28 sm:shrink-0">
                          <span
                            className={cn(
                              'w-1 shrink-0 rounded-full',
                              cancelled
                                ? 'bg-status-error'
                                : unrecorded
                                ? 'bg-status-warning'
                                : concluded
                                ? 'bg-border-default'
                                : 'bg-brand'
                            )}
                            aria-hidden
                          />
                          <div className="tabular-nums">
                            <p className={cn('text-body-strong', cancelled || concluded ? 'text-text-muted' : 'text-text-primary')}>
                              {schedule.start_time}
                            </p>
                            <p className="text-caption text-text-muted">{schedule.end_time}</p>
                          </div>
                        </div>

                        {/* Subject + meta */}
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'truncate text-body-strong',
                              cancelled ? 'text-text-muted line-through' : 'text-text-primary'
                            )}
                          >
                            {schedule.subject_name}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-text-muted">
                            <span className="inline-flex items-center gap-1">
                              <People16Regular aria-hidden />
                              Semester {schedule.semester}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Location16Regular aria-hidden />
                              {schedule.classroom || 'Classroom N/A'}
                            </span>
                            {schedule.kind === 'makeup' && (
                              <Badge variant="brand" shape="pill" className="py-0">Make-up</Badge>
                            )}
                            {recorded && !cancelled && <span className="tabular-nums">{recorded}</span>}
                            {cancelled && schedule.cancellation_reason && (
                              <span className="truncate">Reason: {schedule.cancellation_reason}</span>
                            )}
                          </div>
                        </div>

                        {/* Status + actions */}
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {cancelled ? (
                            <>
                              <Badge variant="destructive" shape="pill">Cancelled</Badge>
                              {canRestore && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenCancelDialog(schedule, 'uncancel')}
                                  title="Restore class"
                                >
                                  <ArrowUndo16Regular aria-hidden />
                                  Restore
                                </Button>
                              )}
                            </>
                          ) : concluded ? (
                            <>
                              {unrecorded ? (
                                <Badge variant="warning" shape="pill">Not recorded</Badge>
                              ) : held || !hasSessionInfo ? (
                                <Badge variant="secondary" shape="pill">{held ? 'Held' : 'Concluded'}</Badge>
                              ) : null}
                              {unrecorded && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenCancelDialog(schedule, 'cancel')}
                                  title="Mark as not held"
                                >
                                  <CalendarCancel16Regular aria-hidden />
                                  Not held
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant={unrecorded ? 'default' : 'ghost'}
                                onClick={() => navigate('/teacher/attendance')}
                              >
                                <ClipboardTaskListLtr20Regular aria-hidden />
                                {unrecorded ? 'Take attendance' : 'Review'}
                              </Button>
                            </>
                          ) : (
                            <>
                              <Badge variant={live ? 'success' : 'info'} shape="pill" className="gap-1.5">
                                <span
                                  className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-status-success' : 'bg-status-info')}
                                  aria-hidden
                                />
                                {live ? 'In progress' : 'Upcoming'}
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenCancelDialog(schedule, 'cancel')}
                                title="Cancel class"
                              >
                                <CalendarCancel16Regular aria-hidden />
                                Cancel
                              </Button>
                              <Button size="sm" onClick={() => navigate('/teacher/attendance')}>
                                <ClipboardTaskListLtr20Regular aria-hidden />
                                Take attendance
                              </Button>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Attendance summary (last 7 days) */}
          <Card className="border-0 bg-surface-default shadow">
            <CardHeader className="border-b border-border-subtle px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
                <DataTrending20Regular className="text-brand-foreground" aria-hidden />
                Attendance Summary
              </CardTitle>
              <CardDescription className="text-caption text-text-muted">Last 7 operational days</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              {/* Stacked distribution bar */}
              <div
                className="flex h-2 w-full overflow-hidden rounded-full bg-surface-subtle"
                role="img"
                aria-label={`Present ${attendance_last_7_days.present}, absent ${attendance_last_7_days.absent}, late ${attendance_last_7_days.late}`}
              >
                {totalWeeklyAttendance > 0 &&
                  attendanceRows.map((row) => (
                    <div
                      key={row.key}
                      className={cn('h-full transition-all', row.dot)}
                      style={{ width: `${Math.min(100, (row.value / totalWeeklyAttendance) * 100)}%` }}
                    />
                  ))}
              </div>

              {totalWeeklyAttendance === 0 ? (
                <p className="text-body text-text-muted">No attendance recorded in the last 7 days.</p>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {attendanceRows.map((row) => (
                    <li key={row.key} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className={cn('h-2.5 w-2.5 rounded-full', row.dot)} aria-hidden />
                        <span className="text-body text-text-primary">{row.label}</span>
                      </div>
                      <span className={cn('text-subheading tabular-nums', row.text)}>{row.value}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Class teams (subjects) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-section-title text-text-primary">My Assigned Courses</h2>
              <p className="text-caption text-text-muted">Curriculum subjects under your instruction</p>
            </div>
            <Badge variant="secondary" shape="pill">
              {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {subjects.map((subject, index) => (
              <div
                key={subject.id}
                className="flex flex-col rounded-lg bg-surface-default p-4 shadow transition-shadow duration-150 ease-fluent-standard hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'grid h-12 w-12 shrink-0 place-items-center rounded-md text-subheading text-text-inverse',
                      TILE_COLORS[index % TILE_COLORS.length]
                    )}
                    aria-hidden
                  >
                    {getInitials(subject.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-body-strong text-text-primary" title={subject.name}>
                      {subject.name}
                    </h3>
                    <p className="text-caption text-text-muted">
                      <span className="font-mono">{subject.code}</span>
                      <span className="mx-1" aria-hidden>·</span>
                      <span className="tabular-nums">{subject.credits} Credits</span>
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {subject.semesters.map((sem) => (
                    <Badge key={sem} variant="secondary" className="px-1.5 py-0 text-overline">
                      Semester {sem}
                    </Badge>
                  ))}
                </div>

                <div className="mt-4 flex gap-1 border-t border-border-subtle pt-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1"
                    onClick={() => navigate(`/teacher/subjects/${subject.id}/students?semester=${subject.semesters[0]}`)}
                  >
                    <People20Regular aria-hidden />
                    <span>Students</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1"
                    onClick={() => navigate(`/teacher/subjects/${subject.id}/analytics?semester=${subject.semesters[0]}`)}
                  >
                    <DataTrending20Regular aria-hidden />
                    <span>Analytics</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick links */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {quickLinks.map(({ label, hint, icon: Icon, to }) => (
            <button
              key={to}
              type="button"
              onClick={() => navigate(to)}
              className="group flex items-center gap-3 rounded-lg bg-surface-default p-4 text-left shadow transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
                <Icon aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-body-strong text-text-primary">{label}</span>
                <span className="block text-caption text-text-muted">{hint}</span>
              </div>
              <ChevronRight20Regular className="shrink-0 text-text-muted" aria-hidden />
            </button>
          ))}
        </div>

        {/* Cancel / restore class dialog */}
        <SessionCancelDialog
          open={cancelDialog.open}
          mode={cancelDialog.mode}
          sessionLabel={
            selectedSchedule
              ? `${selectedSchedule.subject_name} · ${selectedSchedule.start_time}–${selectedSchedule.end_time}, today`
              : ''
          }
          busy={cancelling}
          onOpenChange={(open) => setCancelDialog((d) => ({ ...d, open }))}
          onConfirm={(input) => void handleCancelConfirm(input)}
        />
      </div>
    </TeacherSidebar>
  );
};

export default TeacherDashboard;
