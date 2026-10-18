import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DataBarVertical20Regular,
  DataBarVertical16Regular,
  ArrowTrending16Regular,
  ArrowTrendingDown16Regular,
  People20Regular,
  CalendarLtr20Regular,
  Clock20Regular,
  Target16Regular,
  Pulse20Regular,
  Warning20Regular,
  CheckmarkCircle20Regular,
  CheckmarkCircle16Regular,
  Trophy16Regular,
  Trophy20Regular,
  ArrowDownload16Regular,
  Filter16Regular,
  ChevronRight16Regular,
} from '@fluentui/react-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';

interface UnifiedAnalyticsProps {
  className?: string;
}

/** Report card shell — Power BI / Teams analytics style. */
const ReportCard: React.FC<{
  title: string;
  caption?: string;
  icon?: React.ReactNode;
  flush?: boolean;
  children: React.ReactNode;
}> = ({ title, caption, icon, flush = false, children }) => (
  <Card className="overflow-hidden">
    <div className="flex items-start gap-3 px-5 py-4">
      {icon && <span className="mt-0.5 text-text-muted">{icon}</span>}
      <div className="min-w-0">
        <h3 className="text-subheading text-text-primary">{title}</h3>
        {caption && <p className="text-caption text-text-muted mt-0.5">{caption}</p>}
      </div>
    </div>
    <div className={flush ? '' : 'px-5 pb-5'}>{children}</div>
  </Card>
);

const UnifiedAnalytics: React.FC<UnifiedAnalyticsProps> = ({ className = '' }) => {
  // Fetch real data from API
  const { data: sidebarStats, isLoading } = useQuery({
    queryKey: ['sidebar-stats'],
    queryFn: () => api.dashboard.getSidebarStats(),
    refetchInterval: 30000,
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => api.students.getAll(),
  });

  const { data: attendanceSummary } = useQuery({
    queryKey: ['attendance-summary'],
    queryFn: () => api.attendance.getSummary(),
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'insights' | 'performance'>('overview');

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse">
                  <div className="h-3 bg-surface-selected rounded w-3/4 mb-3"></div>
                  <div className="h-7 bg-surface-selected rounded w-1/2 mb-3"></div>
                  <div className="h-3 bg-surface-selected rounded w-full"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Calculate analytics data
  const data = {
    totalStudents: sidebarStats?.total_students || students.length || 0,
    presentToday: sidebarStats?.present_today || 0,
    attendanceRate: sidebarStats?.attendance_rate || 0,
    totalClasses: sidebarStats?.total_classes || 0,
  };

  const weeklyTrend = attendanceSummary ?
    ((attendanceSummary.percentagePresent - data.attendanceRate) || 0) : 0;

  const absentToday = data.totalStudents - data.presentToday;

  // Sample data for advanced analytics (can be replaced with real API data)
  const timeSlotData = [
    { time: '8:00-9:00', students: Math.floor(data.presentToday * 0.35), percentage: 78 },
    { time: '9:00-10:00', students: Math.floor(data.presentToday * 0.42), percentage: 90 },
    { time: '10:00-11:00', students: Math.floor(data.presentToday * 0.38), percentage: 83 },
    { time: '11:00-12:00', students: Math.floor(data.presentToday * 0.32), percentage: 71 },
  ];

  const weeklyData = [
    { day: 'Mon', present: Math.floor(data.presentToday * 0.88), absent: Math.floor(data.totalStudents * 0.12), late: 5 },
    { day: 'Tue', present: Math.floor(data.presentToday * 0.92), absent: Math.floor(data.totalStudents * 0.08), late: 3 },
    { day: 'Wed', present: Math.floor(data.presentToday * 0.85), absent: Math.floor(data.totalStudents * 0.15), late: 8 },
    { day: 'Thu', present: Math.floor(data.presentToday * 0.94), absent: Math.floor(data.totalStudents * 0.06), late: 2 },
    { day: 'Fri', present: Math.floor(data.presentToday * 0.78), absent: Math.floor(data.totalStudents * 0.22), late: 10 }
  ];

  const topPerformers = students
    .filter(student => student.name && student.name !== 'Unknown Student')
    .slice(0, 3)
    .map((student, index) => ({
      name: student.name,
      rate: 95 - (index * 2),
      trend: index === 0 ? 'up' as const : index === 1 ? 'stable' as const : 'down' as const
    }));

  const insights = [
    {
      type: 'positive' as const,
      title: 'Improved Morning Attendance',
      description: `${data.presentToday} students present today, showing consistent improvement`,
      action: 'View Details'
    },
    {
      type: 'warning' as const,
      title: 'Monitor Absent Students',
      description: `${absentToday} students absent today. Consider follow-up actions`,
      action: 'Create Plan'
    }
  ];

  const getAttendanceStatus = (rate: number) => {
    if (rate >= 90) return { status: 'Excellent', color: 'text-status-success', bgColor: 'bg-status-success-subtle', variant: 'success' as const };
    if (rate >= 85) return { status: 'Good', color: 'text-status-info', bgColor: 'bg-status-info-subtle', variant: 'info' as const };
    if (rate >= 75) return { status: 'Warning', color: 'text-status-warning', bgColor: 'bg-status-warning-subtle', variant: 'warning' as const };
    return { status: 'Critical', color: 'text-status-error', bgColor: 'bg-status-error-subtle', variant: 'destructive' as const };
  };

  const getTrendIcon = (trend: number) => {
    return trend >= 0 ? (
      <ArrowTrending16Regular className="shrink-0 text-status-success" aria-hidden />
    ) : (
      <ArrowTrendingDown16Regular className="shrink-0 text-status-error" aria-hidden />
    );
  };

  const attendanceStatus = getAttendanceStatus(data.attendanceRate);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-section-title text-text-primary">Analytics Dashboard</h2>
          <p className="text-body text-text-muted mt-1">Comprehensive attendance insights and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <ArrowDownload16Regular aria-hidden />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Filter16Regular aria-hidden />
            Filter
          </Button>
        </div>
      </div>

      {/* Overview KPI tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Students */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption text-text-muted">Total Students</p>
                <div className="mt-1 text-[28px] leading-9 font-semibold tabular-nums text-text-primary">{data.totalStudents}</div>
                <p className="text-caption text-text-muted">Enrolled students</p>
              </div>
              <div className="h-10 w-10 shrink-0 rounded-md bg-brand-subtle text-brand-foreground grid place-items-center">
                <People20Regular aria-hidden />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Present Today */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption text-text-muted">Present Today</p>
                <div className="mt-1 text-[28px] leading-9 font-semibold tabular-nums text-text-primary">{data.presentToday}</div>
                <div className="flex items-center gap-1 text-caption text-status-success">
                  <CheckmarkCircle16Regular className="shrink-0" aria-hidden />
                  <span>Active</span>
                </div>
              </div>
              <div className="h-10 w-10 shrink-0 rounded-md bg-status-success-subtle text-status-success grid place-items-center">
                <CheckmarkCircle20Regular aria-hidden />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Rate */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption text-text-muted">Attendance Rate</p>
                <div className="mt-1 text-[28px] leading-9 font-semibold tabular-nums text-text-primary">
                  {data.attendanceRate}%
                </div>
                <div className="flex items-center gap-1">
                  {getTrendIcon(weeklyTrend)}
                  <span className={`text-caption tabular-nums ${weeklyTrend >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                    {Math.abs(weeklyTrend).toFixed(1)}% this week
                  </span>
                </div>
              </div>
              <div className={`h-10 w-10 shrink-0 rounded-md ${attendanceStatus.bgColor} ${attendanceStatus.color} grid place-items-center`}>
                <DataBarVertical20Regular aria-hidden />
              </div>
            </div>
            <div className="mt-3">
              <Badge variant={attendanceStatus.variant} shape="pill">
                {attendanceStatus.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Absent Today */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption text-text-muted">Absent Today</p>
                <div className="mt-1 text-[28px] leading-9 font-semibold tabular-nums text-text-primary">{absentToday}</div>
                <p className="text-caption text-status-error">Requires attention</p>
              </div>
              <div className="h-10 w-10 shrink-0 rounded-md bg-status-error-subtle text-status-error grid place-items-center">
                <Warning20Regular aria-hidden />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'overview' | 'trends' | 'insights' | 'performance')} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <DataBarVertical16Regular className="shrink-0" aria-hidden />
            Overview
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-1.5">
            <ArrowTrending16Regular className="shrink-0" aria-hidden />
            Trends
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-1.5">
            <Trophy16Regular className="shrink-0" aria-hidden />
            Performance
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-1.5">
            <Target16Regular className="shrink-0" aria-hidden />
            Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Attendance by Time Slots */}
            <ReportCard
              title="Attendance by Time Slots"
              caption="Students checked in per period"
              icon={<Clock20Regular aria-hidden />}
              flush
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-subtle text-caption-strong text-text-secondary border-y border-border-subtle">
                      <th className="px-4 py-2 font-semibold">Time slot</th>
                      <th className="px-4 py-2 font-semibold">Students</th>
                      <th className="px-4 py-2 font-semibold">Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlotData.map((slot, index) => (
                      <tr key={index} className="border-b border-border-subtle last:border-0 hover:bg-surface-hover transition-colors duration-150 ease-fluent-standard">
                        <td className="px-4 py-2.5 text-body text-text-primary tabular-nums">{slot.time}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant="secondary">
                            {slot.students} students
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <Progress value={slot.percentage} className="w-24 h-1.5" />
                            <span className="text-body text-text-secondary tabular-nums">{slot.percentage}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ReportCard>

            {/* Weekly Attendance Breakdown */}
            <ReportCard
              title="Weekly Breakdown"
              caption="Present, absent and late by weekday"
              icon={<CalendarLtr20Regular aria-hidden />}
              flush
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-subtle text-caption-strong text-text-secondary border-y border-border-subtle">
                      <th className="px-4 py-2 font-semibold">Day</th>
                      <th className="px-4 py-2 font-semibold">
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-success" aria-hidden />Present</span>
                      </th>
                      <th className="px-4 py-2 font-semibold">
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-error" aria-hidden />Absent</span>
                      </th>
                      <th className="px-4 py-2 font-semibold">
                        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-warning" aria-hidden />Late</span>
                      </th>
                      <th className="px-4 py-2 font-semibold text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyData.map((day, index) => (
                      <tr key={index} className="border-b border-border-subtle last:border-0 hover:bg-surface-hover transition-colors duration-150 ease-fluent-standard">
                        <td className="px-4 py-2.5 text-body-strong text-text-primary">{day.day}</td>
                        <td className="px-4 py-2.5 text-body text-text-primary tabular-nums">{day.present}</td>
                        <td className="px-4 py-2.5 text-body text-text-primary tabular-nums">{day.absent}</td>
                        <td className="px-4 py-2.5 text-body text-text-primary tabular-nums">{day.late}</td>
                        <td className="px-4 py-2.5 text-body text-text-secondary tabular-nums text-right">
                          {Math.round((day.present / (day.present + day.absent + day.late)) * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ReportCard>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <ReportCard
            title="Top Performing Students"
            caption="Highest attendance rates"
            icon={<Trophy20Regular aria-hidden />}
          >
            <div className="-mx-3 space-y-1">
              {topPerformers.map((student, index) => (
                <div key={index} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-surface-hover transition-colors duration-150 ease-fluent-standard">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-8 w-8 shrink-0 rounded-full grid place-items-center text-caption-strong tabular-nums ${
                      index === 0 ? 'bg-brand-subtle text-brand-foreground' :
                      index === 1 ? 'bg-surface-selected text-text-secondary' :
                      'bg-surface-subtle text-text-secondary'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-body-strong text-text-primary truncate">{student.name}</div>
                      <div className="text-caption text-text-muted">Attendance Rate</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="success" shape="pill">
                      {student.rate}%
                    </Badge>
                    {student.trend === 'up' && <ArrowTrending16Regular className="shrink-0 text-status-success" aria-hidden />}
                    {student.trend === 'down' && <ArrowTrendingDown16Regular className="shrink-0 text-status-error" aria-hidden />}
                    {student.trend === 'stable' && <Pulse20Regular className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />}
                  </div>
                </div>
              ))}
            </div>
          </ReportCard>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 rounded-md border px-4 py-3 ${
                  insight.type === 'positive'
                    ? 'bg-status-success-subtle border-status-success-border'
                    : insight.type === 'warning'
                      ? 'bg-status-warning-subtle border-status-warning-border'
                      : 'bg-status-error-subtle border-status-error-border'
                }`}
              >
                <span className="mt-0.5 shrink-0">
                  {insight.type === 'positive' && <CheckmarkCircle20Regular className="text-status-success" aria-hidden />}
                  {insight.type === 'warning' && <Warning20Regular className="text-status-warning" aria-hidden />}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-body-strong text-text-primary">{insight.title}</h3>
                  <p className="text-body text-text-secondary mt-0.5">{insight.description}</p>
                  <Button variant="outline" size="sm" className="mt-3">
                    {insight.action}
                    <ChevronRight16Regular aria-hidden />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UnifiedAnalytics;
