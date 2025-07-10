export interface AttendanceRecord {
  date: string;
  subject: string;
  status: 'present' | 'absent' | 'late';
  time: string;
}

export interface AttendancePrediction {
  currentPercentage: number;
  projectedPercentage: number;
  totalClasses: number;
  presentDays: number;
  remainingClasses: number;
}

export interface SmartAlert {
  id: string;
  type: 'warning' | 'success' | 'info' | 'danger';
  title: string;
  message: string;
  actionable?: boolean;
}

export interface ClassComparison {
  studentAttendance: number;
  classAverageAttendance: number;
  studentMarks: number;
  classAverageMarks: number;
}

export interface CalendarDay {
  date: string;
  status?: 'present' | 'absent' | 'late';
  subjects?: Array<{
    name: string;
    time: string;
    status: 'present' | 'absent' | 'late';
  }>;
}
