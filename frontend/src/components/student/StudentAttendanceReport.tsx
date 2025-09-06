
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CalendarIcon, CheckCircle, XCircle, Clock, Loader2, BookOpen, TrendingUp, Target, AlertTriangle } from 'lucide-react';
import { api } from '@/integrations/api/client';
import { useAuth } from '@/contexts/useAuth';
import { Attendance } from '@/integrations/api/types';

const StudentAttendanceReport = () => {
  const { user } = useAuth();
  
  // Get student ID from user context if available
  const studentId = user?.id;

  // Fetch attendance summary from the dedicated endpoint
  const { data: attendanceSummary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['student-attendance-summary', studentId],
    queryFn: async () => {
      try {
        return await api.studentAttendance.getSummary();
      } catch (error) {
        console.error('Error fetching attendance summary:', error);
        return null;
      }
    },
    enabled: !!studentId
  });

  // Fetch subject-wise breakdown
  const { data: subjectBreakdown = [], isLoading: isLoadingBreakdown } = useQuery({
    queryKey: ['student-attendance-breakdown', studentId],
    queryFn: async () => {
      try {
        return await api.studentAttendance.getSubjectBreakdown();
      } catch (error) {
        console.error('Error fetching subject breakdown:', error);
        return [];
      }
    },
    enabled: !!studentId
  });
  
  // Fetch recent attendance records for the activity feed
  const { data: recentRecords = [], isLoading: isLoadingRecords } = useQuery({
    queryKey: ['student-attendance-recent', studentId],
    queryFn: async () => {
      try {
        const today = new Date();
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(today.getDate() - 14);
        
        // Use the working attendance endpoint instead of the broken student-attendance/records endpoint
        return await api.attendance.getAll({
          startDate: twoWeeksAgo.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        });
      } catch (error) {
        console.error('Error fetching recent records:', error);
        return [];
      }
    },
    enabled: !!studentId
  });

  const isLoading = isLoadingSummary || isLoadingBreakdown || isLoadingRecords;
  
  // Calculate enhanced statistics
  const enhancedStats = React.useMemo(() => {
    if (!attendanceSummary) {
      return {
        overallPercentage: 0,
        totalClasses: 0,
        presentClasses: 0,
        absentClasses: 0,
        lateClasses: 0,
        attendanceGoal: 85,
        isOnTrack: false,
        classesNeeded: 0
      };
    }

    const overallPercentage = attendanceSummary.percentage_present || 0;
    const totalClasses = attendanceSummary.total_academic_days || 0;
    const presentClasses = attendanceSummary.present || 0;
    const absentClasses = attendanceSummary.absent || 0;
    const lateClasses = attendanceSummary.late || 0;
    const attendanceGoal = 85;
    const isOnTrack = overallPercentage >= attendanceGoal;
    
    // Calculate classes needed to reach goal
    const classesNeeded = Math.max(0, Math.ceil((attendanceGoal * totalClasses / 100) - presentClasses));

    return {
      overallPercentage,
      totalClasses,
      presentClasses,
      absentClasses,
      lateClasses,
      attendanceGoal,
      isOnTrack,
      classesNeeded
    };
  }, [attendanceSummary]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'absent':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'late':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      present: 'default',
      absent: 'destructive',
      late: 'secondary'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="h-12 w-12 animate-spin text-brand-500 mb-4" />
        <p className="text-muted-foreground">Loading attendance data...</p>
      </div>
    );
  }
  
  // Show empty state
  if (!attendanceSummary && !isLoading) {
    return (
      <Card className="p-12 bg-slate-900/60 backdrop-blur-md border-slate-700/50">
        <div className="text-center">
          <CalendarIcon className="h-12 w-12 mx-auto text-slate-400 opacity-30 mb-4" />
          <h3 className="text-lg font-medium mb-2 text-white">No Attendance Records</h3>
          <p className="text-slate-400">
            No attendance records found. Start attending classes to see your statistics.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-400" />
              Overall Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold mb-2 ${
              enhancedStats.overallPercentage >= 90 ? 'text-green-400' :
              enhancedStats.overallPercentage >= 75 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {enhancedStats.overallPercentage.toFixed(1)}%
            </div>
            <Progress 
              value={enhancedStats.overallPercentage} 
              className="h-2 mb-2"
            />
            <p className="text-sm text-slate-400">
              {enhancedStats.presentClasses} / {enhancedStats.totalClasses} classes
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              Present
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400 mb-2">
              {enhancedStats.presentClasses}
            </div>
            <p className="text-sm text-slate-400">Classes attended</p>
            {enhancedStats.lateClasses > 0 && (
              <p className="text-xs text-amber-400 mt-1">
                + {enhancedStats.lateClasses} late arrivals
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-400" />
              Absent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-400 mb-2">
              {enhancedStats.absentClasses}
            </div>
            <p className="text-sm text-slate-400">Classes missed</p>
            {enhancedStats.absentClasses > 0 && (
              <p className="text-xs text-red-300 mt-1">
                {((enhancedStats.absentClasses / enhancedStats.totalClasses) * 100).toFixed(1)}% of total
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              {enhancedStats.isOnTrack ? (
                <TrendingUp className="h-5 w-5 text-green-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              )}
              Goal Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold mb-2 ${
              enhancedStats.overallPercentage >= 90 ? 'text-green-400' :
              enhancedStats.overallPercentage >= 50 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {Math.min(100, (enhancedStats.overallPercentage / enhancedStats.attendanceGoal * 100)).toFixed(1)}%
            </div>
            <p className="text-sm text-slate-400">Progress to {enhancedStats.attendanceGoal}% goal</p>
            <Progress 
              value={Math.min(100, (enhancedStats.overallPercentage / enhancedStats.attendanceGoal * 100))} 
              className="h-2 mt-2 mb-2"
            />
            {!enhancedStats.isOnTrack && enhancedStats.classesNeeded > 0 && (
              <p className="text-xs text-amber-400">
                Need {enhancedStats.classesNeeded} more classes
              </p>
            )}
            {enhancedStats.isOnTrack && (
              <p className="text-xs text-green-400">
                ✓ Goal achieved!
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Subject-wise Breakdown */}
      {subjectBreakdown.length > 0 && (
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-400" />
              Subject-wise Performance
            </CardTitle>
            <CardDescription className="text-slate-400">
              Your attendance breakdown by subject
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {subjectBreakdown.map((subject: {
                subject_name: string;
                present_classes: number;
                total_classes: number;
                absent_classes: number;
              }, index: number) => {
                const percentage = subject.total_classes > 0 
                  ? (subject.present_classes / subject.total_classes) * 100 
                  : 0;
                
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">{subject.subject_name}</p>
                        <p className="text-sm text-slate-400">
                          {subject.present_classes} / {subject.total_classes} classes
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${
                          percentage >= 90 ? 'text-green-400' :
                          percentage >= 75 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {percentage.toFixed(1)}%
                        </div>
                        {subject.absent_classes > 0 && (
                          <p className="text-xs text-red-400">
                            {subject.absent_classes} absent
                          </p>
                        )}
                      </div>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {recentRecords.length > 0 && (
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-blue-400" />
              Recent Activity
            </CardTitle>
            <CardDescription className="text-slate-400">
              Your latest attendance records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentRecords.slice(0, 8).map((record, index) => {
                // Handle different response formats from different endpoints
                const status = record.status || 'unknown';
                const date = record.date || new Date().toISOString().split('T')[0];
                const recordWithExtendedProps = record as Attendance & { 
                  subject_name?: string; 
                  subjectName?: string;
                  marked_at?: string;
                  markedAt?: string;
                };
                const subjectName = recordWithExtendedProps.subject_name || 
                                   recordWithExtendedProps.subjectName || 
                                   `Subject ${record.subjectId || 'Unknown'}`;
                const markedAt = recordWithExtendedProps.marked_at || 
                                recordWithExtendedProps.markedAt || 
                                null;
                
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(status)}
                      <div>
                        <p className="font-medium text-white">{subjectName}</p>
                        <p className="text-sm text-slate-400">
                          {new Date(date).toLocaleDateString()} 
                          {markedAt && ` at ${new Date(markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(status)}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Goal Card */}
      <Card className={`border-2 ${
        enhancedStats.isOnTrack 
          ? 'bg-green-500/10 border-green-500/30' 
          : 'bg-amber-500/10 border-amber-500/30'
      }`}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
              enhancedStats.isOnTrack 
                ? 'bg-green-500/20' 
                : 'bg-amber-500/20'
            }`}>
              {enhancedStats.isOnTrack ? (
                <CheckCircle className="h-6 w-6 text-green-400" />
              ) : (
                <Target className="h-6 w-6 text-amber-400" />
              )}
            </div>
            <div className="flex-1">
              <h3 className={`font-semibold ${
                enhancedStats.isOnTrack ? 'text-green-300' : 'text-amber-300'
              }`}>
                {enhancedStats.isOnTrack ? 'Great Job!' : 'Attendance Goal'}
              </h3>
              <p className="text-slate-300 mb-2">
                {enhancedStats.isOnTrack 
                  ? `You're maintaining excellent attendance above ${enhancedStats.attendanceGoal}%`
                  : `You need ${enhancedStats.classesNeeded} more classes to reach your ${enhancedStats.attendanceGoal}% goal`
                }
              </p>
              {!enhancedStats.isOnTrack && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Current: {enhancedStats.overallPercentage.toFixed(1)}%</span>
                    <span className="text-slate-400">Target: {enhancedStats.attendanceGoal}%</span>
                  </div>
                  <Progress 
                    value={enhancedStats.overallPercentage} 
                    className="h-2"
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentAttendanceReport;
