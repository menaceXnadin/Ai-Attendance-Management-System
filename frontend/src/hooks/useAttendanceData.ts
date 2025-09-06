import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/useAuth';
import type { AttendanceFilters, Student, Subject } from '@/integrations/api/types';

export interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  studentName: string;
  studentRollNo: string;
  studentId: string;
  className: string;
}

export const useAttendanceData = () => {
  const { user, loading: authLoading } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>('daily');

  // Fetch classes (subjects)
  const { data: classes = [], isLoading: classesLoading, error: classesError } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      try {
        // Get subjects from API (these are the "classes")
        const data = await api.subjects.getAll();
        
        // Filter by user faculty if needed
        return data.map(subject => ({
          id: subject.id,
          name: `${subject.code} - ${subject.name}`
        }));
      } catch (error) {
        console.error('Error fetching subjects:', error);
        // Re-throw the error to let React Query handle it
        throw error;
      }
    },
  enabled: !!user && !!localStorage.getItem('authToken'), // Fetch only when user and token are present
    retry: (failureCount, error) => {
      // Don't retry on authentication errors (401, 403)
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error.message as string).toLowerCase();
        if (errorMessage.includes('authenticated') || errorMessage.includes('401') || errorMessage.includes('403')) {
          return false;
        }
      }
      return failureCount < 2; // Retry up to 2 times for other errors
    }
  });

  // Fetch attendance records
  const { data: attendanceRecords = [], isLoading: attendanceLoading, error: attendanceError } = useQuery({
    queryKey: ['attendance', selectedClass, activeTab, selectedDate],
    queryFn: async () => {
      try {
        // Build filters based on selections
        const filters: AttendanceFilters = {};
        
        if (selectedClass) {
          filters.classId = selectedClass;
        }
        
        if (activeTab === 'daily') {
          filters.date = format(selectedDate, 'yyyy-MM-dd');
        }
        
        // Get attendance data with applied filters
        const attendanceData = await api.attendance.getAll(filters);
        
        // If there's no attendance data, return empty array
        if (!attendanceData || attendanceData.length === 0) {
          return [];
        }
        
        // Create a map of students and subjects for easy lookup
        const studentIds = [...new Set(attendanceData.map(record => record.studentId))]
          .filter(id => id && id !== 'undefined' && id !== undefined);
        
        const subjectIds = [...new Set(attendanceData.map(record => record.subjectId))]
          .filter(id => id && id !== 'undefined' && id !== undefined);
        
        const studentPromises = studentIds.map(id => api.students.getById(id));
        const subjectPromises = subjectIds.map(id => api.subjects.getById(parseInt(id)));
        
        // Fetch all students and subjects in parallel
        const [students, subjects] = await Promise.all([
          Promise.all(studentPromises),
          Promise.all(subjectPromises)
        ]);
        
        // Create lookup maps (using database IDs since attendance.studentId is the database ID)
        const studentMap = students.reduce<Record<string, Student>>((acc, student) => {
          acc[student.id.toString()] = student;
          return acc;
        }, {});
        
        const subjectMap = subjects.reduce<Record<string, Subject>>((acc, subject) => {
          acc[subject.id] = subject;
          return acc;
        }, {});
        
        // Map attendance data with student and subject details
        return attendanceData.map(record => {
          const student = studentMap[record.studentId] || { name: 'Unknown Student', rollNo: 'N/A', studentId: 'N/A', id: '', email: '' };
          const subject = subjectMap[record.subjectId] || { name: 'Unknown Subject', id: '', code: 'N/A' };
          
          return {
            id: record.id,
            date: record.date,
            status: record.status,
            studentName: student.name,
            studentRollNo: student.rollNo,
            studentId: student.studentId,
            className: `${subject.code} - ${subject.name}`
          };
        });
      } catch (error) {
        console.error('Error fetching attendance data:', error);
        throw error;
      }
    },
  enabled: !!user && !!localStorage.getItem('authToken'), // Fetch only when user and token are present
    retry: (failureCount, error) => {
      // Don't retry on authentication errors (401, 403)
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error.message as string).toLowerCase();
        if (errorMessage.includes('authenticated') || errorMessage.includes('401') || errorMessage.includes('403')) {
          return false;
        }
      }
      return failureCount < 2; // Retry up to 2 times for other errors
    }
  });

  return {
    selectedDate,
    setSelectedDate,
    selectedClass,
    setSelectedClass,
    activeTab,
    setActiveTab,
    classes,
    classesLoading,
    classesError,
    attendanceRecords,
    attendanceLoading,
    attendanceError,
    user,
    authLoading
  };
};

export default useAttendanceData;
