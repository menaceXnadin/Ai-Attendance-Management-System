import { AttendanceRecord, AttendancePrediction, SmartAlert, ClassComparison, CalendarDay } from '@/types/dashboard';

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

export const generateSmartAlerts = (
  attendanceRecords: AttendanceRecord[],
  currentAttendance: number
): SmartAlert[] => {
  const alerts: SmartAlert[] = [];
  
  // Check recent attendance pattern (last 7 days)
  const recentRecords = attendanceRecords
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);
  
  const recentAbsences = recentRecords.filter(r => r.status === 'absent').length;
  const recentPresent = recentRecords.filter(r => r.status === 'present').length;
  
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

  return alerts;
};

export const calculateClassComparison = (
  studentAttendance: number,
  studentMarks: number
): ClassComparison => {
  // Mock class averages - in real app, this would come from API
  const classAverageAttendance = 82.5;
  const classAverageMarks = 78.2;

  return {
    studentAttendance,
    classAverageAttendance,
    studentMarks,
    classAverageMarks
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
    semester: 'Spring 2024'
  };
};
