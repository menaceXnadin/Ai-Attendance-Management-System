import { AttendanceRecord, AttendancePrediction, SmartAlert, ClassComparison, CalendarDay } from '@/types/dashboard';

// API helper for fetching insights and analytics
const fetchStudentInsights = async (studentId: string) => {
  try {
    const response = await fetch(`/api/analytics/student-insights/${studentId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to fetch student insights:', error);
  }
  return null;
};

export const calculateAttendancePrediction = (
  attendanceRecords: AttendanceRecord[],
  totalSemesterClasses: number = 120
): AttendancePrediction => {
  const totalClasses = attendanceRecords.length;
  const presentDays = attendanceRecords.filter(record => record.status === 'present').length;
  const currentPercentage = totalClasses > 0 ? (presentDays / totalClasses) * 100 : 0;
  
  // Simple linear projection
  const remainingClasses = Math.max(0, totalSemesterClasses - totalClasses);
  const projectedPresentDays = presentDays + (remainingClasses * (currentPercentage / 100));
  const projectedPercentage = totalSemesterClasses > 0 ? (projectedPresentDays / totalSemesterClasses) * 100 : 0;

  return {
    currentPercentage,
    projectedPercentage: Math.min(100, Math.max(0, projectedPercentage)),
    totalClasses,
    presentDays,
    remainingClasses
  };
};

export const generateSmartAlerts = async (
  attendanceRecords: AttendanceRecord[],
  currentAttendance: number,
  studentId?: string
): Promise<SmartAlert[]> => {
  const alerts: SmartAlert[] = [];
  
  // Try to get AI insights from backend
  if (studentId) {
    try {
      const insights = await fetchStudentInsights(studentId);
      if (insights && insights.insights) {
        // Convert backend insights to our alert format
        insights.insights.forEach((insight: { type: string; title: string; message: string; priority: string }) => {
          alerts.push({
            id: `ai-${insight.type}`,
            type: insight.type as 'warning' | 'success' | 'info' | 'danger',
            title: insight.title,
            message: insight.message,
            actionable: insight.priority === 'high'
          });
        });
      }
    } catch (error) {
      console.error('Failed to fetch AI insights:', error);
    }
  }
  
  // Fallback to client-side analysis if API fails
  if (alerts.length === 0) {
    // Check recent attendance pattern (last 7 days)
    const recentRecords = attendanceRecords
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
    
    const recentAbsences = recentRecords.filter(r => r.status === 'absent').length;
    
    // Generate context-aware alerts
    if (recentAbsences >= 3) {
      alerts.push({
        id: 'frequent-absences',
        type: 'danger',
        title: 'Attendance Alert',
        message: `You've missed ${recentAbsences} classes recently. Consider reaching out for support.`,
        actionable: true
      });
    } else if (currentAttendance >= 95) {
      alerts.push({
        id: 'excellent-attendance',
        type: 'success',
        title: 'Outstanding Performance!',
        message: `Excellent! You maintain ${currentAttendance}% attendance.`,
        actionable: false
      });
    } else if (currentAttendance < 75) {
      alerts.push({
        id: 'low-attendance',
        type: 'warning',
        title: 'Attendance Below 75%',
        message: 'Your attendance is below the minimum requirement. Take action now!',
        actionable: true
      });
    }

    // Check if student hasn't marked attendance today
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendanceRecords.find(r => r.date === today);
    
    if (!todayAttendance && new Date().getHours() > 8) { // After 8 AM
      alerts.push({
        id: 'attendance-reminder',
        type: 'info',
        title: 'Daily Check-in Reminder',
        message: "Don't forget to mark your attendance for today's classes!",
        actionable: true
      });
    }
  }

  return alerts;
};

export const calculateClassComparison = async (
  studentAttendance: number,
  studentMarks: number,
  studentId?: string
): Promise<ClassComparison> => {
  try {
    // Fetch real class averages from API
    const response = await fetch('/api/analytics/class-averages', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        studentAttendance,
        classAverageAttendance: data.averageAttendance || 0,
        studentMarks,
        classAverageMarks: data.averageMarks || 0
      };
    }
  } catch (error) {
    console.error('Failed to fetch class averages:', error);
  }
  
  // Fallback to empty comparison if API fails
  return {
    studentAttendance,
    classAverageAttendance: 0,
    studentMarks,
    classAverageMarks: 0
  };
};

export const generateCalendarData = (
  attendanceRecords: AttendanceRecord[],
  year: number,
  month: number
): CalendarDay[] => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendar: CalendarDay[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayRecords = attendanceRecords.filter(record => record.date === dateStr);
    
    let status: 'present' | 'absent' | 'late' | undefined;
    if (dayRecords.length > 0) {
      // Determine overall day status based on majority
      const presentCount = dayRecords.filter(r => r.status === 'present').length;
      const absentCount = dayRecords.filter(r => r.status === 'absent').length;
      const lateCount = dayRecords.filter(r => r.status === 'late').length;
      
      if (presentCount >= absentCount && presentCount >= lateCount) {
        status = 'present';
      } else if (lateCount > absentCount) {
        status = 'late';
      } else {
        status = 'absent';
      }
    }

    calendar.push({
      date: dateStr,
      status,
      subjects: dayRecords.map(record => ({
        name: record.subject,
        time: record.time,
        status: record.status
      }))
    });
  }

  return calendar;
};

export const generatePDFData = (
  studentInfo: { name: string; id: string; class: string; email: string },
  attendanceData: { percentage: number; total: number; present: number; absent: number; late: number },
  marksData: Array<{ subject: string; marks: number; totalMarks: number; grade: string; percentage: number }>
) => {
  // This would integrate with a PDF library like jsPDF or react-pdf
  // For now, return structured data that can be used for PDF generation
  return {
    studentInfo: {
      name: studentInfo.name,
      id: studentInfo.id,
      class: studentInfo.class,
      email: studentInfo.email
    },
    attendance: {
      overall: attendanceData.percentage,
      totalClasses: attendanceData.total,
      present: attendanceData.present,
      absent: attendanceData.absent,
      late: attendanceData.late
    },
    marks: marksData,
    generatedDate: new Date().toLocaleDateString(),
    semester: new Date().getFullYear() + (new Date().getMonth() < 6 ? ' Spring' : ' Fall')
  };
};
