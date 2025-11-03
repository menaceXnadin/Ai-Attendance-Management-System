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
  ArrowLeft,
  MapPin
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
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
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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

  // Handle clicking on a calendar day
  const handleDayClick = (day: CalendarDay) => {
    setSelectedDay(day);
    setIsDialogOpen(true);
  };

  // Format time for display (HH:MM format or "Not recorded")
  const formatTime = (time?: string) => {
    if (!time) return 'Not recorded';
    try {
      // If it's already in HH:MM format, return as is
      if (/^\d{2}:\d{2}$/.test(time)) return time;
      
      // If it's a full timestamp, extract time
      const dateTime = new Date(time);
      if (!isNaN(dateTime.getTime())) {
        return dateTime.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
      }
      return time;
    } catch {
      return time || 'Not recorded';
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
                  <button
                    key={day.date}
                    onClick={() => handleDayClick(day)}
                    className={`
                      h-14 border rounded-lg p-2 transition-all cursor-pointer hover:scale-105 hover:shadow-lg
                      ${getStatusColor(day.status)}
                      ${isToday ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900' : ''}
                    `}
                    title={`Click to view details for ${day.weekday}, ${day.date}`}
                  >
                    <div className="flex flex-col h-full justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold">{day.day}</span>
                        {getStatusIcon(day.status)}
                      </div>
                      {day.present > 0 && (
                        <div className="text-[10px] text-center font-semibold opacity-80">
                          {day.present} {day.present === 1 ? 'present' : 'present'}
                        </div>
                      )}
                    </div>
                  </button>
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

        {/* Day Details Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg max-h-[75vh] bg-slate-900 border-slate-700 p-0 gap-0 overflow-hidden">
            {selectedDay && (
              <>
                <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-700/50">
                  <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-400" />
                    {selectedDay.weekday}, {new Date(selectedDay.date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400">
                    Attendance details
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 px-5 py-4 overflow-y-auto max-h-[calc(75vh-8rem)] custom-scrollbar">
                  {/* Day Summary Card */}
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-xs text-slate-300 flex items-center gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
                        Daily Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 px-3 pb-3">
                      {/* Overall Status */}
                      <div className="flex items-center justify-between py-1">
                        <span className="text-xs text-slate-400">Status:</span>
                        <Badge className={`${getStatusColor(selectedDay.status)} text-xs py-0.5 px-2`}>
                          {getStatusIcon(selectedDay.status)}
                          <span className="ml-1 capitalize">{selectedDay.status.replace('_', ' ')}</span>
                        </Badge>
                      </div>
                      
                      <Separator className="bg-slate-700" />
                      
                      {/* Statistics Grid - Calculate from unique subjects */}
                      {(() => {
                        // Deduplicate records by subject to get accurate counts
                        const uniqueSubjects = new Map();
                        selectedDay.records.forEach(record => {
                          const key = record.subject_id || record.subject_name;
                          if (!uniqueSubjects.has(key)) {
                            uniqueSubjects.set(key, record);
                          }
                        });
                        const uniqueRecords = Array.from(uniqueSubjects.values());
                        const totalUnique = uniqueRecords.length;
                        const presentUnique = uniqueRecords.filter(r => r.status === 'present').length;
                        const absentUnique = uniqueRecords.filter(r => r.status === 'absent').length;
                        const lateUnique = uniqueRecords.filter(r => r.status === 'late').length;
                        const dayRate = totalUnique > 0 ? ((presentUnique / totalUnique) * 100).toFixed(1) : '0.0';
                        
                        return (
                          <>
                            <div className="grid grid-cols-4 gap-2">
                              <div className="bg-slate-900/50 rounded p-2 border border-slate-700">
                                <div className="text-[10px] text-slate-400 mb-0.5">Total</div>
                                <div className="text-lg font-bold text-white">{totalUnique}</div>
                              </div>
                              <div className="bg-green-900/20 rounded p-2 border border-green-700/30">
                                <div className="text-[10px] text-green-400 mb-0.5">Present</div>
                                <div className="text-lg font-bold text-green-300">{presentUnique}</div>
                              </div>
                              <div className="bg-red-900/20 rounded p-2 border border-red-700/30">
                                <div className="text-[10px] text-red-400 mb-0.5">Absent</div>
                                <div className="text-lg font-bold text-red-300">{absentUnique}</div>
                              </div>
                              <div className="bg-orange-900/20 rounded p-2 border border-orange-700/30">
                                <div className="text-[10px] text-orange-400 mb-0.5">Late</div>
                                <div className="text-lg font-bold text-orange-300">{lateUnique}</div>
                              </div>
                            </div>

                            {/* Attendance Percentage */}
                            {totalUnique > 0 && (
                              <div className="pt-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] text-slate-400">Day Rate</span>
                                  <span className="text-xs font-semibold text-white">{dayRate}%</span>
                                </div>
                                <Progress 
                                  value={parseFloat(dayRate)} 
                                  className="h-1.5"
                                />
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  {/* Subject-wise Attendance */}
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-xs text-slate-300 flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-purple-400" />
                        Subject-wise Attendance
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      {selectedDay.records.length === 0 ? (
                        <div className="text-center py-4 text-slate-400">
                          <XCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-xs">No attendance records</p>
                          {selectedDay.status === 'system_inactive' && (
                            <p className="text-[10px] mt-1 text-purple-400">
                              System inactive
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* Deduplicate by subject_id - show latest record for each subject */}
                          {(() => {
                            const uniqueRecords = new Map();
                            selectedDay.records.forEach(record => {
                              const key = record.subject_id || record.subject_name;
                              // Keep the latest record or the one with most detailed info
                              if (!uniqueRecords.has(key) || 
                                  (record.time_in && !uniqueRecords.get(key).time_in)) {
                                uniqueRecords.set(key, record);
                              }
                            });
                            return Array.from(uniqueRecords.values());
                          })().map((record, index) => {
                            const recordStatusColor = getStatusColor(record.status);
                            const recordIcon = getStatusIcon(record.status);
                            
                            return (
                              <div 
                                key={record.id || index}
                                className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700 hover:border-slate-600 transition-colors"
                              >
                                {/* Subject Header */}
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-white text-sm mb-0.5 truncate">
                                      {record.subject_name}
                                    </h4>
                                    {record.location && (
                                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                        <MapPin className="h-2.5 w-2.5" />
                                        {record.location}
                                      </div>
                                    )}
                                  </div>
                                  <Badge className={`${recordStatusColor} text-[10px] py-0.5 px-1.5 ml-2`}>
                                    {recordIcon}
                                    <span className="ml-1 capitalize">{record.status}</span>
                                  </Badge>
                                </div>

                                {/* Time Information */}
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  <div className="bg-slate-800/50 rounded p-1.5">
                                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
                                      <Clock className="h-2.5 w-2.5 text-green-400" />
                                      In
                                    </div>
                                    <div className="text-xs font-medium text-slate-200">
                                      {formatTime(record.time_in)}
                                    </div>
                                  </div>
                                  <div className="bg-slate-800/50 rounded p-1.5">
                                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
                                      <Clock className="h-2.5 w-2.5 text-red-400" />
                                      Out
                                    </div>
                                    <div className="text-xs font-medium text-slate-200">
                                      {formatTime(record.time_out)}
                                    </div>
                                  </div>
                                </div>

                                {/* Notes */}
                                {record.notes && (
                                  <div className="bg-blue-900/10 border border-blue-700/30 rounded p-1.5">
                                    <div className="flex items-start gap-1.5">
                                      <AlertCircle className="h-3 w-3 text-blue-400 mt-0.5 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-[10px] text-blue-300 font-medium mb-0.5">Note</div>
                                        <div className="text-[10px] text-slate-300 line-clamp-2">{record.notes}</div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Subject Breakdown - Enhanced */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900/70 to-slate-900/40 border-slate-700/50 shadow-xl shadow-purple-500/5">
          {/* Decorative glow */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gradient-to-tr from-purple-500/10 to-pink-400/10 blur-2xl" />
          
          <CardHeader className="pb-4 pt-5 relative z-10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
                Subject-wise Breakdown
              </CardTitle>
              <Badge variant="outline" className="text-slate-300 border-slate-600 text-xs">
                {calendarData.subject_breakdown.length} Subjects
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pb-5 relative z-10">
            <div className="space-y-4">
              {calendarData.subject_breakdown.map((subject, index) => {
                const getAttendanceColor = (rate: number) => {
                  if (rate >= 80) return { bg: 'bg-green-500/20', border: 'border-green-500/40', text: 'text-green-300', bar: 'from-green-500 to-emerald-400' };
                  if (rate >= 60) return { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-300', bar: 'from-blue-500 to-cyan-400' };
                  if (rate >= 40) return { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-300', bar: 'from-yellow-500 to-orange-400' };
                  return { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-300', bar: 'from-red-500 to-rose-400' };
                };
                
                const colors = getAttendanceColor(subject.attendance_rate);
                
                return (
                  <div 
                    key={subject.subject_name} 
                    className="group relative rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 hover:border-purple-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10"
                  >
                    {/* Subject header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-white text-base mb-1">{subject.subject_name}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Total Classes:</span>
                          <span className="text-xs font-medium text-white">{subject.total_classes}</span>
                        </div>
                      </div>
                      <Badge className={`${colors.bg} ${colors.text} border ${colors.border} px-3 py-1 font-semibold`}>
                        {subject.attendance_rate.toFixed(1)}%
                      </Badge>
                    </div>

                    {/* Progress bar with gradient */}
                    <div className="relative mb-3">
                      <div className="h-2.5 w-full bg-slate-700/50 rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${colors.bar} transition-all duration-500 rounded-full`}
                          style={{ width: `${subject.attendance_rate}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-green-400" />
                          <span className="text-xs text-slate-400">P:</span>
                          <span className="text-sm font-semibold text-green-300">{subject.present}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-red-400" />
                          <span className="text-xs text-slate-400">A:</span>
                          <span className="text-sm font-semibold text-red-300">{subject.absent}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-yellow-400" />
                          <span className="text-xs text-slate-400">L:</span>
                          <span className="text-sm font-semibold text-yellow-300">{subject.late}</span>
                        </div>
                      </div>
                      
                      {/* Attendance status indicator */}
                      {subject.attendance_rate >= 75 && (
                        <div className="flex items-center gap-1 text-green-400">
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">Good</span>
                        </div>
                      )}
                      {subject.attendance_rate < 75 && subject.attendance_rate >= 60 && (
                        <div className="flex items-center gap-1 text-yellow-400">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">Warning</span>
                        </div>
                      )}
                      {subject.attendance_rate < 60 && (
                        <div className="flex items-center gap-1 text-red-400">
                          <XCircle className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">Low</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentAttendanceCalendar;
