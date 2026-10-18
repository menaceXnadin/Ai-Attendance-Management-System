import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DataBarVertical20Regular,
  ArrowTrending16Regular,
  ArrowTrendingDown16Regular,
  People20Regular,
  CalendarLtr20Regular,
  Target20Regular,
  Pulse20Regular,
  Warning20Regular,
  CheckmarkCircle20Regular,
  Lightbulb20Regular,
} from '@fluentui/react-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';

interface AttendanceAnalyticsProps {
  className?: string;
}

const AttendanceAnalytics: React.FC<AttendanceAnalyticsProps> = ({ className = '' }) => {
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

  const data = {
    totalStudents: sidebarStats?.total_students || 0,
    presentToday: sidebarStats?.present_today || 0,
    attendanceRate: sidebarStats?.attendance_rate || 0,
    totalClasses: sidebarStats?.total_classes || 0,
  };

  const weeklyTrend = attendanceSummary ?
    ((attendanceSummary.percentagePresent - data.attendanceRate) || 0) : 0;

  const getAttendanceStatus = (rate: number) => {
    if (rate >= 90) return { status: 'Excellent', color: 'text-status-success', bgColor: 'bg-status-success-subtle', variant: 'success' as const };
    if (rate >= 85) return { status: 'Good', color: 'text-status-info', bgColor: 'bg-status-info-subtle', variant: 'info' as const };
    if (rate >= 75) return { status: 'Warning', color: 'text-status-warning', bgColor: 'bg-status-warning-subtle', variant: 'warning' as const };
    return { status: 'Critical', color: 'text-status-error', bgColor: 'bg-status-error-subtle', variant: 'destructive' as const };
  };

  const attendanceStatus = getAttendanceStatus(data.attendanceRate);
  const absentToday = data.totalStudents - data.presentToday;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview KPI tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Students */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption text-text-muted">Total Students</p>
                <div className="mt-1 text-[28px] leading-9 font-semibold tabular-nums text-text-primary">
                  {data.totalStudents}
                </div>
                <p className="text-caption text-text-muted">
                  Enrolled students
                </p>
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
                <div className="mt-1 text-[28px] leading-9 font-semibold tabular-nums text-text-primary">
                  {data.presentToday}
                </div>
                <p className="text-caption text-text-muted">
                  out of {data.totalStudents} students
                </p>
              </div>
              <div className="h-10 w-10 shrink-0 rounded-md bg-status-success-subtle text-status-success grid place-items-center">
                <CheckmarkCircle20Regular aria-hidden />
              </div>
            </div>
            <div className="mt-3">
              <Progress value={(data.presentToday / data.totalStudents) * 100} className="h-1.5" />
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
                  {weeklyTrend >= 0 ? (
                    <ArrowTrending16Regular className="shrink-0 text-status-success" aria-hidden />
                  ) : (
                    <ArrowTrendingDown16Regular className="shrink-0 text-status-error" aria-hidden />
                  )}
                  <span className={`text-caption tabular-nums ${weeklyTrend >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                    {Math.abs(weeklyTrend).toFixed(1)}% trend
                  </span>
                </div>
              </div>
              <div className="h-10 w-10 shrink-0 rounded-md bg-brand-subtle text-brand-foreground grid place-items-center">
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

        {/* Classes */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption text-text-muted">Active Classes</p>
                <div className="mt-1 text-[28px] leading-9 font-semibold tabular-nums text-text-primary">
                  {data.totalClasses}
                </div>
                <p className="text-caption text-text-muted">
                  Available classes
                </p>
              </div>
              <div className="h-10 w-10 shrink-0 rounded-md bg-brand-subtle text-brand-foreground grid place-items-center">
                <CalendarLtr20Regular aria-hidden />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Today's Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pulse20Regular className="shrink-0 text-text-muted" aria-hidden />
              Today's Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-2.5">
              <span className="inline-flex items-center gap-2 text-body text-text-secondary">
                <span className="h-2 w-2 rounded-full bg-status-success" aria-hidden />
                Present
              </span>
              <Badge variant="success" shape="pill">{data.presentToday}</Badge>
            </div>
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-2.5">
              <span className="inline-flex items-center gap-2 text-body text-text-secondary">
                <span className="h-2 w-2 rounded-full bg-status-error" aria-hidden />
                Absent
              </span>
              <Badge variant="destructive" shape="pill">{absentToday}</Badge>
            </div>
            <div className="flex items-center justify-between px-5 py-2.5">
              <span className="inline-flex items-center gap-2 text-body text-text-secondary">
                <span className="h-2 w-2 rounded-full bg-chart-1" aria-hidden />
                Rate
              </span>
              <Badge variant={attendanceStatus.variant} shape="pill">
                {data.attendanceRate}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target20Regular className="shrink-0 text-text-muted" aria-hidden />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-body text-text-secondary">Overall Attendance</span>
                <span className="text-body-strong text-text-primary tabular-nums">{data.attendanceRate}%</span>
              </div>
              <Progress value={data.attendanceRate} className="h-1.5" />
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-body text-text-secondary">Today's Presence</span>
                <span className="text-body-strong text-text-primary tabular-nums">{Math.round((data.presentToday / data.totalStudents) * 100)}%</span>
              </div>
              <Progress value={(data.presentToday / data.totalStudents) * 100} className="h-1.5" />
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-body text-text-secondary">System Health</span>
                <span className="text-body-strong text-text-primary tabular-nums">100%</span>
              </div>
              <Progress value={100} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        {/* Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb20Regular className="shrink-0 text-text-muted" aria-hidden />
              Smart Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.attendanceRate >= 90 && (
              <div className="flex items-center gap-2 rounded-md border border-status-success-border bg-status-success-subtle px-3 py-2">
                <CheckmarkCircle20Regular className="shrink-0 text-status-success" aria-hidden />
                <span className="text-body text-text-primary">Excellent attendance rate!</span>
              </div>
            )}

            {data.attendanceRate < 75 && (
              <div className="flex items-center gap-2 rounded-md border border-status-warning-border bg-status-warning-subtle px-3 py-2">
                <Warning20Regular className="shrink-0 text-status-warning" aria-hidden />
                <span className="text-body text-text-primary">Attendance needs improvement</span>
              </div>
            )}

            <div className="flex items-center justify-between rounded-md bg-surface-subtle px-3 py-2">
              <span className="text-body text-text-secondary">Data Updated</span>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-presence-available" aria-hidden></span>
                <span className="text-body-strong text-text-primary">Live</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md bg-surface-subtle px-3 py-2">
              <span className="text-body text-text-secondary">Total Records</span>
              <Badge variant="secondary">
                {sidebarStats?.total_attendance_records || 0}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AttendanceAnalytics;
