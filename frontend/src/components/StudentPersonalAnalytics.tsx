import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Target,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
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
            <Card key={i} className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-slate-700 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-slate-700 rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-slate-700 rounded w-full"></div>
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
    if (rate >= 90) return { status: 'Excellent', color: 'text-blue-400', bgColor: 'bg-blue-500/20' };
    if (rate >= 85) return { status: 'Good', color: 'text-green-400', bgColor: 'bg-green-500/20' };
    if (rate >= 75) return { status: 'Warning', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
    return { status: 'Critical', color: 'text-red-400', bgColor: 'bg-red-500/20' };
  };

  const attendanceStatus = getAttendanceStatus(data.attendanceRate);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-white mb-2">Your Personal Analytics</h3>
        <p className="text-slate-400">Track your attendance progress and trends</p>
      </div>

      {/* Personal Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Overall Attendance Rate */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
            data.attendanceRate >= 90 ? 'from-green-500 to-emerald-500' :
            data.attendanceRate >= 75 ? 'from-blue-500 to-cyan-500' :
            data.attendanceRate >= 60 ? 'from-yellow-500 to-orange-500' :
            'from-red-500 to-pink-500'
          }`}></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Attendance Rate</p>
                <div className={`text-2xl font-bold ${attendanceStatus.color}`}>
                  {data.attendanceRate.toFixed(1)}%
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {weeklyTrend >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-400" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-400" />
                  )}
                  <span className={`text-xs ${weeklyTrend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {Math.abs(weeklyTrend).toFixed(1)}% this week
                  </span>
                </div>
              </div>
              <div className={`h-12 w-12 rounded-xl ${attendanceStatus.bgColor} flex items-center justify-center`}>
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

        {/* Days Present */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-500"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Days Present</p>
                <div className="text-2xl font-bold text-green-400">{data.present}</div>
                <p className="text-xs text-slate-500">out of {data.total} days</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Days Absent */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-pink-500"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Days Absent</p>
                <div className="text-2xl font-bold text-red-400">{data.absent}</div>
                <p className="text-xs text-slate-500">including {data.late} late</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Attendance Pattern */}
      <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-400" />
            Recent Attendance Pattern
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {recentDays.map((day, index) => (
              <div key={index} className="text-center">
                <div className="text-xs text-slate-400 mb-2">{day.date}</div>
                <div className={`h-8 w-8 rounded-full mx-auto flex items-center justify-center ${
                  day.status === 'present' ? 'bg-green-500/20 text-green-400' :
                  day.status === 'late' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {day.status === 'present' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : day.status === 'late' ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-4 mt-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-slate-400">Present</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-slate-400">Late</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-slate-400">Absent</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Towards Goals */}
      <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-400" />
            Progress Towards 90% Goal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Current Progress</span>
              <span className="text-white">{data.attendanceRate.toFixed(1)}% of 90%</span>
            </div>
            <Progress value={Math.min(data.attendanceRate, 90)} className="h-3" />
            {data.attendanceRate < 90 && (
              <p className="text-sm text-slate-400">
                You need to maintain {(90 - data.attendanceRate).toFixed(1)}% more attendance to reach the 90% goal.
              </p>
            )}
            {data.attendanceRate >= 90 && (
              <p className="text-sm text-green-400">
                🎉 Congratulations! You've achieved the 90% attendance goal!
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentPersonalAnalytics;
