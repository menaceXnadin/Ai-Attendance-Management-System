import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DataBarVertical20Regular,
  ArrowTrending16Regular,
  ArrowTrendingDown16Regular,
  CalendarLtr20Regular,
  Clock16Regular,
  Target20Regular,
  CheckmarkCircle20Regular,
  Checkmark16Regular,
  Dismiss16Regular,
  Warning20Regular,
  Trophy20Regular,
} from '@fluentui/react-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';
import { useAuth } from '@/contexts/useAuth';

interface StudentPersonalAnalyticsProps {
  className?: string;
}

const StudentPersonalAnalytics: React.FC<StudentPersonalAnalyticsProps> = ({ className = '' }) => {
  const { user } = useAuth();

  // Fetch personal attendance summary
  const { data: attendanceSummary, isLoading } = useQuery({
    queryKey: ['student-attendance-summary', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        return await api.attendance.getSummary({ studentId: user.id });
      } catch (error) {
        console.error('Error fetching attendance summary:', error);
        return { present: 0, absent: 0, late: 0, total: 0, percentage_present: 0, percentagePresent: 0 };
      }
    },
    enabled: !!user?.id
  });

  // Fetch personal attendance records for trend analysis
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['student-attendance-records', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30); // Last 30 days

        const response = await api.attendance.getAll({
          studentId: user.id,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        });
        return response?.records ?? [];
      } catch (error) {
        console.error('Error fetching attendance records:', error);
        return [];
      }
    },
    enabled: !!user?.id
  });

  // Calculate recent attendance pattern - last 7 calendar days
  const recentDays = useMemo(() => {
    const days = [];
    const today = new Date();

    // Create a map of attendance records by date for quick lookup
    const recordsByDate = new Map();
    attendanceRecords.forEach(record => {
      const recordDate = new Date(record.date).toDateString();
      // If multiple records on same date, prioritize present > late > absent
      const existing = recordsByDate.get(recordDate);
      if (!existing ||
          (record.status === 'present') ||
          (record.status === 'late' && existing !== 'present')) {
        recordsByDate.set(recordDate, record.status);
      }
    });

    // Generate last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      const dateString = date.toDateString();
      const status = recordsByDate.get(dateString) || 'absent';

      days.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        status: status,
        fullDate: date.toISOString().split('T')[0] // For debugging
      });
    }

    return days;
  }, [attendanceRecords]);

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
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
    present: attendanceSummary?.present || 0,
    absent: attendanceSummary?.absent || 0,
    late: attendanceSummary?.late || 0,
    total: attendanceSummary?.total || 0,
    attendanceRate: attendanceSummary?.percentage_present || 0,
  };

  // Calculate weekly trend
  const currentWeekRecords = attendanceRecords.filter(record => {
    const recordDate = new Date(record.date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return recordDate >= weekAgo;
  });

  const previousWeekRecords = attendanceRecords.filter(record => {
    const recordDate = new Date(record.date);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return recordDate >= twoWeeksAgo && recordDate < weekAgo;
  });

  const currentWeekRate = currentWeekRecords.length > 0
    ? (currentWeekRecords.filter(r => r.status === 'present').length / currentWeekRecords.length) * 100
    : 0;
  const previousWeekRate = previousWeekRecords.length > 0
    ? (previousWeekRecords.filter(r => r.status === 'present').length / previousWeekRecords.length) * 100
    : 0;
  const weeklyTrend = currentWeekRate - previousWeekRate;

  const getAttendanceStatus = (rate: number) => {
    if (rate >= 90) return { status: 'Excellent', color: 'text-status-success', bgColor: 'bg-status-success-subtle', variant: 'success' as const };
    if (rate >= 85) return { status: 'Good', color: 'text-status-info', bgColor: 'bg-status-info-subtle', variant: 'info' as const };
    if (rate >= 75) return { status: 'Warning', color: 'text-status-warning', bgColor: 'bg-status-warning-subtle', variant: 'warning' as const };
    return { status: 'Critical', color: 'text-status-error', bgColor: 'bg-status-error-subtle', variant: 'destructive' as const };
  };

  const attendanceStatus = getAttendanceStatus(data.attendanceRate);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h3 className="text-section-title text-text-primary">Your Personal Analytics</h3>
        <p className="text-body text-text-muted mt-1">Track your attendance progress and trends</p>
      </div>

      {/* Personal Stats KPI tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Overall Attendance Rate */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption text-text-muted">Attendance Rate</p>
                <div className="mt-1 text-[28px] leading-9 font-semibold tabular-nums text-text-primary">
                  {data.attendanceRate.toFixed(1)}%
                </div>
                <div className="flex items-center gap-1">
                  {weeklyTrend >= 0 ? (
                    <ArrowTrending16Regular className="shrink-0 text-status-success" aria-hidden />
                  ) : (
                    <ArrowTrendingDown16Regular className="shrink-0 text-status-error" aria-hidden />
                  )}
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

        {/* Days Present */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption text-text-muted">Days Present</p>
                <div className="mt-1 text-[28px] leading-9 font-semibold tabular-nums text-text-primary">{data.present}</div>
                <p className="text-caption text-text-muted">out of {data.total} days</p>
              </div>
              <div className="h-10 w-10 shrink-0 rounded-md bg-status-success-subtle text-status-success grid place-items-center">
                <CheckmarkCircle20Regular aria-hidden />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Days Absent */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-caption text-text-muted">Days Absent</p>
                <div className="mt-1 text-[28px] leading-9 font-semibold tabular-nums text-text-primary">{data.absent}</div>
                <p className="text-caption text-text-muted">including {data.late} late</p>
              </div>
              <div className="h-10 w-10 shrink-0 rounded-md bg-status-error-subtle text-status-error grid place-items-center">
                <Warning20Regular aria-hidden />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Attendance Pattern */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarLtr20Regular className="shrink-0 text-text-muted" aria-hidden />
            Recent Attendance Pattern
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {recentDays.map((day, index) => (
              <div key={index} className="flex flex-col items-center gap-2 rounded-md py-2">
                <div className="text-caption text-text-muted">{day.date}</div>
                <div
                  className={`h-9 w-9 rounded-full grid place-items-center border ${
                    day.status === 'present' ? 'bg-status-success-subtle border-status-success-border text-status-success' :
                    day.status === 'late' ? 'bg-status-warning-subtle border-status-warning-border text-status-warning' :
                    'bg-status-error-subtle border-status-error-border text-status-error'
                  }`}
                  title={day.status}
                >
                  {day.status === 'present' ? (
                    <Checkmark16Regular aria-hidden />
                  ) : day.status === 'late' ? (
                    <Clock16Regular aria-hidden />
                  ) : (
                    <Dismiss16Regular aria-hidden />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-4 mt-4 text-caption">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-status-success rounded-full"></div>
              <span className="text-text-muted">Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-status-warning rounded-full"></div>
              <span className="text-text-muted">Late</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-status-error rounded-full"></div>
              <span className="text-text-muted">Absent</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Towards Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target20Regular className="shrink-0 text-text-muted" aria-hidden />
            Progress Towards 90% Goal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-body">
              <span className="text-text-secondary">Current Progress</span>
              <span className="text-body-strong text-text-primary tabular-nums">{data.attendanceRate.toFixed(1)}% of 90%</span>
            </div>
            <Progress value={Math.min(data.attendanceRate, 90)} className="h-1.5" />
            {data.attendanceRate < 90 && (
              <p className="text-body text-text-muted">
                You need to maintain {(90 - data.attendanceRate).toFixed(1)}% more attendance to reach the 90% goal.
              </p>
            )}
            {data.attendanceRate >= 90 && (
              <div className="flex items-center gap-2 rounded-md border border-status-success-border bg-status-success-subtle px-3 py-2">
                <Trophy20Regular className="shrink-0 text-status-success" aria-hidden />
                <p className="text-body text-text-primary">
                  Congratulations! You've achieved the 90% attendance goal!
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentPersonalAnalytics;
