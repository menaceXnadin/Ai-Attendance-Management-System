import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  User, 
  Time,
  Book,
  CheckmarkFilled,
  CloseFilled,
  Camera,
  Security,
  Activity,
  ArrowRight,
  Renew
} from '@carbon/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/useAuth';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';
import { Attendance } from '@/integrations/api/types';
import FaceRegistration from '@/components/FaceRegistration';
import StudentSidebar from '@/components/StudentSidebar';
import TodayClassSchedule from '@/components/TodayClassSchedule';
import { getTodayLocalDate } from '@/utils/dateUtils';

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showFaceRegistration, setShowFaceRegistration] = useState(false);
  const [hasMarkedAttendanceToday, setHasMarkedAttendanceToday] = useState(false);

  // Fetch student data from backend
  const { data: studentData, isLoading: isLoadingStudent } = useQuery({
    queryKey: ['current-student', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      try {
        const students = await api.students.getAll();
        const found = students.find((s) => s.email === user.email);
        if (!found) {
          const foundInsensitive = students.find((s) => s.email?.toLowerCase() === user.email?.toLowerCase());
          return foundInsensitive || null;
        }
        return found;
      } catch (error) {
        console.error('Error fetching student data:', error);
        return null;
      }
    },
    enabled: !!user?.email,
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
    enabled: !!user?.id,
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
          date: today,
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
        return await api.schedules.getStudentToday();
      } catch (error) {
        console.error('Error fetching student today schedules:', error);
        return [];
      }
    },
    enabled: !!studentData?.semester && !!studentData?.faculty_id,
  });

  const todayAttendance = todayAttendanceData?.hasAttendance || false;
  const todayAttendanceRecords = todayAttendanceData?.records || [];
  
  const relevantAttendanceRecords = todayAttendanceRecords.filter((record) => {
    const extendedRecord = record as Attendance & { classId?: string };
    return todaySchedules.some((schedule) => 
      schedule.subject_id === parseInt(record.subjectId, 10) || 
      schedule.subject_id === parseInt(extendedRecord.classId || '0', 10)
    );
  });

  React.useEffect(() => {
    if (todayAttendance) {
      setHasMarkedAttendanceToday(true);
    }
  }, [todayAttendance]);

  if (isLoadingStudent || isLoadingAttendance) {
    return (
      <StudentSidebar>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Renew size={28} className="animate-spin text-action-primary mx-auto" />
            <p className="text-xs text-text-muted">Loading student portal...</p>
          </div>
        </div>
      </StudentSidebar>
    );
  }

  return (
    <StudentSidebar>
      <div className="space-y-6 max-w-7xl mx-auto py-2">
        {/* Header Section */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border-subtle">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Welcome, {studentData?.name?.split(' ')[0] || user?.name?.split(' ')[0] || 'Student'}
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs py-1 px-2.5 gap-1.5 border-status-success/30 bg-status-success/10 text-status-success">
              <span className="h-1.5 w-1.5 rounded-full bg-status-success inline-block" />
              <span>Enrollment Active</span>
            </Badge>
          </div>
        </header>

        {/* Quick Stats Grid */}
        <section aria-label="Student Metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Semester Attendance */}
          <Card className="border border-border-default bg-surface-default shadow-none">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Attendance Rate</p>
                <div className="h-8 w-8 rounded-md bg-surface-subtle flex items-center justify-center text-action-primary">
                  <Calendar size={16} />
                </div>
              </div>
              <div>
                <p className={`text-2xl font-bold tabular-nums ${
                  (attendanceSummary?.percentage_present || 0) >= 75 ? 'text-status-success' : 'text-status-warning'
                }`}>
                  {attendanceSummary?.percentage_present || 0}%
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {attendanceSummary?.present || 0} of {attendanceSummary?.total_academic_days || academicMetrics?.total_academic_days || 0} days recorded
                </p>
              </div>
              <div className="h-1.5 w-full bg-surface-subtle rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    (attendanceSummary?.percentage_present || 0) >= 75 ? 'bg-status-success' : 'bg-status-warning'
                  }`}
                  style={{ width: `${Math.min(100, attendanceSummary?.percentage_present || 0)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Semester Timeline Progress */}
          <Card className="border border-border-default bg-surface-default shadow-none">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Term Progress</p>
                <div className="h-8 w-8 rounded-md bg-surface-subtle flex items-center justify-center text-action-primary">
                  <Activity size={16} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary tabular-nums">
                  {attendanceSummary?.semester_start_date && attendanceSummary?.semester_end_date ? (
                    (() => {
                      const now = new Date();
                      const start = new Date(attendanceSummary.semester_start_date);
                      const end = new Date(attendanceSummary.semester_end_date);
                      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                      const elapsedDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                      return `${Math.min(100, Math.round((elapsedDays / totalDays) * 100))}%`;
                    })()
                  ) : 'Term Active'}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
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
              </div>
              <div className="h-1.5 w-full bg-surface-subtle rounded-full overflow-hidden">
                <div 
                  className="h-full bg-action-primary rounded-full transition-all"
                  style={{ width: `${attendanceSummary?.semester_start_date && attendanceSummary?.semester_end_date ? ((() => {
                    const now = new Date();
                    const start = new Date(attendanceSummary.semester_start_date);
                    const end = new Date(attendanceSummary.semester_end_date);
                    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                    const elapsedDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                    return Math.min(100, Math.round((elapsedDays / totalDays) * 100));
                  })()) : 50}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Student ID */}
          <Card className="border border-border-default bg-surface-default shadow-none">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Student ID</p>
                <div className="h-8 w-8 rounded-md bg-surface-subtle flex items-center justify-center text-action-primary">
                  <User size={16} />
                </div>
              </div>
              <div>
                <p className="text-xl font-bold font-mono text-text-primary tabular-nums">
                  {studentData?.studentId || studentData?.student_id || 'N/A'}
                </p>
                <p className="text-xs text-text-muted mt-0.5 truncate">
                  {studentData?.faculty || 'Enrolled Division'} • Sem {studentData?.semester || 1}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Biometric Status */}
          <Card className="border border-border-default bg-surface-default shadow-none">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Biometrics</p>
                <div className="h-8 w-8 rounded-md bg-surface-subtle flex items-center justify-center text-action-primary">
                  <Security size={16} />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  {studentData?.face_encoding ? (
                    <>
                      <CheckmarkFilled size={16} className="text-status-success" />
                      <span className="text-lg font-bold text-status-success">Registered</span>
                    </>
                  ) : (
                    <>
                      <Time size={16} className="text-status-warning" />
                      <span className="text-lg font-bold text-status-warning">Action Needed</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  {studentData?.face_encoding ? 'Face recognition enabled' : 'Biometric capture required'}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
          
        {/* Today's Class Schedule with Check-in Component */}
        <TodayClassSchedule 
          studentData={studentData}
          todayAttendance={todayAttendanceRecords}
          onAttendanceMarked={() => {
            setHasMarkedAttendanceToday(true);
            refetchTodayAttendance?.();
            toast({
              title: "Attendance Recorded",
              description: "Your attendance was verified and recorded.",
            });
          }}
        />

        {/* Today's Timetable Status Overview */}
        <section aria-label="Today's Timetable Status">
          <Card className="border border-border-default bg-surface-default shadow-none">
            <CardHeader className="py-4 border-b border-border-subtle">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold text-text-primary flex items-center gap-2">
                    <Book size={18} className="text-action-primary" />
                    Today's Attendance Status
                  </CardTitle>
                  <CardDescription className="text-xs text-text-muted mt-0.5">
                    {todaySchedules.length} course session{todaySchedules.length === 1 ? '' : 's'} scheduled for today
                  </CardDescription>
                </div>
                {hasMarkedAttendanceToday && (
                  <Badge variant="outline" className="text-xs text-status-success border-status-success/30 bg-status-success/10 py-1 px-2.5">
                    <CheckmarkFilled size={12} className="mr-1 inline" />
                    {relevantAttendanceRecords.filter((r) => r.status === 'present').length} Verified
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                {isLoadingSchedules ? (
                  <div className="py-8 text-center text-xs text-text-muted">
                    Loading timetable...
                  </div>
                ) : todaySchedules.length > 0 ? (
                  todaySchedules.map((schedule) => {
                    const attendanceRecord = todayAttendanceRecords.find((record) => {
                      const recordSubjectIdInt = parseInt(record.subjectId, 10);
                      const scheduleSubjectIdInt = parseInt(schedule.subject_id.toString(), 10);
                      return !isNaN(recordSubjectIdInt) && !isNaN(scheduleSubjectIdInt) && recordSubjectIdInt === scheduleSubjectIdInt;
                    });
                    
                    let statusText = 'Pending';
                    let statusBadgeClass = 'bg-surface-subtle text-text-muted border-border-default';

                    if (schedule.is_cancelled) {
                      statusText = 'Cancelled';
                      statusBadgeClass = 'bg-surface-subtle text-text-muted border-border-default';
                    } else if (attendanceRecord) {
                      const recordStatus = attendanceRecord.status?.toLowerCase() || '';
                      if (recordStatus === 'present') {
                        statusText = 'Present';
                        statusBadgeClass = 'bg-status-success/10 text-status-success border-status-success/30';
                      } else if (recordStatus === 'absent') {
                        statusText = 'Absent';
                        statusBadgeClass = 'bg-status-danger/10 text-status-danger border-status-danger/30';
                      } else if (recordStatus === 'late') {
                        statusText = 'Late';
                        statusBadgeClass = 'bg-status-warning/10 text-status-warning border-status-warning/30';
                      }
                    }

                    return (
                      <div 
                        key={schedule.id} 
                        className="p-3 rounded-md border border-border-default bg-surface-default hover:bg-surface-subtle transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${schedule.is_cancelled ? 'line-through text-text-muted' : 'text-text-primary'} truncate`}>
                            {schedule.subject_name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                            <span className="font-mono">{schedule.time_slot_display}</span>
                            <span>•</span>
                            <span>{schedule.classroom || 'Room N/A'}</span>
                            {schedule.is_cancelled && schedule.cancellation_reason && (
                              <span className="text-status-warning">({schedule.cancellation_reason})</span>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-xs py-0.5 px-2 font-medium ${statusBadgeClass}`}>
                          {statusText}
                        </Badge>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-text-muted">
                    <Calendar size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium text-text-primary">No classes scheduled today</p>
                    <p className="text-xs text-text-muted mt-0.5">Enjoy your free study hours</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Quick Actions Grid */}
        <section aria-label="Student Services" className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Student Services & Portals
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link to="/student/calendar" className="block group">
              <Card className="border border-border-default bg-surface-default hover:border-action-primary transition-colors shadow-none p-4 h-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-surface-subtle flex items-center justify-center text-action-primary shrink-0">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary group-hover:text-action-primary transition-colors">
                        Academic Calendar
                      </h3>
                      <p className="text-xs text-text-muted mt-0.5">
                        Inspect term dates, institutional breaks, and class timetables
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-text-muted group-hover:text-action-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                </div>
              </Card>
            </Link>

            <Link to="/face-registration" className="block group">
              <Card className="border border-border-default bg-surface-default hover:border-action-primary transition-colors shadow-none p-4 h-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-surface-subtle flex items-center justify-center text-action-primary shrink-0">
                      <Camera size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary group-hover:text-action-primary transition-colors">
                        Face Biometrics Setup
                      </h3>
                      <p className="text-xs text-text-muted mt-0.5">
                        {studentData?.face_encoding ? 'Manage or update your facial recognition profile' : 'Complete initial facial registration for automated check-ins'}
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-text-muted group-hover:text-action-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                </div>
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
    </StudentSidebar>
  );
};

export default StudentDashboard;
