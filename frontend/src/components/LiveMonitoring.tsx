import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';
import { 
  Activity, 
  Users, 
  Database,
  Zap,
  Server,
  CheckCircle,
  TrendingUp,
  Clock
} from 'lucide-react';

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
            <div className="h-10 w-10 border-2 border-action-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs text-text-muted">Loading system metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Live System Monitor</h2>
          <p className="text-xs text-text-muted">Real-time system performance and health metrics</p>
        </div>
        <Badge 
          variant="success"
          className="text-xs"
        >
          <div className="h-2 w-2 rounded-full bg-status-success animate-pulse mr-1.5"></div>
          Live
        </Badge>
      </div>

      {/* Real-time Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <Card className="bg-surface-default border-border-subtle shadow-card overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Total Students</p>
                <div className="text-2xl font-bold text-text-primary tabular-nums mt-0.5">
                  {totalStudents}
                </div>
                <p className="text-[11px] text-text-muted">Registered users</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-action-primary-subtle flex items-center justify-center">
                <Users className="h-5 w-5 text-action-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Present Today */}
        <Card className="bg-surface-default border-border-subtle shadow-card overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Present Today</p>
                <div className="text-2xl font-bold text-status-success tabular-nums mt-0.5">
                  {presentToday}
                </div>
                <p className="text-[11px] text-text-muted">{attendanceRate}% attendance rate</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-status-success-subtle flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-status-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Uptime */}
        <Card className="bg-surface-default border-border-subtle shadow-card overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">System Uptime</p>
                <div className={`text-2xl font-bold tabular-nums mt-0.5 ${getStatusColor(systemHealth?.uptime_percentage || 0, 99)}`}>
                  {systemHealth?.uptime_percentage ? `${systemHealth.uptime_percentage}%` : '--'}
                </div>
                <p className="text-[11px] text-text-muted">
                  {systemHealth?.uptime_hours ? `${systemHealth.uptime_hours.toFixed(1)} hours` : 'Calculating...'}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-status-info-subtle flex items-center justify-center">
                <Activity className="h-5 w-5 text-status-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Response Time */}
        <Card className="bg-surface-default border-border-subtle shadow-card overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">API Response</p>
                <div className={`text-2xl font-bold tabular-nums mt-0.5 ${getStatusColor(200 - (realtimeMetrics?.responseTime || 0), 150)}`}>
                  {realtimeMetrics?.responseTime ? `${realtimeMetrics.responseTime}ms` : '--'}
                </div>
                <p className="text-[11px] text-text-muted">Average response time</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-status-warning-subtle flex items-center justify-center">
                <Zap className="h-5 w-5 text-status-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed System Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Database Health */}
        <Card className="bg-surface-default border-border-subtle shadow-card">
          <CardHeader className="pb-3 border-b border-border-subtle">
            <CardTitle className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Database className="h-4 w-4 text-action-primary" />
              Database Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">Connection Status</span>
              <Badge 
                variant={systemHealth?.database?.status === 'connected' ? 'success' : 'destructive'}
                className="text-[11px]"
              >
                {systemHealth?.database?.status === 'connected' ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </>
                ) : (
                  'Disconnected'
                )}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Response Time</span>
                <span className="text-xs font-semibold text-text-primary tabular-nums">
                  {systemHealth?.database?.response_time_ms ? `${systemHealth.database.response_time_ms}ms` : '--'}
                </span>
              </div>
              <Progress 
                value={systemHealth?.database?.response_time_ms ? Math.min((systemHealth.database.response_time_ms / 100) * 100, 100) : 0} 
                className="h-1.5 bg-surface-subtle" 
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Active Sessions</span>
                <span className="text-xs font-semibold text-text-primary tabular-nums">
                  {systemHealth?.api?.active_sessions || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Resources */}
        <Card className="bg-surface-default border-border-subtle shadow-card">
          <CardHeader className="pb-3 border-b border-border-subtle">
            <CardTitle className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Server className="h-4 w-4 text-status-success" />
              System Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Memory Usage</span>
                <span className="text-xs font-semibold text-text-primary tabular-nums">
                  {realtimeMetrics?.memory_usage ? `${realtimeMetrics.memory_usage}%` : '--'}
                </span>
              </div>
              <Progress 
                value={realtimeMetrics?.memory_usage || 0} 
                className="h-1.5 bg-surface-subtle" 
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">CPU Usage</span>
                <span className="text-xs font-semibold text-text-primary tabular-nums">
                  {realtimeMetrics?.system_load ? `${realtimeMetrics.system_load}%` : '--'}
                </span>
              </div>
              <Progress 
                value={realtimeMetrics?.system_load || 0} 
                className="h-1.5 bg-surface-subtle" 
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
              <span className="text-xs font-medium text-text-secondary">System Status</span>
              <Badge 
                variant="success"
                className="text-[11px]"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Healthy
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Status */}
      <Card className="bg-surface-default border-border-subtle shadow-card">
        <CardHeader className="pb-3 border-b border-border-subtle">
          <CardTitle className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Activity className="h-4 w-4 text-action-primary" />
            Service Status
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 bg-surface-canvas/60 border border-border-subtle rounded-lg">
              <span className="text-xs font-medium text-text-primary">Database</span>
              <Badge 
                variant="success"
                className="text-[11px]"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                {systemHealth?.database?.status === 'connected' ? 'Connected' : 'Active'}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-surface-canvas/60 border border-border-subtle rounded-lg">
              <span className="text-xs font-medium text-text-primary">API Server</span>
              <Badge 
                variant="success"
                className="text-[11px]"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                {systemHealth?.api?.status || 'Active'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Activity Summary */}
      <Card className="bg-surface-default border-border-subtle shadow-card">
        <CardHeader className="pb-3 border-b border-border-subtle">
          <CardTitle className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-action-primary" />
            Today's Activity Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-surface-canvas/60 border border-border-subtle rounded-lg">
              <div className="text-xl font-bold text-text-primary tabular-nums mb-0.5">{totalStudents}</div>
              <div className="text-xs text-text-muted">Total Students</div>
            </div>
            
            <div className="text-center p-3 bg-surface-canvas/60 border border-border-subtle rounded-lg">
              <div className="text-xl font-bold text-status-success tabular-nums mb-0.5">{presentToday}</div>
              <div className="text-xs text-text-muted">Present Today</div>
            </div>
            
            <div className="text-center p-3 bg-surface-canvas/60 border border-border-subtle rounded-lg">
              <div className="text-xl font-bold text-action-primary tabular-nums mb-0.5">{attendanceRate}%</div>
              <div className="text-xs text-text-muted">Attendance Rate</div>
            </div>
            
            <div className="text-center p-3 bg-surface-canvas/60 border border-border-subtle rounded-lg">
              <div className="flex items-center justify-center gap-1.5 text-text-primary mb-0.5">
                <Clock className="h-4 w-4 text-text-muted" />
                <span className="text-xl font-bold tabular-nums">{systemHealth?.uptime_hours?.toFixed(0) || '--'}</span>
              </div>
              <div className="text-xs text-text-muted">Uptime (hours)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveMonitoring;
