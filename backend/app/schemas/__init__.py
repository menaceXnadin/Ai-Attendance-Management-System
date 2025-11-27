from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from enum import Enum

# Enums

class UserRole(str, Enum):
    ADMIN = "admin"
    STUDENT = "student"
    # Align with DB enum which stores teacher role as 'faculty'
    TEACHER = "faculty"
    FACULTY = "faculty"  # alias for clarity/compatibility

class AttendanceStatus(str, Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"

# New Enums for method and priority
class AttendanceMethod(str, Enum):
    MANUAL = "manual"
    FACE = "face"
    OTHER = "other"

class InsightPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class ExamType(str, Enum):
    MIDTERM = "midterm"
    FINAL = "final"
    QUIZ = "quiz"
    ASSIGNMENT = "assignment"

class NotificationType(str, Enum):
    INFO = "info"
    WARNING = "warning"
    SUCCESS = "success"
    DANGER = "danger"

# Base schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.STUDENT

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Student schemas
class StudentBase(BaseModel):
    student_id: Optional[str] = None  # Make optional - will be auto-generated if not provided
    faculty_id: int  # Make faculty_id required
    semester: int = 1  # Current semester (1-8)
    year: int = 1  # Current academic year (1-4)
    batch: int  # Year when student joined (e.g., 2025)
    phone_number: Optional[str] = None
    emergency_contact: Optional[str] = None

class StudentCreate(StudentBase):
    user: UserCreate

class StudentUpdate(BaseModel):
    faculty_id: Optional[int] = None  # Changed to faculty_id
    semester: Optional[int] = None
    year: Optional[int] = None
    batch: Optional[int] = None
    phone_number: Optional[str] = None
    emergency_contact: Optional[str] = None
    face_encoding: Optional[List[float]] = None
    profile_image_url: Optional[str] = None

class Student(StudentBase):
    id: int
    user_id: int
    profile_image_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    user: User
    
    class Config:
        from_attributes = True

# Admin schemas
class AdminBase(BaseModel):
    admin_id: str
    name: str
    department: Optional[str] = None
    permissions: Optional[Dict[str, Any]] = None

class AdminCreate(AdminBase):
    user: UserCreate

class Admin(AdminBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    user: User
    
    class Config:
        from_attributes = True

# Teacher schemas
class TeacherBase(BaseModel):
    # Optional on input; server will auto-generate when creating
    teacher_id: Optional[str] = None
    name: str
    faculty_id: Optional[int] = None
    department: Optional[str] = None
    phone_number: Optional[str] = None
    office_location: Optional[str] = None

class TeacherCreate(TeacherBase):
    user: UserCreate

class TeacherUpdate(BaseModel):
    faculty_id: Optional[int] = None
    department: Optional[str] = None
    phone_number: Optional[str] = None
    office_location: Optional[str] = None

class Teacher(TeacherBase):
    # In responses, teacher_id is always present
    teacher_id: str
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    user: User
    
    class Config:
        from_attributes = True

# Teacher Assignment schemas
class TeacherAssignmentResponse(BaseModel):
    """Response model for teacher's subject assignments"""
    id: int  # ClassSchedule ID
    subject_id: int
    subject_name: str
    subject_code: str
    faculty_id: int
    faculty_name: str
    semester: int
    day_of_week: str
    start_time: str
    end_time: str
    classroom: Optional[str]
    academic_year: int
    student_count: Optional[int] = 0
    time_slot_display: str
    
    class Config:
        from_attributes = True

class TeacherAssignmentCreate(BaseModel):
    """Create a teacher assignment by assigning them to a ClassSchedule"""
    schedule_id: int  # Existing ClassSchedule ID

# Subject schemas
class SubjectBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    credits: int = 3
    class_schedule: Optional[Dict[str, Any]] = None
    faculty_id: Optional[int] = None

class SubjectCreate(SubjectBase):
    pass

class Subject(SubjectBase):
    id: int
    created_at: datetime
    faculty_id: Optional[int] = None
    
    class Config:
        from_attributes = True

# Attendance schemas
class AttendanceRecordBase(BaseModel):
    date: datetime
    status: AttendanceStatus
    method: AttendanceMethod = AttendanceMethod.MANUAL
    confidence_score: Optional[float] = None
    marked_by: str = "face_recognition"
    notes: Optional[str] = None
    period: Optional[int] = None  # Period number for tracking multiple classes per day
    time_slot: Optional[str] = None  # Time slot string like "09:00-10:00"

class AttendanceRecordCreate(AttendanceRecordBase):
    student_id: int
    subject_id: int

class AttendanceRecord(AttendanceRecordBase):
    id: int
    student_id: int
    subject_id: int
    created_at: datetime
    student: Student
    subject: Subject
    
    class Config:
        from_attributes = True

# Mark schemas
class MarkBase(BaseModel):
    exam_type: ExamType
    marks_obtained: float
    total_marks: float
    grade: Optional[str] = None
    exam_date: datetime

class MarkCreate(MarkBase):
    student_id: int
    subject_id: int

class Mark(MarkBase):
    id: int
    student_id: int
    subject_id: int
    created_at: datetime
    student: Student
    subject: Subject
    
    class Config:
        from_attributes = True

# Face Recognition schemas
class FaceRecognitionRequest(BaseModel):
    image_data: str  # Base64 encoded image
    subject_id: int

class FaceRegistrationRequest(BaseModel):
    image_data: Union[str, List[str]]  # Single Base64 string or list of Base64 encoded images
    
class MultiImageFaceRegistrationRequest(BaseModel):
    images: List[str]  # List of Base64 encoded images

class FaceRecognitionResponse(BaseModel):
    success: bool
    student_id: Optional[int] = None
    confidence_score: Optional[float] = None
    message: str
    attendance_marked: bool = False

# Authentication schemas
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

# Password Reset schemas
class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

class PasswordResetResponse(BaseModel):
    success: bool
    message: str
    reset_token: Optional[str] = None
    reset_url: Optional[str] = None

# Dashboard schemas
class AttendanceStats(BaseModel):
    total_classes: int
    present_days: int
    absent_days: int
    late_days: int
    attendance_percentage: float

class StudentDashboard(BaseModel):
    student: Student
    attendance_stats: AttendanceStats
    recent_attendance: List[AttendanceRecord]
    upcoming_exams: List[Dict[str, Any]]
    ai_insights: List[Dict[str, Any]]

class AIInsightBase(BaseModel):
    insight_type: str
    title: str
    description: str
    data: Optional[Dict[str, Any]] = None
    confidence: Optional[float] = None
    priority: InsightPriority = InsightPriority.MEDIUM

class AIInsight(AIInsightBase):
    id: int
    student_id: int
    is_active: bool
    created_at: datetime
    expires_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Faculty schemas
class FacultyBase(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None

class FacultyCreate(BaseModel):
    name: str
    code: str  # Required for creation
    description: Optional[str] = None

class FacultyOut(FacultyBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True
