
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/useAuth';
import type { AttendanceFilters, Student, Class } from '@/integrations/api/types';

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
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>('daily');

  // Fetch classes
  const { data: classes = [], isLoading: classesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      try {
        // Get classes from API
        const data = await api.classes.getAll();
        
        // Filter by teacher ID if needed
        return data
          .filter(cls => !user?.id || cls.teacherId === user?.id)
          .map(cls => ({
            id: cls.id,
            name: cls.name
          }));
      } catch (error) {
        console.error('Error fetching classes:', error);
        throw error;
      }
    },
    enabled: true
  });

  // Fetch attendance records
  const { data: attendanceRecords = [], isLoading: attendanceLoading } = useQuery({
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
        
        // Create a map of students and classes for easy lookup
        const studentPromises = [...new Set(attendanceData.map(record => record.studentId))]
          .map(id => api.students.getById(id));
        
        const classPromises = [...new Set(attendanceData.map(record => record.classId))]
          .map(id => api.classes.getById(id));
        
        // Fetch all students and classes in parallel
        const [students, classes] = await Promise.all([
          Promise.all(studentPromises),
          Promise.all(classPromises)
        ]);
        
        // Create lookup maps (using database IDs since attendance.studentId is the database ID)
        const studentMap = students.reduce<Record<string, Student>>((acc, student) => {
          acc[student.id.toString()] = student;
          return acc;
        }, {});
        
        const classMap = classes.reduce<Record<string, Class>>((acc, cls) => {
          acc[cls.id] = cls;
          return acc;
        }, {});
        
        // Map attendance data with student and class details
        return attendanceData.map(record => {
          const student = studentMap[record.studentId] || { name: 'Unknown Student', rollNo: 'N/A', studentId: 'N/A', id: '', email: '' };
          const cls = classMap[record.classId] || { name: 'Unknown Class', id: '' };
          
          return {
            id: record.id,
            date: record.date,
            status: record.status,
            studentName: student.name,
            studentRollNo: student.rollNo,
            studentId: student.studentId,
            className: cls.name
          };
        });
      } catch (error) {
        console.error('Error fetching attendance data:', error);
        throw error;
      }
    },
    enabled: true
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
    attendanceRecords,
    attendanceLoading
  };
};
