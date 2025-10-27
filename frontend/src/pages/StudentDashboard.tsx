import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CalendarIcon, 
  TrendingUp, 
  User, 
  LogOut, 
  Calendar, 
  Download, 
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
  Settings,
  BarChart3,
  Camera,
  Shield
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/useAuth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';
import { Attendance } from '@/integrations/api/types';
import StudentAttendanceReport from '@/components/student/StudentAttendanceReport';
import StudentMarksReport from '@/components/student/StudentMarksReport';
import StudentProfile from '@/components/student/StudentProfile';
import StudentPersonalAnalytics from '@/components/StudentPersonalAnalytics';
import EnhancedNotificationSystem from '@/components/EnhancedNotificationSystem';
import ProfileDropdown from '@/components/ProfileDropdown';
import FaceRegistration from '@/components/FaceRegistration';
import StudentSidebar from '@/components/StudentSidebar';
import SmartNotificationSystem from '@/components/SmartNotificationSystem';
import TodayClassSchedule from '@/components/TodayClassSchedule';


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
        // Debug log: print user email and all student emails
        console.log('[DEBUG] Logged-in user email:', user.email);
        console.log('[DEBUG] All student emails:', students.map(s => s.email));
        const found = students.find(s => s.email === user.email);
        if (!found) {
          // Try case-insensitive match
          const foundInsensitive = students.find(s => s.email?.toLowerCase() === user.email?.toLowerCase());
          if (foundInsensitive) {
            console.log('[DEBUG] Found student by case-insensitive email match:', foundInsensitive);
          } else {
            console.warn('[DEBUG] No student found for user email:', user.email);
          }
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
        // Use the fixed student attendance endpoint
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
  const { data: academicMetrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['academic-metrics-current'],
    queryFn: async () => {
      try {
        return await api.academicMetrics.getCurrentSemester();
      } catch (error) {
        console.error('Error fetching academic metrics:', error);
        return { total_academic_days: 0, total_periods: 0 };
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes since this data doesn't change often
  });

  // Check if attendance has been marked today and get records
  const { data: todayAttendanceData, refetch: refetchTodayAttendance } = useQuery({
    queryKey: ['today-attendance-data', user?.id, studentData?.id],
    queryFn: async () => {
      if (!user?.id || !studentData?.id) return { hasAttendance: false, records: [] };
      try {
        const today = new Date().toISOString().split('T')[0];
        console.log('[DEBUG] Dashboard fetching attendance for student ID:', studentData.id, 'user ID:', user.id);
        const records = await api.attendance.getAll({
          studentId: studentData.id, // Use student record ID, not user ID
          date: today
        });
        console.log('[DEBUG] Dashboard attendance records:', records);
        return { hasAttendance: records.length > 0, records };
      } catch (error) {
        console.error('Error checking today attendance:', error);
        return { hasAttendance: false, records: [] };
      }
    },
    enabled: !!user?.id && !!studentData?.id,
    staleTime: 5 * 1000, // 5 seconds - fetch fresh data quickly
    refetchInterval: 10 * 1000, // Auto-refetch every 10 seconds to detect admin changes
    refetchOnWindowFocus: true, // Refetch when user switches back to tab
  });

  // Fetch today's real schedule data for dashboard overview - using student-specific endpoint
  const { data: todaySchedules = [], isLoading: isLoadingSchedules } = useQuery({
    queryKey: ['student-today-schedules-dashboard', studentData?.faculty_id, studentData?.semester],
    queryFn: async () => {
      if (!studentData?.semester || !studentData?.faculty_id) return [];
      try {
        console.log('[DEBUG] Fetching student-specific today schedules for dashboard overview - faculty_id:', studentData.faculty_id, 'semester:', studentData.semester);
        
        // Use the proper student-specific endpoint that handles all filtering internally
        const schedules = await api.schedules.getStudentToday();
        console.log('[DEBUG] Student-specific dashboard schedules fetched:', schedules);
        return schedules;
      } catch (error) {
        console.error('Error fetching student today schedules for dashboard:', error);
        return [];
      }
    },
    enabled: !!studentData?.semester && !!studentData?.faculty_id
  });

  const todayAttendance = todayAttendanceData?.hasAttendance || false;
  const todayAttendanceRecords = todayAttendanceData?.records || [];
  
  // Filter attendance records to only include subjects that are in today's schedule
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
  
  // Function removed - no longer needed with class-specific attendance

  const handleDismissReminder = () => {
    // Handle reminder dismissal logic if needed
  };


  // State for active tab (must be before any early return)
  const [activeTab, setActiveTab] = useState('attendance');

  // Show loading state if data is still loading
  if (isLoadingStudent || isLoadingAttendance) {
    return (
      <StudentSidebar>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-teal-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold text-white mb-2">Loading Dashboard</h3>
              <p className="text-blue-200">Setting up your personalized experience...</p>
            </div>
          </div>
        </div>
      </StudentSidebar>
    );
  }



  return (
    <StudentSidebar>
  <div className="space-y-10 px-8 md:px-24 py-6 md:py-10 w-full">

        {/* Header Section */}
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-0">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">
              Welcome back, {studentData?.name?.split(' ')[0] || user?.name?.split(' ')[0] || 'Student'}!
            </h1>
            <p className="text-blue-200/80 text-lg mt-2">
              Here's your academic overview and today's insights
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-teal-500/20 text-teal-300 border-teal-400/30">
              <div className="h-2 w-2 bg-teal-400 rounded-full animate-pulse mr-2" />
              Student Portal
            </Badge>
          </div>
        </div>

          {/* Enhanced Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
            <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 hover:border-green-500/30 transition-all group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-400 mb-1">Semester Attendance</p>
                    <div className={`text-3xl font-bold ${
                      (attendanceSummary?.percentage_present || 0) >= 90 ? 'text-green-400' :
                      (attendanceSummary?.percentage_present || 0) >= 75 ? 'text-blue-400' : 'text-red-400'
                    }`}>
                      {attendanceSummary?.percentage_present || 0}%
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {attendanceSummary?.present || 0} / {attendanceSummary?.total_academic_days || academicMetrics?.total_academic_days || 0} academic days
                    </p>
                    {attendanceSummary?.days_with_any_attendance && attendanceSummary?.days_with_any_attendance !== attendanceSummary?.present && (
                      <p className="text-xs text-amber-400 mt-0.5">
                        {attendanceSummary.days_with_any_attendance} days with partial attendance
                      </p>
                    )}
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CalendarIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="mt-4">
                  <Progress 
                    value={attendanceSummary?.percentage_present || 0} 
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 hover:border-amber-500/30 transition-all group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-400 mb-1">Semester Progress</p>
                    <div className="text-3xl font-bold text-amber-400">
                      {attendanceSummary?.semester_start_date && attendanceSummary?.semester_end_date ? (
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
                    <p className="text-xs text-slate-500 mt-1">
                      Days with classes: {attendanceSummary?.days_with_any_attendance || 0} / {attendanceSummary?.total_academic_days || academicMetrics?.total_academic_days || 0}
                    </p>
                    {academicMetrics?.total_periods && (
                      <p className="text-xs text-blue-400 mt-0.5">
                        Total periods: {academicMetrics.total_periods.toLocaleString()}
                      </p>
                    )}
                    {attendanceSummary?.semester_start_date && attendanceSummary?.semester_end_date && (
                      <p className="text-xs text-blue-400 mt-0.5">
                        {new Date(attendanceSummary.semester_start_date).toLocaleDateString()} - {new Date(attendanceSummary.semester_end_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="mt-4">
                  <Progress 
                    value={attendanceSummary?.semester_start_date && attendanceSummary?.semester_end_date ? (
                      (() => {
                        const now = new Date();
                        const start = new Date(attendanceSummary.semester_start_date);
                        const end = new Date(attendanceSummary.semester_end_date);
                        const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                        const elapsedDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                        return Math.min(100, Math.round((elapsedDays / totalDays) * 100));
                      })()
                    ) : 0} 
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 hover:border-blue-500/30 transition-all group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-400 mb-1">Student ID</p>
                    <div className="text-3xl font-bold text-blue-400">
                      {studentData?.studentId || 'N/A'}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {studentData?.faculty || 'General'}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <User className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 hover:border-purple-500/30 transition-all group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-400 mb-1">Academic Status</p>
                    <div className="text-3xl font-bold text-green-400">Active</div>
                    <p className="text-xs text-slate-500 mt-1">
                      Current Semester: <span className="font-semibold text-blue-400">{studentData?.semester ?? 'N/A'}</span>
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Trophy className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 hover:border-teal-500/30 transition-all group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-400 mb-1">Face ID Status</p>
                    <div className={`text-2xl font-bold ${studentData?.face_encoding ? 'text-green-400' : 'text-blue-400'}`}>
                      {studentData?.face_encoding ? 'Registered' : 'Pending'}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {studentData?.face_encoding ? 'Face recognition ready' : 'Setup required'}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Today's Class Schedule */}
          <TodayClassSchedule 
            studentData={studentData}
            todayAttendance={todayAttendanceRecords}
            onAttendanceMarked={() => {
              setHasMarkedAttendanceToday(true);
              // Refresh attendance data
              refetchTodayAttendance?.();
              toast({
                title: "Attendance Marked",
                description: "Successfully marked attendance",
              });
            }}
          />

        {/* Enhanced Student Portal Tabs */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden mt-8">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-teal-500"></div>
            <CardHeader className="pb-4 px-4 md:px-6 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl text-white flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
                      <BookOpen className="h-4 w-4 text-white" />
                    </div>
                    Today's Attendance Overview
                  </CardTitle>
                  <CardDescription className="text-blue-200/80 mt-2">
                    Track your attendance status across all classes today
                  </CardDescription>
                </div>
                {hasMarkedAttendanceToday && (
                  <Badge className="bg-green-500/20 text-green-300 border-green-400/30">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {relevantAttendanceRecords.filter(record => record.status === 'present').length || 0} classes attended
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 md:px-6 pb-6">
              <div className="space-y-6">
                {/* Attendance Statistics */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 text-green-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-white">
                            {relevantAttendanceRecords.filter(record => record.status === 'present').length}
                          </p>
                          <p className="text-sm text-slate-400">Present Today</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <BookOpen className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-white">
                            {todaySchedules.length}
                          </p>
                          <p className="text-sm text-slate-400">Total Classes</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Today's Schedule Overview */}
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                    <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Today's Classes Status
                    </h4>
                    
                    <div className="space-y-3">
                      {todaySchedules.length > 0 ? (
                        todaySchedules.map((schedule, index) => {
                          // Check if student has attendance record for this subject today
                          const attendanceRecord = todayAttendanceRecords.find(record => {
                            console.log(`[ATTENDANCE-DEBUG] Checking attendance record for ${schedule.subject_name}:`);
                            console.log(`[ATTENDANCE-DEBUG] Record subject ID: ${record.subjectId} (type: ${typeof record.subjectId})`);
                            console.log(`[ATTENDANCE-DEBUG] Schedule subject ID: ${schedule.subject_id} (type: ${typeof schedule.subject_id})`);
                            console.log(`[ATTENDANCE-DEBUG] Record subject object ID: ${record.subject?.id}`);
                            console.log(`[ATTENDANCE-DEBUG] Record subject name: ${record.subject?.name}`);
                            
                            // Strategy 1: Direct subject ID matching (string vs number)
                            if (record.subjectId === schedule.subject_id.toString()) {
                              console.log(`[ATTENDANCE-DEBUG] ✅ Match found via Strategy 1 (subjectId string)`);
                              return true;
                            }
                            
                            // Strategy 2: Subject object ID matching  
                            if (record.subject?.id === schedule.subject_id.toString()) {
                              console.log(`[ATTENDANCE-DEBUG] ✅ Match found via Strategy 2 (subject.id string)`);
                              return true;
                            }
                            
                            // Strategy 3: Subject name matching
                            if (record.subject?.name?.toLowerCase() === schedule.subject_name.toLowerCase()) {
                              console.log(`[ATTENDANCE-DEBUG] ✅ Match found via Strategy 3 (subject name)`);
                              return true;
                            }
                            
                            // Strategy 4: Extended record type check for subjectName field
                            const extendedRecord = record as Attendance & { subjectName?: string };
                            if (extendedRecord.subjectName?.toLowerCase() === schedule.subject_name.toLowerCase()) {
                              console.log(`[ATTENDANCE-DEBUG] ✅ Match found via Strategy 4 (subjectName)`);
                              return true;
                            }
                            
                            // Strategy 5: Integer comparison for subject IDs
                            if (parseInt(record.subjectId) === schedule.subject_id) {
                              console.log(`[ATTENDANCE-DEBUG] ✅ Match found via Strategy 5 (integer comparison)`);
                              return true;
                            }
                            
                            console.log(`[ATTENDANCE-DEBUG] ❌ No match found for ${schedule.subject_name}`);
                            return false;
                          });
                          
                          // Determine status based on database record or time-based calculation
                          let status = 'Pending';
                          let statusColor = 'bg-slate-600/20 text-slate-400 border-slate-500/30';
                          
                          if (attendanceRecord) {
                            // Use database record as authoritative source
                            if (attendanceRecord.status === 'present') {
                              status = 'Present';
                              statusColor = 'bg-green-500/20 text-green-300 border-green-400/30';
                            } else if (attendanceRecord.status === 'absent') {
                              status = 'Absent';
                              statusColor = 'bg-red-500/20 text-red-300 border-red-400/30';
                            } else if (attendanceRecord.status === 'late') {
                              status = 'Late';
                              statusColor = 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30';
                            } else {
                              status = 'Present'; // Default for other statuses
                              statusColor = 'bg-green-500/20 text-green-300 border-green-400/30';
                            }
                          } else {
                            // No database record - check if class time has passed
                            const now = new Date();
                            const currentMinutes = now.getHours() * 60 + now.getMinutes();
                            
                            // Parse schedule time from separate start_time and end_time fields
                            let endTimeMinutes = 0;
                            
                            if (schedule.end_time) {
                              // Parse time in HH:MM format from backend
                              const [endHour, endMin] = schedule.end_time.split(':').map(Number);
                              endTimeMinutes = endHour * 60 + endMin;
                            } else if (schedule.time_slot_display) {
                              // Fallback: Parse from display format "HH:MM - HH:MM"
                              const timeMatch = schedule.time_slot_display.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
                              if (timeMatch) {
                                const [, , , endHour, endMin] = timeMatch;
                                endTimeMinutes = parseInt(endHour) * 60 + parseInt(endMin);
                              }
                            }
                            
                            if (endTimeMinutes > 0) {
                              // Add 30-minute window after class end for attendance marking
                              const attendanceWindowEnd = endTimeMinutes + 30;
                              
                              if (currentMinutes > attendanceWindowEnd) {
                                // Class ended and attendance window passed - should be absent
                                status = 'Absent';
                                statusColor = 'bg-red-500/20 text-red-300 border-red-400/30';
                              } else {
                                // Still within attendance window or class hasn't started
                                status = 'Pending';
                                statusColor = 'bg-slate-600/20 text-slate-400 border-slate-500/30';
                              }
                            }
                          }
                          
                          return (
                            <div key={schedule.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className={`h-2 w-2 rounded-full ${
                                  status === 'Present' ? 'bg-green-400' : 
                                  status === 'Absent' ? 'bg-red-400' :
                                  status === 'Late' ? 'bg-yellow-400' :
                                  'bg-slate-500'
                                }`}></div>
                                <div>
                                  <p className="text-white text-sm font-medium">{schedule.subject_name}</p>
                                  <p className="text-slate-400 text-xs">{schedule.time_slot_display}</p>
                                  {schedule.classroom && (
                                    <p className="text-slate-500 text-xs">{schedule.classroom}</p>
                                  )}
                                </div>
                              </div>
                              <Badge 
                                variant={status === 'Present' || status === 'Late' ? "default" : "secondary"}
                                className={statusColor}
                              >
                                {status}
                              </Badge>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-slate-400 text-sm">
                            {isLoadingSchedules ? 'Loading today\'s schedule...' : 'No classes scheduled for today'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Face Registration Status */}
                  {!studentData?.face_encoding && (
                    <div className="bg-blue-500/20 border border-blue-400/30 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Camera className="h-5 w-5 text-blue-400" />
                        <span className="text-blue-300 font-medium">Face Registration Available</span>
                      </div>
                      <p className="text-blue-200/80 text-sm mb-3">
                        Register your face to enable quick attendance marking via face recognition.
                      </p>
                      <Button 
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => setShowFaceRegistration(true)}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Register Face
                      </Button>
                    </div>
                  )}

                  {/* Quick Action Guide */}
                  <div className="text-center">
                    <p className="text-slate-400 text-sm mb-4">
                      Mark attendance for specific classes using the schedule below
                    </p>
                  </div>
                </div>
                
                <div className="space-y-6">
                  {lastAttendance && (
                    <div className={`p-4 rounded-xl border ${
                      lastAttendance.recognized 
                        ? 'bg-green-500/20 border-green-400/30 text-green-300' 
                        : 'bg-red-500/20 border-red-400/30 text-red-300'
                    }`}>
                      <div className="flex items-center gap-3">
                        {lastAttendance.recognized ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <XCircle className="h-5 w-5" />
                        )}
                        <div>
                          <h4 className="font-medium">
                            {lastAttendance.recognized 
                              ? "Attendance Successfully Marked!" 
                              : "Face Recognition Failed"}
                          </h4>
                          <p className="text-sm opacity-80">
                            {lastAttendance.timestamp}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {!studentData?.face_encoding && (
                    <div className="text-center space-y-6">
                      <div className="bg-blue-500/20 border border-blue-400/30 rounded-xl p-6">
                        <div className="flex items-center justify-center gap-3 text-blue-300 mb-3">
                          <Camera className="h-6 w-6" />
                          <span className="font-semibold text-lg">Face Registration Available</span>
                        </div>
                        <p className="text-blue-200/80">
                          Set up face recognition to enable quick attendance marking with just a glance.
                        </p>
                      </div>
                      
                      <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
                        <Button 
                          className="relative bg-slate-900 hover:bg-slate-800 text-white px-12 py-8 text-lg shadow-xl rounded-2xl border border-slate-700 group-hover:border-slate-600 transition-all"
                          onClick={() => {
                            setShowFaceRegistration(true);
                            toast({
                              title: "Face Registration Started",
                              description: "Follow the instructions to register your face.",
                            });
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                              <User className="h-6 w-6 text-white" />
                            </div>
                            <div className="text-left">
                              <div className="font-semibold">Register Your Face</div>
                              <div className="text-sm text-slate-400">One-time setup process</div>
                            </div>
                          </div>
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                        <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                          <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <span className="text-blue-400 font-bold text-sm">1</span>
                          </div>
                          <span className="text-sm text-slate-300">Position face in frame</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                          <div className="h-8 w-8 rounded-full bg-teal-500/20 flex items-center justify-center">
                            <span className="text-teal-400 font-bold text-sm">2</span>
                          </div>
                          <span className="text-sm text-slate-300">Follow the prompts</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                          <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <span className="text-purple-400 font-bold text-sm">3</span>
                          </div>
                          <span className="text-sm text-slate-300">Start using face ID</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
            </CardContent>
          </Card>
        
        {/* Enhanced Student Portal Tabs */}
  <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden mt-8">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-teal-500"></div>
          <CardHeader className="px-4 md:px-6 pt-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl text-white">Academic Portal</CardTitle>
                <CardDescription className="text-blue-200/80">
                  Access your detailed academic information, reports, and profile settings
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="px-2 md:px-6">
                <TabsList className="grid w-full grid-cols-5 bg-slate-800/50 border border-slate-700/50">
                  <TabsTrigger 
                    value="attendance" 
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-teal-400 data-[state=active]:text-white data-[state=inactive]:text-slate-300"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Attendance
                  </TabsTrigger>
                  <TabsTrigger 
                    value="analytics" 
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=inactive]:text-slate-300"
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Analytics
                  </TabsTrigger>
                  <TabsTrigger 
                    value="notifications" 
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=inactive]:text-slate-300"
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    Notifications
                  </TabsTrigger>
                  <TabsTrigger 
                    value="marks" 
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=inactive]:text-slate-300"
                  >
                    <Trophy className="h-4 w-4 mr-2" />
                    Grades
                  </TabsTrigger>
                  <TabsTrigger 
                    value="profile" 
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=inactive]:text-slate-300"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Profile
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="attendance" className="mt-0 p-4 md:p-6 border-t border-slate-700/30">
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white">Attendance Overview</h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-slate-600 text-slate-300 hover:bg-slate-800"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Report
                    </Button>
                  </div>
                  <StudentAttendanceReport />
                </div>
              </TabsContent>

              <TabsContent value="analytics" className="mt-0 p-4 md:p-6 border-t border-slate-700/30">
                <StudentPersonalAnalytics />
              </TabsContent>

              <TabsContent value="notifications" className="mt-0 p-4 md:p-6 border-t border-slate-700/30">
                <EnhancedNotificationSystem />
              </TabsContent>
              
              <TabsContent value="marks" className="mt-0 p-4 md:p-6 border-t border-slate-700/30">
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white">Academic Performance</h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-slate-600 text-slate-300 hover:bg-slate-800"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Transcript
                    </Button>
                  </div>
                  <StudentMarksReport />
                </div>
              </TabsContent>
              
              <TabsContent value="profile" className="mt-0 p-4 md:p-6 border-t border-slate-700/30">
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white">Profile Management</h3>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="border-slate-600 text-slate-300 hover:bg-slate-800"
                      >
                        <Bell className="h-4 w-4 mr-2" />
                        Notifications
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="border-slate-600 text-slate-300 hover:bg-slate-800"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Privacy
                      </Button>
                    </div>
                  </div>
                  <StudentProfile />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Quick Actions Grid */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 hover:border-blue-500/30 transition-all group cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">Class Schedule</h3>
                  <p className="text-sm text-slate-400">View upcoming classes and timetables</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-white transition-colors" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 hover:border-green-500/30 transition-all group cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">Academic Goals</h3>
                  <p className="text-sm text-slate-400">Track progress towards your targets</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-white transition-colors" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 hover:border-purple-500/30 transition-all group cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Bell className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">Notifications</h3>
                  <p className="text-sm text-slate-400">Important updates and announcements</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-white transition-colors" />
              </div>
            </CardContent>
          </Card>

          <Link to="/face-registration">
            <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 hover:border-purple-500/30 transition-all group cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Camera className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white mb-1">Face Registration</h3>
                    <p className="text-sm text-slate-400">Set up face recognition for attendance</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-white transition-colors" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Face Registration Modal */}
        <FaceRegistration
          isOpen={showFaceRegistration}
          onSuccess={() => {
            setShowFaceRegistration(false);
            // Refetch student data to update the face_encoding status
            window.location.reload(); // Simple way to refresh data
          }}
          onCancel={() => setShowFaceRegistration(false)}
        />
      </div>
    </StudentSidebar>
  );
};

export default StudentDashboard;
