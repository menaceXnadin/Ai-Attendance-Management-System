import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  BookOpen, 
  CheckCircle, 
  Scan,
  AlertTriangle,
  Calendar,
  Timer,
  PlayCircle,
  Pause,
  CheckSquare,
  Lock,
  Shield
} from 'lucide-react';
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

interface SubjectSchedule {
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  startTime: string;
  endTime: string;
  status: 'Starts Soon' | 'Pending' | 'Present' | 'Absent';
  attendanceMarked: boolean;
  isCurrentPeriod: boolean;
  isBeforeStart: boolean;
  isAfterEnd: boolean;
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
        console.log('[DEBUG] Fetching student-specific today schedules for faculty_id:', studentData.faculty_id, 'semester:', studentData.semester);
        
        // Use the proper student-specific endpoint that handles faculty and semester filtering
        const schedules = await api.schedules.getStudentToday();
          
        console.log('[DEBUG] Student-specific schedules fetched:', schedules);
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
    // Debug log student data
    console.log('[DEBUG] TodayClassSchedule studentData:', {
      faculty_id: studentData?.faculty_id,
      faculty: studentData?.faculty,
      semester: studentData?.semester,
      fullData: studentData
    });

    // Check if we have real schedule data from the database
    if (realSchedules && realSchedules.length > 0) {
      console.log('[DEBUG] Using real schedules from database:', realSchedules.length, 'schedules found');
      
      // Convert real schedules to frontend format
      const schedule: SubjectSchedule[] = realSchedules.map((dbSchedule) => ({
        subjectId: dbSchedule.subject_id,
        subjectName: dbSchedule.subject_name,
        subjectCode: dbSchedule.subject_code,
        startTime: dbSchedule.start_time,
        endTime: dbSchedule.end_time,
        status: 'Starts Soon' as const,
        attendanceMarked: false,
        isCurrentPeriod: false,
        isBeforeStart: true,
        isAfterEnd: false
      }));

      console.log('[DEBUG] Generated schedule from real database schedules:', schedule);
      return schedule;
    }

    console.log('[DEBUG] No real schedules found - realSchedules:', realSchedules);
    // Return empty schedule if no real schedules are available
    return [];
  }, [realSchedules, studentData]);

  // Calculate status based on current time and attendance rules
  const calculateSubjectStatus = React.useCallback((schedule: SubjectSchedule[]): SubjectSchedule[] => {
    const now = currentTime;
    const currentHour = now.getHours();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    return schedule.map(subject => {
      const [startHour, startMin] = subject.startTime.split(':').map(Number);
      const [endHour, endMin] = subject.endTime.split(':').map(Number);
      const startTimeMinutes = startHour * 60 + startMin;
      const endTimeMinutes = endHour * 60 + endMin;

      const isBeforeStart = currentMinutes < startTimeMinutes;
      const isCurrentPeriod = currentMinutes >= startTimeMinutes && currentMinutes <= endTimeMinutes;
      const isAfterEnd = currentMinutes > endTimeMinutes;

      // Determine status based on attendance and time
      let status: 'Starts Soon' | 'Pending' | 'Present' | 'Absent' = 'Starts Soon';
      
      console.log(`[DEBUG] Status calculation for ${subject.subjectName}:`, {
        attendanceMarked: subject.attendanceMarked,
        isAfterEnd,
        isCurrentPeriod,
        isBeforeStart,
        currentMinutes,
        startTimeMinutes,
        endTimeMinutes
      });
      
      if (subject.attendanceMarked) {
        status = 'Present';
        console.log(`[DEBUG] ${subject.subjectName} set to Present due to attendanceMarked: true`);
      } else if (isAfterEnd) {
        status = 'Absent';
        console.log(`[DEBUG] ${subject.subjectName} set to Absent due to isAfterEnd: true`);
      } else if (isCurrentPeriod) {
        status = 'Pending';
        console.log(`[DEBUG] ${subject.subjectName} set to Pending due to isCurrentPeriod: true`);
      } else {
        status = 'Starts Soon';
        console.log(`[DEBUG] ${subject.subjectName} set to Starts Soon (default)`);
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
  const { data: fetchedAttendance, refetch: refetchAttendance } = useQuery({
    queryKey: ['today-attendance-by-subject', user?.id, studentData?.id],
    queryFn: async () => {
      if (!user?.id || !studentData?.id) {
        console.log('[DEBUG] Missing IDs - user?.id:', user?.id, 'studentData?.id:', studentData?.id);
        console.log('[DEBUG] Full studentData:', JSON.stringify(studentData, null, 2));
        return [];
      }
      try {
        const today = new Date().toISOString().split('T')[0];
        console.log('[DEBUG] Fetching attendance for student ID:', studentData.id, 'user ID:', user.id, 'date:', today);
        console.log('[DEBUG] StudentData fields:', {
          id: studentData.id,
          student_id: (studentData as Student & { student_id?: string }).student_id,
          name: studentData.name,
          email: studentData.email
        });
        const records = await api.attendance.getAll({
          studentId: studentData.id, // Use student record ID, not user ID
          date: today
        });
        return records;
      } catch (error) {
        console.error('Error fetching today attendance:', error);
        return [];
      }
    },
    enabled: !!user?.id && !!studentData?.id && !todayAttendanceProp, // Only fetch if not provided via prop
    staleTime: 30 * 1000,
  });

  // Use prop data if available, otherwise use fetched data
  const todayAttendance = React.useMemo(() => {
    return todayAttendanceProp || fetchedAttendance || [];
  }, [todayAttendanceProp, fetchedAttendance]);

  // Enhanced status calculation that uses database records as authoritative source
  const calculateSubjectStatusWithDB = React.useCallback((schedule: SubjectSchedule[]): SubjectSchedule[] => {
    const now = currentTime;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    return schedule.map(subject => {
      const [startHour, startMin] = subject.startTime.split(':').map(Number);
      const [endHour, endMin] = subject.endTime.split(':').map(Number);
      const startTimeMinutes = startHour * 60 + startMin;
      const endTimeMinutes = endHour * 60 + endMin;

      const isBeforeStart = currentMinutes < startTimeMinutes;
      const isCurrentPeriod = currentMinutes >= startTimeMinutes && currentMinutes <= endTimeMinutes;
      const isAfterEnd = currentMinutes > endTimeMinutes;

      // Find matching attendance record in database
      const attendanceRecord = todayAttendance?.find(record => {
        // Get subject IDs for comparison - handle both string and integer types
        const recordSubjectId = record.subjectId || '';
        const scheduleSubjectId = subject.subjectId;
        
        // Normalize both IDs to integers for reliable comparison
        const recordSubjectIdInt = recordSubjectId ? parseInt(recordSubjectId.toString()) : null;
        const scheduleSubjectIdInt = scheduleSubjectId ? parseInt(scheduleSubjectId.toString()) : null;
        
        // Debug: Check ID matching
        const idsMatch = recordSubjectIdInt === scheduleSubjectIdInt;
        
        // Primary strategy: Integer comparison (most reliable)
        if (recordSubjectIdInt && scheduleSubjectIdInt && recordSubjectIdInt === scheduleSubjectIdInt) {
          return true;
        }
        
        // Fallback strategies for edge cases
        const extendedRecord = record as Attendance & { 
          subjectName?: string; 
          subjectCode?: string; 
        };
        
        // Strategy 2: Subject code matching
        if (extendedRecord.subjectCode && extendedRecord.subjectCode === subject.subjectCode) {
          console.log(`[DEBUG] ✅ MATCH FOUND for ${subject.subjectName} - Subject Code: ${subject.subjectCode}`);
          return true;
        }
        
        // Strategy 3: Subject name matching (case-insensitive)
        if (extendedRecord.subjectName?.toLowerCase() === subject.subjectName?.toLowerCase()) {
          console.log(`[DEBUG] ✅ MATCH FOUND for ${subject.subjectName} - Subject Name match`);
          return true;
        }
        
        return false;
      });

      // Determine status - prioritize database record over time-based calculation
      let status: 'Starts Soon' | 'Pending' | 'Present' | 'Absent' = 'Starts Soon';
      let attendanceMarked = false;

      if (attendanceRecord) {
        // Use database status as authoritative source
        attendanceMarked = true;
        if (attendanceRecord.status === 'present' || attendanceRecord.status === 'late') {
          status = 'Present';
        } else if (attendanceRecord.status === 'absent') {
          status = 'Absent';
        } else {
          status = 'Present'; // Default for any other status
        }
      } else {
        // No database record - calculate based on time
        if (isAfterEnd) {
          status = 'Absent';
        } else if (isCurrentPeriod) {
          status = 'Pending';
        } else {
          status = 'Starts Soon';
        }
      }

      return {
        ...subject,
        status,
        attendanceMarked,
        isCurrentPeriod,
        isBeforeStart,
        isAfterEnd
      };
    });
  }, [currentTime, todayAttendance]);

  // Combine schedule with attendance status
  const todaySchedule = React.useMemo(() => {
    const baseSchedule = generateTodayScheduleFromDB();
    
    console.log('[DEBUG] Recalculating todaySchedule...');
    console.log('[DEBUG] Base schedule:', baseSchedule);
    console.log('[DEBUG] Today attendance records:', todayAttendance);
    
    // Log detailed attendance record structure
    if (todayAttendance && todayAttendance.length > 0) {
      console.log('[DEBUG] First attendance record structure:', JSON.stringify(todayAttendance[0], null, 2));
      todayAttendance.forEach((record, index) => {
        console.log(`[DEBUG] Attendance Record ${index + 1}:`, {
          id: record.id,
          subjectId: record.subjectId,
          subjectName: (record as Attendance & { subjectName?: string }).subjectName,
          subjectCode: (record as Attendance & { subjectCode?: string }).subjectCode,
          status: record.status
        });
      });
    }
    // Log today's schedule subjects for comparison
    if (baseSchedule && baseSchedule.length > 0) {
      baseSchedule.forEach((subject, idx) => {
        console.log(`[DEBUG] Schedule Subject ${idx + 1}:`, {
          subjectId: subject.subjectId,
          subjectName: subject.subjectName,
          subjectCode: subject.subjectCode,
          startTime: subject.startTime,
          endTime: subject.endTime
        });
      });
    }
    
    // Use enhanced calculation that prioritizes database records
    const scheduleWithStatus = calculateSubjectStatusWithDB(baseSchedule);
    
    return scheduleWithStatus;
  }, [generateTodayScheduleFromDB, calculateSubjectStatusWithDB, todayAttendance]);

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
      // Refresh attendance data and notify parent - use multiple strategies with correct query keys
      await Promise.all([
        refetchAttendance(),
        queryClient.invalidateQueries({ queryKey: ['today-attendance-by-subject', user?.id, studentData?.id] }),
        queryClient.refetchQueries({ queryKey: ['today-attendance-by-subject', user?.id, studentData?.id] }),
        // Also invalidate other attendance-related queries
        queryClient.invalidateQueries({ queryKey: ['attendance-summary', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['student-attendance-summary', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['today-attendance-data', user?.id, studentData?.id] })
      ]);
      onAttendanceMarked?.();
      
      // Force a small delay to ensure backend has processed the data
      setTimeout(async () => {
        await Promise.all([
          refetchAttendance(),
          queryClient.invalidateQueries({ queryKey: ['today-attendance-by-subject', user?.id, studentData?.id] }),
          queryClient.refetchQueries({ queryKey: ['today-attendance-by-subject', user?.id, studentData?.id] }),
          // Also refresh other related queries
          queryClient.invalidateQueries({ queryKey: ['attendance-summary', user?.id] }),
          queryClient.invalidateQueries({ queryKey: ['student-attendance-summary', user?.id] }),
          queryClient.invalidateQueries({ queryKey: ['today-attendance-data', user?.id, studentData?.id] })
        ]);
      }, 1000);
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
      <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl text-white flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-white" />
            </div>
            Today's Class Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="h-16 w-16 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No Classes Scheduled</h3>
            <p className="text-slate-400">
              {new Date().getDay() === 5 || new Date().getDay() === 6 
                ? "It's weekend - no classes scheduled." 
                : "No class schedules available for today. Please contact your admin to set up class schedules."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (showFaceRecognition && activeSubjectId) {
    const activeSubject = todaySchedule.find(s => s.subjectId === activeSubjectId);
    return (
      <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl text-white flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-teal-400 flex items-center justify-center">
              <Scan className="h-4 w-4 text-white" />
            </div>
            Marking Attendance - {activeSubject?.subjectName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-white font-medium">Face Recognition Active</span>
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
    <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-teal-400 to-purple-500"></div>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl text-white flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-white" />
            </div>
            Today's Class Schedule
          </CardTitle>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-400/30">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'short', 
                day: 'numeric' 
              })}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Time restrictions enabled - verification controlled by school hours and periods */}

        {/* Time Restriction Status */}
        <div className={`border rounded-xl p-4 ${
          isFaceVerificationAllowed 
            ? 'bg-green-500/10 border-green-400/30' 
            : 'bg-red-500/10 border-red-400/30'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
              isFaceVerificationAllowed 
                ? 'bg-green-500/20' 
                : 'bg-red-500/20'
            }`}>
              {isFaceVerificationAllowed ? (
                <Shield className="h-4 w-4 text-green-400" />
              ) : (
                <Lock className="h-4 w-4 text-red-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className={`font-medium ${
                  isFaceVerificationAllowed ? 'text-green-300' : 'text-red-300'
                }`}>
                  {isFaceVerificationAllowed ? 'Face Verification Available' : 'Face Verification Restricted'}
                </p>
                {currentPeriod && (
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30 text-xs">
                    {currentPeriod.name}
                  </Badge>
                )}
              </div>
              <p className={`text-sm ${
                isFaceVerificationAllowed ? 'text-green-200/80' : 'text-red-200/80'
              }`}>
                {restrictionReason}
              </p>
              {currentPeriod && isFaceVerificationAllowed && (
                <p className="text-xs text-slate-400 mt-1">
                  {getTimeRemainingInPeriod(currentPeriod)}
                </p>
              )}
              {timeUntilNext && !isFaceVerificationAllowed && (
                <p className="text-xs text-slate-400 mt-1">
                  Next opportunity in {timeUntilNext}
                </p>
              )}
            </div>
          </div>
        </div>
        {todaySchedule.map((subject, index) => (
          <div
            key={`${subject.subjectId}-${subject.startTime}-${index}`}
            className="group bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600/50 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-white">{subject.subjectName}</h3>
                    <Badge 
                      className={`${getStatusColor(subject.status)} flex items-center gap-1`}
                    >
                      {getStatusIcon(subject.status)}
                      {subject.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-400 mb-2">{subject.subjectCode}</p>
                  <div className="flex items-center gap-4 text-sm text-slate-300">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(subject.startTime)} - {formatTime(subject.endTime)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                {subject.attendanceMarked || subject.status === 'Present' ? (
                  <Badge className="bg-green-500/20 text-green-300 border-green-400/30">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Present
                  </Badge>
                ) : subject.status === 'Pending' ? (
                  <>
                    {!isFaceVerificationAllowed ? (
                      <div className="flex flex-col items-end gap-1">
                        <Badge className="bg-red-500/20 text-red-300 border-red-400/30">
                          <Lock className="h-3 w-3 mr-1" />
                          Restricted
                        </Badge>
                        <p className="text-xs text-red-400 text-right max-w-32">
                          {restrictionReason}
                        </p>
                        {timeUntilNext && (
                          <p className="text-xs text-slate-400 text-right">
                            Next: {timeUntilNext}
                          </p>
                        )}
                      </div>
                    ) : !studentData?.face_encoding ? (
                      <div className="flex flex-col items-end gap-1">
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Setup Required
                        </Badge>
                        <p className="text-xs text-amber-400 text-right">
                          Face registration required
                        </p>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleMarkAttendance(subject.subjectId)}
                        className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg"
                        // TESTING: Disabled attribute removed for testing purposes
                        // disabled={!subject.isCurrentPeriod}
                      >
                        <Scan className="h-4 w-4 mr-2" />
                        Mark Attendance
                      </Button>
                    )}
                  </>
                ) : subject.status === 'Absent' ? (
                  <Badge className="bg-red-500/20 text-red-300 border-red-400/30">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Absent
                  </Badge>
                ) : subject.status === 'Starts Soon' ? (
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30">
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
