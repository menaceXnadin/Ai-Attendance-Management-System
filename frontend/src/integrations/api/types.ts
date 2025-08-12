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
  faculty_id?: number;       // Add faculty_id field for filtering
  semester?: number;
  year?: number;
  batch?: number;
  phone_number?: string;     // Add phone number field
  emergency_contact?: string; // Add emergency contact field
  profileImage?: string | null;
  face_encoding?: number[] | null; // Face encoding for recognition
}

export interface StudentCreateData {
  name: string;         // Maps to user.full_name 
  email: string;        // Maps to user.email
  password: string;     // Maps to user.password
  studentId: string;    // Maps to student_id
  faculty_id: number;   // Maps to faculty_id (required)
  semester: number;     // Maps to semester
  year: number;         // Maps to year
  batch: number;        // Maps to batch
  phone_number?: string;     // Maps to phone_number (optional)
  emergency_contact?: string; // Maps to emergency_contact (optional)
  // Legacy fields - can be removed in future
  rollNo?: string;      // Not used in backend
  role?: string;        // Not used in backend  
  profileImage?: string | null; // Not used in backend
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  description?: string;
  credits?: number;
  class_schedule?: Record<string, unknown>; // JSON schedule data
  faculty_id?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  subjectId: string;  // Fixed: should be subjectId, not classId
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  student?: Student;
  subject?: Subject;  // Fixed: should be subject, not class
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
