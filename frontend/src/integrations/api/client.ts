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
  options: (RequestInit & { skipAuth?: boolean }) = {}
): Promise<T> => {
  const token = localStorage.getItem('authToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (!options.skipAuth && token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 || res.status === 403) {
    const text = await res.text().catch(() => '');
    console.warn(`[API] Permission error ${res.status}:`, text || res.statusText);
    throw new Error('Not authenticated');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed: ${res.status}`);
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
      });

      // Store token in localStorage
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
        subjectId: record?.subject_id?.toString?.() || record?.class_id?.toString?.() || '',
        date: (record?.date ?? '').toString(),
        status: (record?.status ?? 'absent') as Attendance['status'],
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
      const params = facultyId ? `?faculty_id=${facultyId}` : '';
      return apiRequest(`/subjects${params}`);
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

  // Dashboard and sidebar statistics
  dashboard: {
    getSidebarStats: async () => apiRequest('/sidebar/stats'),
    getDashboardStats: async () => apiRequest('/dashboard/stats'),
    getSystemHealth: async () => apiRequest('/system/health'),
    getStudentPerformance: async () => apiRequest('/student-performance/'),
    getRealtimeMetrics: async () => apiRequest('/realtime/metrics'),
  },
};

// Local type to satisfy register function without importing from elsewhere
// RegisterData imported from './types'
