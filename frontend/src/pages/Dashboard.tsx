import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  People20Regular,
  CalendarLtr20Regular,
  Alert20Regular,
  DataTrending20Regular,
  DesktopPulse20Regular,
  CheckmarkCircle20Regular,
  ChevronRight16Regular,
  Clock16Regular,
  HatGraduation20Regular,
  PeopleTeam20Regular,
  Pulse20Regular,
  CalendarClock20Regular,
  PersonClock20Regular,
  BuildingMultiple20Regular,
} from '@fluentui/react-icons';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Link } from 'react-router-dom';
import { api, apiClient } from '@/integrations/api/client';
import { useAuth } from '@/contexts/useAuth';
import { useAttendancePolicy } from '@/hooks/useAttendancePolicy';
import { cn } from '@/lib/utils';
import { formatPercent, localDateString, metricTone, readMetrics, type MetricTone } from '@/utils/metricsDisplay';

const tooltipStyle: React.CSSProperties = {
  background: 'var(--surface-raised)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 8,
  boxShadow: 'var(--shadow-16)',
  color: 'var(--text-primary)',
  fontSize: 12,
};

type QuickNavCardProps = {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
};

const QuickNavCard: React.FC<QuickNavCardProps> = ({ href, icon, title, description }) => (
  <Link
    to={href}
    className="group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <h3 className="truncate text-body-strong text-text-primary group-hover:text-brand-foreground transition-colors">
        {title}
      </h3>
      <p className="truncate text-caption text-text-muted">{description}</p>
    </div>
    <ChevronRight16Regular className="shrink-0 text-text-muted" aria-hidden />
  </Link>
);

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  tone?: 'brand' | 'success' | 'warning';
  badge?: {
    text: string;
    variant?: 'success' | 'warning' | 'error' | 'neutral';
  };
};

const chipTone: Record<NonNullable<StatCardProps['tone']>, string> = {
  brand: 'bg-brand-subtle text-brand-foreground',
  success: 'bg-status-success-subtle text-status-success',
  warning: 'bg-status-warning-subtle text-status-warning',
};

const StatCard: React.FC<StatCardProps> = ({ label, value, hint, icon, badge, tone = 'brand' }) => (
  <Card className="border-0 bg-surface-default shadow">
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-md', chipTone[tone])}>
          {icon}
        </div>
        {badge && (
          <Badge
            shape="pill"
            variant={
              badge.variant === 'success'
                ? 'success'
                : badge.variant === 'warning'
                  ? 'warning'
                  : badge.variant === 'error'
                    ? 'destructive'
                    : 'secondary'
            }
          >
            {badge.text}
          </Badge>
        )}
      </div>
      <p className="mt-4 text-caption text-text-muted">{label}</p>
      <p className="text-[28px] leading-9 font-semibold tabular-nums text-text-primary">{value}</p>
      {hint && <p className="mt-0.5 text-caption text-text-muted">{hint}</p>}
    </CardContent>
  </Card>
);

const statusMeta = {
  present: { label: 'Present', color: 'var(--status-success)', variant: 'success' as const },
  late: { label: 'Late', color: 'var(--status-warning)', variant: 'warning' as const },
  absent: { label: 'Absent', color: 'var(--status-error)', variant: 'destructive' as const },
  excused: { label: 'Excused', color: 'var(--status-info)', variant: 'info' as const },
};

type StatusKey = keyof typeof statusMeta;

const initials = (name?: string) =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('') || '?';

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  // Fetch summary data
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => api.students.getAll(),
    retry: false,
  });

  const { data: faculties = [] } = useQuery({
    queryKey: ['faculties'],
    queryFn: () => api.faculties.getAll(),
    retry: false,
  });

  // Recent entries only: the first page of today's records, by local date (never toISOString(), which is UTC).
  const { data: todayAttendance = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ['today-attendance', localDateString()],
    queryFn: async () => {
      const response = await api.attendance.getAll({ date: localDateString(), limit: 50, skip: 0 });
      return response.records || [];
    },
    retry: false,
  });

  // Today's counts, percentage and band come from the server (attendance_metrics); never computed here.
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['analytics-dashboard-summary'],
    queryFn: async () => (await apiClient.get('/analytics/dashboard-summary')).data,
    refetchInterval: 60_000,
    retry: false,
  });

  const { data: autoAbsent } = useQuery({
    queryKey: ['auto-absent-status'],
    queryFn: () => api.autoAbsent.status(),
    refetchInterval: 30_000,
    retry: false,
  });

  const { data: policy } = useAttendancePolicy();

  const totalStudents = students.length;
  const today = readMetrics(summary?.today);
  const todayTone: MetricTone = metricTone(today, policy);
  const isLoading = studentsLoading || attendanceLoading || summaryLoading;

  // Presentation-only views of the server counts.
  const statusBreakdown = (Object.keys(statusMeta) as StatusKey[]).map((key) => ({
    key,
    name: statusMeta[key].label,
    value: today[key],
    color: statusMeta[key].color,
  }));
  const totalMarked = statusBreakdown.reduce((acc, s) => acc + s.value, 0);

  const unrecorded = typeof autoAbsent?.unrecorded_sessions === 'number' ? autoAbsent.unrecorded_sessions : null;
  const schedulerRunning = autoAbsent ? autoAbsent.scheduler_running === true : null;
  const lastRun = autoAbsent?.last_run;

  const recentActivity = React.useMemo(() => {
    const stamp = (r: (typeof todayAttendance)[number]) => r.createdAt || (r.timeIn ? `${r.date}T${r.timeIn}` : r.date);
    return [...todayAttendance].sort((a, b) => stamp(b).localeCompare(stamp(a))).slice(0, 6);
  }, [todayAttendance]);

  const facultyDistribution = React.useMemo(() => {
    const rows = faculties.map((f) => ({
      id: f.id,
      name: f.name,
      count: students.filter((s) => s.faculty_id === f.id).length,
    }));
    return rows.sort((a, b) => b.count - a.count).slice(0, 6);
  }, [faculties, students]);
  const maxFacultyCount = Math.max(1, ...facultyDistribution.map((f) => f.count));

  const formatTime = (r: (typeof todayAttendance)[number]) => {
    if (r.timeIn) return r.timeIn.slice(0, 5);
    if (r.createdAt) {
      const d = new Date(r.createdAt);
      if (!isNaN(d.getTime())) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return '—';
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-section-title text-text-primary">
            {user?.name ? `Welcome back, ${user.name.split(' ')[0]}` : 'Admin Dashboard'}
          </h1>
          <p className="mt-1 text-body text-text-muted">
            Institutional overview, attendance metrics, and operational command modules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-8 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-default px-3 text-caption text-text-secondary">
            <Clock16Regular className="text-text-muted" aria-hidden />
            <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Summary Metrics Strip */}
      <section aria-labelledby="summary-metrics-heading">
        <h2 id="summary-metrics-heading" className="sr-only">Key Statistics</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Students"
            value={isLoading ? '—' : totalStudents}
            hint="Active registered student roster"
            icon={<People20Regular aria-hidden />}
          />
          <StatCard
            label="Attended today"
            value={summaryLoading || !today.hasData ? '—' : (today.attended ?? today.present)}
            hint={
              today.hasData
                ? `of ${today.considered ?? summary?.today?.total_records ?? '—'} counted records in classes held today`
                : 'No attendance recorded for held classes yet today'
            }
            icon={<CheckmarkCircle20Regular aria-hidden />}
            tone="success"
            badge={
              today.hasData
                ? {
                    text: `${formatPercent(today.percentage)} attendance`,
                    variant: todayTone === 'neutral' || todayTone === 'info' ? 'neutral' : todayTone,
                  }
                : undefined
            }
          />
          <StatCard
            label="Academic Faculties"
            value={faculties.length || '—'}
            hint="Configured institutional faculties"
            icon={<HatGraduation20Regular aria-hidden />}
          />
          <StatCard
            label="Auto-absent scheduler"
            value={schedulerRunning === null ? '—' : schedulerRunning ? 'Running' : 'Stopped'}
            hint={
              lastRun
                ? `Last run ${new Date(lastRun.started_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${lastRun.status}`
                : 'No runs recorded yet'
            }
            icon={<Pulse20Regular aria-hidden />}
            tone={schedulerRunning === false ? 'warning' : 'brand'}
            badge={
              unrecorded === null
                ? undefined
                : unrecorded > 0
                  ? { text: `${unrecorded} unrecorded`, variant: 'warning' }
                  : { text: 'Nothing unrecorded', variant: 'success' }
            }
          />
        </div>
      </section>

      {/* Insights grid */}
      <section aria-label="Attendance insights" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Today's attendance breakdown */}
        <Card className="border-0 bg-surface-default shadow">
          <CardHeader className="flex-row items-center justify-between space-y-0 px-5 py-4">
            <div>
              <h2 className="text-subheading text-text-primary">Today&apos;s attendance</h2>
              <p className="text-caption text-text-muted">Counted records in classes held today</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/attendance">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {totalMarked === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                  <CalendarLtr20Regular aria-hidden />
                </div>
                <p className="text-body-strong text-text-primary">{isLoading ? 'Loading…' : 'No records yet'}</p>
                <p className="text-caption text-text-muted">Attendance marked today will appear here.</p>
              </div>
            ) : (
              <div className="flex items-center gap-5">
                <div className="relative h-36 w-36 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusBreakdown.filter((s) => s.value > 0)}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={48}
                        outerRadius={66}
                        paddingAngle={2}
                        stroke="var(--surface-default)"
                        strokeWidth={2}
                      >
                        {statusBreakdown
                          .filter((s) => s.value > 0)
                          .map((s) => (
                            <Cell key={s.key} fill={s.color} />
                          ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--text-primary)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-section-title tabular-nums text-text-primary">{totalMarked}</span>
                    <span className="text-caption text-text-muted">marked</span>
                  </div>
                </div>
                <ul className="flex-1 space-y-2">
                  {statusBreakdown.map((s) => (
                    <li key={s.key} className="flex items-center justify-between gap-2 text-body">
                      <span className="flex items-center gap-2 text-text-secondary">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                        {s.name}
                      </span>
                      <span className="font-semibold tabular-nums text-text-primary">{s.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="border-0 bg-surface-default shadow">
          <CardHeader className="flex-row items-center justify-between space-y-0 px-5 py-4">
            <div>
              <h2 className="text-subheading text-text-primary">Recent activity</h2>
              <p className="text-caption text-text-muted">Latest attendance entries today</p>
            </div>
            <PersonClock20Regular className="text-text-muted" aria-hidden />
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {recentActivity.length === 0 ? (
              <p className="px-3 py-8 text-center text-caption text-text-muted">
                {isLoading ? 'Loading…' : 'No activity recorded today.'}
              </p>
            ) : (
              <ul>
                {recentActivity.map((r) => {
                  const meta = statusMeta[r.status as StatusKey];
                  return (
                    <li key={r.id} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-surface-hover">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-subtle text-caption-strong text-brand-foreground">
                        {initials(r.studentName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-strong text-text-primary">{r.studentName || r.studentNumber || 'Student'}</p>
                        <p className="truncate text-caption text-text-muted">
                          {r.subjectName || r.subjectCode || 'Class'} · {formatTime(r)}
                        </p>
                      </div>
                      <Badge shape="pill" variant={meta?.variant ?? 'secondary'} className="capitalize">
                        {meta?.label ?? r.status}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Students by faculty */}
        <Card className="border-0 bg-surface-default shadow">
          <CardHeader className="flex-row items-center justify-between space-y-0 px-5 py-4">
            <div>
              <h2 className="text-subheading text-text-primary">Students by faculty</h2>
              <p className="text-caption text-text-muted">Enrollment distribution</p>
            </div>
            <BuildingMultiple20Regular className="text-text-muted" aria-hidden />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {facultyDistribution.length === 0 ? (
              <p className="py-8 text-center text-caption text-text-muted">No faculties configured.</p>
            ) : (
              <ul className="space-y-3">
                {facultyDistribution.map((f, i) => (
                  <li key={f.id}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-body text-text-secondary">{f.name}</span>
                      <span className="text-body-strong tabular-nums text-text-primary">{f.count}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                      <div
                        className="h-full rounded-full transition-all duration-300 ease-fluent-decelerate"
                        style={{ width: `${(f.count / maxFacultyCount) * 100}%`, background: `var(--chart-${(i % 8) + 1})` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Quick Navigation Hub */}
      <section aria-labelledby="quick-nav-heading">
        <Card className="border-0 bg-surface-default shadow">
          <CardHeader className="space-y-0 px-5 py-4">
            <h2 id="quick-nav-heading" className="text-subheading text-text-primary">
              Management Operations
            </h2>
            <p className="text-caption text-text-muted">Quick access to key administrative controls and monitoring tools</p>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <div className="grid grid-cols-1 gap-x-2 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
              <QuickNavCard
                href="/app/attendance"
                icon={<CalendarLtr20Regular aria-hidden />}
                title="Attendance Hub"
                description="Inspect, log, and adjust daily student attendance"
              />
              <QuickNavCard
                href="/app/students"
                icon={<People20Regular aria-hidden />}
                title="Students Directory"
                description="Manage student records, biometrics, and enrollments"
              />
              <QuickNavCard
                href="/app/teachers"
                icon={<PeopleTeam20Regular aria-hidden />}
                title="Teachers Management"
                description="Instructor accounts and course scheduling"
              />
              <QuickNavCard
                href="/app/faculties"
                icon={<HatGraduation20Regular aria-hidden />}
                title="Faculties & Curriculum"
                description="Manage degree departments and semester courses"
              />
              <QuickNavCard
                href="/app/auto-absent"
                icon={<Pulse20Regular aria-hidden />}
                title="Auto-Absent System"
                description="Monitor and execute scheduled automated absent tracking"
              />
              <QuickNavCard
                href="/app/calendar-settings"
                icon={<CalendarClock20Regular aria-hidden />}
                title="Academic Calendar"
                description="Configure semesters, institutional holidays, and terms"
              />
              <QuickNavCard
                href="/app/analytics"
                icon={<DataTrending20Regular aria-hidden />}
                title="Analytics & Reports"
                description="Aggregated trends, risk alerts, and exportable logs"
              />
              <QuickNavCard
                href="/app/monitoring"
                icon={<DesktopPulse20Regular aria-hidden />}
                title="System Monitor"
                description="Live daemon status and health diagnostics"
              />
              <QuickNavCard
                href="/app/notifications"
                icon={<Alert20Regular aria-hidden />}
                title="Notifications"
                description="Campus-wide announcements and alerts"
              />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Dashboard;
