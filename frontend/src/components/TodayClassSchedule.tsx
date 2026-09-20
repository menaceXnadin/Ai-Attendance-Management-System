import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Time as Clock, 
  Book as BookOpen, 
  CheckmarkFilled as CheckCircle, 
  ScanAlt as Scan,
  WarningAlt as AlertTriangle,
  Calendar,
  Timer,
  PlayFilled as PlayCircle,
  PauseFilled as Pause,
  CheckboxChecked as CheckSquare,
  Locked as Lock,
  Security as Shield,
  CloseFilled as XCircle
} from '@carbon/icons-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';
import { Attendance, Student } from '@/integrations/api/types';
import { useAuth } from '@/contexts/useAuth';
import FaceRecognition from '@/components/FaceRecognition';
import { useTimeRestrictions } from '@/hooks/useTimeRestrictions';
import { 
  formatTimeForDisplay, 
  getTimeRemainingInPeriod,
  type ClassPeriod 
} from '@/utils/timeRestrictions';
import { getTodayLocalDate } from '@/utils/dateUtils';

interface SubjectSchedule {
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  startTime: string;
  endTime: string;
  status: 'Starts Soon' | 'Pending' | 'Present' | 'Absent' | 'Cancelled';
  attendanceMarked: boolean;
  isCurrentPeriod: boolean;
  isBeforeStart: boolean;
  isAfterEnd: boolean;
  is_cancelled?: boolean;
  cancellation_reason?: string;
}

interface StudentData {
  id?: string;
  name?: string;
  email?: string;
  studentId?: string;
  faculty?: string;
  faculty_id?: number;
  semester?: number;
  year?: number;
  batch?: number;
  face_encoding?: number[] | null;
}

interface TodayClassScheduleProps {
  studentData: StudentData | null;
  todayAttendance?: Attendance[];
  onAttendanceMarked?: () => void;
}

type AttendanceWithMeta = Attendance & {
  method?: string;
  marked_by?: string;
};

const TodayClassSchedule: React.FC<TodayClassScheduleProps> = ({ 
  studentData, 
  todayAttendance: todayAttendanceProp,
  onAttendanceMarked 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeSubjectId, setActiveSubjectId] = useState<number | null>(null);
  const [showFaceRecognition, setShowFaceRecognition] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Time restriction management
  const {
    isAllowed: isFaceVerificationAllowed,
    reason: restrictionReason,
    currentPeriod,
    nextPeriod,
    timeUntilNext,
    markVerificationComplete,
    clearTodayHistory,
    verificationHistory
  } = useTimeRestrictions();

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // NEW: Fetch real schedules from database - using student-specific endpoint
  const { data: realSchedules, isLoading: isLoadingSchedules } = useQuery({
    queryKey: ['student-today-schedule', studentData?.faculty_id, studentData?.semester],
    queryFn: async () => {
      if (!studentData?.semester) return [];
      try {
        // Use the proper student-specific endpoint that handles faculty and semester filtering
        const schedules = await api.schedules.getStudentToday();
        return schedules;
      } catch (error) {
        console.error('Error fetching student schedules:', error);
        return [];
      }
    },
    enabled: !!studentData?.semester && !!studentData?.faculty_id,
  });

  // Generate today's schedule from real database schedules
  const generateTodayScheduleFromDB = React.useCallback((): SubjectSchedule[] => {
    // Check if we have real schedule data from the database
    if (realSchedules && realSchedules.length > 0) {
      
      // Convert real schedules to frontend format
      const schedule: SubjectSchedule[] = realSchedules.map((dbSchedule) => ({
        subjectId: dbSchedule.subject_id,
        subjectName: dbSchedule.subject_name,
        subjectCode: dbSchedule.subject_code,
        startTime: dbSchedule.start_time,
        endTime: dbSchedule.end_time,
        status: dbSchedule.is_cancelled ? 'Cancelled' as const : 'Starts Soon' as const,
        attendanceMarked: false,
        isCurrentPeriod: false,
        isBeforeStart: true,
        isAfterEnd: false,
        is_cancelled: dbSchedule.is_cancelled,
        cancellation_reason: dbSchedule.cancellation_reason
      }));

      return schedule;
    }
    // Return empty schedule if no real schedules are available
    return [];
  }, [realSchedules]);

  // Calculate status based on current time and attendance rules
  const calculateSubjectStatus = React.useCallback((schedule: SubjectSchedule[]): SubjectSchedule[] => {
    const now = currentTime;
    const currentHour = now.getHours();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    return schedule.map(subject => {
      // If class is cancelled, always show Cancelled status
      if (subject.is_cancelled) {
        return {
          ...subject,
          status: 'Cancelled' as const,
          attendanceMarked: true, // Prevent marking attendance
          isCurrentPeriod: false,
          isBeforeStart: false,
          isAfterEnd: true
        };
      }
      
      const [startHour, startMin] = subject.startTime.split(':').map(Number);
      const [endHour, endMin] = subject.endTime.split(':').map(Number);
      const startTimeMinutes = startHour * 60 + startMin;
      const endTimeMinutes = endHour * 60 + endMin;

      const isBeforeStart = currentMinutes < startTimeMinutes;
      const isCurrentPeriod = currentMinutes >= startTimeMinutes && currentMinutes <= endTimeMinutes;
      const isAfterEnd = currentMinutes > endTimeMinutes;

      // Determine status based on attendance and time
      let status: 'Starts Soon' | 'Pending' | 'Present' | 'Absent' = 'Starts Soon';
      
      if (subject.attendanceMarked) {
        status = 'Present';
      } else if (isAfterEnd) {
        status = 'Absent';
      } else if (isCurrentPeriod) {
        status = 'Pending';
      } else {
        status = 'Starts Soon';
      }

      return {
        ...subject,
        status,
        isCurrentPeriod,
        isBeforeStart,
        isAfterEnd
      };
    });
  }, [currentTime]);

  // Use attendance data from props or fetch if not provided
  // FIXED: Reduced staleTime to 5 seconds and added polling to detect external changes
  const { data: fetchedAttendance, refetch: refetchAttendance } = useQuery({
    queryKey: ['today-attendance-by-subject', user?.id, studentData?.id],
    queryFn: async () => {
      if (!user?.id || !studentData?.id) {
        return [];
      }
      try {
        // FIXED: Use local date instead of UTC to avoid timezone issues
        const today = getTodayLocalDate();
        const response = await api.attendance.getAll({
          studentId: studentData.id, // Use student record ID, not user ID
          date: today
        });
        const records = response.records || [];
        return records;
      } catch (error) {
        console.error('Error fetching today attendance:', error);
        return [];
      }
    },
    enabled: !!user?.id && !!studentData?.id && !todayAttendanceProp, // Only fetch if not provided via prop
    staleTime: 5 * 1000, // FIXED: Reduced from 30s to 5s for faster updates
    refetchInterval: 10 * 1000, // FIXED: Auto-refetch every 10 seconds to detect external changes
    refetchOnWindowFocus: true, // FIXED: Refetch when user switches back to tab
  });

  // Use prop data if available, otherwise use fetched data
  const todayAttendance = React.useMemo<AttendanceWithMeta[]>(() => {
    const base = todayAttendanceProp ?? fetchedAttendance ?? [];
    return base.map((record) => {
      const recordData = record as Record<string, unknown>;
      const methodValue = typeof recordData.method === 'string' ? recordData.method : undefined;
      const markedByValue = typeof recordData.marked_by === 'string' ? recordData.marked_by : undefined;

      return {
        ...record,
        method: methodValue,
        marked_by: markedByValue,
      };
    });
  }, [todayAttendanceProp, fetchedAttendance]);

  // Enhanced status calculation that uses database records as authoritative source
  const calculateSubjectStatusWithDB = React.useCallback((schedule: SubjectSchedule[]): SubjectSchedule[] => {
    const now = currentTime;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return schedule.map((subject) => {
      // If class is cancelled, always show Cancelled status and disable actions
      if (subject.is_cancelled) {
        return {
          ...subject,
          status: 'Cancelled' as const,
          attendanceMarked: true,
          isCurrentPeriod: false,
          isBeforeStart: false,
          isAfterEnd: true,
        };
      }

      const [startHour, startMin] = subject.startTime.split(':').map(Number);
      const [endHour, endMin] = subject.endTime.split(':').map(Number);
      const startTimeMinutes = startHour * 60 + startMin;
      const endTimeMinutes = endHour * 60 + endMin;

      const isBeforeStart = currentMinutes < startTimeMinutes;
      const isCurrentPeriod = currentMinutes >= startTimeMinutes && currentMinutes <= endTimeMinutes;
      const isAfterEnd = currentMinutes > endTimeMinutes;

      // Find matching attendance record in database - FIXED: More precise matching
      const attendanceRecord = todayAttendance.find((record) => {
        const recordSubjectId = record.subjectId || '';
        const scheduleSubjectId = subject.subjectId;
        const recordSubjectIdInt = recordSubjectId ? parseInt(recordSubjectId.toString()) : null;
        const scheduleSubjectIdInt = scheduleSubjectId ? parseInt(scheduleSubjectId.toString()) : null;
        return Boolean(
          recordSubjectIdInt &&
          scheduleSubjectIdInt &&
          recordSubjectIdInt === scheduleSubjectIdInt
        );
      });

      // Always prioritize database record if it exists
      let status: 'Starts Soon' | 'Pending' | 'Present' | 'Absent' | 'Cancelled' = 'Starts Soon';
      let attendanceMarked = false;

      if (attendanceRecord) {
        const dbStatus = String(attendanceRecord.status).toLowerCase();
        console.log(`[DEBUG] ${subject.subjectName} has DB record with status: ${dbStatus}`);

        if (dbStatus === 'present' || dbStatus === 'late') {
          status = 'Present';
          attendanceMarked = true; // present/late
        } else if (dbStatus === 'absent') {
          status = 'Absent';
          const isManuallyMarked = attendanceRecord.method === 'manual' ||
            (attendanceRecord.marked_by && attendanceRecord.marked_by !== 'system');
          attendanceMarked = Boolean(isManuallyMarked);
          console.log(`[DEBUG] ${subject.subjectName} absent - manually marked: ${attendanceMarked}`);
        } else if (dbStatus === 'cancelled' || dbStatus === 'canceled') {
          status = 'Cancelled';
          attendanceMarked = true; // disable actions for cancelled
        } else {
          // Unknown status - log warning and use time-based logic
          console.warn('[WARN] Unknown attendance status:', attendanceRecord.status, 'for subject:', subject.subjectName);
          if (isAfterEnd) {
            status = 'Absent';
          } else if (isCurrentPeriod) {
            status = 'Pending';
          } else {
            status = 'Starts Soon';
          }
        }
      } else {
        // No database record - calculate based on time
        console.log(
          `[DEBUG] ${subject.subjectName} has NO DB record. Time-based: isAfterEnd=${isAfterEnd}, isCurrentPeriod=${isCurrentPeriod}, isBeforeStart=${isBeforeStart}`
        );

        if (isAfterEnd) {
          status = 'Absent';
        } else if (isCurrentPeriod) {
          status = 'Pending';
          console.log(`[DEBUG] ${subject.subjectName} marked Pending (class ongoing)`);
        } else {
          status = 'Starts Soon';
          console.log(`[DEBUG] ${subject.subjectName} marked Starts Soon (not started yet)`);
        }
      }

      return {
        ...subject,
        status,
        attendanceMarked,
        isCurrentPeriod,
        isBeforeStart,
        isAfterEnd,
      };
    });
  }, [currentTime, todayAttendance]);

  const todaySchedule = React.useMemo(() => {
    const baseSchedule = generateTodayScheduleFromDB();
    // Use enhanced calculation that prioritizes database records
    const scheduleWithStatus = calculateSubjectStatusWithDB(baseSchedule);
    return scheduleWithStatus;
  }, [generateTodayScheduleFromDB, calculateSubjectStatusWithDB]);

  const handleMarkAttendance = (subjectId: number) => {
    // Time restrictions enabled - subject to school hours and class periods
    setActiveSubjectId(subjectId);
    setShowFaceRecognition(true);
    toast({
      title: "Face Recognition Started",
      description: "Please position your face within the camera frame",
    });
  };

  const handleFaceCapture = async (_dataUrl: string, recognized: boolean) => {
    if (!activeSubjectId) return;

    console.log('[DEBUG] Face capture result - recognized:', recognized, 'subjectId:', activeSubjectId);

    // FaceRecognition component already attempted attendance when subjectId is provided
    if (recognized) {
      // Mark verification as complete for this period
      markVerificationComplete();
      
      toast({
        title: "Attendance Marked Successfully",
        description: `Face verified and attendance recorded for ${currentPeriod?.name || 'current period'}`,
      });
      
      console.log('[DEBUG] Calling refetchAttendance and onAttendanceMarked...');
      // FIXED: Comprehensive invalidation of all attendance-related queries
      await Promise.all([
        refetchAttendance(),
        // Invalidate all possible attendance query keys
        queryClient.invalidateQueries({ queryKey: ['today-attendance-by-subject'] }),
        queryClient.invalidateQueries({ queryKey: ['attendance-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['student-attendance-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['today-attendance-data'] }),
        queryClient.invalidateQueries({ queryKey: ['attendance'] }),
        queryClient.invalidateQueries({ queryKey: ['student-today-schedule'] }),
      ]);
      
      // FIXED: Immediately refetch with exact query keys
      await queryClient.refetchQueries({ 
        queryKey: ['today-attendance-by-subject', user?.id, studentData?.id],
        exact: true 
      });
      
      onAttendanceMarked?.();
      
      // FIXED: Extended delay to ensure backend commit + second invalidation wave
      setTimeout(async () => {
        console.log('[DEBUG] Second wave refresh after backend processing');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['today-attendance-by-subject'] }),
          queryClient.invalidateQueries({ queryKey: ['attendance-summary'] }),
          queryClient.invalidateQueries({ queryKey: ['student-attendance-summary'] }),
          queryClient.refetchQueries({ 
            queryKey: ['today-attendance-by-subject', user?.id, studentData?.id],
            exact: true 
          }),
        ]);
      }, 1500);
    } else {
      toast({
        title: "Face Verification Failed",
        description: "Face did not match the current user.",
        variant: "destructive",
      });
    }

    setShowFaceRecognition(false);
    setActiveSubjectId(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pending':
        return <PlayCircle className="h-4 w-4" />;
      case 'Starts Soon':
        return <Timer className="h-4 w-4" />;
      case 'Present':
        return <CheckSquare className="h-4 w-4" />;
      case 'Absent':
        return <AlertTriangle className="h-4 w-4" />;
      case 'Cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30';
      case 'Starts Soon':
        return 'bg-blue-500/20 text-blue-300 border-blue-400/30';
      case 'Present':
        return 'bg-green-500/20 text-green-300 border-green-400/30';
      case 'Absent':
        return 'bg-red-500/20 text-red-300 border-red-400/30';
      case 'Cancelled':
        return 'bg-gray-600/30 text-gray-400 border-gray-500/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-400/30';
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  if (todaySchedule.length === 0) {
    return (
      <Card className="border border-border-subtle bg-surface-default shadow-card">
        <CardHeader className="border-b border-border-subtle pb-4">
          <CardTitle className="text-base font-semibold text-text-primary flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-action-primary" />
            Today's Class Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="h-12 w-12 rounded-full bg-surface-canvas border border-border-subtle flex items-center justify-center mx-auto mb-3 text-text-muted">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary mb-1">No Classes Scheduled</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              {new Date().getDay() === 5 || new Date().getDay() === 6 
                ? "It's weekend – no instructional periods scheduled for today." 
                : "No class schedules assigned for today. Contact your course administrator if this is unexpected."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (showFaceRecognition && activeSubjectId) {
    const activeSubject = todaySchedule.find(s => s.subjectId === activeSubjectId);
    return (
      <Card className="border border-border-subtle bg-surface-default shadow-card">
        <CardHeader className="border-b border-border-subtle pb-4">
          <CardTitle className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Scan className="w-5 h-5 text-action-primary" />
            Marking Attendance – {activeSubject?.subjectName}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="bg-surface-canvas rounded-lg p-4 border border-border-subtle">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2.5 h-2.5 bg-status-error rounded-full animate-pulse"></div>
              <span className="text-xs font-semibold text-text-primary">Biometric Face Verification Active</span>
            </div>
            <FaceRecognition 
              onCapture={handleFaceCapture} 
              onCancel={() => {
                setShowFaceRecognition(false);
                setActiveSubjectId(null);
              }}
              subjectId={activeSubjectId.toString()}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border-subtle bg-surface-default shadow-card">
      <CardHeader className="border-b border-border-subtle pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base font-semibold text-text-primary flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-action-primary" />
            <span>Today's Class Schedule</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs px-2.5 py-0.5">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {/* Time Restriction Status */}
        <div className={`border rounded-lg p-4 ${
          isFaceVerificationAllowed 
            ? 'bg-status-success/5 border-status-success/30' 
            : 'bg-status-error/5 border-status-error/30'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              isFaceVerificationAllowed 
                ? 'bg-status-success/15 text-status-success' 
                : 'bg-status-error/15 text-status-error'
            }`}>
              {isFaceVerificationAllowed ? (
                <Shield className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-xs font-semibold ${
                  isFaceVerificationAllowed ? 'text-status-success' : 'text-status-error'
                }`}>
                  {isFaceVerificationAllowed ? 'Face Verification Available' : 'Face Verification Restricted'}
                </p>
                {currentPeriod && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {currentPeriod.name}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-text-secondary">
                {restrictionReason}
              </p>
              {currentPeriod && isFaceVerificationAllowed && (
                <p className="text-[11px] text-text-muted mt-1">
                  {getTimeRemainingInPeriod(currentPeriod)}
                </p>
              )}
              {timeUntilNext && !isFaceVerificationAllowed && (
                <p className="text-[11px] text-text-muted mt-1">
                  Next opportunity in {timeUntilNext}
                </p>
              )}
            </div>
          </div>
        </div>
        {todaySchedule.map((subject, index) => (
          <div
            key={`${subject.subjectId}-${subject.startTime}-${index}`}
            className="p-4 rounded-lg bg-surface-canvas border border-border-subtle hover:border-border-strong transition-colors"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-surface-default border border-border-subtle flex items-center justify-center flex-shrink-0 text-action-primary">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-text-primary text-sm truncate">
                      {subject.subjectName}
                    </h3>
                    <Badge 
                      className={`${getStatusColor(subject.status)} flex items-center gap-1 text-[10px] px-2 py-0.5`}
                    >
                      {getStatusIcon(subject.status)}
                      <span className="truncate">{subject.status}</span>
                    </Badge>
                  </div>
                  <p className="text-xs text-text-muted mb-1 truncate">{subject.subjectCode}</p>
                  <div className="flex items-center gap-1 text-xs text-text-secondary">
                    <Clock className="w-3.5 h-3.5 text-text-muted" />
                    <span>{formatTime(subject.startTime)} – {formatTime(subject.endTime)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-start md:items-end md:flex-col gap-2 md:gap-2 w-full md:w-auto">
                {subject.status === 'Cancelled' ? (
                  <div className="flex flex-col items-start md:items-end gap-1">
                    <Badge className="bg-gray-600/30 text-gray-400 border-gray-500/30 text-[10px] sm:text-xs px-2 py-0.5">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Cancelled
                    </Badge>
                    {subject.cancellation_reason && (
                      <p className="text-[10px] sm:text-xs text-gray-400 text-left md:text-right max-w-[160px]">
                        {subject.cancellation_reason}
                      </p>
                    )}
                  </div>
                ) : subject.status === 'Present' ? (
                  <Badge className="bg-green-500/20 text-green-300 border-green-400/30 text-[10px] sm:text-xs px-2 py-0.5">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Present
                  </Badge>
                ) : subject.status === 'Pending' ? (
                  <>
                    {!isFaceVerificationAllowed ? (
                      <div className="flex flex-col items-start md:items-end gap-1">
                        <Badge className="bg-red-500/20 text-red-300 border-red-400/30 text-[10px] sm:text-xs px-2 py-0.5">
                          <Lock className="h-3 w-3 mr-1" />
                          Restricted
                        </Badge>
                        <p className="text-[10px] sm:text-xs text-red-400 text-left md:text-right max-w-[140px]">
                          {restrictionReason}
                        </p>
                        {timeUntilNext && (
                          <p className="text-[10px] sm:text-xs text-slate-400 text-left md:text-right">
                            Next: {timeUntilNext}
                          </p>
                        )}
                      </div>
                    ) : !studentData?.face_encoding ? (
                      <div className="flex flex-col items-start md:items-end gap-1">
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30 text-[10px] sm:text-xs px-2 py-0.5">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Setup Required
                        </Badge>
                        <p className="text-[10px] sm:text-xs text-amber-400 text-left md:text-right">
                          Face registration required
                        </p>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleMarkAttendance(subject.subjectId)}
                        className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg h-8 text-[11px] sm:text-sm px-3 sm:px-4"
                      >
                        <Scan className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Mark
                      </Button>
                    )}
                  </>
                ) : subject.status === 'Absent' ? (
                  <div className="flex flex-col items-start md:items-end gap-1">
                    <Badge className="bg-red-500/20 text-red-300 border-red-400/30 text-[10px] sm:text-xs px-2 py-0.5">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Absent
                    </Badge>
                    <p className="text-[10px] sm:text-xs text-slate-400">
                      {subject.attendanceMarked ? 'Marked by admin' : 'Auto-marked absent'}
                    </p>
                  </div>
                ) : subject.status === 'Starts Soon' ? (
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30 text-[10px] sm:text-xs px-2 py-0.5">
                    <Timer className="h-3 w-3 mr-1" />
                    Starts Soon
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        ))}

        {/* Next class info */}
        {(() => {
          const nextClass = todaySchedule.find(s => s.status === 'Starts Soon');
          if (nextClass) {
            const timeUntilNext = () => {
              const now = new Date();
              const [hours, minutes] = nextClass.startTime.split(':');
              const classTime = new Date();
              classTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
              
              const diff = classTime.getTime() - now.getTime();
              if (diff > 0) {
                const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
                const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                return `${hoursLeft}h ${minutesLeft}m`;
              }
              return 'Starting soon';
            };

            return (
              <div className="bg-blue-500/10 border border-blue-400/30 rounded-xl p-4 mt-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Timer className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-blue-300 font-medium">Next Class</p>
                    <p className="text-blue-200/80 text-sm">
                      {nextClass.subjectName} starts in {timeUntilNext()}
                    </p>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}
      </CardContent>
    </Card>
  );
};

export default TodayClassSchedule;
