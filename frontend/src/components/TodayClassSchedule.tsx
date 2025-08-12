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
  CheckSquare
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';
import { useAuth } from '@/contexts/useAuth';
import FaceRecognition from '@/components/FaceRecognition';

interface SubjectSchedule {
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  startTime: string;
  endTime: string;
  status: 'Upcoming' | 'Ongoing' | 'Completed';
  attendanceMarked: boolean;
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
          status: 'Upcoming',
          attendanceMarked: false
        },
        {
          subjectId: 21,
          subjectName: 'Programming Fundamentals',
          subjectCode: 'CSE101',
          startTime: '11:00',
          endTime: '12:30',
          status: 'Upcoming',
          attendanceMarked: false
        },
        {
          subjectId: 22,
          subjectName: 'Mathematics for Computing',
          subjectCode: 'CSE102',
          startTime: '14:00',
          endTime: '15:30',
          status: 'Upcoming',
          attendanceMarked: false
        }
      ],
      2: [ // Tuesday
        {
          subjectId: 23,
          subjectName: 'Digital Logic Design',
          subjectCode: 'CSE103',
          startTime: '10:00',
          endTime: '11:30',
          status: 'Upcoming',
          attendanceMarked: false
        },
        {
          subjectId: 1,
          subjectName: 'Default Subject',
          subjectCode: 'DEF101',
          startTime: '13:00',
          endTime: '14:30',
          status: 'Upcoming',
          attendanceMarked: false
        }
      ],
      3: [ // Wednesday
        {
          subjectId: 21,
          subjectName: 'Programming Fundamentals',
          subjectCode: 'CSE101',
          startTime: '09:30',
          endTime: '11:00',
          status: 'Upcoming',
          attendanceMarked: false
        },
        {
          subjectId: 22,
          subjectName: 'Mathematics for Computing',
          subjectCode: 'CSE102',
          startTime: '15:00',
          endTime: '16:30',
          status: 'Upcoming',
          attendanceMarked: false
        }
      ],
      4: [ // Thursday
        {
          subjectId: 1,
          subjectName: 'Default Subject',
          subjectCode: 'DEF101',
          startTime: '08:30',
          endTime: '10:00',
          status: 'Upcoming',
          attendanceMarked: false
        },
        {
          subjectId: 23,
          subjectName: 'Digital Logic Design',
          subjectCode: 'CSE103',
          startTime: '11:30',
          endTime: '13:00',
          status: 'Upcoming',
          attendanceMarked: false
        }
      ],
      5: [ // Friday
        {
          subjectId: 22,
          subjectName: 'Mathematics for Computing',
          subjectCode: 'CSE102',
          startTime: '10:00',
          endTime: '11:30',
          status: 'Upcoming',
          attendanceMarked: false
        },
        {
          subjectId: 21,
          subjectName: 'Programming Fundamentals',
          subjectCode: 'CSE101',
          startTime: '14:30',
          endTime: '16:00',
          status: 'Upcoming',
          attendanceMarked: false
        }
      ]
    };

    return mockSchedules[dayOfWeek] || [];
  }, [studentData?.faculty_id, studentData?.semester]);

  // Calculate status based on current time
  const calculateSubjectStatus = React.useCallback((schedule: SubjectSchedule[]): SubjectSchedule[] => {
    const now = currentTime;
    const currentTimeStr = now.toTimeString().slice(0, 5); // HH:MM format

    return schedule.map(subject => {
      const startTime = subject.startTime;
      const endTime = subject.endTime;

      let status: 'Upcoming' | 'Ongoing' | 'Completed' = 'Upcoming';

      if (currentTimeStr >= startTime && currentTimeStr <= endTime) {
        status = 'Ongoing';
      } else if (currentTimeStr > endTime) {
        status = 'Completed';
      }

      return { ...subject, status };
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
    setActiveSubjectId(subjectId);
    setShowFaceRecognition(true);
    toast({
      title: "Face Recognition Started",
      description: "Please position your face within the camera frame.",
    });
  };

  const handleFaceCapture = async (_dataUrl: string, recognized: boolean) => {
    if (!activeSubjectId) return;

    // FaceRecognition component already attempted attendance when subjectId is provided
    if (recognized) {
      toast({
        title: "Attendance Marked Successfully",
        description: `Your face was verified and attendance recorded.`,
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
      case 'Ongoing':
        return <PlayCircle className="h-4 w-4" />;
      case 'Upcoming':
        return <Timer className="h-4 w-4" />;
      case 'Completed':
        return <CheckSquare className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Ongoing':
        return 'bg-green-500/20 text-green-300 border-green-400/30';
      case 'Upcoming':
        return 'bg-blue-500/20 text-blue-300 border-blue-400/30';
      case 'Completed':
        return 'bg-slate-500/20 text-slate-300 border-slate-400/30';
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
        <CardTitle className="text-xl text-white flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
            <Calendar className="h-4 w-4 text-white" />
          </div>
          Today's Class Schedule
          <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-400/30 ml-auto">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'short', 
              day: 'numeric' 
            })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
                {subject.attendanceMarked ? (
                  <Badge className="bg-green-500/20 text-green-300 border-green-400/30">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Already Marked
                  </Badge>
                ) : subject.status === 'Ongoing' ? (
                  <Button
                    onClick={() => handleMarkAttendance(subject.subjectId)}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg"
                    disabled={!studentData?.face_encoding}
                  >
                    <Scan className="h-4 w-4 mr-2" />
                    Mark Attendance
                  </Button>
                ) : subject.status === 'Completed' ? (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Time Expired
                  </Badge>
                ) : (
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30">
                    <Timer className="h-3 w-3 mr-1" />
                    Starts Soon
                  </Badge>
                )}

                {!studentData?.face_encoding && subject.status === 'Ongoing' && (
                  <p className="text-xs text-amber-400 text-right">
                    Face registration required
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Next class info */}
        {(() => {
          const nextClass = todaySchedule.find(s => s.status === 'Upcoming');
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
