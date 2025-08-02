// Real API client connected to FastAPI backend
import { 
  User, 
  AuthResponse, 
  Student, 
  StudentCreateData,
  Class, 
  Attendance, 
  AttendanceSummary, 
  AttendanceFilters, 
  RegisterData 
} from './types';

// Backend API base URL - use proxy in development
const API_BASE_URL = '/api';  // Use Vite proxy configuration

// Helper function for making API requests
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('authToken');
  
  // Validate token before making request
  if (token) {
    if (!isValidTokenFormat(token)) {
      console.log('[API] Invalid token format detected, clearing token');
      localStorage.removeItem('authToken');
    } else if (isTokenLikelyExpired(token)) {
      console.log('[API] Token appears expired, clearing token');
      localStorage.removeItem('authToken');
    }
  }
  
  // Get the token again after potential cleanup
  const validToken = localStorage.getItem('authToken');
  
  try {
    console.log(`[API] Making request to: ${API_BASE_URL}${endpoint}`);
    console.log(`[API] Auth token present:`, !!validToken);
    console.log(`[API] Token value (first 20 chars):`, validToken ? validToken.substring(0, 20) + '...' : 'null');
    
    const headers = {
      'Content-Type': 'application/json',
      ...(validToken && { Authorization: `Bearer ${validToken}` }),
      ...options.headers,
    };
    
    console.log(`[API] Request headers:`, { 
      ...headers, 
      Authorization: headers.Authorization ? `Bearer ${headers.Authorization.substring(7, 27)}...` : 'missing' 
    });
    console.log(`[API] Full URL being requested: ${window.location.origin}${API_BASE_URL}${endpoint}`);
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers,
      ...options,
    });

    console.log(`[API] Response status:`, response.status, response.statusText);

    if (!response.ok) {
      // Read the response body once and handle different error scenarios
      let errorMessage = `HTTP ${response.status}`;
      let errorData = null;
      
      try {
        // Try to clone the response so we can read it multiple times if needed
        const responseClone = response.clone();
        errorData = await responseClone.json();
        errorMessage = errorData.detail || errorData.message || `HTTP ${response.status}`;
      } catch {
        // If JSON parsing fails, try to read as text
        try {
          errorMessage = await response.text() || `HTTP ${response.status}`;
        } catch {
          // If both fail, use default message
          errorMessage = `HTTP ${response.status}`;
        }
      }
      
      if (response.status === 401) {
        // Token expired or invalid, clear it
        console.log('[API] Authentication failed, clearing token');
        console.log('[API] Token that failed:', token ? token.substring(0, 20) + '...' : 'null');
        localStorage.removeItem('authToken');
        
        console.log('[API] Auth error details:', errorMessage);
        throw new Error(errorMessage === `HTTP ${response.status}` ? 'Authentication required' : errorMessage);
      }
      
      if (response.status === 403) {
        // Forbidden - user is authenticated but lacks permissions
        console.log('[API] Permission error details:', errorMessage);
        throw new Error(errorMessage === `HTTP ${response.status}` ? 'Access forbidden' : errorMessage);
      }
      
      console.log(`[API] Error response:`, errorMessage);
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log(`[API] Success response for ${endpoint}:`, result);
    return result;
  } catch (error) {
    console.error(`[API] Request to ${endpoint} failed:`, error);
    
    // Handle network errors specifically
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      const detailedError = `Cannot connect to backend server at ${API_BASE_URL}. Please check:
1. Backend server is running on port 8000
2. No firewall blocking the connection
3. CORS settings allow your frontend origin`;
      throw new Error(detailedError);
    }
    
    throw error;
  }
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('authToken');
};

// Get stored auth token
export const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

// Validate token format (basic JWT structure check)
const isValidTokenFormat = (token: string): boolean => {
  if (!token) return false;
  const parts = token.split('.');
  return parts.length === 3; // JWT should have 3 parts separated by dots
};

// Check if token appears to be expired (basic check)
const isTokenLikelyExpired = (token: string): boolean => {
  try {
    if (!isValidTokenFormat(token)) return true;
    
    // Decode the payload (middle part) without verification
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    
    // Check if token has expired
    if (payload.exp && payload.exp < now) {
      console.log('[API] Token appears to be expired');
      return true;
    }
    
    return false;
  } catch (error) {
    console.log('[API] Error checking token expiry:', error);
    return true; // If we can't parse it, assume it's invalid
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
          role: response.user.role
        },
        token: response.access_token
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
              password: userData.password
            },
            student_id: `STU${Date.now()}`, // Generate unique student ID
            class_name: "General",
            year: new Date().getFullYear(),
            phone_number: "",
            emergency_contact: ""
          }),
        });
        
        // Note: This endpoint returns student data, not auth data
        // You might need a separate login after registration
        return {
          user: {
            id: response.user_id?.toString() || '',
            name: response.user?.full_name || userData.name,
            email: response.user?.email || userData.email,
            role: 'student'
          },
          token: '' // No token returned from registration
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
        console.log('[API] Fetching current user info...');
        console.log('[API] Using token:', localStorage.getItem('authToken') ? 'present' : 'missing');
        
        const response = await apiRequest('/auth/me');
        
        console.log('[API] Current user response:', response);
        
        const user = {
          id: response.id.toString(),
          name: response.full_name,
          email: response.email,
          role: response.role
        };
        
        console.log('[API] Mapped user data:', user);
        console.log('[API] User role for permissions:', user.role);
        
        return user;
      } catch (error) {
        console.error('[API] Failed to get user info:', error);
        console.log('[API] This might indicate token/auth issues');
        throw new Error('Failed to get user');
      }
    },

    refreshToken: async (): Promise<AuthResponse> => {
      try {
        const response = await apiRequest('/auth/refresh-token', {
          method: 'POST',
        });
        
        // Store the new token
        localStorage.setItem('authToken', response.access_token);
        
        return {
          user: {
            id: response.user.id.toString(),
            name: response.user.full_name,
            email: response.user.email,
            role: response.user.role
          },
          token: response.access_token
        };
      } catch (error) {
        console.log('[API] Token refresh failed, clearing token');
        localStorage.removeItem('authToken');
        throw new Error('Failed to refresh token');
      }
    },
    
    // Helper to check current auth status
    checkAuthStatus: async (): Promise<boolean> => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) return false;
        
        // Try to get user info with current token
        await api.auth.getUser();
        return true;
      } catch (error) {
        console.log('[API] Auth check failed:', error);
        return false;
      }
    },
  },

  // Students methods
  students: {
    getAll: async (): Promise<Student[]> => {
      console.log('[API] students.getAll called');
      // Use high limit to get all students
      const response = await apiRequest('/students/?limit=1000');
      console.log('[API] Students API response:', response);
      if (!response || !Array.isArray(response)) {
        console.error('[API] Invalid response format, expected array:', response);
        return [];
      }
      return response.map((student: Record<string, unknown>) => {
        // Extract nested user data safely
        const user = student.user as Record<string, unknown> || {};
        const fullName = user && user.full_name ? String(user.full_name) : '';
        const email = user && user.email ? String(user.email) : '';
        const studentId = student.student_id ? String(student.student_id) : '';
        const faculty = student.faculty ? String(student.faculty) : 'Unknown Faculty';
        
        console.log(`[API] Mapping student ${studentId}: faculty=${faculty}`);
        
        return {
          id: student.id?.toString() || '',
          name: fullName,
          email: email,
          rollNo: `R-${studentId}`,
          studentId: studentId,
          faculty: faculty,
          faculty_id: student.faculty_id ? Number(student.faculty_id) : 0, // Add faculty_id from backend
          semester: student.semester ? Number(student.semester) : 1,
          year: student.year ? Number(student.year) : 1,
          batch: student.batch ? Number(student.batch) : new Date().getFullYear(),
          phone_number: student.phone_number?.toString() || '',
          emergency_contact: student.emergency_contact?.toString() || '',
          profileImage: student.profile_image_url?.toString() || '',
          face_encoding: Array.isArray(student.face_encoding) ? student.face_encoding as number[] : null
        };
      });
    },
    
    getById: async (id: string): Promise<Student> => {
      try {
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
          face_encoding: Array.isArray(response.face_encoding) ? response.face_encoding as number[] : null
        };
      } catch (error) {
        throw new Error(`Student with ID ${id} not found`);
      }
    },
    
    create: async (studentData: StudentCreateData): Promise<Student> => {
      try {
        console.log('[API] Creating student with data:', studentData);
        console.log('[API] Auth token for create:', localStorage.getItem('authToken') ? 'present' : 'missing');
        
        const response = await apiRequest('/students/', {
          method: 'POST',
          body: JSON.stringify({
            user: {
              email: studentData.email,
              full_name: studentData.name,
              password: studentData.password
            },
            student_id: studentData.studentId,
            faculty_id: studentData.faculty_id, // Send faculty_id instead of faculty
            semester: studentData.semester || 1,
            year: studentData.year || 1,
            batch: studentData.batch || new Date().getFullYear(),
            phone_number: studentData.phone_number || null,
            emergency_contact: studentData.emergency_contact || null
          }),
        });
        
        console.log('[API] Student creation response:', response);
        
        return {
          id: response.id.toString(),
          name: response.user ? response.user.full_name : studentData.name,
          email: response.user ? response.user.email : studentData.email,
          rollNo: `R-${response.student_id}`,
          studentId: response.student_id,
          faculty: response.faculty || "Unknown", // Use faculty from backend response
          semester: response.semester || studentData.semester,
          year: response.year || studentData.year,
          batch: response.batch || studentData.batch,
          profileImage: response.profile_image_url || ''
        };
      } catch (error) {
        console.error('[API] Student creation error:', error);
        throw error; // Pass the actual error instead of generic message
      }
    },
    
    update: async (id: string, updateData: Record<string, unknown>) => {
      try {
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
          profileImage: response.profile_image_url || ''
        };
      } catch (error) {
        throw new Error(`Failed to update student with ID ${id}`);
      }
    },
    
    delete: async (id: string): Promise<void> => {
      try {
        console.log(`[API] Deleting student with ID: ${id}`);
        
        // Make sure we're working with a valid ID
        if (!id || id === 'undefined' || id === 'null' || id.trim() === '') {
          throw new Error(`Invalid student ID: ${id}`);
        }
        
        // The backend expects a numeric ID
        const endpoint = `/students/${id}`;
        console.log(`[API] Delete endpoint: ${endpoint}`);
        
        const response = await apiRequest(endpoint, {
          method: 'DELETE',
        });
        
        console.log(`[API] Delete response:`, response);
        return response;
      } catch (error) {
        console.error('[API] Delete student error:', error);
        throw error;
      }
    },
  },

  // Attendance methods
  attendance: {
    getAll: async (filters: AttendanceFilters = {}): Promise<Attendance[]> => {
      try {
        const params = new URLSearchParams();
        if (filters.studentId) params.append('student_id', filters.studentId);
        if (filters.classId) params.append('class_id', filters.classId);
        if (filters.date) params.append('date', filters.date);
        if (filters.startDate) params.append('start_date', filters.startDate);
        if (filters.endDate) params.append('end_date', filters.endDate);
        
        const queryString = params.toString();
        const endpoint = queryString ? `/attendance?${queryString}` : '/attendance';
        
        const response = await apiRequest(endpoint);
        return response.map((record: Record<string, unknown>) => ({
          id: record.id?.toString() || '',
          studentId: record.student_id?.toString() || '',
          date: record.date?.toString() || '',
          status: record.status?.toString() || 'absent',
          classId: record.class_id?.toString() || ''
        }));
      } catch (error) {
        console.error('Failed to fetch attendance:', error);
        return []; // Return empty array when API fails
      }
    },
    
    getById: async (id: string): Promise<Attendance> => {
      try {
        const response = await apiRequest(`/attendance/${id}`);
        return {
          id: response.id.toString(),
          studentId: response.student_id.toString(),
          date: response.date,
          status: response.status,
          classId: response.class_id.toString()
        };
      } catch (error) {
        throw new Error(`Attendance record with ID ${id} not found`);
      }
    },
    
    create: async (attendance: Omit<Attendance, 'id'>) => {
      try {
        const response = await apiRequest('/attendance', {
          method: 'POST',
          body: JSON.stringify({
            student_id: parseInt(attendance.studentId),
            class_id: parseInt(attendance.classId),
            date: attendance.date,
            status: attendance.status
          }),
        });
        
        return {
          id: response.id.toString(),
          studentId: response.student_id.toString(),
          date: response.date,
          status: response.status,
          classId: response.class_id.toString()
        };
      } catch (error) {
        throw new Error('Failed to create attendance record');
      }
    },
      
    getSummary: async (filters: AttendanceFilters = {}): Promise<AttendanceSummary> => {
      try {
        const params = new URLSearchParams();
        if (filters.studentId) params.append('student_id', filters.studentId);
        if (filters.classId) params.append('class_id', filters.classId);
        if (filters.startDate) params.append('start_date', filters.startDate);
        if (filters.endDate) params.append('end_date', filters.endDate);
        
        const queryString = params.toString();
        const endpoint = queryString ? `/attendance/summary?${queryString}` : '/attendance/summary';
        
        const response = await apiRequest(endpoint);
        return {
          present: response.present || 0,
          absent: response.absent || 0,
          late: response.late || 0,
          excused: response.excused || 0,
          total: response.total || 0,
          percentagePresent: response.percentage_present || 0
        };
      } catch (error) {
        console.error('Failed to fetch attendance summary:', error);
        // Return empty data when API fails
        return {
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          total: 0,
          percentagePresent: 0
        };
      }
    },

    getStudentsBySubject: async (
      facultyId: number,
      semester: number,
      subjectId: number,
      date?: string
    ) => {
      try {
        const params = new URLSearchParams({
          faculty_id: facultyId.toString(),
          semester: semester.toString(),
          subject_id: subjectId.toString(),
        });
        if (date) params.append('date', date);
        
        const response = await apiRequest(`/attendance/students-by-subject?${params}`);
        return response;
      } catch (error) {
        console.error('Failed to fetch students by subject:', error);
        throw error;
      }
    },

    markBulk: async (attendanceData: {
      subject_id: number;
      date?: string;
      students: Array<{ student_id: number; status: string }>;
    }) => {
      console.log('[API] attendance.markBulk called', attendanceData);
      try {
        const response = await apiRequest('/attendance/mark-bulk', {
          method: 'POST',
          body: JSON.stringify(attendanceData),
        });
        return response;
      } catch (error) {
        console.error('Failed to mark bulk attendance:', error);
        throw error;
      }
    },
  },

  // Classes methods
  classes: {
    getAll: async (): Promise<Class[]> => {
      try {
        const response = await apiRequest('/classes');
        return response.map((cls: Record<string, unknown>) => ({
          id: cls.id?.toString() || '',
          name: cls.name?.toString() || '',
          teacherId: cls.teacher_id?.toString() || '',
          faculty_id: cls.faculty_id !== undefined ? Number(cls.faculty_id) : undefined
        }));
      } catch (error) {
        console.error('Failed to fetch classes:', error);
        return []; // Return empty array when classes API fails
      }
    },
    
    getById: async (id: string): Promise<Class> => {
      try {
        const response = await apiRequest(`/classes/${id}`);
        return {
          id: response.id.toString(),
          name: response.name,
          teacherId: response.teacher_id?.toString() || '',
          faculty_id: response.faculty_id !== undefined ? Number(response.faculty_id) : undefined
        };
      } catch (error) {
        throw new Error(`Class with ID ${id} not found`);
      }
    },
    
    create: async (classData: Omit<Class, 'id'>) => {
      try {
        const response = await apiRequest('/classes', {
          method: 'POST',
          body: JSON.stringify({
            name: classData.name,
            teacher_id: classData.teacherId ? parseInt(classData.teacherId) : undefined,
            faculty_id: classData.faculty_id
          }),
        });
        
        return {
          id: response.id.toString(),
          name: response.name,
          teacherId: response.teacher_id?.toString() || '',
          faculty_id: response.faculty_id !== undefined ? Number(response.faculty_id) : undefined
        };
      } catch (error) {
        throw new Error('Failed to create class');
      }
    },
    
    update: async (id: string, classData: Partial<Class>) => {
      try {
        const updateData: Record<string, unknown> = {};
  if (classData.name) updateData.name = classData.name;
  if (classData.teacherId) updateData.teacher_id = parseInt(classData.teacherId);
  if (classData.faculty_id !== undefined) updateData.faculty_id = classData.faculty_id;
        
        const response = await apiRequest(`/classes/${id}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });
        
        return {
          id: response.id.toString(),
          name: response.name,
          teacherId: response.teacher_id?.toString() || '',
          faculty_id: response.faculty_id !== undefined ? Number(response.faculty_id) : undefined
        };
      } catch (error) {
        throw new Error(`Failed to update class with ID ${id}`);
      }
    },
    
    delete: async (id: string): Promise<void> => {
      try {
        await apiRequest(`/classes/${id}`, {
          method: 'DELETE',
        });
      } catch (error) {
        throw new Error(`Failed to delete class with ID ${id}`);
      }
    },
  },

  // Face Recognition methods
  faceRecognition: {
    markAttendance: async (imageData: string, subjectId: string) => {
      try {
        const response = await apiRequest('/face-recognition/mark-attendance', {
          method: 'POST',
          body: JSON.stringify({
            image_data: imageData,
            subject_id: parseInt(subjectId)
          }),
        });
        
        return {
          success: response.success,
          message: response.message,
          attendanceMarked: response.attendance_marked,
          studentId: response.student_id?.toString(),
          confidenceScore: response.confidence_score
        };
      } catch (error) {
        throw new Error('Failed to process face recognition');
      }
    },

    registerFace: async (imageData: string) => {
      try {
        console.log('[API] Registering face, image data length:', imageData.length);
        console.log('[API] Image data preview:', imageData.substring(0, 50) + '...');
        
        const response = await apiRequest('/face-recognition/register-face', {
          method: 'POST',
          body: JSON.stringify({ image_data: imageData }),
        });
        
        console.log('[API] Face registration response:', response);
        
        return {
          success: response.success,
          message: response.message
        };
      } catch (error) {
        console.error('[API] Face registration error:', error);
        throw new Error('Failed to register face');
      }
    },

    verifyFace: async (imageData: string) => {
      try {
        console.log('[API] Verifying face, image data length:', imageData.length);
        
        const response = await apiRequest('/face-recognition/verify-face', {
          method: 'POST',
          body: JSON.stringify({ image_data: imageData }),
        });
        
        console.log('[API] Face verification response:', response);
        
        return {
          valid: response.valid,
          message: response.message
        };
      } catch (error) {
        console.error('[API] Face verification error:', error);
        throw new Error('Failed to verify face');
      }
    },

    getMyAttendance: async () => {
      try {
        const response = await apiRequest('/face-recognition/my-attendance');
        return response.map((record: Record<string, unknown>) => ({
          id: record.id?.toString() || '',
          studentId: record.student_id?.toString() || '',
          subjectId: record.subject_id?.toString() || '',
          date: record.date?.toString() || '',
          status: record.status?.toString() || 'absent',
          confidenceScore: record.confidence_score as number || 0,
          markedBy: record.marked_by?.toString() || ''
        }));
      } catch (error) {
        throw new Error('Failed to fetch attendance records');
      }
    },

    detectFaces: async (imageData: string) => {
      try {
        console.log('[API] Detecting faces, image data length:', imageData.length);
        
        const response = await apiRequest('/face-recognition/detect-faces', {
          method: 'POST',
          body: JSON.stringify({ image_data: imageData }),
        });
        
        console.log('[API] Face detection response:', response);
        
        return {
          success: response.success,
          message: response.message,
          faces_detected: response.faces_detected,
          faces: response.faces,
          feedback: response.feedback,
          ready_for_capture: response.ready_for_capture
        };
      } catch (error) {
        console.error('[API] Face detection error:', error);
        throw new Error('Failed to detect faces');
      }
    }
  },

  // Subjects methods
  subjects: {
    getAll: async (facultyId?: number) => {
      console.log('[API] subjects.getAll called', { facultyId });
      const params = facultyId ? `?faculty_id=${facultyId}` : '';
      const response = await apiRequest(`/subjects/${params}`);
      return response;
    },

    getByFaculty: async (facultyId: number) => {
      console.log('[API] subjects.getByFaculty called', { facultyId });
      const response = await apiRequest(`/subjects/by-faculty?faculty_id=${facultyId}`);
      return response;
    },

    getByFacultySemester: async (facultyId: number, semester?: number) => {
      console.log('[API] subjects.getByFacultySemester called', { facultyId, semester });
      const params = new URLSearchParams({ faculty_id: facultyId.toString() });
      if (semester) params.append('semester', semester.toString());
      const response = await apiRequest(`/subjects/by-faculty-semester?${params}`);
      return response;
    },

    create: async (subjectData: { 
      name: string; 
      code: string; 
      description?: string; 
      credits?: number; 
      faculty_id?: number;
      class_schedule?: Record<string, unknown>;
    }) => {
      console.log('[API] subjects.create called', subjectData);
      const response = await apiRequest('/subjects/', {
        method: 'POST',
        body: JSON.stringify(subjectData),
      });
      return response;
    },

    getById: async (subjectId: number) => {
      console.log('[API] subjects.getById called', subjectId);
      const response = await apiRequest(`/subjects/${subjectId}`);
      return response;
    },

    delete: async (subjectId: number) => {
      console.log('[API] subjects.delete called', subjectId);
      const response = await apiRequest(`/subjects/${subjectId}`, {
        method: 'DELETE',
      });
      return response;
    }
  },

  // Enhanced attendance methods
  attendanceAdmin: {
    getStudentsBySubject: async (facultyId: number, semester: number, subjectId: number, date?: string) => {
      console.log('[API] attendanceAdmin.getStudentsBySubject called', { facultyId, semester, subjectId, date });
      const params = new URLSearchParams({
        faculty_id: facultyId.toString(),
        semester: semester.toString(),
        subject_id: subjectId.toString()
      });
      if (date) params.append('date', date);
      
      const response = await apiRequest(`/attendance/students-by-subject?${params}`);
      return response;
    },

    markBulkAttendance: async (attendanceData: {
      subject_id: number;
      date?: string;
      students: Array<{ student_id: number; status: string }>;
    }) => {
      console.log('[API] attendanceAdmin.markBulkAttendance called', attendanceData);
      const response = await apiRequest('/attendance/mark-bulk', {
        method: 'POST',
        body: JSON.stringify(attendanceData),
      });
      return response;
    }
  },

  // Faculties methods
  faculties: {
    getAll: async () => {
      console.log('[API] faculties.getAll called');
      const response = await apiRequest('/faculties/');
      return response;
    },

    create: async (facultyData: { name: string; description?: string }) => {
      console.log('[API] faculties.create called', facultyData);
      const response = await apiRequest('/faculties/', {
        method: 'POST',
        body: JSON.stringify(facultyData),
      });
      return response;
    },

    delete: async (facultyId: number) => {
      console.log('[API] faculties.delete called', facultyId);
      const response = await apiRequest(`/faculties/${facultyId}`, {
        method: 'DELETE',
      });
      return response;
    }
  },

  // Dashboard and sidebar statistics
  dashboard: {
    getSidebarStats: async () => {
      console.log('[API] dashboard.getSidebarStats called');
      const response = await apiRequest('/sidebar/stats');
      return response;
    },

    getDashboardStats: async () => {
      console.log('[API] dashboard.getDashboardStats called');
      const response = await apiRequest('/dashboard/stats');
      return response;
    },

    getSystemHealth: async () => {
      console.log('[API] dashboard.getSystemHealth called');
      const response = await apiRequest('/system/health');
      return response;
    },

    getStudentPerformance: async () => {
      console.log('[API] dashboard.getStudentPerformance called');
      const response = await apiRequest('/student-performance/');
      return response;
    },

    getRealtimeMetrics: async () => {
      console.log('[API] dashboard.getRealtimeMetrics called');
      const response = await apiRequest('/realtime/metrics');
      return response;
    }
  }
};
