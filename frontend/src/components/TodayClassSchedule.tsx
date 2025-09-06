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
import { api } from '@/integrations/api/client';
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
  onAttendanceMarked?: () => void;
}

const TodayClassSchedule: React.FC<TodayClassScheduleProps> = ({ 
  studentData, 
  onAttendanceMarked 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
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

  // Mock schedule data - In real implementation, this would come from backend
  // For now, creating a realistic schedule based on student's faculty and semester
  const generateTodaySchedule = React.useCallback((): SubjectSchedule[] => {
    if (!studentData?.faculty_id || !studentData?.semester) {
      return [];
    }

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return [];
    }

    // Mock schedule based on day and student data
    const mockSchedules: { [key: number]: SubjectSchedule[] } = {
      1: [ // Monday
        {
          subjectId: 1,
          subjectName: 'Default Subject',
          subjectCode: 'DEF101',
          startTime: '09:00',
          endTime: '10:30',
          status: 'Starts Soon' as const,
          attendanceMarked: false,
          isCurrentPeriod: false,
          isBeforeStart: true,
          isAfterEnd: false
        },
        {
          subjectId: 21,
          subjectName: 'Programming Fundamentals',
          subjectCode: 'CSE101',
          startTime: '11:00',
          endTime: '12:30',
          status: 'Starts Soon' as const,
          attendanceMarked: false,
          isCurrentPeriod: false,
          isBeforeStart: true,
          isAfterEnd: false
        },
        {
          subjectId: 22,
          subjectName: 'Mathematics for Computing',
          subjectCode: 'CSE102',
          startTime: '14:00',
          endTime: '15:30',
          status: 'Starts Soon' as const,
          attendanceMarked: false,
          isCurrentPeriod: false,
          isBeforeStart: true,
          isAfterEnd: false
        }
      ],
      2: [ // Tuesday
        {
          subjectId: 23,
          subjectName: 'Digital Logic Design',
          subjectCode: 'CSE103',
          startTime: '10:00',
          endTime: '11:30',
          status: 'Starts Soon' as const,
          attendanceMarked: false,
          isCurrentPeriod: false,
          isBeforeStart: true,
          isAfterEnd: false
        },
        {
          subjectId: 1,
          subjectName: 'Default Subject',
          subjectCode: 'DEF101',
          startTime: '13:00',
          endTime: '14:30',
          status: 'Starts Soon' as const,
          attendanceMarked: false,
          isCurrentPeriod: false,
          isBeforeStart: true,
          isAfterEnd: false
        }
      ],
      3: [ // Wednesday
        {
          subjectId: 24,
          subjectName: 'Computer Architecture',
          subjectCode: 'CSE104',
          startTime: '08:00',
          endTime: '09:30',
          status: 'Starts Soon' as const,
          attendanceMarked: false,
          isCurrentPeriod: false,
          isBeforeStart: true,
          isAfterEnd: false
        },
        {
          subjectId: 21,
          subjectName: 'Programming Fundamentals',
          subjectCode: 'CSE101',
          startTime: '09:45',
          endTime: '11:15',
          status: 'Starts Soon' as const,
          attendanceMarked: false,
          isCurrentPeriod: false,
          isBeforeStart: true,
          isAfterEnd: false
        },
        {
          subjectId: 25,
          subjectName: 'Data Structures',
          subjectCode: 'CSE105',
          startTime: '11:30',
          endTime: '13:00',
          status: 'Starts Soon' as const,
          attendanceMarked: false,
          isCurrentPeriod: false,
          isBeforeStart: true,
          isAfterEnd: false
        },
        {
          subjectId: 22,
          subjectName: 'Mathematics for Computing',
          subjectCode: 'CSE102',
          startTime: '14:00',
          endTime: '15:30',
          status: 'Starts Soon' as const,
          attendanceMarked: false,
          isCurrentPeriod: false,
          isBeforeStart: true,
          isAfterEnd: false
        },
        {
          subjectId: 26,
          subjectName: 'Database Systems',
          subjectCode: 'CSE106',
          startTime: '15:45',
          endTime: '17:00',
          status: 'Starts Soon' as const,
          attendanceMarked: false,
          isCurrentPeriod: false,
          isBeforeStart: true,
          isAfterEnd: false
        }
      ],
      4: [ // Thursday
        {
          subjectId: 1,
          subjectName: 'Default Subject',
          subjectCode: 'DEF101',
          startTime: '08:30',
          endTime: '10:00',
          status: 'Starts Soon' as const,
          attendanceMarked: false,
          isCurrentPeriod: false,
          isBeforeStart: true,
          isAfterEnd: false
        },
        {
          subjectId: 23,
          subjectName: 'Digital Logic Design',
          subjectCode: 'CSE103',
          startTime: '11:30',
          endTime: '13:00',
          status: 'Starts Soon' as const,
          attendanceMarked: false,
          isCurrentPeriod: false,
          isBeforeStart: true,
          isAfterEnd: false
        }
      ],
      5: [ // Friday
        {
          subjectId: 22,
          subjectName: 'Mathematics for Computing',
          subjectCode: 'CSE102',
          startTime: '10:00',
          endTime: '11:30',
          status: 'Starts Soon' as const,
          attendanceMarked: false,
          isCurrentPeriod: false,
          isBeforeStart: true,
          isAfterEnd: false
        },
        {
          subjectId: 21,
          subjectName: 'Programming Fundamentals',
          subjectCode: 'CSE101',
          startTime: '14:30',
          endTime: '16:00',
          status: 'Starts Soon' as const,
          attendanceMarked: false,
          isCurrentPeriod: false,
          isBeforeStart: true,
          isAfterEnd: false
        }
      ]
    };

    return mockSchedules[dayOfWeek] || [];
  }, [studentData?.faculty_id, studentData?.semester]);

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

      let status: 'Starts Soon' | 'Pending' | 'Present' | 'Absent' = 'Starts Soon';
      if (subject.attendanceMarked) {
        status = 'Present';
      } else if (isCurrentPeriod) {
        status = 'Pending';
      } else if (isAfterEnd) {
        status = 'Absent';
      } else if (isBeforeStart) {
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

  // Get today's attendance records to check which subjects already have attendance marked
  const { data: todayAttendance, refetch: refetchAttendance } = useQuery({
    queryKey: ['today-attendance-by-subject', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const today = new Date().toISOString().split('T')[0];
        const records = await api.attendance.getAll({
          studentId: user.id,
          date: today
        });
        return records;
      } catch (error) {
        console.error('Error fetching today attendance:', error);
        return [];
      }
    },
    enabled: !!user?.id,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Combine schedule with attendance status
  const todaySchedule = React.useMemo(() => {
    const baseSchedule = generateTodaySchedule();
    const scheduleWithStatus = calculateSubjectStatus(baseSchedule);
    
    // Mark attendance status based on today's records
    // Now correctly using subjectId since we fixed the type mismatch
    return scheduleWithStatus.map(subject => ({
      ...subject,
      attendanceMarked: todayAttendance?.some(record => 
        record.subjectId === subject.subjectId.toString() // Now correctly using subjectId
      ) || false
    }));
  }, [generateTodaySchedule, calculateSubjectStatus, todayAttendance]);

  const handleMarkAttendance = (subjectId: number) => {
    // Time restrictions disabled - direct access to face recognition
    setActiveSubjectId(subjectId);
    setShowFaceRecognition(true);
    toast({
      title: "Face Recognition Started",
      description: "Please position your face within the camera frame",
    });
  };

  const handleFaceCapture = async (_dataUrl: string, recognized: boolean) => {
    if (!activeSubjectId) return;

    // FaceRecognition component already attempted attendance when subjectId is provided
    if (recognized) {
      // Mark verification as complete for this period
      markVerificationComplete();
      
      toast({
        title: "Attendance Marked Successfully",
        description: `Face verified and attendance recorded for ${currentPeriod?.name || 'current period'}`,
      });
      // Refresh attendance data and notify parent
      refetchAttendance();
      onAttendanceMarked?.();
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
            <h3 className="text-lg font-medium text-white mb-2">No Classes Today</h3>
            <p className="text-slate-400">
              {new Date().getDay() === 0 || new Date().getDay() === 6 
                ? "Enjoy your weekend!" 
                : "You have a free day today!"}
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
        {/* Time restrictions disabled - face verification always available */}

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
            key={subject.subjectId}
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
                        disabled={!subject.isCurrentPeriod}
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
