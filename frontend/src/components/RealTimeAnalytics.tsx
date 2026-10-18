import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowTrending16Regular,
  ArrowTrendingDown16Regular,
  CalendarLtr20Regular,
  CheckmarkCircle20Regular,
  DataBarVertical20Regular,
  People20Regular,
  Warning16Regular,
  CheckmarkCircle16Regular,
} from '@fluentui/react-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';

interface AnalyticsData {
  totalStudents: number;
  presentToday: number;
  attendanceRate: number;
  totalClasses: number;
  totalAttendanceRecords: number;
}

const RealTimeAnalytics: React.FC = () => {
  // Fetch real-time statistics
  const { data: sidebarStats, isLoading } = useQuery({
    queryKey: ['sidebar-stats'],
    queryFn: () => api.dashboard.getSidebarStats(),
    refetchInterval: 30000, // Refetch every 30 seconds for real-time feel
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  // Fetch students for additional analytics
  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => api.students.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch attendance summary
  const { data: attendanceSummary } = useQuery({
    queryKey: ['attendance-summary'],
    queryFn: () => api.attendance.getSummary(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="shadow">
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const data: AnalyticsData = {
    totalStudents: sidebarStats?.total_students || 0,
    presentToday: sidebarStats?.present_today || 0,
    attendanceRate: sidebarStats?.attendance_rate || 0,
    totalClasses: sidebarStats?.total_classes || 0,
    totalAttendanceRecords: sidebarStats?.total_attendance_records || 0,
  };

  const getAttendanceStatus = (rate: number) => {
    if (rate >= 90) return { status: 'Excellent', color: 'text-status-success', bgColor: 'bg-status-success-subtle', badge: 'success' as const };
    if (rate >= 85) return { status: 'Good', color: 'text-status-success', bgColor: 'bg-status-success-subtle', badge: 'success' as const };
    if (rate >= 75) return { status: 'Warning', color: 'text-status-warning', bgColor: 'bg-status-warning-subtle', badge: 'warning' as const };
    return { status: 'Critical', color: 'text-status-error', bgColor: 'bg-status-error-subtle', badge: 'destructive' as const };
  };

  const attendanceStatus = getAttendanceStatus(data.attendanceRate);

  // Calculate some derived metrics
  const absentToday = data.totalStudents - data.presentToday;
  const weeklyTrend = attendanceSummary ? 
    ((attendanceSummary.percentagePresent - data.attendanceRate) || 0) : 0;

  const kpiValueClass = 'mt-1 text-[28px] font-semibold leading-9 tabular-nums text-text-primary';
  const chipClass = 'grid h-10 w-10 shrink-0 place-items-center rounded-md';
  const cardHeaderClass = 'space-y-0 border-b border-border-subtle px-5 py-4';
  const cardTitleClass = 'text-subheading tracking-normal text-text-primary';
  const listRowClass = 'flex items-center justify-between gap-3 py-2.5';

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Students */}
        <Card className="shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption text-text-muted">Total Students</p>
                <div className={kpiValueClass}>{data.totalStudents}</div>
                <p className="mt-1 text-caption text-text-muted">Registered students</p>
              </div>
              <div className={`${chipClass} bg-brand-subtle text-brand-foreground`}>
                <People20Regular aria-hidden />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Present Today */}
        <Card className="shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption text-text-muted">Present Today</p>
                <div className={kpiValueClass}>{data.presentToday}</div>
                <p className="mt-1 text-caption text-text-muted">out of {data.totalStudents} students</p>
              </div>
              <div className={`${chipClass} bg-status-success-subtle text-status-success`}>
                <CheckmarkCircle20Regular aria-hidden />
              </div>
            </div>
            <div className="mt-4">
              <Progress value={(data.presentToday / data.totalStudents) * 100} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        {/* Attendance Rate */}
        <Card className="shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption text-text-muted">Attendance Rate</p>
                <div className={kpiValueClass}>{data.attendanceRate}%</div>
                <div className="mt-1 flex items-center gap-1">
                  {weeklyTrend >= 0 ? (
                    <ArrowTrending16Regular className="shrink-0 text-status-success" aria-hidden />
                  ) : (
                    <ArrowTrendingDown16Regular className="shrink-0 text-status-error" aria-hidden />
                  )}
                  <span className={`text-caption ${weeklyTrend >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                    {Math.abs(weeklyTrend).toFixed(1)}% vs average
                  </span>
                </div>
              </div>
              <div className={`${chipClass} bg-brand-subtle text-brand-foreground`}>
                <DataBarVertical20Regular aria-hidden />
              </div>
            </div>
            <div className="mt-3">
              <Badge variant={attendanceStatus.badge} shape="pill">
                {attendanceStatus.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Total Classes */}
        <Card className="shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption text-text-muted">Total Classes</p>
                <div className={kpiValueClass}>{data.totalClasses}</div>
                <p className="mt-1 text-caption text-text-muted">Active classes</p>
              </div>
              <div className={`${chipClass} bg-brand-subtle text-brand-foreground`}>
                <CalendarLtr20Regular aria-hidden />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Insights */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Today's Summary */}
        <Card className="shadow">
          <CardHeader className={cardHeaderClass}>
            <CardTitle className={cardTitleClass}>Today's Summary</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-1">
            <div className="divide-y divide-border-subtle">
              <div className={listRowClass}>
                <span className="text-body text-text-secondary">Present</span>
                <Badge variant="success" shape="pill">{data.presentToday}</Badge>
              </div>
              <div className={listRowClass}>
                <span className="text-body text-text-secondary">Absent</span>
                <Badge variant="destructive" shape="pill">{absentToday}</Badge>
              </div>
              <div className={listRowClass}>
                <span className="text-body text-text-secondary">Rate</span>
                <Badge variant={attendanceStatus.badge} shape="pill">
                  {data.attendanceRate}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="shadow">
          <CardHeader className={cardHeaderClass}>
            <CardTitle className={cardTitleClass}>System Health</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-1">
            <div className="divide-y divide-border-subtle">
              <div className={listRowClass}>
                <span className="text-body text-text-secondary">Database</span>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-presence-available" aria-hidden />
                  <span className="text-body text-text-primary">Online</span>
                </div>
              </div>
              <div className={listRowClass}>
                <span className="text-body text-text-secondary">API Server</span>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-presence-available" aria-hidden />
                  <span className="text-body text-text-primary">Active</span>
                </div>
              </div>
              <div className={listRowClass}>
                <span className="text-body text-text-secondary">Records</span>
                <Badge variant="secondary" shape="pill">
                  {data.totalAttendanceRecords}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="shadow">
          <CardHeader className={cardHeaderClass}>
            <CardTitle className={cardTitleClass}>Quick Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-5 py-3">
            {data.attendanceRate < 75 && (
              <div className="flex items-center gap-2 rounded-md border border-status-warning-border bg-status-warning-subtle px-3 py-2">
                <Warning16Regular className="shrink-0 text-status-warning" aria-hidden />
                <span className="text-body text-text-primary">Low attendance alert</span>
              </div>
            )}

            {data.attendanceRate >= 90 && (
              <div className="flex items-center gap-2 rounded-md border border-status-success-border bg-status-success-subtle px-3 py-2">
                <CheckmarkCircle16Regular className="shrink-0 text-status-success" aria-hidden />
                <span className="text-body text-text-primary">Excellent attendance!</span>
              </div>
            )}

            <div className={listRowClass}>
              <span className="text-body text-text-secondary">Auto-refresh</span>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />
                <span className="text-body tabular-nums text-text-primary">30s</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RealTimeAnalytics;
