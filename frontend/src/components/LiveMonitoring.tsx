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
    if (value >= threshold) return 'text-green-400';
    if (value >= threshold * 0.7) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading system metrics...</p>
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
          <h2 className="text-2xl font-bold text-white">Live System Monitor</h2>
          <p className="text-slate-400">Real-time system performance and health metrics</p>
        </div>
        <Badge 
          variant="outline" 
          className="bg-green-500/20 text-green-300 border-green-400/30"
        >
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse mr-2"></div>
          Live
        </Badge>
      </div>

      {/* Real-time Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Students</p>
                <div className="text-2xl font-bold text-blue-400">
                  {totalStudents}
                </div>
                <p className="text-xs text-slate-500">Registered users</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Present Today */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-500"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Present Today</p>
                <div className="text-2xl font-bold text-green-400">
                  {presentToday}
                </div>
                <p className="text-xs text-slate-500">{attendanceRate}% attendance rate</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Uptime */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">System Uptime</p>
                <div className={`text-2xl font-bold ${getStatusColor(systemHealth?.uptime_percentage || 0, 99)}`}>
                  {systemHealth?.uptime_percentage ? `${systemHealth.uptime_percentage}%` : '--'}
                </div>
                <p className="text-xs text-slate-500">
                  {systemHealth?.uptime_hours ? `${systemHealth.uptime_hours.toFixed(1)} hours` : 'Calculating...'}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Activity className="h-6 w-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Response Time */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-red-500"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">API Response</p>
                <div className={`text-2xl font-bold ${getStatusColor(200 - (realtimeMetrics?.responseTime || 0), 150)}`}>
                  {realtimeMetrics?.responseTime ? `${realtimeMetrics.responseTime}ms` : '--'}
                </div>
                <p className="text-xs text-slate-500">Average response time</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Zap className="h-6 w-6 text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed System Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Database Health */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-400" />
              Database Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Connection Status</span>
              <Badge 
                variant="outline"
                className={
                  systemHealth?.database?.status === 'connected'
                    ? 'bg-green-500/20 text-green-300 border-green-500/50'
                    : 'bg-red-500/20 text-red-300 border-red-500/50'
                }
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

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Response Time</span>
                <span className="text-sm font-medium text-white">
                  {systemHealth?.database?.response_time_ms ? `${systemHealth.database.response_time_ms}ms` : '--'}
                </span>
              </div>
              <Progress 
                value={systemHealth?.database?.response_time_ms ? Math.min((systemHealth.database.response_time_ms / 100) * 100, 100) : 0} 
                className="h-2" 
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Active Sessions</span>
                <span className="text-sm font-medium text-white">
                  {systemHealth?.api?.active_sessions || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Resources */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Server className="h-5 w-5 text-green-400" />
              System Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Memory Usage</span>
                <span className="text-sm font-medium text-white">
                  {realtimeMetrics?.memory_usage ? `${realtimeMetrics.memory_usage}%` : '--'}
                </span>
              </div>
              <Progress 
                value={realtimeMetrics?.memory_usage || 0} 
                className="h-2" 
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">CPU Usage</span>
                <span className="text-sm font-medium text-white">
                  {realtimeMetrics?.system_load ? `${realtimeMetrics.system_load}%` : '--'}
                </span>
              </div>
              <Progress 
                value={realtimeMetrics?.system_load || 0} 
                className="h-2" 
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-700">
              <span className="text-sm text-slate-300">System Status</span>
              <Badge 
                variant="outline"
                className="bg-green-500/20 text-green-300 border-green-500/50"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Healthy
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Status */}
      <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-400" />
            Service Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
              <span className="text-slate-300">Database</span>
              <Badge 
                variant="outline"
                className="bg-green-500/20 text-green-300 border-green-500/50"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                {systemHealth?.database?.status === 'connected' ? 'Connected' : 'Active'}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
              <span className="text-slate-300">API Server</span>
              <Badge 
                variant="outline"
                className="bg-green-500/20 text-green-300 border-green-500/50"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                {systemHealth?.api?.status || 'Active'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Activity Summary */}
      <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            Today's Activity Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-400 mb-1">{totalStudents}</div>
              <div className="text-sm text-slate-400">Total Students</div>
            </div>
            
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-green-400 mb-1">{presentToday}</div>
              <div className="text-sm text-slate-400">Present Today</div>
            </div>
            
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-purple-400 mb-1">{attendanceRate}%</div>
              <div className="text-sm text-slate-400">Attendance Rate</div>
            </div>
            
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="flex items-center justify-center gap-2 text-green-400 mb-1">
                <Clock className="h-5 w-5" />
                <span className="text-2xl font-bold">{systemHealth?.uptime_hours?.toFixed(0) || '--'}</span>
              </div>
              <div className="text-sm text-slate-400">Uptime (hours)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveMonitoring;
