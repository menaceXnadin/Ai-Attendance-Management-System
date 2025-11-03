import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CalendarIcon, 
  TrendingUp, 
  User, 
  Calendar, 
  Target, 
  AlertTriangle, 
  Loader2,
  Clock,
  Trophy,
  BookOpen,
  CheckCircle,
  XCircle,
  ChevronRight,
  Bell,
  BarChart3,
  Camera,
  Shield,
  Award,
  Activity,
  ArrowRight
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/useAuth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';
import { Attendance } from '@/integrations/api/types';
import FaceRegistration from '@/components/FaceRegistration';
import StudentSidebar from '@/components/StudentSidebar';
import SmartNotificationSystem from '@/components/SmartNotificationSystem';
import TodayClassSchedule from '@/components/TodayClassSchedule';
import { getTodayLocalDate } from '@/utils/dateUtils';


const StudentDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showFaceRegistration, setShowFaceRegistration] = useState(false);
  const [hasMarkedAttendanceToday, setHasMarkedAttendanceToday] = useState(false);
  const [lastAttendance, setLastAttendance] = useState<{
    timestamp: string;
    recognized: boolean;
  } | null>(null);

  // Fetch student data from backend (safe: getAll and filter by email)
  const { data: studentData, isLoading: isLoadingStudent } = useQuery({
    queryKey: ['current-student', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      try {
        const students = await api.students.getAll();
        const found = students.find(s => s.email === user.email);
        if (!found) {
          const foundInsensitive = students.find(s => s.email?.toLowerCase() === user.email?.toLowerCase());
          return foundInsensitive || null;
        }
        return found;
      } catch (error) {
        console.error('Error fetching student data:', error);
        return null;
      }
    },
    enabled: !!user?.email
  });

  // Fetch attendance summary
  const { data: attendanceSummary, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['attendance-summary', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        return await api.studentAttendance.getSummary();
      } catch (error) {
        console.error('Error fetching attendance summary:', error);
        return { 
          present: 0, 
          absent: 0, 
          late: 0, 
          total_academic_days: 0, 
          percentage_present: 0,
          days_with_any_attendance: 0,
          partial_attendance_percentage: 0,
          semester_start_date: '',
          semester_end_date: ''
        };
      }
    },
    enabled: !!user?.id
  });

  // Fetch dynamic academic metrics
  const { data: academicMetrics } = useQuery({
    queryKey: ['academic-metrics-current'],
    queryFn: async () => {
      try {
        return await api.academicMetrics.getCurrentSemester();
      } catch (error) {
        console.error('Error fetching academic metrics:', error);
        return { total_academic_days: 0, total_periods: 0 };
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // Check if attendance has been marked today and get records
  const { data: todayAttendanceData, refetch: refetchTodayAttendance } = useQuery({
    queryKey: ['today-attendance-data', user?.id, studentData?.id],
    queryFn: async () => {
      if (!user?.id || !studentData?.id) return { hasAttendance: false, records: [] };
      try {
        const today = getTodayLocalDate();
        const response = await api.attendance.getAll({
          studentId: studentData.id,
          date: today
        });
        const records = response.records || [];
        return { hasAttendance: records.length > 0, records };
      } catch (error) {
        console.error('Error checking today attendance:', error);
        return { hasAttendance: false, records: [] };
      }
    },
    enabled: !!user?.id && !!studentData?.id,
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
    refetchOnWindowFocus: true,
  });

  // Fetch today's real schedule data
  const { data: todaySchedules = [], isLoading: isLoadingSchedules } = useQuery({
    queryKey: ['student-today-schedules-dashboard', studentData?.faculty_id, studentData?.semester],
    queryFn: async () => {
      if (!studentData?.semester || !studentData?.faculty_id) return [];
      try {
        const schedules = await api.schedules.getStudentToday();
        return schedules;
      } catch (error) {
        console.error('Error fetching student today schedules:', error);
        return [];
      }
    },
    enabled: !!studentData?.semester && !!studentData?.faculty_id
  });

  const todayAttendance = todayAttendanceData?.hasAttendance || false;
  const todayAttendanceRecords = todayAttendanceData?.records || [];
  
  const relevantAttendanceRecords = todayAttendanceRecords.filter(record => {
    const extendedRecord = record as Attendance & { classId?: string };
    return todaySchedules.some(schedule => 
      schedule.subject_id === parseInt(record.subjectId) || 
      schedule.subject_id === parseInt(extendedRecord.classId || '0')
    );
  });

  React.useEffect(() => {
    if (todayAttendance) {
      setHasMarkedAttendanceToday(true);
    }
  }, [todayAttendance]);

  // Show loading state
  if (isLoadingStudent || isLoadingAttendance) {
    return (
      <StudentSidebar>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-400 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-white">Loading Dashboard</h3>
              <p className="text-slate-400 text-sm">Please wait...</p>
            </div>
          </div>
        </div>
      </StudentSidebar>
    );
  }

  return (
    <StudentSidebar>
      <div className="min-h-screen w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

        {/* Header Section */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
              Welcome back, <span className="text-blue-400">{studentData?.name?.split(' ')[0] || user?.name?.split(' ')[0] || 'Student'}</span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1.5 w-fit">
            <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse mr-2" />
            Active
          </Badge>
        </header>

        {/* Enhanced Quick Stats */}
        <section aria-label="Quick Statistics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Semester Attendance */}
          <Card className="bg-slate-900/70 backdrop-blur-sm border-slate-700/80 hover:border-slate-600 transition-all duration-300 group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wide">Attendance</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <CalendarIcon className="h-4 w-4 text-blue-400" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className={`text-3xl font-bold mb-1 tabular-nums ${
                (attendanceSummary?.percentage_present || 0) >= 90 ? 'text-emerald-400' :
                (attendanceSummary?.percentage_present || 0) >= 75 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {isLoadingAttendance ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  `${attendanceSummary?.percentage_present || 0}%`
                )}
              </div>
              <p className="text-xs text-slate-500 mb-3">
                {attendanceSummary?.present || 0} of {attendanceSummary?.total_academic_days || academicMetrics?.total_academic_days || 0} days
              </p>
              <div className="relative">
                <div className="h-2 w-full bg-slate-800/50 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      (attendanceSummary?.percentage_present || 0) >= 90 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                      (attendanceSummary?.percentage_present || 0) >= 75 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-rose-400 to-rose-500'
                    }`}
                    style={{ width: `${attendanceSummary?.percentage_present || 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Semester Progress */}
          <Card className="bg-slate-900/70 backdrop-blur-sm border-slate-700/80 hover:border-slate-600 transition-all duration-300 group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wide">Progress</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Activity className="h-4 w-4 text-purple-400" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-purple-400 mb-1 tabular-nums">
                {isLoadingAttendance ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : attendanceSummary?.semester_start_date && attendanceSummary?.semester_end_date ? (
                  (() => {
                    const now = new Date();
                    const start = new Date(attendanceSummary.semester_start_date);
                    const end = new Date(attendanceSummary.semester_end_date);
                    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                    const elapsedDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                    const progressPercent = Math.min(100, Math.round((elapsedDays / totalDays) * 100));
                    return `${progressPercent}%`;
                  })()
                ) : 'N/A'}
              </div>
              <p className="text-xs text-slate-500 mb-3">
                {attendanceSummary?.semester_start_date && attendanceSummary?.semester_end_date ? (
                  (() => {
                    const start = new Date(attendanceSummary.semester_start_date);
                    const end = new Date(attendanceSummary.semester_end_date);
                    const now = new Date();
                    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                    const elapsedDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                    const remainingDays = Math.max(0, totalDays - elapsedDays);
                    return `${remainingDays} days remaining`;
                  })()
                ) : 'Semester timeline'}
              </p>
              <div className="relative">
                <div className="h-2 w-full bg-slate-800/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-400 to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${attendanceSummary?.semester_start_date && attendanceSummary?.semester_end_date ? ((() => {
                      const now = new Date();
                      const start = new Date(attendanceSummary.semester_start_date);
                      const end = new Date(attendanceSummary.semester_end_date);
                      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                      const elapsedDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                      return Math.min(100, Math.round((elapsedDays / totalDays) * 100));
                    })()) : 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Student ID */}
          <Card className="bg-slate-900/70 backdrop-blur-sm border-slate-700/80 hover:border-slate-600 transition-all duration-300 group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wide">Student ID</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <User className="h-4 w-4 text-cyan-400" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-white mb-1 tabular-nums">
                {isLoadingStudent ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  studentData?.studentId || 'N/A'
                )}
              </div>
              <p className="text-xs text-slate-500 truncate">
                {studentData?.faculty || 'General'}
              </p>
            </CardContent>
          </Card>

          {/* Face ID Status */}
          <Card className="bg-slate-900/70 backdrop-blur-sm border-slate-700/80 hover:border-slate-600 transition-all duration-300 group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wide">Face ID</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className={`text-2xl font-bold mb-1 flex items-center gap-2 ${studentData?.face_encoding ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isLoadingStudent ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    {studentData?.face_encoding ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <Clock className="h-5 w-5" />
                    )}
                    {studentData?.face_encoding ? 'Active' : 'Pending'}
                  </>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {studentData?.face_encoding ? 'Biometric enabled' : 'Setup required'}
              </p>
            </CardContent>
          </Card>
        </section>
          
        {/* Today's Class Schedule */}
        <TodayClassSchedule 
          studentData={studentData}
          todayAttendance={todayAttendanceRecords}
          onAttendanceMarked={() => {
            setHasMarkedAttendanceToday(true);
            refetchTodayAttendance?.();
            toast({
              title: "Attendance Marked",
              description: "Successfully marked attendance",
            });
          }}
        />

        {/* Today's Attendance Overview */}
        <section aria-label="Today's Schedule">
          <Card className="bg-slate-900/70 backdrop-blur-sm border-slate-700/80 overflow-hidden">
            <CardHeader className="border-b border-slate-800/50 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-xl sm:text-2xl text-white flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <BookOpen className="h-4 w-4 text-blue-400" />
                    </div>
                    Today's Schedule
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-sm">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long' })} • {todaySchedules.length} {todaySchedules.length === 1 ? 'class' : 'classes'}
                  </CardDescription>
                </div>
                {hasMarkedAttendanceToday && (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1">
                    <CheckCircle className="h-3 w-3 mr-1.5" />
                    {relevantAttendanceRecords.filter(record => record.status === 'present').length || 0} Attended
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
                <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/70 hover:border-slate-600/70 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <CheckCircle className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold text-white tabular-nums">
                        {isLoadingSchedules ? '...' : relevantAttendanceRecords.filter(record => record.status === 'present').length}
                      </p>
                      <p className="text-xs text-slate-400 truncate">Present</p>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/70 hover:border-slate-600/70 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Calendar className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold text-white tabular-nums">
                        {isLoadingSchedules ? '...' : todaySchedules.length}
                      </p>
                      <p className="text-xs text-slate-400 truncate">Total</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {isLoadingSchedules ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center space-y-3">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-400 mx-auto" />
                      <p className="text-sm text-slate-400">Loading today's schedule...</p>
                    </div>
                  </div>
                ) : todaySchedules.length > 0 ? (
                  todaySchedules.map((schedule) => {
                    const attendanceRecord = todayAttendanceRecords.find(record => {
                      const recordSubjectIdInt = parseInt(record.subjectId);
                      const scheduleSubjectIdInt = parseInt(schedule.subject_id.toString());
                      return !isNaN(recordSubjectIdInt) && !isNaN(scheduleSubjectIdInt) && recordSubjectIdInt === scheduleSubjectIdInt;
                    });
                    
                    let status = 'Pending';
                    let statusColor = 'bg-slate-700/50 text-slate-300 border-slate-600/50';
                    let statusIcon = <Clock className="h-3 w-3" />;

                    // Check if class is cancelled
                    if (schedule.is_cancelled) {
                      status = 'Cancelled';
                      statusColor = 'bg-gray-600/30 text-gray-400 border-gray-500/30';
                      statusIcon = <XCircle className="h-3 w-3" />;
                    } else if (attendanceRecord) {
                      const recordStatus = attendanceRecord.status?.toLowerCase() || '';
                      if (recordStatus === 'present') {
                        status = 'Present';
                        statusColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                        statusIcon = <CheckCircle className="h-3 w-3" />;
                      } else if (recordStatus === 'absent') {
                        status = 'Absent';
                        statusColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                        statusIcon = <XCircle className="h-3 w-3" />;
                      } else if (recordStatus === 'late') {
                        status = 'Late';
                        statusColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                        statusIcon = <Clock className="h-3 w-3" />;
                      }
                    } else {
                      const now = new Date();
                      const currentMinutes = now.getHours() * 60 + now.getMinutes();
                      let endTimeMinutes = 0;
                      
                      if (schedule.end_time) {
                        const [endHour, endMin] = schedule.end_time.split(':').map(Number);
                        endTimeMinutes = endHour * 60 + endMin;
                      }
                      
                      if (endTimeMinutes > 0 && currentMinutes > (endTimeMinutes + 15)) {
                        status = 'Absent';
                        statusColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                        statusIcon = <XCircle className="h-3 w-3" />;
                      }
                    }
                    
                    return (
                      <div key={schedule.id} className={`group flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                        schedule.is_cancelled 
                          ? 'bg-slate-800/40 border-gray-600/50 opacity-75' 
                          : 'bg-slate-800/60 hover:bg-slate-800/80 border-slate-700/70 hover:border-slate-600/70'
                      }`}>
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`h-2 w-2 rounded-full shrink-0 ${
                            status === 'Cancelled' ? 'bg-gray-500' :
                            status === 'Present' ? 'bg-emerald-400' : 
                            status === 'Absent' ? 'bg-rose-400' :
                            status === 'Late' ? 'bg-amber-400' : 'bg-slate-500'
                          }`}></div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium truncate ${
                              schedule.is_cancelled ? 'text-gray-400 line-through' : 'text-white'
                            }`}>
                              {schedule.subject_name}
                            </p>
                            <p className="text-slate-400 text-xs truncate">
                              {schedule.time_slot_display}
                              {schedule.is_cancelled && schedule.cancellation_reason && (
                                <span className="ml-2 text-gray-500">• {schedule.cancellation_reason}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`${statusColor} flex items-center gap-1.5 shrink-0 ml-2`}>
                          {statusIcon}
                          <span className="hidden sm:inline">{status}</span>
                        </Badge>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800/70 mb-4">
                      <Calendar className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-slate-400 text-sm font-medium mb-1">No classes today</p>
                    <p className="text-slate-500 text-xs">Enjoy your free day!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Quick Actions Grid */}
        <section aria-label="Quick Actions">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link to="/student/calendar" className="group">
              <Card className="bg-slate-900/70 backdrop-blur-sm border-slate-700/80 hover:border-blue-500/50 hover:bg-slate-900/85 transition-all duration-300 h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Calendar className="h-6 w-6 text-blue-400" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                  <h3 className="font-semibold text-white mb-2">Academic Calendar</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">View semester schedule, holidays, and important dates</p>
                </CardContent>
              </Card>
            </Link>

            <Link to="/face-registration" className="group">
              <Card className="bg-slate-900/70 backdrop-blur-sm border-slate-700/80 hover:border-purple-500/50 hover:bg-slate-900/85 transition-all duration-300 h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Camera className="h-6 w-6 text-purple-400" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                  <h3 className="font-semibold text-white mb-2">Face Registration</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{studentData?.face_encoding ? 'Update your biometric data' : 'Set up face recognition for quick access'}</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

        {/* Face Registration Modal */}
        <FaceRegistration
          isOpen={showFaceRegistration}
          onSuccess={() => {
            setShowFaceRegistration(false);
            window.location.reload();
          }}
          onCancel={() => setShowFaceRegistration(false)}
        />
        </div>
      </div>
    </StudentSidebar>
  );
};

export default StudentDashboard;
