// Mock API client with fake data (no backend)
import { 
  User, 
  AuthResponse, 
  Student, 
  Class, 
  Attendance, 
  AttendanceSummary, 
  AttendanceFilters, 
  RegisterData 
} from './types';

// Mock data for frontend development
const mockUsers: User[] = [
  { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'admin' },
  { id: '2', name: 'Teacher One', email: 'teacher1@example.com', role: 'teacher' }
];

const mockStudents: Student[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com', rollNo: 'S001', studentId: 'STU001', profileImage: '' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', rollNo: 'S002', studentId: 'STU002', profileImage: '' },
  { id: '3', name: 'Mike Johnson', email: 'mike@example.com', rollNo: 'S003', studentId: 'STU003', profileImage: '' },
  { id: '4', name: 'Sarah Williams', email: 'sarah@example.com', rollNo: 'S004', studentId: 'STU004', profileImage: '' },
  { id: '5', name: 'David Brown', email: 'david@example.com', rollNo: 'S005', studentId: 'STU005', profileImage: '' }
];

const mockClasses: Class[] = [
  { id: '1', name: 'Computer Science 101', teacherId: '2' },
  { id: '2', name: 'Database Systems', teacherId: '2' },
  { id: '3', name: 'Web Development', teacherId: '2' }
];

const mockAttendance: Attendance[] = [
  { id: '1', studentId: '1', date: '2025-07-09', status: 'present', classId: '1' },
  { id: '2', studentId: '2', date: '2025-07-09', status: 'absent', classId: '1' },
  { id: '3', studentId: '3', date: '2025-07-09', status: 'present', classId: '1' },
  { id: '4', studentId: '4', date: '2025-07-09', status: 'late', classId: '1' },
  { id: '5', studentId: '5', date: '2025-07-09', status: 'present', classId: '1' },
  { id: '6', studentId: '1', date: '2025-07-10', status: 'present', classId: '1' },
  { id: '7', studentId: '2', date: '2025-07-10', status: 'present', classId: '1' },
  { id: '8', studentId: '3', date: '2025-07-10', status: 'absent', classId: '1' },
  { id: '9', studentId: '4', date: '2025-07-10', status: 'present', classId: '1' },
  { id: '10', studentId: '5', date: '2025-07-10', status: 'present', classId: '1' }
];

// Mock function that simulates API delay
const mockDelay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// API client methods with mock data
export const api = {
  // Auth methods
  auth: {
    login: async (email: string, password: string): Promise<AuthResponse> => {
      await mockDelay();
      const user = mockUsers.find(u => u.email === email);
      
      if (!user || password !== 'password') { // simple mock auth
        throw new Error('Invalid email or password');
      }
      
      const token = `mock-token-${user.id}`;
      localStorage.setItem('authToken', token);
      
      return {
        user,
        token
      };
    },
    
    register: async (userData: RegisterData): Promise<AuthResponse> => {
      await mockDelay();
      const newUser: User = {
        id: `${mockUsers.length + 1}`,
        name: userData.name,
        email: userData.email,
        role: 'teacher'
      };
      
      mockUsers.push(newUser);
      const token = `mock-token-${newUser.id}`;
      localStorage.setItem('authToken', token);
      
      return {
        user: newUser,
        token
      };
    },
      
    logout: (): Promise<void> => {
      localStorage.removeItem('authToken');
      return Promise.resolve();
    },
    
    getUser: async (): Promise<User> => {
      await mockDelay();
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const userId = token.split('-').pop() || '';
      const user = mockUsers.find(u => u.id === userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    },
  },

  // Students methods
  students: {
    getAll: async (): Promise<Student[]> => {
      await mockDelay();
      return [...mockStudents];
    },
    
    getById: async (id: string): Promise<Student> => {
      await mockDelay();
      const student = mockStudents.find(s => s.id === id);
      if (!student) {
        throw new Error(`Student with ID ${id} not found`);
      }
      return student;
    },
    
    create: async (student: Omit<Student, 'id'>) => {
      await mockDelay();
      const newStudent = {
        id: `${mockStudents.length + 1}`,
        ...student
      };
      mockStudents.push(newStudent);
      return newStudent;
    },
    
    update: async (id: string, student: Partial<Student>) => {
      await mockDelay();
      const index = mockStudents.findIndex(s => s.id === id);
      if (index === -1) {
        throw new Error(`Student with ID ${id} not found`);
      }
      
      mockStudents[index] = { ...mockStudents[index], ...student };
      return mockStudents[index];
    },
    
    delete: async (id: string): Promise<void> => {
      await mockDelay();
      const index = mockStudents.findIndex(s => s.id === id);
      if (index !== -1) {
        mockStudents.splice(index, 1);
      }
    },
  },

  // Attendance methods
  attendance: {
    getAll: async (filters: AttendanceFilters = {}): Promise<Attendance[]> => {
      await mockDelay();
      let result = [...mockAttendance];
      
      if (filters.studentId) {
        result = result.filter(a => a.studentId === filters.studentId);
      }
      
      if (filters.classId) {
        result = result.filter(a => a.classId === filters.classId);
      }
      
      if (filters.date) {
        result = result.filter(a => a.date === filters.date);
      }
      
      if (filters.startDate && filters.endDate) {
        result = result.filter(a => a.date >= filters.startDate && a.date <= filters.endDate);
      }
      
      return result;
    },
    
    getById: async (id: string): Promise<Attendance> => {
      await mockDelay();
      const attendance = mockAttendance.find(a => a.id === id);
      if (!attendance) {
        throw new Error(`Attendance record with ID ${id} not found`);
      }
      return attendance;
    },
    
    create: async (attendance: Omit<Attendance, 'id'>) => {
      await mockDelay();
      const newAttendance = {
        id: `${mockAttendance.length + 1}`,
        ...attendance
      };
      mockAttendance.push(newAttendance);
      return newAttendance;
    },
      
    getSummary: async (filters: AttendanceFilters = {}): Promise<AttendanceSummary> => {
      await mockDelay();
      
      // Mock summary data based on the type definition
      return {
        present: 35,
        absent: 3,
        late: 1,
        excused: 1,
        total: 40,
        percentagePresent: 87.5
      };
    },
  },

  // Classes methods
  classes: {
    getAll: async (): Promise<Class[]> => {
      await mockDelay();
      return [...mockClasses];
    },
    
    getById: async (id: string): Promise<Class> => {
      await mockDelay();
      const cls = mockClasses.find(c => c.id === id);
      if (!cls) {
        throw new Error(`Class with ID ${id} not found`);
      }
      return cls;
    },
    
    create: async (classData: Omit<Class, 'id'>) => {
      await mockDelay();
      const newClass = {
        id: `${mockClasses.length + 1}`,
        ...classData
      };
      mockClasses.push(newClass);
      return newClass;
    },
    
    update: async (id: string, classData: Partial<Class>) => {
      await mockDelay();
      const index = mockClasses.findIndex(c => c.id === id);
      if (index === -1) {
        throw new Error(`Class with ID ${id} not found`);
      }
      
      mockClasses[index] = { ...mockClasses[index], ...classData };
      return mockClasses[index];
    },
    
    delete: async (id: string): Promise<void> => {
      await mockDelay();
      const index = mockClasses.findIndex(c => c.id === id);
      if (index !== -1) {
        mockClasses.splice(index, 1);
      }
    },
  }
};
