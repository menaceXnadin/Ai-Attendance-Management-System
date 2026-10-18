import React, { useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CalendarLtr20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  ArrowLeft20Regular,
  CheckmarkCircle16Regular,
  CheckmarkCircle20Regular,
  DismissCircle16Regular,
  DismissCircle20Regular,
  Warning16Regular,
  Clock16Regular,
  Info16Regular,
  Book20Regular,
  DataBarVertical20Regular,
  Location16Regular,
  Fire20Regular,
  Prohibited16Regular,
  QuestionCircle16Regular,
  DataTrending20Regular,
} from '@fluentui/react-icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { api, type MetricsBlock, type TermState, type TermSummary } from '@/integrations/api/client';
import TermStateBanner from '@/components/TermStateBanner';
import { useAttendancePolicy } from '@/hooks/useAttendancePolicy';
import {
  barWidth,
  formatPercent,
  localDateString,
  meetsMinimum,
  metricTone,
  parseLocalDate,
  readMetrics,
  TONE_BADGE,
  TONE_CSS_VAR,
} from '@/utils/metricsDisplay';

// Day statuses from the metrics service (+ legacy values kept for old payloads).
const STATUS_STYLES: Record<string, { label: string; pill: string; dot: string; text: string }> = {
  present: {
    label: 'Present',
    pill: 'bg-status-success-subtle text-status-success border-status-success-border',
    dot: 'bg-status-success',
    text: 'text-status-success',
  },
  absent: {
    label: 'Absent',
    pill: 'bg-status-error-subtle text-status-error border-status-error-border',
    dot: 'bg-status-error',
    text: 'text-status-error',
  },
  partial: {
    label: 'Partial',
    pill: 'bg-surface-default text-status-warning border-status-warning-border',
    dot: 'bg-status-warning',
    text: 'text-status-warning',
  },
  late: {
    label: 'Late',
    pill: 'bg-status-warning-subtle text-status-warning border-status-warning-border',
    dot: 'bg-status-warning',
    text: 'text-status-warning',
  },
  excused: {
    label: 'Excused',
    pill: 'bg-status-info-subtle text-status-info border-status-info-border',
    dot: 'bg-status-info',
    text: 'text-status-info',
  },
  cancelled: {
    label: 'Cancelled',
    pill: 'bg-surface-subtle text-text-muted border-border-default',
    dot: 'bg-presence-offline',
    text: 'text-text-muted',
  },
  unrecorded: {
    label: 'Not recorded',
    pill: 'bg-surface-subtle text-text-secondary border-dashed border-border-default',
    dot: 'bg-presence-offline',
    text: 'text-text-secondary',
  },
  holiday: {
    label: 'Holiday',
    pill: 'bg-brand-subtle text-brand-foreground border-brand-stroke/50',
    dot: 'bg-brand',
    text: 'text-brand-foreground',
  },
  exam: {
    label: 'Exam',
    pill: 'bg-brand-subtle text-brand-foreground border-brand-stroke/50',
    dot: 'bg-brand',
    text: 'text-brand-foreground',
  },
  weekly_off: {
    label: 'Day off',
    pill: 'bg-surface-subtle text-text-muted border-border-subtle',
    dot: 'bg-border-default',
    text: 'text-text-muted',
  },
  between_terms: {
    label: 'Between terms',
    pill: 'bg-surface-subtle text-text-muted border-border-subtle',
    dot: 'bg-border-default',
    text: 'text-text-muted',
  },
  no_class: {
    label: 'No classes',
    pill: 'bg-surface-subtle text-text-muted border-border-subtle',
    dot: 'bg-border-default',
    text: 'text-text-muted',
  },
  future: {
    label: 'Upcoming',
    pill: 'bg-surface-subtle text-text-muted border-border-subtle',
    dot: 'bg-border-default',
    text: 'text-text-muted',
  },
  // legacy payloads
  system_inactive: {
    label: 'System Inactive',
    pill: 'bg-surface-subtle text-text-muted border-dashed border-border-default',
    dot: 'bg-presence-offline',
    text: 'text-text-muted',
  },
  no_data: {
    label: 'No classes',
    pill: 'bg-surface-subtle text-text-muted border-border-subtle',
    dot: 'bg-border-default',
    text: 'text-text-muted',
  },
};

const statusStyle = (status: string) => STATUS_STYLES[status] ?? STATUS_STYLES.no_class;

/** Statuses that render no pill in the grid (nothing to report). */
const QUIET_STATUSES = new Set(['no_class', 'no_data', 'future', 'between_terms']);
/** Muted cell background. */
const MUTED_CELL_STATUSES = new Set(['weekly_off', 'between_terms', 'system_inactive', 'holiday']);

const LEGEND: ReadonlyArray<string> = [
  'present',
  'partial',
  'absent',
  'excused',
  'unrecorded',
  'cancelled',
  'holiday',
  'exam',
  'weekly_off',
  'no_class',
];

interface DayRecord {
  id: number;
  status: string;
  subject_id: number;
  subject_name: string;
  session_id?: number | null;
  source?: string | null;
  excluded_from_metrics?: boolean;
  exclusion_reason?: string | null;
  countable?: boolean;
  time_in?: string;
  time_out?: string;
  location?: string;
  notes?: string;
}

interface CalendarDay {
  date: string;
  day: number;
  weekday: string;
  status: string;
  reason?: string | null;
  total_classes: number;
  present: number;
  absent: number;
  late: number;
  attended?: number;
  excused?: number;
  events?: Array<Record<string, unknown>>;
  records: DayRecord[];
}

interface CalendarStatistics extends MetricsBlock {
  current_streak?: number;
  longest_streak?: number;
  days_with_classes?: number;
}

interface SubjectBreakdown extends MetricsBlock {
  subject_id?: number;
  subject_name: string;
  subject_code?: string;
}

interface StudentCalendarData {
  student_id: number;
  student_name: string;
  student_number: string;
  year: number;
  month: number;
  month_name: string;
  calendar_days: CalendarDay[];
  statistics: CalendarStatistics;
  subject_breakdown: SubjectBreakdown[];
  term_statistics?: CalendarStatistics & { streak?: { current?: number; longest?: number } };
  term_subject_breakdown?: SubjectBreakdown[];
  term?: TermSummary | null;
  term_state?: TermState;
}

interface StudentAttendanceCalendarProps {
  studentId?: string;
  hideBackButton?: boolean;
}

const formatTime = (time?: string) => {
  if (!time) return 'Not recorded';
  if (/^\d{2}:\d{2}$/.test(time)) return time;
  const dateTime = new Date(time);
  if (!isNaN(dateTime.getTime())) {
    return dateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  return time;
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'present':
      return <CheckmarkCircle16Regular aria-hidden />;
    case 'absent':
      return <DismissCircle16Regular aria-hidden />;
    case 'partial':
    case 'late':
      return <Warning16Regular aria-hidden />;
    case 'excused':
      return <Info16Regular aria-hidden />;
    case 'cancelled':
      return <Prohibited16Regular aria-hidden />;
    case 'unrecorded':
      return <QuestionCircle16Regular aria-hidden />;
    case 'system_inactive':
      return <Clock16Regular aria-hidden />;
    default:
      return null;
  }
};

const eventTitle = (e: Record<string, unknown>) =>
  String(e.title ?? e.name ?? e.event_type ?? 'Event');

const StudentAttendanceCalendar = ({ studentId: propStudentId, hideBackButton = false }: StudentAttendanceCalendarProps = {}) => {
  const { studentId: paramStudentId } = useParams<{ studentId: string }>();
  const studentId = propStudentId || paramStudentId;
  const navigate = useNavigate();
  const { data: policy } = useAttendancePolicy();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [breakdownScope, setBreakdownScope] = useState<'month' | 'term'>('month');
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const { data: calendarData, isLoading, error, isFetching } = useQuery<StudentCalendarData, Error, StudentCalendarData>({
    queryKey: ['student-calendar', studentId, year, month, propStudentId ? 'student' : 'admin'],
    queryFn: async () => {
      // Student view (prop) → /me; admin view (route param) → /{studentId}
      const data = propStudentId
        ? await api.attendance.getMyCalendar(year, month)
        : await api.attendance.getStudentCalendar(Number(studentId), year, month);
      return data as StudentCalendarData;
    },
    enabled: !!studentId,
    retry: 1,
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });

  const goToPreviousMonth = () =>
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const goToNextMonth = () =>
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const calendarGrid = useMemo(() => {
    if (!calendarData) return [];
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
    const grid: Array<CalendarDay | null> = Array(firstDay).fill(null);
    (calendarData.calendar_days ?? []).forEach((day) => grid.push(day));
    return grid;
  }, [calendarData, year, month]);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-[3px] border-brand-subtle border-t-brand" />
          <p className="text-body text-text-muted">Loading attendance calendar...</p>
        </div>
      </div>
    );
  }

  if (error || !calendarData) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6">
        <Card className="max-w-md border-0 bg-surface-default shadow">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-status-error-subtle text-status-error">
              <DismissCircle20Regular aria-hidden />
            </div>
            <h2 className="mb-1 text-section-title text-text-primary">Error Loading Calendar</h2>
            <p className="mb-6 text-body text-text-muted">
              Unable to fetch attendance calendar data. Please try again.
            </p>
            {!hideBackButton && (
              <Button variant="outline" onClick={() => navigate('/app/students')}>
                <ArrowLeft20Regular aria-hidden />
                Back to Students
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = calendarData.statistics ?? {};
  const month_m = readMetrics(stats, ['attendance_rate', 'percentage_present']);
  const term_m = calendarData.term_statistics
    ? readMetrics(calendarData.term_statistics, ['attendance_rate', 'percentage_present'])
    : null;
  const termEligible = term_m ? meetsMinimum(term_m, policy) : null;
  const currentStreak = stats.current_streak ?? calendarData.term_statistics?.streak?.current ?? 0;
  const longestStreak = stats.longest_streak ?? calendarData.term_statistics?.streak?.longest ?? 0;
  const monthConsidered = month_m.considered ?? month_m.present + month_m.late + month_m.absent;
  const breakdown =
    breakdownScope === 'term' && calendarData.term_subject_breakdown
      ? calendarData.term_subject_breakdown
      : calendarData.subject_breakdown ?? [];
  const todayStr = localDateString();

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {!hideBackButton && (
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/students')} aria-label="Back" title="Back">
            <ArrowLeft20Regular aria-hidden />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-page-title text-text-primary">Attendance Calendar</h1>
          <p className="truncate text-body text-text-muted">
            {calendarData.student_name} ({calendarData.student_number})
          </p>
        </div>
      </div>

      <TermStateBanner termState={calendarData.term_state} term={calendarData.term} />

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
        <Card className="border-0 bg-surface-default shadow">
          <CardContent className="p-4">
            <div className="mb-3 grid h-9 w-9 place-items-center rounded-md bg-status-success-subtle text-status-success">
              <CheckmarkCircle20Regular aria-hidden />
            </div>
            <p className="text-caption text-text-muted">This Month</p>
            <p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">
              {formatPercent(month_m.percentage)}
            </p>
            <Progress value={barWidth(month_m.percentage)} className="my-1.5 h-1" />
            <p className="text-caption text-text-muted">
              {month_m.hasData
                ? `${month_m.attended ?? month_m.present + month_m.late} of ${monthConsidered} classes attended`
                : 'No classes yet'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-surface-default shadow">
          <CardContent className="p-4">
            <div className="mb-3 grid h-9 w-9 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
              <Book20Regular aria-hidden />
            </div>
            <p className="text-caption text-text-muted">Classes Counted</p>
            <p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{monthConsidered}</p>
            <div className="flex flex-wrap items-center gap-x-3 text-caption tabular-nums">
              <span className="text-status-success">P: {month_m.present}</span>
              <span className="text-status-error">A: {month_m.absent}</span>
              <span className="text-status-warning">L: {month_m.late}</span>
              {month_m.excused > 0 && <span className="text-status-info">E: {month_m.excused}</span>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-surface-default shadow">
          <CardContent className="p-4">
            <div className="mb-3 grid h-9 w-9 place-items-center rounded-md bg-status-warning-subtle text-status-warning">
              <Fire20Regular aria-hidden />
            </div>
            <p className="text-caption text-text-muted">Current Streak</p>
            <p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">
              {currentStreak}
              <span className="ml-1 text-body font-normal text-text-muted">days</span>
            </p>
            <p className="text-caption text-text-muted">Longest this term: {longestStreak} days</p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-surface-default shadow">
          <CardContent className="p-4">
            <div className="mb-3 grid h-9 w-9 place-items-center rounded-md bg-status-error-subtle text-status-error">
              <DismissCircle20Regular aria-hidden />
            </div>
            <p className="text-caption text-text-muted">Absences</p>
            <p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{month_m.absent}</p>
            <p className="text-caption text-text-muted">
              {month_m.hasData ? `of ${monthConsidered} counted classes this month` : 'No classes yet'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-surface-default shadow">
          <CardContent className="p-4">
            <div className="mb-3 grid h-9 w-9 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
              <DataTrending20Regular aria-hidden />
            </div>
            <p className="text-caption text-text-muted">{calendarData.term?.name ?? 'This Term'}</p>
            <p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">
              {term_m ? formatPercent(term_m.percentage) : '—'}
            </p>
            <p className="text-caption text-text-muted">
              {!term_m || !term_m.hasData
                ? 'No classes yet'
                : termEligible === true
                  ? `Meets ${policy ? `${policy.minimum_percentage}% ` : ''}minimum`
                  : termEligible === false
                    ? `Below ${policy ? `${policy.minimum_percentage}% ` : 'the '}minimum`
                    : 'Term to date'}
              {term_m?.provisional ? ' · provisional' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar View */}
      <Card className="overflow-hidden border-0 bg-surface-default shadow">
        <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border-subtle px-4 py-3">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="mr-2">
              <CalendarLtr20Regular aria-hidden />
              Today
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={goToPreviousMonth} aria-label="Previous month" title="Previous month">
              <ChevronLeft20Regular aria-hidden />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={goToNextMonth} aria-label="Next month" title="Next month">
              <ChevronRight20Regular aria-hidden />
            </Button>
            <CardTitle className="ml-2 text-subheading text-text-primary">
              {calendarData.month_name} {calendarData.year}
            </CardTitle>
          </div>
          {isFetching && (
            <span className="text-caption text-text-muted" aria-live="polite">Updating…</span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border-subtle bg-surface-subtle">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
              <div key={idx} className="px-2 py-1.5 text-caption-strong text-text-secondary">
                <span className="sm:hidden">{day}</span>
                <span className="hidden sm:inline">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][idx]}</span>
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calendarGrid.map((day, index) => {
              const cellBorder = `border-b border-border-subtle ${index % 7 !== 6 ? 'border-r' : ''}`;
              if (!day) {
                return <div key={`empty-${index}`} className={`min-h-[64px] bg-surface-subtle sm:min-h-[92px] ${cellBorder}`} />;
              }

              const isToday = day.date === todayStr;
              const s = statusStyle(day.status);
              const hasStatus = !QUIET_STATUSES.has(day.status);
              const attended = day.attended ?? day.present;

              return (
                <button
                  key={day.date}
                  onClick={() => {
                    setSelectedDay(day);
                    setIsDialogOpen(true);
                  }}
                  className={`group flex min-h-[64px] flex-col items-stretch gap-1 p-1.5 text-left transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover focus-visible:relative focus-visible:z-10 sm:min-h-[92px] sm:p-2 ${cellBorder} ${
                    MUTED_CELL_STATUSES.has(day.status) ? 'bg-surface-subtle' : 'bg-surface-default'
                  }`}
                  title={`View details for ${day.weekday}, ${day.date}`}
                  aria-label={`${day.weekday}, ${day.date}: ${s.label}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`grid h-6 min-w-[1.5rem] place-items-center rounded-full px-1 text-caption-strong tabular-nums sm:text-body-strong ${
                        isToday ? 'bg-brand text-brand-on' : 'text-text-primary'
                      }`}
                    >
                      {day.day}
                    </span>
                    {hasStatus && <span className={`hidden sm:inline-flex ${s.text}`}>{getStatusIcon(day.status)}</span>}
                    {hasStatus && <span className={`h-2 w-2 rounded-full sm:hidden ${s.dot}`} aria-hidden />}
                  </div>
                  {hasStatus && (
                    <span className={`mt-auto hidden items-center gap-1 truncate rounded-sm border px-1.5 py-0.5 text-caption sm:inline-flex ${s.pill}`}>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} aria-hidden />
                      <span className="truncate">{s.label}</span>
                    </span>
                  )}
                  {attended > 0 && (
                    <span className="hidden text-caption tabular-nums text-text-muted sm:block">{attended} attended</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <span className="text-caption-strong text-text-secondary">Legend:</span>
            {LEGEND.map((key) => {
              const s = STATUS_STYLES[key];
              return (
                <span key={key} className="inline-flex items-center gap-1.5 text-caption text-text-secondary">
                  <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} aria-hidden />
                  {s.label}
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-[95vw] gap-0 overflow-hidden rounded-lg border-border-subtle bg-surface-raised p-0 shadow-xl sm:max-h-[75vh] sm:max-w-lg">
          {selectedDay && (
            <>
              <DialogHeader className="border-b border-border-subtle px-6 pb-3 pt-5 text-left">
                <DialogTitle className="flex items-center gap-2 text-section-title text-text-primary">
                  <CalendarLtr20Regular className="shrink-0 text-text-muted" aria-hidden />
                  <span className="truncate">
                    {selectedDay.weekday},{' '}
                    {parseLocalDate(selectedDay.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-caption text-text-muted">Attendance details</DialogDescription>
              </DialogHeader>

              <div className="max-h-[calc(85vh-7rem)] space-y-5 overflow-y-auto px-6 py-4 sm:max-h-[calc(75vh-8rem)]">
                {/* Day Summary */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-body-strong text-text-primary">
                      <DataBarVertical20Regular className="text-text-muted" aria-hidden />
                      Daily Summary
                    </h3>
                    <Badge shape="pill" className={`gap-1 border ${statusStyle(selectedDay.status).pill}`}>
                      {getStatusIcon(selectedDay.status)}
                      <span>{statusStyle(selectedDay.status).label}</span>
                    </Badge>
                  </div>
                  {selectedDay.reason && (
                    <p className="text-caption text-text-muted">{String(selectedDay.reason).replace(/_/g, ' ')}</p>
                  )}

                  <Separator className="bg-border-subtle" />

                  <div className="grid grid-cols-4 gap-2">
                    <div className="rounded-md border border-border-subtle bg-surface-subtle p-2">
                      <div className="text-caption text-text-muted">Records</div>
                      <div className="text-section-title tabular-nums text-text-primary">{selectedDay.records?.length ?? 0}</div>
                    </div>
                    <div className="rounded-md border border-status-success-border bg-status-success-subtle p-2">
                      <div className="text-caption text-status-success">Present</div>
                      <div className="text-section-title tabular-nums text-text-primary">{selectedDay.present ?? 0}</div>
                    </div>
                    <div className="rounded-md border border-status-error-border bg-status-error-subtle p-2">
                      <div className="text-caption text-status-error">Absent</div>
                      <div className="text-section-title tabular-nums text-text-primary">{selectedDay.absent ?? 0}</div>
                    </div>
                    <div className="rounded-md border border-status-warning-border bg-status-warning-subtle p-2">
                      <div className="text-caption text-status-warning">Late</div>
                      <div className="text-section-title tabular-nums text-text-primary">{selectedDay.late ?? 0}</div>
                    </div>
                  </div>
                  {(selectedDay.excused ?? 0) > 0 && (
                    <p className="text-caption text-text-muted">{selectedDay.excused} excused (not counted)</p>
                  )}
                  {Array.isArray(selectedDay.events) && selectedDay.events.length > 0 && (
                    <ul className="space-y-1">
                      {selectedDay.events.map((e, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-caption text-text-secondary">
                          <Info16Regular className="shrink-0 text-status-info" aria-hidden />
                          {eventTitle(e)}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Records */}
                <section className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-body-strong text-text-primary">
                    <Book20Regular className="text-text-muted" aria-hidden />
                    Class Records
                  </h3>
                  {!selectedDay.records || selectedDay.records.length === 0 ? (
                    <div className="flex flex-col items-center py-6 text-center">
                      <div className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-surface-subtle text-text-muted">
                        <DismissCircle20Regular aria-hidden />
                      </div>
                      <p className="text-body text-text-muted">No attendance records</p>
                      {selectedDay.status === 'unrecorded' && (
                        <p className="mt-0.5 text-caption text-text-muted">
                          A class was scheduled but attendance has not been recorded yet. It is not counted against you.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedDay.records.map((record, index) => {
                        const rs = statusStyle(record.status);
                        const notCounted = record.excluded_from_metrics || record.countable === false;
                        return (
                          <div key={record.id || index} className="rounded-md border border-border-subtle bg-surface-default p-3">
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h4 className="truncate text-body-strong text-text-primary">{record.subject_name}</h4>
                                {record.location && record.location !== 'AUTO_ABSENT_SYSTEM' && (
                                  <div className="flex items-center gap-1 text-caption text-text-muted">
                                    <Location16Regular aria-hidden />
                                    {record.location}
                                  </div>
                                )}
                                {notCounted && (
                                  <p className="text-caption text-text-muted">
                                    Not counted{record.exclusion_reason ? ` · ${record.exclusion_reason.replace(/_/g, ' ')}` : ''}
                                  </p>
                                )}
                              </div>
                              <Badge shape="pill" className={`gap-1 border ${rs.pill}`}>
                                {getStatusIcon(record.status)}
                                <span>{rs.label}</span>
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-sm bg-surface-subtle px-2 py-1.5">
                                <div className="flex items-center gap-1 text-caption text-text-muted">
                                  <Clock16Regular className="text-status-success" aria-hidden />
                                  In
                                </div>
                                <div className="text-body tabular-nums text-text-primary">{formatTime(record.time_in)}</div>
                              </div>
                              <div className="rounded-sm bg-surface-subtle px-2 py-1.5">
                                <div className="flex items-center gap-1 text-caption text-text-muted">
                                  <Clock16Regular className="text-status-error" aria-hidden />
                                  Out
                                </div>
                                <div className="text-body tabular-nums text-text-primary">{formatTime(record.time_out)}</div>
                              </div>
                            </div>

                            {record.notes && (
                              <div className="mt-2 flex items-start gap-1.5 rounded-md border border-status-info-border bg-status-info-subtle px-2 py-1.5">
                                <Info16Regular className="mt-0.5 shrink-0 text-status-info" aria-hidden />
                                <div className="min-w-0 flex-1">
                                  <div className="text-caption-strong text-text-primary">Note</div>
                                  <div className="line-clamp-2 text-caption text-text-secondary">{record.notes}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Subject Breakdown */}
      <Card className="border-0 bg-surface-default shadow">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 border-b border-border-subtle px-5 py-4">
          <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
            <DataBarVertical20Regular className="text-text-muted" aria-hidden />
            Subject-wise Breakdown
          </CardTitle>
          <div className="flex items-center gap-2">
            {calendarData.term_subject_breakdown && (
              <div role="radiogroup" aria-label="Breakdown period" className="inline-flex rounded-md border border-border-default p-0.5">
                {(['month', 'term'] as const).map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    role="radio"
                    aria-checked={breakdownScope === scope}
                    onClick={() => setBreakdownScope(scope)}
                    className={`h-6 rounded px-2 text-caption-strong transition-colors duration-150 ease-fluent-standard ${
                      breakdownScope === scope ? 'bg-brand-subtle text-brand-foreground' : 'text-text-secondary hover:bg-surface-hover'
                    }`}
                  >
                    {scope === 'month' ? 'This month' : 'This term'}
                  </button>
                ))}
              </div>
            )}
            <Badge variant="secondary" shape="pill">
              {breakdown.length} Subjects
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {breakdown.length === 0 ? (
            <p className="px-5 py-6 text-center text-body text-text-muted">No subjects with classes in this period.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {breakdown.map((subject) => {
                const m = readMetrics(subject, ['attendance_percentage', 'attendance_rate']);
                const tone = metricTone(m, policy);
                const ok = meetsMinimum(m, policy);
                const counted = m.considered ?? m.present + m.late + m.absent;
                return (
                  <li key={`${subject.subject_id ?? subject.subject_name}`} className="px-5 py-3.5 transition-colors hover:bg-surface-hover">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-body-strong text-text-primary">{subject.subject_name}</h4>
                        <p className="text-caption text-text-muted">
                          Counted classes: <span className="tabular-nums text-text-secondary">{counted}</span>
                          {m.unrecorded > 0 && <span> · {m.unrecorded} not recorded yet</span>}
                        </p>
                      </div>
                      <Badge variant={TONE_BADGE[tone]} shape="pill" className="font-semibold">
                        {m.hasData ? formatPercent(m.percentage) : 'No classes yet'}
                      </Badge>
                    </div>

                    <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                      <div
                        className="h-full rounded-full transition-all duration-300 ease-fluent-decelerate"
                        style={{ width: `${barWidth(m.percentage)}%`, background: TONE_CSS_VAR[tone] }}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-4 text-caption">
                        <span className="flex items-center gap-1.5 text-text-muted">
                          <span className="h-2 w-2 rounded-full bg-status-success" aria-hidden />
                          P: <span className="font-semibold tabular-nums text-text-primary">{m.present}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-text-muted">
                          <span className="h-2 w-2 rounded-full bg-status-error" aria-hidden />
                          A: <span className="font-semibold tabular-nums text-text-primary">{m.absent}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-text-muted">
                          <span className="h-2 w-2 rounded-full bg-status-warning" aria-hidden />
                          L: <span className="font-semibold tabular-nums text-text-primary">{m.late}</span>
                        </span>
                      </div>

                      {ok === true && (
                        <div className="flex items-center gap-1 text-status-success">
                          <CheckmarkCircle16Regular aria-hidden />
                          <span className="text-caption-strong">Meets minimum{m.provisional ? ' (provisional)' : ''}</span>
                        </div>
                      )}
                      {ok === false && (
                        <div className="flex items-center gap-1 text-status-error">
                          <Warning16Regular aria-hidden />
                          <span className="text-caption-strong">Below minimum{m.provisional ? ' (provisional)' : ''}</span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentAttendanceCalendar;
