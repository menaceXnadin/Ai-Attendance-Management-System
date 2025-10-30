import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Award,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  BookOpen,
  User,
  BarChart3,
  ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { api } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';

interface CalendarDay {
  date: string;
  day: number;
  weekday: string;
  status: 'present' | 'absent' | 'partial' | 'late' | 'excused' | 'system_inactive' | 'no_data';
  total_classes: number;
  present: number;
  absent: number;
  late: number;
  records: Array<{
    id: number;
    status: string;
    subject_id: number;
    subject_name: string;
    time_in?: string;
    time_out?: string;
    location?: string;
    notes?: string;
  }>;
}

interface AttendanceStatistics {
  total_classes: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_rate: number;
  current_streak: number;
  longest_streak: number;
  days_with_classes: number;
}

interface SubjectBreakdown {
  subject_name: string;
  total_classes: number;
  present: number;
  absent: number;
  late: number;
  attendance_rate: number;
}

interface StudentCalendarData {
  student_id: number;
  student_name: string;
  student_number: string;
  year: number;
  month: number;
  month_name: string;
  calendar_days: CalendarDay[];
  statistics: AttendanceStatistics;
  subject_breakdown: SubjectBreakdown[];
}

interface StudentAttendanceCalendarProps {
  studentId?: string;
  hideBackButton?: boolean;
}

const StudentAttendanceCalendar = ({ studentId: propStudentId, hideBackButton = false }: StudentAttendanceCalendarProps = {}) => {
  const { studentId: paramStudentId } = useParams<{ studentId: string }>();
  const studentId = propStudentId || paramStudentId;
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Fetch calendar data
  const { data: calendarData, isLoading, error, isFetching } = useQuery<StudentCalendarData>({
    queryKey: ['student-calendar', studentId, year, month, propStudentId ? 'admin' : 'student'],
    queryFn: async () => {
      // If studentId is passed as prop (student view), use /me endpoint
      // If studentId is from params (admin view), use /{studentId} endpoint
      const endpoint = propStudentId 
        ? `http://127.0.0.1:8000/api/student-calendar/me?year=${year}&month=${month}`
        : `http://127.0.0.1:8000/api/student-calendar/${studentId}?year=${year}&month=${month}`;
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch calendar data');
      }
      
      return response.json();
    },
    enabled: !!studentId,
    retry: 1,
    staleTime: 30000, // Keep data fresh for 30 seconds
    keepPreviousData: true // Keep showing old data while fetching new data
  });

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  // Get status styling
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-500/20 text-green-300 border-green-400/30 hover:bg-green-500/30';
      case 'absent':
        return 'bg-red-500/20 text-red-300 border-red-400/30 hover:bg-red-500/30';
      case 'partial':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30 hover:bg-yellow-500/30';
      case 'late':
        return 'bg-orange-500/20 text-orange-300 border-orange-400/30 hover:bg-orange-500/30';
      case 'excused':
        return 'bg-blue-500/20 text-blue-300 border-blue-400/30 hover:bg-blue-500/30';
      case 'system_inactive':
        return 'bg-purple-900/30 text-purple-300 border-purple-600/50 hover:bg-purple-900/40 border-2 border-dashed';
      default:
        return 'bg-slate-700/20 text-slate-400 border-slate-600/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-4 w-4" />;
      case 'absent':
        return <XCircle className="h-4 w-4" />;
      case 'partial':
      case 'late':
        return <AlertCircle className="h-4 w-4" />;
      case 'system_inactive':
        return <Clock className="h-4 w-4" />;
      default:
        return null;
    }
  };

  // Build calendar grid (7 columns for days of week)
  const calendarGrid = useMemo(() => {
    if (!calendarData) return [];
    
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
    const daysInMonth = calendarData.calendar_days.length;
    
    // Create array with empty slots for days before the 1st
    const grid = Array(firstDay).fill(null);
    
    // Add actual days
    calendarData.calendar_days.forEach(day => grid.push(day));
    
    return grid;
  }, [calendarData, year, month]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading attendance calendar...</p>
        </div>
      </div>
    );
  }

  if (error || !calendarData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex items-center justify-center p-6">
        <Card className="bg-slate-900/80 border-slate-700/50 max-w-md">
          <CardContent className="p-8 text-center">
            <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Error Loading Calendar</h2>
            <p className="text-slate-400 mb-6">
              Unable to fetch attendance calendar data. Please try again.
            </p>
            {!hideBackButton && (
              <Button 
                onClick={() => navigate('/app/students')}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Students
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = calendarData.statistics;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!hideBackButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/app/students')}
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Calendar className="h-6 w-6 text-blue-400" />
                Attendance Calendar
              </h1>
              <p className="text-blue-200/80 text-sm">
                {calendarData.student_name} ({calendarData.student_number})
              </p>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-500"></div>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-xs text-slate-400 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Attendance Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-2xl font-bold text-white mb-1">
                {stats.attendance_rate.toFixed(1)}%
              </div>
              <Progress value={stats.attendance_rate} className="h-1.5 mb-1" />
              <p className="text-xs text-slate-400">
                {stats.present} of {stats.total_classes} classes
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-xs text-slate-400 flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                Total Classes
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-2xl font-bold text-white mb-1">
                {stats.total_classes}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-400">P: {stats.present}</span>
                <span className="text-red-400">A: {stats.absent}</span>
                <span className="text-yellow-400">L: {stats.late}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-xs text-slate-400 flex items-center gap-1">
                <Award className="h-3 w-3" />
                Current Streak
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-2xl font-bold text-white mb-1">
                {stats.current_streak}
                <span className="text-sm text-slate-400 ml-1">days</span>
              </div>
              <p className="text-xs text-slate-400">
                Longest: {stats.longest_streak} days
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-red-500"></div>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-xs text-slate-400 flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Days Absent
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-2xl font-bold text-white mb-1">
                {stats.absent}
              </div>
              <p className="text-xs text-slate-400">
                {((stats.absent / stats.total_classes) * 100).toFixed(1)}% of total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Calendar View */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader className="pb-3 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-400" />
                {calendarData.month_name} {calendarData.year}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousMonth}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800 h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date())}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800 h-8 px-3 text-xs"
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextMonth}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800 h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-semibold text-slate-400 py-1.5">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarGrid.map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="h-14" />;
                }

                // Get today's date in local timezone
                const todayLocal = new Date();
                const todayStr = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, '0')}-${String(todayLocal.getDate()).padStart(2, '0')}`;
                const isToday = day.date === todayStr;

                return (
                  <div
                    key={day.date}
                    className={`
                      h-14 border rounded-lg p-2 transition-all cursor-pointer hover:scale-105
                      ${getStatusColor(day.status)}
                      ${isToday ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900' : ''}
                    `}
                    title={`${day.weekday}, ${day.date}\n${day.total_classes} classes\nPresent: ${day.present}, Absent: ${day.absent}, Late: ${day.late}`}
                  >
                    <div className="flex flex-col h-full justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold">{day.day}</span>
                        {getStatusIcon(day.status)}
                      </div>
                      {day.total_classes > 0 && (
                        <div className="text-[10px] text-center font-semibold opacity-80">
                          {day.total_classes} {day.total_classes === 1 ? 'class' : 'classes'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-700">
              <span className="text-xs text-slate-400 font-semibold">Legend:</span>
              <Badge className="bg-green-500/20 text-green-300 border-green-400/30 text-xs py-0">
                <CheckCircle className="h-2.5 w-2.5 mr-1" />
                Present
              </Badge>
              <Badge className="bg-red-500/20 text-red-300 border-red-400/30 text-xs py-0">
                <XCircle className="h-2.5 w-2.5 mr-1" />
                Absent
              </Badge>
              <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-400/30 text-xs py-0">
                <AlertCircle className="h-2.5 w-2.5 mr-1" />
                Partial
              </Badge>
              <Badge className="bg-orange-500/20 text-orange-300 border-orange-400/30 text-xs py-0">
                <Clock className="h-2.5 w-2.5 mr-1" />
                Late
              </Badge>
              <Badge className="bg-gray-600/20 text-gray-400 border-gray-500/30 text-xs py-0">
                <Clock className="h-2.5 w-2.5 mr-1" />
                System Inactive
              </Badge>
              <Badge className="bg-slate-700/20 text-slate-400 border-slate-600/30 text-xs py-0">
                No Classes
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Subject Breakdown */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-400" />
              Subject-wise Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="space-y-3">
              {calendarData.subject_breakdown.map((subject) => (
                <div key={subject.subject_name} className="p-3 rounded-lg bg-slate-800/50">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-white text-sm">{subject.subject_name}</span>
                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30 text-xs py-0">
                      {subject.attendance_rate.toFixed(1)}%
                    </Badge>
                  </div>
                  <Progress value={subject.attendance_rate} className="h-1.5 mb-1.5" />
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-400">
                      Total: <span className="text-white">{subject.total_classes}</span>
                    </span>
                    <span className="text-green-400">
                      P: {subject.present}
                    </span>
                    <span className="text-red-400">
                      A: {subject.absent}
                    </span>
                    <span className="text-yellow-400">
                      L: {subject.late}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentAttendanceCalendar;
