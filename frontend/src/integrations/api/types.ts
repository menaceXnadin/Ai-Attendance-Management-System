// Type definitions for the API client

export interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Student {
  id: string;
  name: string;
  rollNo: string;
  studentId: string;
  email: string;
  profileImage?: string | null;
}

export interface Class {
  id: string;
  name: string;
  description?: string;
  teacherId?: string;
  createdAt?: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  student?: Student;
  class?: Class;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  percentagePresent: number;
}

export interface AttendanceFilters {
  startDate?: string;
  endDate?: string;
  classId?: string;
  studentId?: string;
  date?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: string;
}
