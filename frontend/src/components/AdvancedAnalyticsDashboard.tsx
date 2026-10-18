import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowDownload20Regular,
  ArrowMaximize16Regular,
  ArrowMinimize16Regular,
  ArrowRight16Regular,
  ArrowSync20Regular,
  ArrowTrending16Regular,
  ArrowTrending20Regular,
  ArrowTrendingDown16Regular,
  ArrowTrendingDown20Regular,
  BookOpen20Regular,
  CalendarLtr20Regular,
  CheckmarkCircle20Regular,
  ChevronDown16Regular,
  ClipboardTaskListLtr20Regular,
  Clock20Regular,
  DataBarVertical20Regular,
  DataTrending20Regular,
  Dismiss16Regular,
  DocumentTable20Regular,
  ErrorCircle20Regular,
  Eye20Regular,
  EyeOff20Regular,
  Filter20Regular,
  Lightbulb20Regular,
  People20Regular,
  Print20Regular,
  Pulse20Regular,
  Trophy20Regular,
  Warning20Regular,
} from '@fluentui/react-icons';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/integrations/api/client';
import {
  formatPercent,
  resolveBand,
  resolvePercentage,
  useAttendancePolicy,
  type BandView,
} from '@/components/attendance-admin/metrics';

interface AdvancedAnalyticsDashboardProps {
  className?: string;
}

interface FilterState {
  dateRange: 'today' | 'week' | 'month' | 'custom';
  startDate?: string;
  endDate?: string;
  showLowPerformers?: boolean;
}

interface SubjectAnalytics {
  subject_id: number;
  subject_name: string;
  subject_code: string;
  total_classes: number;
  present: number;
  absent: number;
  late: number;
  attendance_rate: number;
  unique_students: number;
  first_class: string | null;
  last_class: string | null;
}

interface DayBreakdown {
  date: string;
  day: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
}

interface TopPerformer {
  student_id: string;
  name: string;
  email: string;
  attendance_rate: number;
  total_classes: number;
  present_count: number;
  absent_count: number;
  trend: string;
  recent_rate: number;
  faculty: string;
  semester: number;
}

interface Insight {
  type: string;
  priority: string;
  title: string;
  description: string;
  action: string;
  icon: string;
}

/* ---------- Presentation helpers (Fluent 2 / Power BI report look) ---------- */

interface StatusTone {
  color: string;
  bgColor: string;
  bar: string;
  badge: 'success' | 'warning' | 'destructive' | 'brand' | 'secondary';
  status: string;
}

const NO_DATA_TONE: StatusTone = {
  color: 'text-text-muted',
  bgColor: 'bg-surface-subtle',
  bar: 'bg-border-strong',
  badge: 'secondary',
  status: 'No data',
};

const TONE_BY_BAND: Record<BandView['tone'], Omit<StatusTone, 'status'>> = {
  brand: { color: 'text-status-success', bgColor: 'bg-status-success-subtle', bar: 'bg-status-success', badge: 'success' },
  success: { color: 'text-status-success', bgColor: 'bg-status-success-subtle', bar: 'bg-status-success', badge: 'success' },
  warning: { color: 'text-status-warning', bgColor: 'bg-status-warning-subtle', bar: 'bg-status-warning', badge: 'warning' },
  destructive: { color: 'text-status-error', bgColor: 'bg-status-error-subtle', bar: 'bg-status-error', badge: 'destructive' },
  secondary: { color: 'text-text-muted', bgColor: 'bg-surface-subtle', bar: 'bg-border-strong', badge: 'secondary' },
};

const getInitials = (name?: string) =>
  (name || '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const RateBar: React.FC<{ value: number | null; barClass: string; className?: string }> = ({ value, barClass, className = '' }) => {
  const pct = typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-border-subtle ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ease-fluent-decelerate ${barClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

const ReportCardHeader: React.FC<{
  title: React.ReactNode;
  caption?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, caption, actions }) => (
  <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 border-b border-border-subtle px-5 py-4">
    <div className="min-w-0">
      <CardTitle className="text-subheading tracking-normal text-text-primary">{title}</CardTitle>
      {caption && <CardDescription className="mt-0.5 text-caption text-text-muted">{caption}</CardDescription>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </CardHeader>
);

const ExpandToggle: React.FC<{ expanded: boolean; onToggle: () => void; label: string }> = ({ expanded, onToggle, label }) => (
  <Button
    variant="ghost"
    size="icon-sm"
    onClick={onToggle}
    aria-pressed={expanded}
    aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
    title={expanded ? 'Collapse' : 'Expand'}
    className="text-text-muted hover:text-text-primary print:hidden"
  >
    {expanded ? <ArrowMinimize16Regular aria-hidden /> : <ArrowMaximize16Regular aria-hidden />}
  </Button>
);

const EmptyBlock: React.FC<{ icon: React.ReactNode; title: string; description?: string; className?: string }> = ({
  icon,
  title,
  description,
  className = '',
}) => (
  <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
    <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted [&>svg]:h-6 [&>svg]:w-6">
      {icon}
    </div>
    <p className="text-subheading text-text-primary">{title}</p>
    {description && <p className="mt-1 max-w-sm text-body text-text-muted">{description}</p>}
  </div>
);

interface PeriodTileProps {
  label: string;
  /** Server percentage; `null` renders "—". */
  rate: number | null;
  icon: React.ReactNode;
  tone: StatusTone;
  stats: { label: string; value: React.ReactNode; dot?: string }[];
}

const PeriodTile: React.FC<PeriodTileProps> = ({ label, rate, icon, tone, stats }) => (
  <Card className="shadow">
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption text-text-muted">{label}</p>
          <p className="mt-1 text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{formatPercent(rate)}</p>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
          {icon}
        </div>
      </div>
      <div className="mt-2">
        <Badge variant={tone.badge} shape="pill">
          {tone.status}
        </Badge>
      </div>
      <RateBar value={rate} barClass={tone.bar} className="mt-4" />
      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-border-subtle pt-3">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-caption text-text-muted">
              {stat.dot && <span className={`h-2 w-2 shrink-0 rounded-full ${stat.dot}`} aria-hidden />}
              {stat.label}
            </dt>
            <dd className="mt-0.5 text-body-strong tabular-nums text-text-primary">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </CardContent>
  </Card>
);

const thClass = 'px-4 py-2.5 font-semibold';
const rowClass =
  'border-b border-border-subtle last:border-b-0 transition-colors duration-150 ease-fluent-standard hover:bg-surface-hover';
const tdClass = 'px-4 py-2.5 text-body';

const AdvancedAnalyticsDashboard: React.FC<AdvancedAnalyticsDashboardProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'insights' | 'performance'>('overview');
  const [daysFilter, setDaysFilter] = useState(7);
  const [showFilters, setShowFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    dateRange: 'week',
    showLowPerformers: false
  });
  const [subjectsExpanded, setSubjectsExpanded] = useState(false);
  const policyView = useAttendancePolicy();
  const [trendsExpanded, setTrendsExpanded] = useState(false);

  // Fetch real data from new analytics endpoints
  const { data: dashboardSummary, isLoading: summaryLoading, error: summaryError } = useQuery({
    queryKey: ['analytics-dashboard-summary'],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/dashboard-summary');
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
    retry: 2,
  });

  const { data: weeklyBreakdown } = useQuery({
    queryKey: ['analytics-weekly-breakdown', daysFilter],
    queryFn: async () => {
      const { data } = await apiClient.get(`/analytics/weekly-breakdown?days=${daysFilter}`);
      return data;
    },
    refetchInterval: 60000,
    retry: 2,
  });

  const { data: topPerformers } = useQuery({
    queryKey: ['analytics-top-performers'],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/top-performers?limit=5');
      return data;
    },
    retry: 2,
  });

  const { data: subjectWise } = useQuery({
    queryKey: ['analytics-subject-wise'],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/subject-wise');
      return data;
    },
    retry: 2,
  });

  const { data: insights } = useQuery({
    queryKey: ['analytics-insights'],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/insights');
      return data;
    },
    refetchInterval: 300000, // Refresh every 5 minutes
    retry: 2,
  });

  // Filter top performers based on toggle (must be before conditional returns)
  const filteredPerformers = useMemo(() => {
    if (!topPerformers?.top_performers) return [];
    if (filters.showLowPerformers) {
      // Show bottom performers instead
      return [...topPerformers.top_performers].reverse();
    }
    return topPerformers.top_performers;
  }, [topPerformers, filters.showLowPerformers]);

  if (summaryLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card className="shadow">
          <CardContent className="flex items-center justify-center gap-3 p-8">
            <div
              className="h-6 w-6 animate-spin rounded-full border-2 border-brand-subtle border-t-brand"
              role="status"
              aria-label="Loading"
            />
            <div>
              <p className="text-body-strong text-text-primary">Loading analytics...</p>
              <p className="text-caption text-text-muted">Fetching real-time data</p>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="shadow">
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (summaryError) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card className="shadow">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-status-error-subtle text-status-error">
                <ErrorCircle20Regular aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-section-title text-text-primary">Error Loading Analytics</h3>
                <p className="mt-1 text-body text-status-error">
                  {summaryError instanceof Error ? summaryError.message : 'Unknown error occurred'}
                </p>

                <div className="mt-4 rounded-md border border-border-subtle bg-surface-subtle p-4">
                  <p className="mb-2 text-body-strong text-text-primary">Troubleshooting Steps:</p>
                  <ul className="space-y-1.5 text-body text-text-secondary">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted" aria-hidden />
                      Backend server is running on port 8000
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted" aria-hidden />
                      You are logged in with a valid authentication token
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted" aria-hidden />
                      CORS is properly configured for your domain
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted" aria-hidden />
                      Database connection is active
                    </li>
                  </ul>
                </div>

                <Button onClick={() => window.location.reload()} className="mt-4">
                  <ArrowSync20Regular aria-hidden />
                  Retry Connection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dashboardSummary) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card className="shadow">
          <EmptyBlock
            icon={<DataBarVertical20Regular aria-hidden />}
            title="No Data Available"
            description="Analytics data will appear here once attendance records are created"
            className="py-16"
          />
        </Card>
      </div>
    );
  }

  /** Tone for a server metrics block: band from the server or policy bands; no data → neutral. */
  const getStatusColor = (pct: number | null, block?: Record<string, unknown> | null): StatusTone => {
    const band = resolveBand(block ?? null, policyView, pct);
    if (!band) return NO_DATA_TONE;
    return { ...TONE_BY_BAND[band.tone], status: band.label };
  };

  const pctOf = (block: unknown, legacyKey: string): number | null =>
    resolvePercentage((block ?? null) as Record<string, unknown> | null, [legacyKey]);

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return <ArrowTrending16Regular className="shrink-0 text-status-success" aria-label="Trending up" />;
    if (trend === 'down') return <ArrowTrendingDown16Regular className="shrink-0 text-status-error" aria-label="Trending down" />;
    return <ArrowRight16Regular className="shrink-0 text-text-muted" aria-label="Stable" />;
  };

  const getInsightIcon = (icon: string) => {
    switch (icon) {
      case 'alert-triangle': return <Warning20Regular aria-hidden />;
      case 'check-circle': return <CheckmarkCircle20Regular aria-hidden />;
      case 'calendar': return <CalendarLtr20Regular aria-hidden />;
      case 'trending-up': return <ArrowTrending20Regular aria-hidden />;
      case 'trending-down': return <ArrowTrendingDown20Regular aria-hidden />;
      default: return <Pulse20Regular aria-hidden />;
    }
  };

  // Export functionality
  const handleExportCSV = () => {
    if (!dashboardSummary) return;
    
    const csvData = [
      ['Analytics Report', 'Generated on', new Date().toLocaleDateString()],
      [],
      ['Period', 'Attendance Rate', 'Present', 'Absent', 'Late', 'Total Records'],
      ['Today', formatPercent(pctOf(dashboardSummary.today, 'rate')), dashboardSummary.today?.present || 0, dashboardSummary.today?.absent || 0, dashboardSummary.today?.late || 0, dashboardSummary.today?.total_records || 0],
      ['This Week', formatPercent(pctOf(dashboardSummary.this_week, 'rate')), dashboardSummary.this_week?.present || 0, dashboardSummary.this_week?.absent || 0, dashboardSummary.this_week?.late || 0, dashboardSummary.this_week?.total_records || 0],
      ['This Month', formatPercent(pctOf(dashboardSummary.this_month, 'rate')), dashboardSummary.this_month?.present || 0, dashboardSummary.this_month?.absent || 0, dashboardSummary.this_month?.late || 0, dashboardSummary.this_month?.total_records || 0],
      [],
      ['System Statistics'],
      ['Total Students', dashboardSummary.system?.total_students || 0],
      ['Total Subjects', dashboardSummary.system?.total_subjects || 0],
      ['Total Records', dashboardSummary.system?.total_records || 0],
    ];

    if (subjectWise?.subjects) {
      csvData.push([], ['Subject Performance']);
      csvData.push(['Subject Name', 'Subject Code', 'Attendance Rate', 'Total Classes', 'Present', 'Absent']);
      subjectWise.subjects.forEach((subject: SubjectAnalytics) => {
        csvData.push([
          subject.subject_name,
          subject.subject_code,
          formatPercent(pctOf(subject, 'attendance_rate')),
          subject.total_classes.toString(),
          subject.present.toString(),
          subject.absent.toString()
        ]);
      });
    }

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `analytics_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const handleExportPDF = () => {
    // Create a printable version
    window.print();
    setShowExportMenu(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Trigger refetch of all queries
    await Promise.all([
      dashboardSummary,
      weeklyBreakdown,
      topPerformers,
      subjectWise,
      insights
    ]);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const todayRate = pctOf(dashboardSummary?.today, 'rate');
  const weekRate = pctOf(dashboardSummary?.this_week, 'rate');
  const monthRate = pctOf(dashboardSummary?.this_month, 'rate');
  const todayStatus = getStatusColor(todayRate, dashboardSummary?.today);
  const weekStatus = getStatusColor(weekRate, dashboardSummary?.this_week);
  const monthStatus = getStatusColor(monthRate, dashboardSummary?.this_month);

  const selectedToggleClass = 'border-brand-stroke bg-brand-subtle text-brand-foreground hover:bg-brand-subtle-hover';

  const rankChipClass = (index: number) => {
    if (filters.showLowPerformers) return 'bg-status-error-subtle text-status-error';
    if (index === 0) return 'bg-chart-8/15 text-chart-8';
    if (index === 1) return 'bg-surface-selected text-text-secondary';
    if (index === 2) return 'bg-chart-5/15 text-chart-5';
    return 'border border-border-subtle text-text-secondary';
  };

  const insightTone = (type: string) => {
    if (type === 'success') return 'bg-status-success-subtle text-status-success';
    if (type === 'warning') return 'bg-status-warning-subtle text-status-warning';
    if (type === 'info') return 'bg-status-info-subtle text-status-info';
    return 'bg-status-error-subtle text-status-error';
  };

  return (
    <div className={`space-y-4 ${className} print:bg-white`}>
      {/* Report toolbar */}
      <Card className="shadow">
        <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
              <DataTrending20Regular aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-subheading text-text-primary">Advanced Analytics Dashboard</h2>
              <p className="truncate text-caption text-text-muted">Real-time insights • Live data • Comprehensive metrics</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {/* Refresh Button */}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <ArrowSync20Regular className={isRefreshing ? 'animate-spin' : ''} aria-hidden />
              Refresh
            </Button>

            {/* Export Menu */}
            <DropdownMenu open={showExportMenu} onOpenChange={setShowExportMenu}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowDownload20Regular aria-hidden />
                  Export
                  <ChevronDown16Regular
                    className={`transition-transform duration-150 ease-fluent-standard ${showExportMenu ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={handleExportCSV} className="gap-2">
                  <DocumentTable20Regular className="text-text-muted" aria-hidden />
                  <span>Export as CSV</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExportPDF} className="gap-2">
                  <Print20Regular className="text-text-muted" aria-hidden />
                  <span>Print / PDF</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Filters Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              aria-pressed={showFilters}
              aria-expanded={showFilters}
              className={showFilters ? selectedToggleClass : ''}
            >
              <Filter20Regular aria-hidden />
              Filters
              {showFilters && <Dismiss16Regular aria-hidden />}
            </Button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="grid grid-cols-1 gap-4 border-t border-border-subtle px-4 py-3 animate-fade-in-up md:grid-cols-3 print:hidden">
            <div className="space-y-1.5">
              <label htmlFor="analytics-date-range" className="block text-caption-strong text-text-secondary">
                Date Range
              </label>
              <Select
                value={filters.dateRange}
                onValueChange={(value) => setFilters({ ...filters, dateRange: value as 'today' | 'week' | 'month' | 'custom' })}
              >
                <SelectTrigger id="analytics-date-range" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="block text-caption-strong text-text-secondary">Performance View</span>
              <Button
                variant="outline"
                onClick={() => setFilters({ ...filters, showLowPerformers: !filters.showLowPerformers })}
                aria-pressed={!!filters.showLowPerformers}
                className={`h-9 w-full justify-between ${filters.showLowPerformers ? selectedToggleClass : ''}`}
              >
                <span>{filters.showLowPerformers ? 'Low Performers' : 'Top Performers'}</span>
                {filters.showLowPerformers ? <EyeOff20Regular aria-hidden /> : <Eye20Regular aria-hidden />}
              </Button>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => setFilters({ dateRange: 'week', showLowPerformers: false })}
                variant="outline"
                size="sm"
                className="h-9 w-full md:w-auto"
              >
                Reset Filters
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Period KPI tiles */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <PeriodTile
          label="Today"
          rate={todayRate}
          tone={todayStatus}
          icon={<Clock20Regular aria-hidden />}
          stats={[
            { label: 'Present', value: dashboardSummary?.today?.present || 0, dot: 'bg-status-success' },
            { label: 'Absent', value: dashboardSummary?.today?.absent || 0, dot: 'bg-status-error' },
          ]}
        />
        <PeriodTile
          label="This Week"
          rate={weekRate}
          tone={weekStatus}
          icon={<CalendarLtr20Regular aria-hidden />}
          stats={[
            { label: 'Total Classes', value: dashboardSummary?.this_week?.total_records || 0 },
            { label: 'Attended', value: dashboardSummary?.this_week?.present || 0, dot: 'bg-status-success' },
          ]}
        />
        <PeriodTile
          label="This Month"
          rate={monthRate}
          tone={monthStatus}
          icon={<DataBarVertical20Regular aria-hidden />}
          stats={[
            { label: 'Total Classes', value: dashboardSummary?.this_month?.total_records || 0 },
            { label: 'Attended', value: dashboardSummary?.this_month?.present || 0, dot: 'bg-status-success' },
          ]}
        />
      </div>

      {/* System summary strip */}
      <Card className="shadow">
        <div className="grid grid-cols-1 divide-y divide-border-subtle sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { label: 'Total Students', value: dashboardSummary?.system?.total_students || 0, icon: <People20Regular aria-hidden /> },
            { label: 'Total Subjects', value: dashboardSummary?.system?.total_subjects || 0, icon: <BookOpen20Regular aria-hidden /> },
            { label: 'Records (30d)', value: dashboardSummary?.this_month?.total_records || 0, icon: <ClipboardTaskListLtr20Regular aria-hidden /> },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 px-5 py-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
                {stat.icon}
              </div>
              <div className="min-w-0">
                <p className="text-caption text-text-muted">{stat.label}</p>
                <p className="text-page-title tabular-nums text-text-primary">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Report pages */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'overview' | 'trends' | 'insights' | 'performance')}
        className="space-y-4"
      >
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview" className="gap-2" aria-label="Overview">
            <DataBarVertical20Regular aria-hidden />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-2" aria-label="Trends">
            <ArrowTrending20Regular aria-hidden />
            <span className="hidden sm:inline">Trends</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-2" aria-label="Performance">
            <Trophy20Regular aria-hidden />
            <span className="hidden sm:inline">Performance</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-2" aria-label="Insights">
            <Lightbulb20Regular aria-hidden />
            <span className="hidden sm:inline">Insights</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview: subject-wise DataGrid */}
        <TabsContent value="overview" className="mt-0 space-y-4">
          <Card className="overflow-hidden shadow">
            <ReportCardHeader
              title="Subject-Wise Performance"
              caption="Attendance rate per subject"
              actions={
                <>
                  <Badge variant="secondary" shape="pill">
                    {subjectWise?.subjects?.length || 0} subjects
                  </Badge>
                  <ExpandToggle
                    expanded={subjectsExpanded}
                    onToggle={() => setSubjectsExpanded((v) => !v)}
                    label="subject table"
                  />
                </>
              }
            />
            {subjectWise?.subjects && subjectWise.subjects.length > 0 ? (
              <div className={`overflow-auto ${subjectsExpanded ? '' : 'max-h-[600px]'}`}>
                <table className="w-full min-w-[680px] border-collapse text-left">
                  <thead className="sticky top-0 z-[1] bg-surface-subtle">
                    <tr className="border-b border-border-subtle text-caption-strong text-text-secondary">
                      <th scope="col" className={thClass}>Subject</th>
                      <th scope="col" className={`${thClass} text-right`}>Classes</th>
                      <th scope="col" className={`${thClass} text-right`}>Students</th>
                      <th scope="col" className={`${thClass} text-right`}>Present</th>
                      <th scope="col" className={`${thClass} w-[220px]`}>Attendance</th>
                      <th scope="col" className={thClass}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectWise.subjects.map((subject: SubjectAnalytics, index: number) => {
                      const subjectRate = pctOf(subject, 'attendance_rate');
                      const status = getStatusColor(subjectRate, subject as unknown as Record<string, unknown>);
                      return (
                        <tr key={index} className={rowClass}>
                          <td className={tdClass}>
                            <div className="min-w-0 max-w-[280px]">
                              <p className="truncate text-body-strong text-text-primary">{subject.subject_name}</p>
                              <p className="truncate text-caption text-text-muted">{subject.subject_code}</p>
                            </div>
                          </td>
                          <td className={`${tdClass} text-right tabular-nums text-text-secondary`}>{subject.total_classes}</td>
                          <td className={`${tdClass} text-right tabular-nums text-text-secondary`}>{subject.unique_students}</td>
                          <td className={`${tdClass} text-right tabular-nums text-text-secondary`}>
                            {subject.present}/{subject.total_classes}
                          </td>
                          <td className={tdClass}>
                            <div className="flex items-center gap-3">
                              <RateBar value={subjectRate} barClass={status.bar} className="flex-1" />
                              <span className="w-12 text-right text-body-strong tabular-nums text-text-primary">
                                {formatPercent(subjectRate)}
                              </span>
                            </div>
                          </td>
                          <td className={tdClass}>
                            <Badge variant={status.badge} shape="pill">
                              {status.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyBlock icon={<BookOpen20Regular aria-hidden />} title="No subject data available" />
            )}
          </Card>
        </TabsContent>

        {/* Trends: daily breakdown DataGrid */}
        <TabsContent value="trends" className="mt-0 space-y-4">
          <Card className="overflow-hidden shadow">
            <ReportCardHeader
              title="Daily Attendance Trends"
              caption="Present, absent and late records per day"
              actions={
                <>
                  <Select value={String(daysFilter)} onValueChange={(value) => setDaysFilter(Number(value))}>
                    <SelectTrigger className="h-8 w-[140px]" aria-label="Time range">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Last 7 Days</SelectItem>
                      <SelectItem value="14">Last 14 Days</SelectItem>
                      <SelectItem value="30">Last 30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                  <ExpandToggle
                    expanded={trendsExpanded}
                    onToggle={() => setTrendsExpanded((v) => !v)}
                    label="daily trends table"
                  />
                </>
              }
            />
            {weeklyBreakdown?.breakdown && weeklyBreakdown.breakdown.length > 0 ? (
              <div className={`overflow-auto ${trendsExpanded ? '' : 'max-h-[600px]'}`}>
                <table className="w-full min-w-[720px] border-collapse text-left">
                  <thead className="sticky top-0 z-[1] bg-surface-subtle">
                    <tr className="border-b border-border-subtle text-caption-strong text-text-secondary">
                      <th scope="col" className={thClass}>Day</th>
                      <th scope="col" className={`${thClass} text-right`}>Present</th>
                      <th scope="col" className={`${thClass} text-right`}>Absent</th>
                      <th scope="col" className={`${thClass} text-right`}>Late</th>
                      <th scope="col" className={`${thClass} hidden w-[180px] lg:table-cell`}>Breakdown</th>
                      <th scope="col" className={`${thClass} text-right`}>Total records</th>
                      <th scope="col" className={`${thClass} w-[200px]`}>Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyBreakdown.breakdown.map((day: DayBreakdown, index: number) => {
                      const dayRate = pctOf(day, 'percentage');
                      const dayStatus = getStatusColor(dayRate, day as unknown as Record<string, unknown>);
                      const segmentTotal = (day.present || 0) + (day.absent || 0) + (day.late || 0);
                      return (
                        <tr key={index} className={rowClass}>
                          <td className={tdClass}>
                            <p className="text-body-strong text-text-primary">{day.day}</p>
                            <p className="text-caption text-text-muted">
                              {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          </td>
                          <td className={`${tdClass} text-right`}>
                            <span className="inline-flex items-center gap-1.5 tabular-nums text-text-primary">
                              <span className="h-2 w-2 rounded-full bg-status-success" aria-hidden />
                              {day.present}
                            </span>
                          </td>
                          <td className={`${tdClass} text-right`}>
                            <span className="inline-flex items-center gap-1.5 tabular-nums text-text-primary">
                              <span className="h-2 w-2 rounded-full bg-status-error" aria-hidden />
                              {day.absent}
                            </span>
                          </td>
                          <td className={`${tdClass} text-right`}>
                            <span className="inline-flex items-center gap-1.5 tabular-nums text-text-primary">
                              <span className="h-2 w-2 rounded-full bg-status-warning" aria-hidden />
                              {day.late}
                            </span>
                          </td>
                          <td className={`${tdClass} hidden lg:table-cell`}>
                            <div
                              className="flex h-2 w-full overflow-hidden rounded-full bg-border-subtle"
                              role="img"
                              aria-label={`${day.present} present, ${day.late} late, ${day.absent} absent`}
                            >
                              {segmentTotal > 0 && (
                                <>
                                  <div className="h-full bg-status-success" style={{ width: `${(day.present / segmentTotal) * 100}%` }} />
                                  <div className="h-full bg-status-warning" style={{ width: `${(day.late / segmentTotal) * 100}%` }} />
                                  <div className="h-full bg-status-error" style={{ width: `${(day.absent / segmentTotal) * 100}%` }} />
                                </>
                              )}
                            </div>
                          </td>
                          <td className={`${tdClass} text-right tabular-nums text-text-secondary`}>{day.total}</td>
                          <td className={tdClass}>
                            <div className="flex items-center gap-3">
                              <RateBar value={dayRate} barClass={dayStatus.bar} className="flex-1" />
                              <span className="w-12 text-right text-body-strong tabular-nums text-text-primary">
                                {formatPercent(dayRate)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyBlock
                icon={<CalendarLtr20Regular aria-hidden />}
                title="No attendance data for this period"
                description="Try selecting a different time range"
              />
            )}
          </Card>
        </TabsContent>

        {/* Performance: student leaderboard DataGrid */}
        <TabsContent value="performance" className="mt-0 space-y-4">
          <Card className="overflow-hidden shadow">
            <ReportCardHeader
              title={filters.showLowPerformers ? 'Students Needing Support' : 'Top Performing Students'}
              caption="Overall and recent attendance rate"
              actions={
                <Badge variant={filters.showLowPerformers ? 'destructive' : 'success'} shape="pill">
                  {filteredPerformers.length} students
                </Badge>
              }
            />
            {filteredPerformers && filteredPerformers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead className="bg-surface-subtle">
                    <tr className="border-b border-border-subtle text-caption-strong text-text-secondary">
                      <th scope="col" className={`${thClass} w-20`}>Rank</th>
                      <th scope="col" className={thClass}>Student</th>
                      <th scope="col" className={`${thClass} text-right`}>Attendance</th>
                      <th scope="col" className={`${thClass} text-right`}>Recent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPerformers.map((student: TopPerformer, index: number) => (
                      <tr key={index} className={rowClass}>
                        <td className={tdClass}>
                          <div
                            className={`grid h-8 w-8 place-items-center rounded-full text-caption-strong tabular-nums ${rankChipClass(index)}`}
                          >
                            {!filters.showLowPerformers && index < 3 ? (
                              <Trophy20Regular className="h-4 w-4" aria-label={`Rank ${index + 1}`} />
                            ) : (
                              index + 1
                            )}
                          </div>
                        </td>
                        <td className={tdClass}>
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-subtle text-caption-strong text-brand-foreground"
                              aria-hidden
                            >
                              {getInitials(student.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-body-strong text-text-primary">{student.name}</p>
                              <p className="flex flex-wrap items-center gap-x-1.5 text-caption text-text-muted">
                                <span>{student.student_id}</span>
                                <span aria-hidden>•</span>
                                <span>{student.faculty}</span>
                                <span aria-hidden>•</span>
                                <span>Sem {student.semester}</span>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className={`${tdClass} text-right`}>
                          <p
                            className={`text-body-strong tabular-nums ${
                              getStatusColor(pctOf(student, 'attendance_rate'), student as unknown as Record<string, unknown>).color
                            }`}
                          >
                            {formatPercent(pctOf(student, 'attendance_rate'))}
                          </p>
                          <p className="text-caption tabular-nums text-text-muted">
                            {student.present_count}/{student.total_classes} classes
                          </p>
                        </td>
                        <td className={tdClass}>
                          <div className="flex items-center justify-end gap-2">
                            {getTrendIcon(student.trend)}
                            <div className="text-right">
                              <p
                                className={`text-body-strong tabular-nums ${
                                  student.trend === 'up'
                                    ? 'text-status-success'
                                    : student.trend === 'down'
                                      ? 'text-status-error'
                                      : 'text-text-secondary'
                                }`}
                              >
                                {formatPercent(student.recent_rate)}
                              </p>
                              <p className="text-caption text-text-muted">recent</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyBlock icon={<Trophy20Regular aria-hidden />} title="No performance data available" />
            )}
          </Card>
        </TabsContent>

        {/* Insights */}
        <TabsContent value="insights" className="mt-0 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {insights?.insights?.map((insight: Insight, index: number) => (
              <Card key={index} className="shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${insightTone(insight.type)}`}>
                      {getInsightIcon(insight.icon)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-body-strong text-text-primary">{insight.title}</h3>
                        <Badge
                          variant={
                            insight.priority === 'high'
                              ? 'destructive'
                              : insight.priority === 'medium'
                                ? 'warning'
                                : 'info'
                          }
                          shape="pill"
                          className="shrink-0 capitalize"
                        >
                          {insight.priority}
                        </Badge>
                      </div>
                      <p className="mt-1 text-body text-text-muted">{insight.description}</p>
                      <Button variant="outline" size="sm" className="mt-3">
                        {insight.action}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!insights?.insights || insights.insights.length === 0) && (
              <Card className="shadow md:col-span-2">
                <EmptyBlock
                  icon={<Lightbulb20Regular aria-hidden />}
                  title="No insights available"
                  description="System is monitoring attendance patterns"
                  className="py-16"
                />
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Print helpers for the analytics report
const styles = `
  @media print {
    .print\\:hidden {
      display: none !important;
    }

    .print\\:bg-white {
      background: white !important;
    }

    @page {
      margin: 1cm;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.getElementById('advanced-analytics-styles');
  if (!styleElement) {
    const style = document.createElement('style');
    style.id = 'advanced-analytics-styles';
    style.textContent = styles;
    document.head.appendChild(style);
  }
}

export default AdvancedAnalyticsDashboard;
