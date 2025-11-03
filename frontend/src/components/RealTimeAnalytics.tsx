import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Calendar, 
  Clock, 
  Target,
  BarChart3,
  Activity,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
            <CardContent className="p-6">
              {/* Use a dedicated skeleton animation to avoid global green glow from .animate-pulse */}
              <div className="animate-skeleton space-y-3">
                <div className="h-4 bg-slate-700/50 rounded w-3/4"></div>
                <div className="h-8 bg-slate-700/50 rounded w-1/2"></div>
                <div className="h-3 bg-slate-700/50 rounded w-full"></div>
              </div>
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
    if (rate >= 90) return { status: 'Excellent', color: 'text-blue-400', bgColor: 'bg-blue-500/20' };
    if (rate >= 85) return { status: 'Good', color: 'text-green-400', bgColor: 'bg-green-500/20' };
    if (rate >= 75) return { status: 'Warning', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
    return { status: 'Critical', color: 'text-red-400', bgColor: 'bg-red-500/20' };
  };

  const attendanceStatus = getAttendanceStatus(data.attendanceRate);

  // Calculate some derived metrics
  const absentToday = data.totalStudents - data.presentToday;
  const weeklyTrend = attendanceSummary ? 
    ((attendanceSummary.percentagePresent - data.attendanceRate) || 0) : 0;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Students</p>
                <div className="text-2xl font-bold text-blue-400">
                  {data.totalStudents}
                </div>
                <p className="text-xs text-slate-500">
                  Registered students
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
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
                  {data.presentToday}
                </div>
                <p className="text-xs text-slate-500">
                  out of {data.totalStudents} students
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="mt-3">
              <Progress value={(data.presentToday / data.totalStudents) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Attendance Rate */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Attendance Rate</p>
                <div className="text-2xl font-bold text-purple-400">
                  {data.attendanceRate}%
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {weeklyTrend >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-400" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-400" />
                  )}
                  <span className={`text-xs ${weeklyTrend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {Math.abs(weeklyTrend).toFixed(1)}% vs average
                  </span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <BarChart3 className={`h-6 w-6 ${attendanceStatus.color}`} />
              </div>
            </div>
            <div className="mt-3">
              <Badge variant="outline" className={`${attendanceStatus.bgColor} ${attendanceStatus.color} border-current`}>
                {attendanceStatus.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Total Classes */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-red-500"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Classes</p>
                <div className="text-2xl font-bold text-orange-400">
                  {data.totalClasses}
                </div>
                <p className="text-xs text-slate-500">
                  Active classes
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Today's Summary */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              Today's Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded bg-slate-800/50">
              <span className="text-slate-300">Present</span>
              <Badge className="bg-green-500/20 text-green-300">{data.presentToday}</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-800/50">
              <span className="text-slate-300">Absent</span>
              <Badge className="bg-red-500/20 text-red-300">{absentToday}</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-800/50">
              <span className="text-slate-300">Rate</span>
              <Badge className={`${attendanceStatus.bgColor} ${attendanceStatus.color}`}>
                {data.attendanceRate}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Target className="h-5 w-5 text-green-400" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded bg-slate-800/50">
              <span className="text-slate-300">Database</span>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <span className="text-green-300 text-sm">Online</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-800/50">
              <span className="text-slate-300">API Server</span>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <span className="text-green-300 text-sm">Active</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-800/50">
              <span className="text-slate-300">Records</span>
              <Badge className="bg-blue-500/20 text-blue-300">
                {data.totalAttendanceRecords}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-400" />
              Quick Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.attendanceRate < 75 && (
              <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="h-4 w-4 text-amber-400" />
                <span className="text-amber-300 text-sm">Low attendance alert</span>
              </div>
            )}
            
            {data.attendanceRate >= 90 && (
              <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/20">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <span className="text-green-300 text-sm">Excellent attendance!</span>
              </div>
            )}
            
            <div className="flex items-center justify-between p-2 rounded bg-slate-800/50">
              <span className="text-slate-300">Auto-refresh</span>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-blue-300 text-sm">30s</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RealTimeAnalytics;
