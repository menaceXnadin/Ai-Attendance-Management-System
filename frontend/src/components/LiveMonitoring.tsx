import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';
import {
  Pulse20Regular,
  People20Regular,
  Database20Regular,
  Flash20Regular,
  Server20Regular,
  CheckmarkCircle20Regular,
  CheckmarkCircle16Filled,
  ArrowTrendingLines20Regular,
  Clock20Regular,
  HeartPulse20Regular,
  Circle12Filled,
} from '@fluentui/react-icons';

const LiveMonitoring: React.FC = () => {
  // Fetch real system health data
  const { data: systemHealth, isLoading: healthLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => api.dashboard.getSystemHealth(),
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false,
  });

  // Fetch real-time metrics
  const { data: realtimeMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['realtime-metrics'],
    queryFn: () => api.dashboard.getRealtimeMetrics(),
    refetchInterval: 10000, // Refresh every 10 seconds
    retry: false,
  });

  // Fetch students data
  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => api.students.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch today's attendance
  const { data: todayAttendance = [] } = useQuery({
    queryKey: ['today-attendance-monitoring'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await api.attendance.getAll({ date: today, limit: 200, skip: 0 });
      return response.records || [];
    },
    refetchInterval: 30000,
    retry: false,
  });

  const isLoading = healthLoading || metricsLoading;

  // Calculate real metrics
  const totalStudents = students.length;
  const presentToday = todayAttendance.filter(r => r.status === 'present').length;
  const attendanceRate = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;
  
  const getStatusColor = (value: number, threshold: number) => {
    if (value >= threshold) return 'text-status-success';
    if (value >= threshold * 0.7) return 'text-status-warning';
    return 'text-status-error';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-brand-subtle border-t-brand" aria-hidden></div>
            <p className="text-caption text-text-muted">Loading system metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  const tileClass = 'border-0 shadow';
  const kpiValue = 'text-[28px] font-semibold leading-9 tabular-nums text-text-primary';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-section-title text-text-primary">Live System Monitor</h2>
          <p className="text-caption text-text-muted">Real-time system performance and health metrics</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-status-success-border bg-status-success-subtle px-2.5 py-0.5 text-caption-strong text-status-success">
          <span className="h-2 w-2 animate-pulse rounded-full bg-status-success" aria-hidden></span>
          Live
        </span>
      </div>

      {/* Real-time Metrics Grid (KPI tiles) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Students */}
        <Card className={tileClass}>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
              <People20Regular aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-caption text-text-muted">Total Students</p>
              <div className={kpiValue}>{totalStudents}</div>
              <p className="text-caption text-text-muted">Registered users</p>
            </div>
          </CardContent>
        </Card>

        {/* Present Today */}
        <Card className={tileClass}>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-status-success-subtle text-status-success">
              <CheckmarkCircle20Regular aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-caption text-text-muted">Present Today</p>
              <div className={kpiValue}>{presentToday}</div>
              <p className="text-caption text-status-success">{attendanceRate}% attendance rate</p>
            </div>
          </CardContent>
        </Card>

        {/* System Uptime */}
        <Card className={tileClass}>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-status-info-subtle text-status-info">
              <Pulse20Regular aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-caption text-text-muted">System Uptime</p>
              <div className="flex items-center gap-2">
                <span className={kpiValue}>
                  {systemHealth?.uptime_percentage ? `${systemHealth.uptime_percentage}%` : '--'}
                </span>
                <Circle12Filled className={getStatusColor(systemHealth?.uptime_percentage || 0, 99)} aria-hidden />
              </div>
              <p className="text-caption text-text-muted">
                {systemHealth?.uptime_hours ? `${systemHealth.uptime_hours.toFixed(1)} hours` : 'Calculating...'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* API Response Time */}
        <Card className={tileClass}>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-status-warning-subtle text-status-warning">
              <Flash20Regular aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-caption text-text-muted">API Response</p>
              <div className="flex items-center gap-2">
                <span className={kpiValue}>
                  {realtimeMetrics?.responseTime ? `${realtimeMetrics.responseTime}ms` : '--'}
                </span>
                <Circle12Filled className={getStatusColor(200 - (realtimeMetrics?.responseTime || 0), 150)} aria-hidden />
              </div>
              <p className="text-caption text-text-muted">Average response time</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed System Performance */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Database Health */}
        <Card className="border-0 shadow overflow-hidden">
          <CardHeader className="border-b border-border-subtle px-5 py-3">
            <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
              <Database20Regular className="shrink-0 text-brand-foreground" aria-hidden />
              Database Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border-subtle p-0">
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-body text-text-secondary">Connection Status</span>
              <Badge
                variant={systemHealth?.database?.status === 'connected' ? 'success' : 'destructive'}
                shape="pill"
                className="gap-1"
              >
                {systemHealth?.database?.status === 'connected' ? (
                  <>
                    <CheckmarkCircle16Filled aria-hidden />
                    Connected
                  </>
                ) : (
                  'Disconnected'
                )}
              </Badge>
            </div>

            <div className="space-y-2 px-5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-body text-text-secondary">Response Time</span>
                <span className="text-body-strong tabular-nums text-text-primary">
                  {systemHealth?.database?.response_time_ms ? `${systemHealth.database.response_time_ms}ms` : '--'}
                </span>
              </div>
              <Progress
                value={systemHealth?.database?.response_time_ms ? Math.min((systemHealth.database.response_time_ms / 100) * 100, 100) : 0}
                className="h-1.5 bg-surface-subtle"
              />
            </div>

            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-body text-text-secondary">Active Sessions</span>
              <span className="text-body-strong tabular-nums text-text-primary">
                {systemHealth?.api?.active_sessions || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* System Resources */}
        <Card className="border-0 shadow overflow-hidden">
          <CardHeader className="border-b border-border-subtle px-5 py-3">
            <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
              <Server20Regular className="shrink-0 text-brand-foreground" aria-hidden />
              System Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border-subtle p-0">
            <div className="space-y-2 px-5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-body text-text-secondary">Memory Usage</span>
                <span className="text-body-strong tabular-nums text-text-primary">
                  {realtimeMetrics?.memory_usage ? `${realtimeMetrics.memory_usage}%` : '--'}
                </span>
              </div>
              <Progress value={realtimeMetrics?.memory_usage || 0} className="h-1.5 bg-surface-subtle" />
            </div>

            <div className="space-y-2 px-5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-body text-text-secondary">CPU Usage</span>
                <span className="text-body-strong tabular-nums text-text-primary">
                  {realtimeMetrics?.system_load ? `${realtimeMetrics.system_load}%` : '--'}
                </span>
              </div>
              <Progress value={realtimeMetrics?.system_load || 0} className="h-1.5 bg-surface-subtle" />
            </div>

            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-body text-text-secondary">System Status</span>
              <Badge variant="success" shape="pill" className="gap-1">
                <CheckmarkCircle16Filled aria-hidden />
                Healthy
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Status (service health list) */}
      <Card className="border-0 shadow overflow-hidden">
        <CardHeader className="border-b border-border-subtle px-5 py-3">
          <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
            <HeartPulse20Regular className="shrink-0 text-brand-foreground" aria-hidden />
            Service Status
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] border-b border-border-subtle bg-surface-subtle px-5 py-2 text-caption-strong text-text-secondary">
            <span>Service</span>
            <span>Health</span>
          </div>
          <div className="divide-y divide-border-subtle">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-2.5 hover:bg-surface-hover">
              <span className="flex items-center gap-3 text-body text-text-primary">
                <Database20Regular className="shrink-0 text-text-muted" aria-hidden />
                Database
              </span>
              <Badge variant="success" shape="pill" className="gap-1">
                <CheckmarkCircle16Filled aria-hidden />
                {systemHealth?.database?.status === 'connected' ? 'Connected' : 'Active'}
              </Badge>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-2.5 hover:bg-surface-hover">
              <span className="flex items-center gap-3 text-body text-text-primary">
                <Server20Regular className="shrink-0 text-text-muted" aria-hidden />
                API Server
              </span>
              <Badge variant="success" shape="pill" className="gap-1 capitalize">
                <CheckmarkCircle16Filled aria-hidden />
                {systemHealth?.api?.status || 'Active'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Activity Summary */}
      <Card className="border-0 shadow overflow-hidden">
        <CardHeader className="border-b border-border-subtle px-5 py-3">
          <CardTitle className="flex items-center gap-2 text-subheading text-text-primary">
            <ArrowTrendingLines20Regular className="shrink-0 text-brand-foreground" aria-hidden />
            Today's Activity Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 divide-border-subtle md:grid-cols-4 md:divide-x">
            <div className="px-5 py-4">
              <div className="text-caption text-text-muted">Total Students</div>
              <div className="text-section-title tabular-nums text-text-primary">{totalStudents}</div>
            </div>

            <div className="px-5 py-4">
              <div className="text-caption text-text-muted">Present Today</div>
              <div className="text-section-title tabular-nums text-status-success">{presentToday}</div>
            </div>

            <div className="px-5 py-4">
              <div className="text-caption text-text-muted">Attendance Rate</div>
              <div className="text-section-title tabular-nums text-brand-foreground">{attendanceRate}%</div>
            </div>

            <div className="px-5 py-4">
              <div className="text-caption text-text-muted">Uptime (hours)</div>
              <div className="flex items-center gap-1.5 text-text-primary">
                <Clock20Regular className="shrink-0 text-text-muted" aria-hidden />
                <span className="text-section-title tabular-nums">{systemHealth?.uptime_hours?.toFixed(0) || '--'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveMonitoring;
