import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  PieChart,
  Activity,
  AlertCircle
} from 'lucide-react';

interface AnalyticsData {
  totalStudents: number;
  presentToday: number;
  attendanceRate: number;
  weeklyTrend: number;
  averageArrivalTime: string;
  topPerformingClass: string;
  lowAttendanceCount: number;
}

interface AdvancedAnalyticsProps {
  data: AnalyticsData;
}

const AdvancedAnalytics: React.FC<AdvancedAnalyticsProps> = ({ data }) => {
  const {
    totalStudents,
    presentToday,
    attendanceRate,
    weeklyTrend,
    averageArrivalTime,
    topPerformingClass,
    lowAttendanceCount
  } = data;

  const getAttendanceStatus = (rate: number) => {
    if (rate >= 90) return { color: 'text-green-400', status: 'Excellent', bgColor: 'bg-green-500/20' };
    if (rate >= 75) return { color: 'text-yellow-400', status: 'Good', bgColor: 'bg-yellow-500/20' };
    if (rate >= 60) return { color: 'text-orange-400', status: 'Needs Improvement', bgColor: 'bg-orange-500/20' };
    return { color: 'text-red-400', status: 'Critical', bgColor: 'bg-red-500/20' };
  };

  const getTrendIcon = (trend: number) => {
    return trend >= 0 ? (
      <TrendingUp className="h-4 w-4 text-green-400" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-400" />
    );
  };

  const attendanceStatus = getAttendanceStatus(attendanceRate);

  // Sample data for detailed analytics
  const timeSlotData = [
    { time: '8:00-9:00', students: 45, percentage: 78 },
    { time: '9:00-10:00', students: 52, percentage: 90 },
    { time: '10:00-11:00', students: 48, percentage: 83 },
    { time: '11:00-12:00', students: 41, percentage: 71 },
  ];

  const departmentData = [
    { name: 'Computer Science', attendance: 92, students: 45 },
    { name: 'Engineering', attendance: 88, students: 38 },
    { name: 'Business', attendance: 85, students: 33 },
    { name: 'Arts', attendance: 79, students: 28 },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Overall Attendance</p>
                <div className={`text-2xl font-bold ${attendanceStatus.color}`}>
                  {attendanceRate}%
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {getTrendIcon(weeklyTrend)}
                  <span className={`text-xs ${weeklyTrend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {Math.abs(weeklyTrend)}% this week
                  </span>
                </div>
              </div>
              <div className={`h-12 w-12 rounded-lg ${attendanceStatus.bgColor} flex items-center justify-center`}>
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

        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-500"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Present Today</p>
                <div className="text-2xl font-bold text-green-400">
                  {presentToday}
                </div>
                <p className="text-xs text-slate-500">
                  out of {totalStudents} students
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-green-400" />
              </div>
            </div>
            <div className="mt-3">
              <Progress value={(presentToday / totalStudents) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Avg. Arrival Time</p>
                <div className="text-2xl font-bold text-purple-400">
                  {averageArrivalTime}
                </div>
                <p className="text-xs text-slate-500">
                  across all classes
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Need Attention</p>
                <div className="text-2xl font-bold text-amber-400">
                  {lowAttendanceCount}
                </div>
                <p className="text-xs text-slate-500">
                  students below 75%
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time Slot Analysis */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-400" />
              Attendance by Time Slot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {timeSlotData.map((slot, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{slot.time}</span>
                  <div className="text-right">
                    <span className="text-sm font-bold text-white">{slot.students}</span>
                    <span className="text-xs text-slate-400 ml-1">({slot.percentage}%)</span>
                  </div>
                </div>
                <Progress value={slot.percentage} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Department Performance */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Target className="h-5 w-5 text-green-400" />
              Department Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {departmentData.map((dept, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{dept.name}</span>
                  <div className="text-right">
                    <span className="text-sm font-bold text-white">{dept.attendance}%</span>
                    <span className="text-xs text-slate-400 ml-1">({dept.students} students)</span>
                  </div>
                </div>
                <Progress value={dept.attendance} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Key Insights */}
      <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-teal-400" />
            Key Insights & Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                <h4 className="font-medium text-white">Positive Trend</h4>
              </div>
              <p className="text-sm text-slate-300">
                {topPerformingClass} shows excellent attendance with consistent improvement over the past month.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="h-5 w-5 text-blue-400" />
                <h4 className="font-medium text-white">Peak Hours</h4>
              </div>
              <p className="text-sm text-slate-300">
                Most students arrive between 9:00-10:00 AM. Consider scheduling important classes during this time.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="h-5 w-5 text-amber-400" />
                <h4 className="font-medium text-white">Action Required</h4>
              </div>
              <p className="text-sm text-slate-300">
                {lowAttendanceCount} students need intervention. Consider implementing early warning system.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvancedAnalytics;
