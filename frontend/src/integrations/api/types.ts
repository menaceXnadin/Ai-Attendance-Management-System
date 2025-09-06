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
  // Optional timestamps for accurate time displays
  timeIn?: string;   // HH:MM:SS when attendance was marked (from backend time_in)
  timeOut?: string;  // HH:MM:SS when student left (from backend time_out)
  createdAt?: string; // ISO datetime when record was created (from backend created_at)
  student?: Student;
  subject?: Subject;  // Fixed: should be subject, not class
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused?: number;
  total?: number;
  percentage_present: number;
  // Backend response fields from student-attendance API
  total_academic_days?: number;
  total_periods?: number;
  total_marked?: number;
  percentage_absent?: number;
  percentage_late?: number;
  average_confidence?: number;
  academic_metrics?: {
    total_academic_days: number;
    total_periods: number;
    class_days_breakdown?: Array<{
      date: string;
      day_of_week: string;
      periods_count: number;
    }>;
  };
  // Backward compatibility
  percentagePresent?: number;
  // New semester-based fields
  days_with_any_attendance?: number;
  partial_attendance_percentage?: number;
  semester_start_date?: string;
  semester_end_date?: string;
  // Record-based metrics for detailed views
  present_records?: number;
  absent_records?: number;
  late_records?: number;
  excused_records?: number;
  total_records?: number;
  percentage_present_records?: number;
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

// Schedule types
export enum DayOfWeek {
  SUNDAY = 'sunday',
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday'
}

export interface Schedule {
  id: number;
  subject_id: number;
  subject_name: string;
  subject_code: string;
  faculty_id: number;
  faculty_name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  semester: number;
  academic_year: number;
  classroom?: string;
  instructor_name?: string;
  is_active: boolean;
  notes?: string;
  duration_minutes: number;
  time_slot_display: string;
}

export interface ScheduleCreateData {
  subject_id: number;
  faculty_id: number;
  day_of_week: string;
  start_time: string;
  end_time: string;
  semester: number;
  academic_year: number;
  classroom?: string;
  instructor_name?: string;
  notes?: string;
}

export interface ScheduleFilters {
  faculty_id?: number;
  semester?: number;
  academic_year?: number;
  day_of_week?: string;
  is_active?: boolean;
}

export interface SemesterConfiguration {
  id: number;
  semester_number: number;
  academic_year: number;
  semester_name: string;
  start_date: string;
  end_date: string;
  total_weeks?: number;
  exam_week_start?: string;
  exam_week_end?: string;
  is_current: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: number;
}

export interface SemesterConfigurationCreateData {
  semester_number: number;
  academic_year: number;
  semester_name: string;
  start_date: string;
  end_date: string;
  total_weeks?: number;
  exam_week_start?: string;
  exam_week_end?: string;
  is_current?: boolean;
  is_active?: boolean;
}

export interface SemesterConfigurationUpdateData {
  semester_number?: number;
  academic_year?: number;
  semester_name?: string;
  start_date?: string;
  end_date?: string;
  total_weeks?: number;
  exam_week_start?: string;
  exam_week_end?: string;
  is_current?: boolean;
  is_active?: boolean;
}
