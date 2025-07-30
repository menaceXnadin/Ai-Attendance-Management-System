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

export interface Faculty {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
}

export interface Student {
  id: string;
  name: string;
  rollNo: string;
  studentId: string;
  student_id?: string; // Backend sends this field
  email: string;
  faculty?: string;
  semester?: number;
  year?: number;
  batch?: number;
  profileImage?: string | null;
  face_encoding?: number[] | null; // Face encoding for recognition
}

export interface StudentCreateData {
  name: string;
  rollNo: string;
  studentId: string;
  email: string;
  password: string;
  role: string;
  faculty_id?: number;  // Changed to faculty_id
  semester?: number;
  year?: number;
  batch?: number;
  profileImage?: string | null;
}

export interface Class {
  id: string;
  name: string;
  description?: string;
  teacherId?: string;
  createdAt?: string;
  faculty_id?: number;
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

// Face Recognition types
export interface FaceRecognitionResult {
  success: boolean;
  message: string;
  attendanceMarked?: boolean;
  studentId?: string;
  confidenceScore?: number;
}

export interface FaceRegistrationResult {
  success: boolean;
  message: string;
}

export interface FaceVerificationResult {
  valid: boolean;
  message: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  subjectId: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  confidenceScore: number;
  markedBy: string;
}
