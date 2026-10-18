import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import TeacherSidebar from '@/components/TeacherSidebar';
import {
  ArrowLeft20Regular,
  ArrowSync20Regular,
  CheckmarkCircle16Regular,
  CheckmarkCircle20Regular,
  Clock16Regular,
  DataBarVertical20Regular,
  DataBarVertical24Regular,
  DataTrending20Regular,
  DismissCircle16Regular,
  DismissCircle20Regular,
  People20Regular,
  People24Regular,
} from '@fluentui/react-icons';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, parseApiError, type MetricsBlock, type TermState, type TermSummary } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';
import SemesterFilter from '@/components/filters/SemesterFilter';
import TermStateBanner from '@/components/TermStateBanner';
import { useAttendancePolicy } from '@/hooks/useAttendancePolicy';
import { cn } from '@/lib/utils';
import {
  barWidth,
  formatPercent,
  metricTone,
  readMetrics,
  resolveBand,
  TONE_BADGE,
  TONE_CSS_VAR,
  TONE_FILL,
  toneForBand,
} from '@/utils/metricsDisplay';

interface StudentAttendance extends MetricsBlock {
  id?: number;
  student_id: string;
  student_name: string;
}

interface AnalyticsData extends MetricsBlock {
  subject_id: number;
  total_students: number;
  overall_stats: {
    present: number;
    absent: number;
    late: number;
    excused?: number;
  };
  student_attendance: StudentAttendance[];
  sessions?: { held?: number; unrecorded?: number; cancelled?: number; upcoming?: number };
  term?: TermSummary | null;
  term_state?: TermState;
}

/** Shared Recharts styling — every colour comes from theme CSS variables. */
const AXIS_TICK = { fill: 'var(--text-muted)', fontSize: 12 };
const CATEGORY_TICK = { fill: 'var(--text-secondary)', fontSize: 12 };
const TOOLTIP_PROPS = {
  cursor: { fill: 'var(--surface-hover)' },
  contentStyle: {
    background: 'var(--surface-raised)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 4,
    boxShadow: 'var(--shadow-16)',
    color: 'var(--text-primary)',
    fontSize: 12,
    padding: '6px 10px',
  },
  labelStyle: { color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: 'var(--text-secondary)', padding: 0 },
};

const TeacherSubjectAnalytics: React.FC = () => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSemester = Number(searchParams.get('semester') || 1);
  const [semester, setSemester] = useState<number>(initialSemester);
  const { data: policy } = useAttendancePolicy();

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.teacher.getSubjectAnalytics(parseInt(subjectId!), semester);
      setAnalytics(data);
    } catch (err: unknown) {
      console.error('Error fetching analytics:', err);
      toast({
        title: 'Error',
        description: parseApiError(err).message || 'Failed to load analytics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [subjectId, semester, toast]);

  useEffect(() => {
    if (subjectId) {
      fetchAnalytics();
    }
  }, [subjectId, fetchAnalytics]);

  // Keep URL in sync when semester changes
  useEffect(() => {
    const next = new URLSearchParams(window.location.search || '');
    next.set('semester', String(semester));
    setSearchParams(next, { replace: true });
  }, [semester, setSearchParams]);

  if (loading) {
    return (
      <TeacherSidebar>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <ArrowSync20Regular className="mx-auto h-8 w-8 animate-spin text-brand-foreground" aria-hidden />
            <p className="text-body text-text-muted">Loading analytics...</p>
          </div>
        </div>
      </TeacherSidebar>
    );
  }

  if (!analytics) {
    return (
      <TeacherSidebar>
        <div className="mx-auto max-w-7xl space-y-4">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 text-text-secondary"
            onClick={() => navigate('/teacher')}
          >
            <ArrowLeft20Regular aria-hidden />
            Back to Dashboard
          </Button>
          <div className="flex flex-col items-center rounded-lg bg-surface-default py-14 text-center shadow">
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
              <DataBarVertical24Regular aria-hidden />
            </div>
            <p className="text-subheading text-text-primary">No analytics data available</p>
          </div>
        </div>
      </TeacherSidebar>
    );
  }

  // All percentages come from the server; null = no counted classes yet.
  const overall = readMetrics(analytics);
  const overallStats = {
    present: analytics.overall_stats?.present ?? 0,
    absent: analytics.overall_stats?.absent ?? 0,
    late: analytics.overall_stats?.late ?? 0,
  };
  const totalRecords = overallStats.present + overallStats.absent + overallStats.late;
  const students = analytics.student_attendance ?? [];
  const studentMetrics = students.map((st) => ({
    student: st,
    m: readMetrics(st, ['attendance_percentage', 'attendance_rate']),
  }));

  // ---- Chart data (counts only; presentation) ----
  const recordsData = [
    { label: 'Present', value: overallStats.present, color: 'var(--status-success)' },
    { label: 'Late', value: overallStats.late, color: 'var(--status-warning)' },
    { label: 'Absent', value: overallStats.absent, color: 'var(--status-error)' },
  ];

  // Students per policy band (server band first, else the server % classified by policy bands)
  const bandsData = (() => {
    const noData = studentMetrics.filter(({ m }) => !m.hasData).length;
    const rows: Array<{ label: string; value: number; color: string }> = [];
    if (policy?.bands.length) {
      policy.bands.forEach((band) => {
        const value = studentMetrics.filter(({ m }) => m.hasData && resolveBand(m, policy)?.name === band.name).length;
        rows.push({
          label: band.max === null ? `${band.label} (≥ ${band.min}%)` : `${band.label} (${band.min}–${band.max}%)`,
          value,
          color: TONE_CSS_VAR[toneForBand(band, policy)],
        });
      });
    } else {
      const byName = new Map<string, number>();
      studentMetrics.forEach(({ m }) => {
        if (m.hasData) byName.set(m.bandLabel || m.band || 'Unbanded', (byName.get(m.bandLabel || m.band || 'Unbanded') ?? 0) + 1);
      });
      byName.forEach((value, label) => rows.push({ label, value, color: TONE_CSS_VAR.info }));
    }
    if (noData > 0) rows.push({ label: 'No classes yet', value: noData, color: 'var(--border-default)' });
    return rows;
  })();

  const sessionsSummary = analytics.sessions;

  const kpis = [
    { label: 'Total Students', value: analytics.total_students, icon: People20Regular, chip: 'bg-brand-subtle text-brand-foreground' },
    { label: 'Present', value: overallStats.present, icon: CheckmarkCircle20Regular, chip: 'bg-status-success-subtle text-status-success' },
    { label: 'Absent', value: overallStats.absent, icon: DismissCircle20Regular, chip: 'bg-status-error-subtle text-status-error' },
    { label: 'Overall Rate', value: overall.hasData ? formatPercent(overall.percentage) : '—', icon: DataTrending20Regular, chip: 'bg-brand-subtle text-brand-foreground' },
  ];

  return (
    <TeacherSidebar>
      <div className="mx-auto max-w-7xl space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-text-secondary"
          onClick={() => navigate('/teacher')}
        >
          <ArrowLeft20Regular aria-hidden />
          Back to Dashboard
        </Button>

        {/* Header + filter */}
        <div className="page-header !mb-2">
          <div>
            <h1 className="text-page-title text-text-primary">Attendance analytics</h1>
            <p className="mt-1 text-body text-text-muted tabular-nums">
              Semester {semester} · {totalRecords} counted records
              {sessionsSummary && (
                <>
                  {' · '}
                  {sessionsSummary.held ?? 0} held
                  {(sessionsSummary.unrecorded ?? 0) > 0 && `, ${sessionsSummary.unrecorded} not recorded`}
                  {(sessionsSummary.cancelled ?? 0) > 0 && `, ${sessionsSummary.cancelled} cancelled`}
                </>
              )}
            </p>
          </div>
          <SemesterFilter value={semester} onChange={setSemester} />
        </div>

        <TermStateBanner termState={analytics.term_state} term={analytics.term} />

        {/* KPI tiles */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(({ label, value, icon: Icon, chip }) => (
            <div key={label} className="flex items-start justify-between gap-3 rounded-lg bg-surface-default p-4 shadow">
              <div>
                <p className="text-caption text-text-muted">{label}</p>
                <p className="mt-1 text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{value}</p>
              </div>
              <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-md', chip)}>
                <Icon aria-hidden />
              </div>
            </div>
          ))}
        </div>

        {/* Report charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-lg bg-surface-default shadow">
            <div className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-subheading text-text-primary">Attendance records</h2>
              <p className="text-caption text-text-muted">Counted records this term, by status</p>
            </div>
            <div className="h-[180px] px-3 py-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={recordsData} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 4 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border-subtle)" />
                  <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" width={64} tick={CATEGORY_TICK} axisLine={false} tickLine={false} />
                  <Tooltip
                    {...TOOLTIP_PROPS}
                    formatter={(value: number) => [value, 'Records']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
                    {recordsData.map((d) => (
                      <Cell key={d.label} fill={d.color} />
                    ))}
                    <LabelList dataKey="value" position="right" fill="var(--text-primary)" fontSize={12} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-lg bg-surface-default shadow">
            <div className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-subheading text-text-primary">Students by attendance band</h2>
              <p className="text-caption text-text-muted">
                Number of students in each policy band{policy ? ` (minimum ${policy.minimum_percentage}%)` : ''}
              </p>
            </div>
            <div className="h-[180px] px-3 py-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bandsData} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 4 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border-subtle)" />
                  <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" width={132} tick={CATEGORY_TICK} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_PROPS} formatter={(value: number) => [value, 'Students']} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
                    {bandsData.map((d) => (
                      <Cell key={d.label} fill={d.color} />
                    ))}
                    <LabelList dataKey="value" position="right" fill="var(--text-primary)" fontSize={12} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* Student Attendance DataGrid */}
        <section className="overflow-hidden rounded-lg bg-surface-default shadow">
          <div className="flex items-center gap-3 border-b border-border-subtle px-5 py-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
              <DataBarVertical20Regular aria-hidden />
            </div>
            <div>
              <h2 className="text-subheading text-text-primary">Student Attendance Details</h2>
              <p className="text-caption text-text-muted">Individual attendance breakdown for all students</p>
            </div>
          </div>

          {students.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                <People24Regular aria-hidden />
              </div>
              <p className="text-subheading text-text-primary">No attendance records available</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="normal-case tracking-normal text-caption-strong text-text-secondary">Student</TableHead>
                  <TableHead className="hidden text-right normal-case tracking-normal text-caption-strong text-text-secondary sm:table-cell">Classes</TableHead>
                  <TableHead className="text-right normal-case tracking-normal text-caption-strong text-text-secondary">
                    <span className="inline-flex items-center gap-1"><CheckmarkCircle16Regular className="text-status-success" aria-hidden />Present</span>
                  </TableHead>
                  <TableHead className="text-right normal-case tracking-normal text-caption-strong text-text-secondary">
                    <span className="inline-flex items-center gap-1"><DismissCircle16Regular className="text-status-error" aria-hidden />Absent</span>
                  </TableHead>
                  <TableHead className="text-right normal-case tracking-normal text-caption-strong text-text-secondary">
                    <span className="inline-flex items-center gap-1"><Clock16Regular className="text-status-warning" aria-hidden />Late</span>
                  </TableHead>
                  <TableHead className="normal-case tracking-normal text-caption-strong text-text-secondary">Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentMetrics.map(({ student, m }) => {
                  const tone = metricTone(m, policy);
                  return (
                    <TableRow key={student.id ?? student.student_id} className="hover:bg-surface-hover">
                      <TableCell className="py-2.5">
                        <p className="text-body-strong text-text-primary">{student.student_name}</p>
                        <p className="font-mono text-caption text-text-muted">{student.student_id}</p>
                      </TableCell>
                      <TableCell className="hidden py-2.5 text-right text-body tabular-nums text-text-secondary sm:table-cell">
                        {m.considered ?? student.total_classes ?? 0}
                      </TableCell>
                      <TableCell className="py-2.5 text-right text-body tabular-nums text-text-primary">{m.present}</TableCell>
                      <TableCell className="py-2.5 text-right text-body tabular-nums text-text-primary">{m.absent}</TableCell>
                      <TableCell className="py-2.5 text-right text-body tabular-nums text-text-primary">{m.late}</TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-surface-subtle ring-1 ring-inset ring-border-subtle md:block"
                            role="progressbar"
                            aria-valuenow={m.percentage ?? undefined}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${student.student_name} attendance`}
                          >
                            <div
                              className={cn('h-full rounded-full', TONE_FILL[tone])}
                              style={{ width: `${barWidth(m.percentage)}%` }}
                            />
                          </div>
                          <Badge variant={TONE_BADGE[tone]} shape="pill" className="tabular-nums">
                            {m.hasData ? formatPercent(m.percentage) : 'No classes yet'}
                          </Badge>
                          {m.provisional && (
                            <span className="hidden text-caption text-text-muted lg:inline" title="Some sessions are not recorded yet">
                              provisional
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </TeacherSidebar>
  );
};

export default TeacherSubjectAnalytics;
