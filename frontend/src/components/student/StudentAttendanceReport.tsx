
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { api } from '@/integrations/api/client';
import { useAuth } from '@/contexts/useAuth';

const StudentAttendanceReport = () => {
  const { user } = useAuth();
  
  // Get student ID from user context if available
  const studentId = user?.id;
  
  // Fetch attendance data from API
  const { data: attendanceData = [], isLoading } = useQuery({
    queryKey: ['student-attendance', studentId],
    queryFn: async () => {
      try {
        if (!studentId) return [];
        
        // Get the current month's data
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        const filters = {
          studentId: studentId,
          startDate: startOfMonth.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };
        
        const records = await api.attendance.getAll(filters);
        
        // Get class details for each record
        const classIds = [...new Set(records.map(record => record.classId))];
        const classPromises = classIds.map(id => api.classes.getById(id));
        const classes = await Promise.all(classPromises);
        
        // Create a map of classId -> className
        const classMap = classes.reduce((map, cls) => {
          map[cls.id] = cls.name;
          return map;
        }, {});
        
        // Format records with class names
        return records.map(record => ({
          date: record.date,
          subject: classMap[record.classId] || 'Unknown Class',
          status: record.status,
          time: new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      } catch (error) {
        console.error('Error fetching student attendance:', error);
        return [];
      }
    },
    enabled: !!studentId
  });
  
  // Calculate attendance statistics
  const attendanceStats = React.useMemo(() => {
    if (!attendanceData.length) {
      return { 
        total: 0, 
        present: 0, 
        absent: 0, 
        late: 0,
        percentage: 0 
      };
    }
    
    const present = attendanceData.filter(record => record.status === 'present').length;
    const absent = attendanceData.filter(record => record.status === 'absent').length;
    const late = attendanceData.filter(record => record.status === 'late').length;
    const total = attendanceData.length;
    const percentage = Math.round((present / total) * 100);
    
    return { total, present, absent, late, percentage };
  }, [attendanceData]);

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
  if (!attendanceData.length) {
    return (
      <Card className="p-12">
        <div className="text-center">
          <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-4" />
          <h3 className="text-lg font-medium mb-2">No Attendance Records</h3>
          <p className="text-muted-foreground">
            No attendance records found for the current month.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              attendanceStats.percentage >= 90 ? 'text-green-600' :
              attendanceStats.percentage >= 75 ? 'text-amber-500' : 'text-red-600'
            }`}>
              {attendanceStats.percentage}%
            </div>
            <p className="text-sm text-muted-foreground">Attendance Rate</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Present Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendanceStats.present}</div>
            <p className="text-sm text-muted-foreground">
              Out of {attendanceStats.total} days
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Absent Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{attendanceStats.absent}</div>
            <p className="text-sm text-muted-foreground">
              {attendanceStats.late > 0 && `+ ${attendanceStats.late} late`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Recent Attendance
          </CardTitle>
          <CardDescription>
            Your attendance record for the last {Math.min(attendanceData.length, 10)} days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {attendanceData.slice(0, 10).map((record, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(record.status)}
                  <div>
                    <p className="font-medium">{record.subject}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(record.date).toLocaleDateString()} at {record.time}
                    </p>
                  </div>
                </div>
                {getStatusBadge(record.status)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentAttendanceReport;
