/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Attendance,
  AttendanceFilters,
  AttendanceSummary,
  Student,
  StudentCreateData,
  Subject,
  AuthResponse,
  User,
  RegisterData,
} from './types';

// Vite dev server proxies "/api" to FastAPI at http://127.0.0.1:8000
const API_BASE = '/api';

// Core fetch wrapper that injects Authorization header and parses JSON
const apiRequest = async <T = any>(
  path: string,
  options: (RequestInit & { skipAuth?: boolean; _retry?: boolean }) = {}
): Promise<T> => {
  const tokenRaw = localStorage.getItem('authToken');
  const token = tokenRaw ? tokenRaw.trim() : tokenRaw;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  
  // Always include Authorization header if token exists and skipAuth is not true
  if (!options.skipAuth && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    // Ensure credentials are included for CORS
    credentials: 'include',
  });

  // Handle authentication errors
  if (res.status === 401 || res.status === 403) {
    const errorText = await res.text().catch(() => '');
    console.warn(`[API] Authentication error ${res.status}:`, errorText || res.statusText);

    // Try to parse error details
    let errorDetails: any;
    try {
      errorDetails = errorText ? JSON.parse(errorText) : null;
    } catch {
      errorDetails = { detail: errorText || 'Authentication failed' };
    }

    // Attempt a one-time token refresh on 401/403 if not already retried
    const shouldAttemptRefresh = !options.skipAuth && !options._retry && (res.status === 401 || res.status === 403);
    if (shouldAttemptRefresh) {
      try {
        // Lazy import via existing api reference below
        const refreshed = await api.auth.refreshToken();
        if (refreshed?.token) {
          // Retry original request with _retry flag to avoid loops
          return await apiRequest<T>(path, { ...options, _retry: true });
        }
      } catch (refreshErr) {
        console.warn('[API] Token refresh failed:', refreshErr);
        // fall through to throw original auth error
      }
    }

    // If it's a 401, the token might be expired - clear it
    if (res.status === 401) {
      localStorage.removeItem('authToken');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        console.warn('[API] Token expired, clearing localStorage');
      }
    }

    const error = new Error(errorDetails?.detail || 'Not authenticated');
    (error as any).status = res.status;
    (error as any).response = { status: res.status, data: errorDetails };
    throw error;
  }

  // Handle other HTTP errors
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    let errorDetails;
    try {
      errorDetails = errorText ? JSON.parse(errorText) : null;
    } catch {
      errorDetails = { detail: errorText || `Request failed: ${res.status}` };
    }
    
    const error = new Error(errorDetails?.detail || `Request failed: ${res.status}`);
    (error as any).status = res.status;
    (error as any).response = { status: res.status, data: errorDetails };
    throw error;
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    return data as T;
  }
  const text = await res.text();
  return text as unknown as T;
};

// Helpers for token validation (best-effort checks)
const base64UrlDecode = (input: string): string => {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';
  else if (pad !== 0) base64 += '===';
  return atob(base64);
};

const isValidTokenFormat = (token: string): boolean => {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
};

const isTokenLikelyExpired = (token: string): boolean => {
  try {
    if (!isValidTokenFormat(token)) return true;
    const parts = token.split('.');
    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1000);
    return !!(payload.exp && payload.exp < now);
  } catch {
    return true;
  }
};

// API client methods
export const api = {
  // Auth methods
  auth: {
    login: async (email: string, password: string): Promise<AuthResponse> => {
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true, // Don't include auth header for login
      });

      // Validate response structure
      if (!response || !response.access_token) {
        throw new Error('Invalid login response: missing access token');
      }

      // Store token in localStorage
      localStorage.setItem('authToken', response.access_token);
      
      // Log successful login (remove in production)
      console.log('[AUTH] Login successful for:', response.user?.email);

      return {
        user: {
          id: response.user.id.toString(),
          name: response.user.full_name,
          email: response.user.email,
          role: response.user.role,
        },
        token: response.access_token,
      };
    },

    register: async (userData: RegisterData): Promise<AuthResponse> => {
      try {
        const response = await apiRequest('/auth/register-student', {
          method: 'POST',
          body: JSON.stringify({
            user: {
              email: userData.email,
              full_name: userData.name,
              password: userData.password,
            },
            student_id: `STU${Date.now()}`,
            class_name: 'General',
            year: new Date().getFullYear(),
            phone_number: '',
            emergency_contact: '',
          }),
        });

        return {
          user: {
            id: response.user_id?.toString() || '',
            name: response.user?.full_name || userData.name,
            email: response.user?.email || userData.email,
            role: 'student',
          },
          token: '', // No token returned from registration
        };
      } catch (error) {
        throw new Error('Registration failed');
      }
    },

    logout: (): Promise<void> => {
      localStorage.removeItem('authToken');
      return Promise.resolve();
    },

    getUser: async (): Promise<User> => {
      try {
        const response = await apiRequest('/auth/me');
        return {
          id: response.id.toString(),
          name: response.full_name,
          email: response.email,
          role: response.role,
        };
      } catch (error) {
        throw new Error('Failed to get user');
      }
    },

    refreshToken: async (): Promise<AuthResponse> => {
      try {
        const response = await apiRequest('/auth/refresh-token', {
          method: 'POST',
          skipAuth: false, // Include auth header but prevent retry
          _retry: true, // Prevent infinite loop by marking as retry
        });

        localStorage.setItem('authToken', response.access_token);

        return {
          user: {
            id: response.user.id.toString(),
            name: response.user.full_name,
            email: response.user.email,
            role: response.user.role,
          },
          token: response.access_token,
        };
      } catch (error) {
        localStorage.removeItem('authToken');
        throw new Error('Failed to refresh token');
      }
    },

    checkAuthStatus: async (): Promise<boolean> => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token || isTokenLikelyExpired(token)) return false;
        await api.auth.getUser();
        return true;
      } catch {
        return false;
      }
    },
  },

  // Students methods
  students: {
    getAll: async (): Promise<Student[]> => {
      const response = await apiRequest('/students/?limit=1000');
      if (!response || !Array.isArray(response)) return [];
      return response.map((student: Record<string, unknown>) => {
        const user = (student.user as Record<string, unknown>) || {};
        const fullName = user?.full_name ? String(user.full_name) : '';
        const email = user?.email ? String(user.email) : '';
        const studentId = student.student_id ? String(student.student_id) : '';
        const faculty = student.faculty ? String(student.faculty) : 'Unknown Faculty';
        return {
          id: student.id?.toString() || '',
          name: fullName,
          email,
          rollNo: `R-${studentId}`,
          studentId,
          faculty,
          faculty_id: student.faculty_id ? Number(student.faculty_id) : 0,
          semester: student.semester ? Number(student.semester) : 1,
          year: student.year ? Number(student.year) : 1,
          batch: student.batch ? Number(student.batch) : new Date().getFullYear(),
          phone_number: student.phone_number?.toString() || '',
          emergency_contact: student.emergency_contact?.toString() || '',
          profileImage: student.profile_image_url?.toString() || '',
          face_encoding: Array.isArray(student.face_encoding) ? (student.face_encoding as number[]) : null,
        } as Student;
      });
    },

    getById: async (id: string): Promise<Student> => {
      const response = await apiRequest(`/students/${id}`);
      return {
        id: response.id.toString(),
        name: response.user ? response.user.full_name : '',
        email: response.user ? response.user.email : '',
        rollNo: `R-${response.student_id}`,
        studentId: response.student_id,
        faculty: response.faculty || 'Unknown Faculty',
        semester: response.semester || 1,
        year: response.year || 1,
        batch: response.batch || new Date().getFullYear(),
        phone_number: response.phone_number || '',
        emergency_contact: response.emergency_contact || '',
        profileImage: response.profile_image_url || '',
        face_encoding: Array.isArray(response.face_encoding) ? (response.face_encoding as number[]) : null,
      } as Student;
    },

    create: async (studentData: StudentCreateData): Promise<Student> => {
      const response = await apiRequest('/students/', {
        method: 'POST',
        body: JSON.stringify({
          user: {
            email: studentData.email,
            full_name: studentData.name,
            password: studentData.password,
          },
          student_id: studentData.studentId,
          faculty_id: studentData.faculty_id,
          semester: studentData.semester || 1,
          year: studentData.year || 1,
          batch: studentData.batch || new Date().getFullYear(),
          phone_number: studentData.phone_number || null,
          emergency_contact: studentData.emergency_contact || null,
        }),
      });

      return {
        id: response.id.toString(),
        name: response.user ? response.user.full_name : studentData.name,
        email: response.user ? response.user.email : studentData.email,
        rollNo: `R-${response.student_id}`,
        studentId: response.student_id,
        faculty: response.faculty || 'Unknown',
        semester: response.semester || studentData.semester,
        year: response.year || studentData.year,
        batch: response.batch || studentData.batch,
        profileImage: response.profile_image_url || '',
      } as Student;
    },

    update: async (id: string, updateData: Record<string, unknown>) => {
      const response = await apiRequest(`/students/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      return {
        id: response.id.toString(),
        name: response.user ? response.user.full_name : '',
        email: response.user ? response.user.email : '',
        rollNo: `R-${response.student_id}`,
        studentId: response.student_id,
        faculty: response.faculty || 'Unknown Faculty',
        semester: response.semester || 1,
        year: response.year || 1,
        batch: response.batch || new Date().getFullYear(),
        profileImage: response.profile_image_url || '',
      } as Student;
    },

    delete: async (id: string): Promise<void> => {
      if (!id || id.trim() === '') throw new Error(`Invalid student ID: ${id}`);
      await apiRequest(`/students/${id}`, { method: 'DELETE' });
    },
  },

  // Attendance methods (unified, snake_case params, no trailing slash)
  attendance: {
    getAll: async (filters: AttendanceFilters = {}): Promise<Attendance[]> => {
      const params = new URLSearchParams();
      if (filters.studentId) params.append('student_id', filters.studentId);
      if (filters.date) params.append('date', filters.date);
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      const endpoint = params.toString() ? `/attendance?${params}` : '/attendance';
      const response = await apiRequest(endpoint);
      return (Array.isArray(response) ? response : []).map((record: Record<string, unknown>) => ({
        id: record?.id?.toString?.() || '',
        studentId: record?.student_id?.toString?.() || record?.studentId?.toString?.() || '',
        subjectId: record?.subjectId?.toString?.() || record?.subject_id?.toString?.() || record?.class_id?.toString?.() || '',
        subjectName: (record as any)?.subjectName?.toString?.() || (record as any)?.subject_name?.toString?.(),
        subjectCode: (record as any)?.subjectCode?.toString?.() || (record as any)?.subject_code?.toString?.(),
        date: (record?.date ?? '').toString(),
        status: (record?.status ?? 'absent') as Attendance['status'],
        timeIn: (record as any)?.timeIn?.toString?.() || (record as any)?.time_in?.toString?.(),
        timeOut: (record as any)?.timeOut?.toString?.() || (record as any)?.time_out?.toString?.(),
        createdAt: (record as any)?.createdAt?.toString?.() || (record as any)?.created_at?.toString?.(),
      }));
    },

    getById: async (id: string): Promise<Attendance> => {
      const response = await apiRequest(`/attendance/${id}`);
      return {
        id: response.id.toString(),
        studentId: response.student_id?.toString() || response.studentId?.toString(),
        subjectId: response.subject_id?.toString() || response.class_id?.toString() || '',
        date: response.date,
        status: response.status,
        timeIn: (response as any)?.timeIn || (response as any)?.time_in,
        timeOut: (response as any)?.timeOut || (response as any)?.time_out,
        createdAt: (response as any)?.createdAt || (response as any)?.created_at,
      } as Attendance;
    },

    create: async (attendance: Omit<Attendance, 'id'>) => {
      const response = await apiRequest('/attendance', {
        method: 'POST',
        body: JSON.stringify({
          student_id: parseInt(attendance.studentId),
          subject_id: parseInt(attendance.subjectId),
          date: attendance.date,
          status: attendance.status,
        }),
      });
      return {
        id: response.id.toString(),
        studentId: response.student_id?.toString() || '',
        subjectId: (response.subject_id ?? response.class_id)?.toString?.() || '',
        date: response.date,
        status: response.status,
        timeIn: (response as any)?.timeIn || (response as any)?.time_in,
        timeOut: (response as any)?.timeOut || (response as any)?.time_out,
        createdAt: (response as any)?.createdAt || (response as any)?.created_at,
      } as Attendance;
    },

    getSummary: async (filters: AttendanceFilters = {}): Promise<AttendanceSummary> => {
      const params = new URLSearchParams();
      if (filters.studentId) params.append('student_id', filters.studentId);
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      const endpoint = params.toString()
        ? `/attendance/summary?${params}`
        : '/attendance/summary';
      const response = await apiRequest(endpoint);
      return {
        present: response.present || 0,
        absent: response.absent || 0,
        late: response.late || 0,
        excused: response.excused || 0,
        total: response.total || 0,
        percentagePresent: response.percentage_present ?? response.percentagePresent ?? 0,
      } as AttendanceSummary;
    },

    getCalendar: async (year: number, month: number) => {
      console.log('API: Calling attendance calendar with:', { year, month });
      try {
        const response = await apiRequest(`/attendance/calendar?year=${year}&month=${month}`);
        console.log('API: Calendar response received:', response);
        
        // The backend returns { calendar_data: [...], month: X, year: Y }
        // We need to extract calendar_data
        return {
          calendar_data: response.calendar_data || response || []
        };
      } catch (error) {
        console.error('API: Calendar request failed:', error);
        return {
          calendar_data: []
        };
      }
    },

    getStudentsBySubject: async (
      facultyId: number,
      semester: number,
      subjectId: number,
      date?: string
    ) => {
      const params = new URLSearchParams({
        faculty_id: facultyId.toString(),
        semester: semester.toString(),
        subject_id: subjectId.toString(),
      });
      if (date) params.append('date', date);
      return apiRequest(`/attendance/students-by-subject?${params}`);
    },

    markBulk: async (attendanceData: {
      subject_id: number;
      date?: string;
      students: Array<{ student_id: number; status: string }>;
    }) => {
      return apiRequest('/attendance/mark-bulk', {
        method: 'POST',
        body: JSON.stringify(attendanceData),
      });
    },

    getStudentSubjectBreakdown: async (studentId: number) => {
      return apiRequest(`/attendance/student-subject-breakdown/${studentId}`);
    },
  },



  // Classes methods (legacy wrapper around subjects)
  classes: {
    getAll: async (): Promise<Subject[]> => {
      const response = await apiRequest('/classes');
      return (response as unknown[]).map((cls: Record<string, unknown>) => ({
        id: cls.id?.toString() || '',
        name: cls.name?.toString() || '',
        code: cls.code?.toString() || '',
        description: cls.description?.toString(),
        credits: cls.credits ? Number(cls.credits) : undefined,
        faculty_id: cls.faculty_id !== undefined ? Number(cls.faculty_id) : undefined,
      }));
    },

    getById: async (id: string): Promise<Subject> => {
      const response = await apiRequest(`/classes/${id}`);
      return {
        id: response.id.toString(),
        name: response.name,
        code: response.code || '',
        description: response.description,
        credits: response.credits ? Number(response.credits) : undefined,
        faculty_id: response.faculty_id !== undefined ? Number(response.faculty_id) : undefined,
      } as Subject;
    },

    create: async (classData: Omit<Subject, 'id'>) => {
      const response = await apiRequest('/classes', {
        method: 'POST',
        body: JSON.stringify({
          name: classData.name,
          code: classData.code,
          description: classData.description,
          credits: classData.credits,
          faculty_id: classData.faculty_id,
        }),
      });
      return {
        id: response.id.toString(),
        name: response.name,
        code: response.code || '',
        description: response.description,
        credits: response.credits ? Number(response.credits) : undefined,
        faculty_id: response.faculty_id !== undefined ? Number(response.faculty_id) : undefined,
      } as Subject;
    },

    update: async (id: string, classData: Partial<Subject>) => {
      const updateData: Record<string, unknown> = {};
      if (classData.name) updateData.name = classData.name;
      if (classData.code) updateData.code = classData.code;
      if (classData.description) updateData.description = classData.description;
      if (classData.credits !== undefined) updateData.credits = classData.credits;
      if (classData.faculty_id !== undefined) updateData.faculty_id = classData.faculty_id;

      const response = await apiRequest(`/classes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      return {
        id: response.id.toString(),
        name: response.name,
        code: response.code || '',
        description: response.description,
        credits: response.credits ? Number(response.credits) : undefined,
        faculty_id: response.faculty_id !== undefined ? Number(response.faculty_id) : undefined,
      } as Subject;
    },

    delete: async (id: string): Promise<void> => {
      await apiRequest(`/classes/${id}`, { method: 'DELETE' });
    },
  },

  // Face Recognition methods
  faceRecognition: {
    markAttendance: async (imageData: string, subjectId: string) => {
      const response = await apiRequest('/face-recognition/mark-attendance', {
        method: 'POST',
        body: JSON.stringify({
          image_data: imageData,
          subject_id: parseInt(subjectId),
        }),
      });
      return {
        success: response.success,
        message: response.message,
        attendanceMarked: response.attendance_marked,
        studentId: response.student_id?.toString(),
        confidenceScore: response.confidence_score,
      };
    },

    registerFace: async (imageData: string | string[] | { image_data: string | string[] }) => {
      let requestBody: Record<string, unknown>;
      if (typeof imageData === 'string') {
        requestBody = { image_data: imageData };
      } else if (Array.isArray(imageData)) {
        requestBody = { image_data: imageData };
      } else {
        requestBody = imageData;
      }
      const response = await apiRequest('/face-recognition/register-face', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      return {
        success: response.success,
        message: response.message,
        details: response.details,
      };
    },

    registerFaceMulti: async (images: string[]) => {
      const response = await apiRequest('/face-recognition/register-face-multi', {
        method: 'POST',
        body: JSON.stringify({ images }),
      });
      return {
        success: response.success,
        message: response.message,
        details: response.details,
      };
    },

    detectGlasses: async (imageData: string) => {
      const response = await apiRequest('/face-recognition/detect-glasses', {
        method: 'POST',
        body: JSON.stringify({ image_data: imageData }),
      });
      return {
        success: response.success,
        message: response.message,
        glasses_detected: response.glasses_detected,
        confidence: response.confidence,
        all_attributes: response.all_attributes,
      };
    },

    verifyFace: async (imageData: string) => {
      const response = await apiRequest('/face-recognition/verify-face', {
        method: 'POST',
        body: JSON.stringify({ image_data: imageData }),
      });
      return {
        valid: response.valid,
        message: response.message,
      };
    },

    getMyAttendance: async () => {
      const response = await apiRequest('/face-recognition/my-attendance');
      return (response as unknown[]).map((record: Record<string, unknown>) => ({
        id: record.id?.toString() || '',
        studentId: record.student_id?.toString() || '',
        subjectId: record.subject_id?.toString() || '',
        date: record.date?.toString() || '',
        status: (record.status?.toString() || 'absent') as Attendance['status'],
        confidenceScore: (record.confidence_score as number) || 0,
        markedBy: record.marked_by?.toString() || '',
      }));
    },

    detectFaces: async (imageData: string) => {
      const response = await apiRequest('/face-recognition/detect-faces', {
        method: 'POST',
        body: JSON.stringify({ image_data: imageData }),
      });
      return {
        success: response.success,
        message: response.message,
        faces_detected: response.faces_detected,
        faces: response.faces,
        feedback: response.feedback,
        ready_for_capture: response.ready_for_capture,
      };
    },
  },

  // Subjects methods
  subjects: {
    getAll: async (facultyId?: number) => {
      // Use trailing slash to avoid 307 redirect (which can drop Authorization header across proxy)
      const params = facultyId ? `?faculty_id=${facultyId}` : '';
      return apiRequest(`/subjects/${params}`);
    },

    getByFaculty: async (facultyId: number) => {
      return apiRequest(`/subjects/by-faculty?faculty_id=${facultyId}`);
    },

    getByFacultySemester: async (facultyId: number, semester?: number) => {
      const params = new URLSearchParams({ faculty_id: facultyId.toString() });
      if (semester) params.append('semester', semester.toString());
      return apiRequest(`/subjects/by-faculty-semester?${params}`);
    },

    create: async (subjectData: {
      name: string;
      code: string;
      description?: string;
      credits?: number;
      faculty_id?: number;
      class_schedule?: Record<string, unknown>;
    }) => {
      return apiRequest('/subjects/', {
        method: 'POST',
        body: JSON.stringify(subjectData),
      });
    },

    getById: async (subjectId: number) => {
      return apiRequest(`/subjects/${subjectId}`);
    },

    delete: async (subjectId: number) => {
      return apiRequest(`/subjects/${subjectId}`, { method: 'DELETE' });
    },
  },

  // Enhanced attendance methods for admins
  attendanceAdmin: {
    getStudentsBySubject: async (
      facultyId: number,
      semester: number,
      subjectId: number,
      date?: string
    ) => {
      const params = new URLSearchParams({
        faculty_id: facultyId.toString(),
        semester: semester.toString(),
        subject_id: subjectId.toString(),
      });
      if (date) params.append('date', date);
      return apiRequest(`/attendance/students-by-subject?${params}`);
    },

    markBulkAttendance: async (attendanceData: {
      subject_id: number;
      date?: string;
      students: Array<{ student_id: number; status: string }>;
    }) => {
      return apiRequest('/attendance/mark-bulk', {
        method: 'POST',
        body: JSON.stringify(attendanceData),
      });
    },
  },

  // Faculties methods
  faculties: {
    getAll: async () => apiRequest('/faculties/'),
    create: async (facultyData: { name: string; description?: string }) =>
      apiRequest('/faculties/', { method: 'POST', body: JSON.stringify(facultyData) }),
    delete: async (facultyId: number) => apiRequest(`/faculties/${facultyId}`, { method: 'DELETE' }),
  },

  // Schedules methods
  schedules: {
    getStudentToday: async () => {
      const today = new Date();
      const dayOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][today.getDay()];
      return apiRequest(`/schedules/student/today?day=${dayOfWeek}`);
    },

    getByFacultyAndSemester: async (facultyId: number, semester: number, dayOfWeek?: string) => {
      const params = new URLSearchParams({
        faculty_id: facultyId.toString(),
        semester: semester.toString(),
      });
      if (dayOfWeek) params.append('day_of_week', dayOfWeek);
      return apiRequest(`/schedules?${params}`);
    },

    getAll: async (filters: {
      faculty_id?: number | string;
      semester?: number | string;
      day_of_week?: string;
      academic_year?: number | string;
      is_active?: boolean | string;
      skip?: number;
      limit?: number;
    } = {}) => {
      const params = new URLSearchParams();
      if (filters.faculty_id !== undefined && filters.faculty_id !== 'all') params.append('faculty_id', String(filters.faculty_id));
      if (filters.semester !== undefined && filters.semester !== 'all') params.append('semester', String(filters.semester));
      if (filters.day_of_week && filters.day_of_week !== 'all') params.append('day_of_week', filters.day_of_week);
      if (filters.academic_year) params.append('academic_year', String(filters.academic_year));
      if (filters.is_active !== undefined && filters.is_active !== 'all') params.append('is_active', String(filters.is_active));
      if (typeof filters.skip === 'number') params.append('skip', String(filters.skip));
      if (typeof filters.limit === 'number') params.append('limit', String(filters.limit));
      const endpoint = params.toString() ? `/schedules?${params}` : '/schedules';
      return apiRequest(endpoint);
    },

    create: async (data: {
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
    }) => {
      return apiRequest('/schedules', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    update: async (id: number, data: Partial<{
      subject_id: number;
      faculty_id: number;
      day_of_week: string;
      start_time: string;
      end_time: string;
      semester: number;
      academic_year: number;
      classroom?: string;
      instructor_name?: string;
      is_active?: boolean;
      notes?: string;
    }>) => {
      return apiRequest(`/schedules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    delete: async (id: number) => {
      return apiRequest(`/schedules/${id}`, {
        method: 'DELETE',
      });
    },

    toggle: async (id: number) => {
      return apiRequest(`/schedules/${id}/toggle`, {
        method: 'POST',
      });
    },
  },

  // Dashboard and sidebar statistics
  dashboard: {
    getSidebarStats: async () => apiRequest('/sidebar/stats'),
    getDashboardStats: async () => apiRequest('/dashboard/stats'),
    getSystemHealth: async () => apiRequest('/system/health'),
    getStudentPerformance: async () => apiRequest('/student-performance/'),
    getRealtimeMetrics: async () => apiRequest('/realtime/metrics'),
  },



  // Student Attendance methods (comprehensive)
  studentAttendance: {
    getSummary: async () => {
      return apiRequest('/student-attendance/summary');
    },

    getRecords: async (filters: {
      startDate?: string;
      endDate?: string;
      subjectId?: number;
      status?: string;
      limit?: number;
      offset?: number;
    } = {}) => {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      if (filters.subjectId) params.append('subject_id', filters.subjectId.toString());
      if (filters.status) params.append('status', filters.status);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const endpoint = params.toString() ? `/student-attendance/records?${params}` : '/student-attendance/records';
      return apiRequest(endpoint);
    },

    getSubjectBreakdown: async () => {
      return apiRequest('/student-attendance/subject-breakdown');
    },

    getAnalytics: async (period: string = 'semester') => {
      return apiRequest(`/student-attendance/analytics?period=${period}`);
    },

    getGoals: async () => {
      return apiRequest('/student-attendance/goals');
    },
  },

  // Academic Metrics methods
  academicMetrics: {
    getCurrentSemester: async () => {
      const response = await apiRequest('/academic-metrics/current-semester');
      // Handle wrapped response format: { success: true, data: {...}, semester_info: {...} }
      return response.data || response;
    },

    getSummary: async (startDate: string, endDate: string, semester?: number, academicYear?: number) => {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      if (semester) params.append('semester', semester.toString());
      if (academicYear) params.append('academic_year', academicYear.toString());
      return apiRequest(`/academic-metrics/summary?${params}`);
    },

    calculate: async (startDate: string, endDate: string, semester?: number, academicYear?: number) => {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      if (semester) params.append('semester', semester.toString());
      if (academicYear) params.append('academic_year', academicYear.toString());
      const response = await apiRequest(`/academic-metrics/calculate?${params}`);
      // Handle wrapped response format: { success: true, data: {...} }
      return response.data || response;
    },

    getDetailedBreakdown: async (startDate: string, endDate: string, semester?: number, academicYear?: number) => {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      if (semester) params.append('semester', semester.toString());
      if (academicYear) params.append('academic_year', academicYear.toString());
      const response = await apiRequest(`/academic-metrics/detailed-breakdown?${params}`);
      // Handle wrapped response format: { success: true, data: {...} }
      return response.data || response;
    },

    validateData: async (startDate: string, endDate: string) => {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      const response = await apiRequest(`/academic-metrics/validate-data?${params}`);
      // Handle wrapped response format: { success: true, validation: {...} }
      return response.validation || response;
    },
  },

  // Semester Configuration methods
  semesterConfiguration: {
    getAll: async () => {
      return apiRequest('/admin/semester-config/');
    },

    create: async (data: {
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
    }) => {
      return apiRequest('/admin/semester-config/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    update: async (id: number, data: {
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
    }) => {
      return apiRequest(`/admin/semester-config/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    delete: async (id: number) => {
      return apiRequest(`/admin/semester-config/${id}`, {
        method: 'DELETE',
      });
    },

    setCurrent: async (id: number) => {
      return apiRequest(`/admin/semester-config/${id}/set-current`, {
        method: 'POST',
      });
    },
  },

  // Analytics methods
  analytics: {
    getStudentInsights: async (studentId: number) => {
      return apiRequest(`/analytics/student-insights/${studentId}`);
    },

    getAttendanceTrends: async (studentId?: number, days: number = 30) => {
      const params = new URLSearchParams();
      if (studentId) params.append('student_id', studentId.toString());
      if (days !== 30) params.append('days', days.toString());
      const endpoint = params.toString() ? `/analytics/attendance-trends?${params}` : '/analytics/attendance-trends';
      return apiRequest(endpoint);
    },

    getClassAverages: async (classId?: number) => {
      const params = new URLSearchParams();
      if (classId) params.append('class_id', classId.toString());
      const endpoint = params.toString() ? `/analytics/class-averages?${params}` : '/analytics/class-averages';
      return apiRequest(endpoint);
    },
  },
};

// Helper client for services that need axios-like interface
export const apiClient = {
  get: async <T = any>(path: string): Promise<{ data: T }> => {
    const data = await apiRequest<T>(path);
    return { data };
  },
  post: async <T = any>(path: string, body?: any): Promise<{ data: T }> => {
    const data = await apiRequest<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    return { data };
  },
  put: async <T = any>(path: string, body?: any): Promise<{ data: T }> => {
    const data = await apiRequest<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
    return { data };
  },
  delete: async <T = any>(path: string): Promise<{ data: T }> => {
    const data = await apiRequest<T>(path, { method: 'DELETE' });
    return { data };
  },
};

// Local type to satisfy register function without importing from elsewhere
// RegisterData imported from './types'
