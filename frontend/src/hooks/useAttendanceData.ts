import React, { useState } from 'react';
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
  const [selectedFaculty, setSelectedFaculty] = useState<string>("all");
  const [selectedSemester, setSelectedSemester] = useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  
  // Persist active tab in sessionStorage to survive page refreshes and tab switches
  const [activeTab, setActiveTab] = useState<string>(() => {
    const savedTab = sessionStorage.getItem('attendanceActiveTab');
    return savedTab || 'admin-workflow';
  });
  
  // Save tab to sessionStorage whenever it changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    sessionStorage.setItem('attendanceActiveTab', tab);
  };

  // Fetch faculties for the faculty filter
  const { data: faculties = [], isLoading: facultiesLoading } = useQuery({
    queryKey: ['faculties'],
    queryFn: async () => {
      try {
        const data = await api.faculties.getAll();
        return data.map(faculty => ({
          id: faculty.id.toString(),
          name: faculty.name
        }));
      } catch (error) {
        console.error('Error fetching faculties:', error);
        throw error;
      }
    },
    enabled: !!user && !!localStorage.getItem('authToken'),
    refetchOnWindowFocus: false
  });

  // Fetch classes (subjects with semester info from schedules)
  const { data: classes = [], isLoading: classesLoading, error: classesError } = useQuery({
    queryKey: ['subjects-with-semesters'],
    queryFn: async () => {
      try {
        // Get schedules which contain subject and semester info
        const schedules = await api.schedules.getAll();
        
        // Create a map to deduplicate subjects and track their semesters
        const subjectMap = new Map();
        
        schedules.forEach((schedule: any) => {
          const key = schedule.subject_id;
          if (!subjectMap.has(key)) {
            subjectMap.set(key, {
              id: schedule.subject_id.toString(),
              name: `${schedule.subject_code} - ${schedule.subject_name}`,
              semester: schedule.semester,
              faculty_id: schedule.faculty_id
            });
          }
        });
        
        // Convert map to array and sort by semester then name
        return Array.from(subjectMap.values()).sort((a, b) => {
          if (a.semester !== b.semester) return a.semester - b.semester;
          return a.name.localeCompare(b.name);
        });
      } catch (error) {
        console.error('Error fetching subjects:', error);
        throw error;
      }
    },
    enabled: !!user && !!localStorage.getItem('authToken'), // Fetch only when user and token are present
    refetchOnWindowFocus: false, // Don't refetch when switching browser tabs
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

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, selectedFaculty, selectedSemester, selectedClass, searchQuery, statusFilter, pageSize]);

  // Reset semester and class selection when faculty changes
  React.useEffect(() => {
    setSelectedSemester("all");
    setSelectedClass("");
  }, [selectedFaculty]);

  // Reset class selection when semester changes
  React.useEffect(() => {
    setSelectedClass("");
  }, [selectedSemester]);

  // Fetch attendance records
  const { data: attendanceData, isLoading: attendanceLoading, error: attendanceError } = useQuery({
    queryKey: ['attendance', selectedDate.toISOString(), selectedFaculty, selectedSemester, selectedClass, statusFilter, searchQuery, activeTab, currentPage, pageSize],
    queryFn: async () => {
      try {
        // Only fetch for daily-report tab
        if (activeTab !== 'daily-report') {
          return [];
        }

        // Build filters based on selections
        const filters: AttendanceFilters = {};
        
        // Server-side filters
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        filters.date = formattedDate;
        console.log('[ATTENDANCE HOOK] Fetching with date filter:', formattedDate, 'Raw date:', selectedDate);

        if (selectedClass && selectedClass !== 'all' && selectedClass !== '') {
          filters.subjectId = selectedClass;
        }

        if (selectedFaculty && selectedFaculty !== 'all') {
          filters.faculty_id = parseInt(selectedFaculty);
        }

        if (selectedSemester && selectedSemester !== 'all') {
          filters.semester = parseInt(selectedSemester);
        }

        if (statusFilter && statusFilter !== 'all') {
          filters.status = statusFilter;
        }

        // Server-side search across all records when searchQuery present
        if (searchQuery && searchQuery.trim()) {
          filters.search = searchQuery.trim();
        }

        // Server-side pagination aligned with UI controls
        const page = Math.max(1, currentPage);
        const size = Math.max(1, pageSize);
        filters.skip = (page - 1) * size;
        filters.limit = size;
        
        // Get attendance data with applied filters
        const apiResponse = await api.attendance.getAll(filters);
        
        // Handle paginated response
        const attendanceData = apiResponse.records || [];
        const totalCount = apiResponse.total || 0;
        
        // Map to table-friendly shape (use backend data directly)
        const allRecords = (attendanceData || []).map(record => {
          return {
            id: record.id,
            date: record.date,
            status: record.status,
            studentName: record.studentName || 'Unknown Student',
            studentRollNo: record.studentNumber || 'N/A',
            studentId: record.studentNumber || record.studentId || 'N/A',
            className: record.subjectCode && record.subjectName 
              ? `${record.subjectCode} - ${record.subjectName}`
              : 'Unknown Subject'
          };
        });
        
        return { records: allRecords, totalCount };
      } catch (error) {
        console.error('Error fetching attendance data:', error);
        throw error;
      }
    },
    enabled: !!user && !!localStorage.getItem('authToken') && activeTab === 'daily-report',
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error.message as string).toLowerCase();
        if (errorMessage.includes('authenticated') || errorMessage.includes('401') || errorMessage.includes('403')) {
          return false;
        }
      }
      return failureCount < 2;
    }
  });

  // Extract records and total count from data
  const attendanceRecords = attendanceData?.records || [];
  const totalRecords = attendanceData?.totalCount || 0;

  return {
    selectedDate,
    setSelectedDate,
    selectedFaculty,
    setSelectedFaculty,
    selectedSemester,
    setSelectedSemester,
    selectedClass,
    setSelectedClass,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    activeTab,
    setActiveTab: handleTabChange,
    classes,
    classesLoading,
    classesError,
    faculties,
    facultiesLoading,
    attendanceRecords,
    attendanceLoading,
    attendanceError,
    user,
    authLoading,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalRecords
  };
};

export default useAttendanceData;
