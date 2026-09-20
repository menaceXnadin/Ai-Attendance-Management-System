import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { 
  UserMultiple, 
  Book, 
  Education, 
  CheckmarkFilled, 
  CloseFilled, 
  Time, 
  Save, 
  UserFollow, 
  UserAdmin, 
  Search, 
  Close, 
  User, 
  Email, 
  Stop, 
  Renew 
} from '@carbon/icons-react';
import { api } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';

interface Faculty {
  id: number;
  name: string;
  description?: string;
}

interface Subject {
  id: number;
  name: string;
  code: string;
  description?: string;
  credits: number;
  faculty_id?: number;
  semester?: number;
}

interface StudentWithAttendance {
  id: number;
  student_id: string;
  name: string;
  email: string;
  semester: number;
  status: 'present' | 'absent' | 'late';
  faculty_id: number;
  hasChanges?: boolean; // Track if attendance was manually changed
}

type AttendanceStatus = 'present' | 'absent' | 'late' | 'system_inactive' | 'no_data' | 'cancelled';

interface SubjectWithAttendance extends Subject {
  todayStatus?: AttendanceStatus;
  hasChanges?: boolean;
  cancellation_reason?: string;  // Reason for cancellation if class was cancelled
}

interface AttendanceRecord {
  createdAt?: string;
  created_at?: string;
  date: string;
  subjectId?: string | number;
  status: AttendanceStatus;
  cancellation_reason?: string;
  notes?: string;
}

interface StudentSubjectBreakdown {
  subjectId: number;
  subjectName: string;
  status: AttendanceStatus;
}

interface StudentApi {
  id: number | string;
  full_name?: string;
  name?: string;
  student_id?: string;
  studentId?: string;
  email?: string;
  faculty?: string;
  faculty_id?: number | string;
  semester?: number | string;
}

const toAttendanceStatus = (value: unknown): AttendanceStatus => {
  switch (value) {
    case 'present':
    case 'late':
    case 'absent':
    case 'cancelled':
    case 'system_inactive':
    case 'no_data':
      return value;
    default:
      return 'absent';
  }
};

const normalizeAttendanceRecord = (record: unknown, fallbackDate: string): AttendanceRecord | null => {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const data = record as Record<string, unknown>;
  const rawSubjectId = data.subjectId;
  const subjectId =
    typeof rawSubjectId === 'string' || typeof rawSubjectId === 'number'
      ? rawSubjectId
      : undefined;
  const status = toAttendanceStatus(data.status);
  const date = typeof data.date === 'string' ? data.date : fallbackDate;

  return {
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
    created_at: typeof data.created_at === 'string' ? data.created_at : undefined,
    date,
    subjectId,
    status,
    cancellation_reason: typeof data.cancellation_reason === 'string' ? data.cancellation_reason : undefined,
    notes: typeof data.notes === 'string' ? data.notes : undefined,
  };
};

const isStudentApi = (student: unknown): student is StudentApi => {
  if (!student || typeof student !== 'object') {
    return false;
  }
  const data = student as Record<string, unknown>;
  return 'id' in data;
};

const toStudentWithAttendance = (student: StudentApi): StudentWithAttendance => {
  const idValue = typeof student.id === 'string' ? parseInt(student.id, 10) : student.id;
  const parsedIdRaw = Number(idValue);
  const parsedId = Number.isFinite(parsedIdRaw) ? parsedIdRaw : 0;
  const facultyIdValue =
    typeof student.faculty_id === 'string' ? parseInt(student.faculty_id, 10) : student.faculty_id;
  const parsedFacultyIdRaw = Number(facultyIdValue);
  const parsedFacultyId = Number.isFinite(parsedFacultyIdRaw) ? parsedFacultyIdRaw : 0;
  const semesterValue =
    typeof student.semester === 'string' ? parseInt(student.semester, 10) : student.semester;
  const parsedSemesterRaw = Number(semesterValue);
  const parsedSemester = Number.isFinite(parsedSemesterRaw) ? parsedSemesterRaw : 1;
  return {
    id: parsedId,
    student_id: student.student_id || student.studentId || 'Unknown ID',
    name: student.full_name || student.name || 'Unknown Name',
    email: student.email || 'unknown@example.com',
    semester: parsedSemester,
    status: 'absent',
    faculty_id: parsedFacultyId,
  };
};

const EnhancedAttendanceManagement = () => {
  const { toast } = useToast();
  
  // State management
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [subjects, setSubjects] = useState<SubjectWithAttendance[]>([]);
  const [students, setStudents] = useState<StudentWithAttendance[]>([]);
  const [allStudents, setAllStudents] = useState<StudentWithAttendance[]>([]);
  const [studentSubjectBreakdown, setStudentSubjectBreakdown] = useState<StudentSubjectBreakdown[]>([]);
  
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'subject' | 'student'>('subject');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [quickSearchResults, setQuickSearchResults] = useState<StudentWithAttendance[]>([]);
  const [showQuickSearch, setShowQuickSearch] = useState<boolean>(false);
  
  const [loading, setLoading] = useState({
    faculties: false,
    subjects: false,
    students: false,
    allStudents: false,
    studentBreakdown: false,
    saving: false,
    quickSearch: false,
  });
  
  // Force refresh counter to trigger re-fetches
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Filtered students based on search query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) {
      return students;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return students.filter(student => 
      student.name.toLowerCase().includes(query) ||
      student.student_id.toLowerCase().includes(query) ||
      student.email.toLowerCase().includes(query)
    );
  }, [students, searchQuery]);

  // Fetch faculties on component mount
  const fetchFaculties = useCallback(async (retryCount = 0) => {
    console.log('Fetching faculties, attempt:', retryCount + 1);
    setLoading(prev => ({ ...prev, faculties: true }));
    try {
      const response = await api.faculties.getAll();
      console.log('Faculties response:', response);
      setFaculties(response || []);
    } catch (error) {
      console.error('Error fetching faculties:', error);
      setFaculties([]);
      
      // Retry once on failure
      if (retryCount < 1) {
        console.log('Retrying faculties fetch...');
        setTimeout(() => { void fetchFaculties(retryCount + 1); }, 1000);
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to fetch faculties. Please try the refresh button.",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, faculties: false }));
    }
  }, [toast]);

  const fetchSubjects = useCallback(async () => {
    if (!selectedFaculty) {
      setSubjects([]);
      return;
    }
    
    console.log('Fetching subjects for faculty:', selectedFaculty, 'semester:', selectedSemester);
    setLoading(prev => ({ ...prev, subjects: true }));
    try {
      const response = await api.subjects.getByFacultySemester(
        parseInt(selectedFaculty),
        selectedSemester ? parseInt(selectedSemester) : undefined
      );
      console.log('Subjects response:', response);
      const typedResponse = Array.isArray(response)
        ? (response as SubjectWithAttendance[])
        : [];
      setSubjects(typedResponse);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      setSubjects([]);
      toast({
        title: "Error",
        description: "Failed to fetch subjects. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, subjects: false }));
    }
  }, [selectedFaculty, selectedSemester, toast]);

  const fetchStudents = useCallback(async () => {
    if (!selectedFaculty || !selectedSemester || !selectedSubject) return;
    
    setLoading(prev => ({ ...prev, students: true }));
    try {
      const response = await api.attendance.getStudentsBySubject(
        parseInt(selectedFaculty),
        parseInt(selectedSemester),
        parseInt(selectedSubject),
        selectedDate
      );
      const studentsData = Array.isArray(response?.students)
        ? (response.students as StudentWithAttendance[])
        : [];
      setStudents(studentsData);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        title: "Error",
        description: "Failed to fetch students",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, students: false }));
    }
  }, [selectedFaculty, selectedSemester, selectedSubject, selectedDate, toast]);

  useEffect(() => {
    void fetchFaculties();
  }, [fetchFaculties, refreshCounter]);

  // Fetch subjects when faculty or semester changes
  useEffect(() => {
    if (selectedFaculty) {
      void fetchSubjects();
    } else {
      setSubjects([]);
      setSelectedSubject('');
    }
  }, [selectedFaculty, selectedSemester, fetchSubjects, refreshCounter]);

  // Fetch all students for student selector
  const fetchAllStudents = useCallback(async () => {
    if (!selectedFaculty || !selectedSemester) {
      setAllStudents([]);
      return;
    }
    
    console.log('Fetching students for faculty:', selectedFaculty, 'semester:', selectedSemester);
    setLoading(prev => ({ ...prev, allStudents: true }));
    try {
      const response = await api.students.getAll();
      console.log('All students response:', response);
      const apiStudents = Array.isArray(response)
        ? response.filter(isStudentApi)
        : [];
      const targetFaculty = parseInt(selectedFaculty, 10);
      const targetSemester = parseInt(selectedSemester, 10);
      const filteredStudents = apiStudents.filter(student => {
        const facultyIdValue =
          typeof student.faculty_id === 'string' ? parseInt(student.faculty_id, 10) : student.faculty_id;
        const semesterValue =
          typeof student.semester === 'string' ? parseInt(student.semester, 10) : student.semester;
        return facultyIdValue === targetFaculty && semesterValue === targetSemester;
      });
      console.log('Filtered students:', filteredStudents);
      setAllStudents(
        filteredStudents.map(student => ({
          ...toStudentWithAttendance(student),
          status: 'absent' as const,
        }))
      );
    } catch (error) {
      console.error('Error fetching all students:', error);
      setAllStudents([]);
      toast({
        title: "Error",
        description: "Failed to fetch students. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, allStudents: false }));
    }
  }, [selectedFaculty, selectedSemester, toast]);

  // Fetch subjects with today's attendance for selected student
  const fetchStudentSubjects = useCallback(async () => {
    if (!selectedStudent || !selectedFaculty || !selectedSemester) return;
    
    setLoading(prev => ({ ...prev, subjects: true }));
    try {
      // Get all subjects for this faculty/semester
      const subjectsResponseRaw = await api.subjects.getByFacultySemester(
        parseInt(selectedFaculty),
        parseInt(selectedSemester)
      );
      const subjectsResponse = Array.isArray(subjectsResponseRaw)
        ? (subjectsResponseRaw as SubjectWithAttendance[])
        : [];
      
      // Get attendance for this student across all subjects for selected date
      const attendanceResponseRaw = await api.attendance.getAll({
        studentId: selectedStudent,
        date: selectedDate
      });
      const attendanceResponse = Array.isArray(attendanceResponseRaw?.records)
        ? attendanceResponseRaw.records
            .map(record => normalizeAttendanceRecord(record, selectedDate))
            .filter((record): record is AttendanceRecord => record !== null)
        : [];
      
      // Check if system was active on the selected date
      // by checking if ANY attendance record was created on the same day
      const targetDate = new Date(selectedDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      targetDate.setHours(0, 0, 0, 0);
      
      const systemWasActive = attendanceResponse.some((record) => {
        const createdDate = new Date(record.createdAt || record.created_at);
        const recordDate = new Date(record.date);
        createdDate.setHours(0, 0, 0, 0);
        recordDate.setHours(0, 0, 0, 0);
        return createdDate.getTime() === recordDate.getTime();
      });
      
      // Determine default status for subjects with no records
      // IMPORTANT: Default should be 'no_data' or 'system_inactive', NOT 'absent'
      // 'absent' should ONLY come from actual database records
      let defaultStatus: AttendanceStatus = 'no_data';
      if (targetDate > today) {
        // Future dates should show no_data
        defaultStatus = 'no_data';
      } else if (targetDate.getTime() === today.getTime()) {
        // Today should show no_data (not marked yet)
        defaultStatus = 'no_data';
      } else if (!systemWasActive && attendanceResponse.length === 0) {
        // Past dates with no system activity should show system_inactive
        defaultStatus = 'system_inactive';
      } else if (systemWasActive && attendanceResponse.length > 0) {
        // System was active, but this specific subject has no record
        // This means the student was likely absent (but should be explicitly marked)
        defaultStatus = 'no_data';
      }
      
      // Create attendance map with cancellation information
      // Since backend now creates actual attendance records with status='cancelled',
      // we don't need special handling for missing records
      const attendanceMap = attendanceResponse.reduce<Record<string, { status: AttendanceStatus; cancellation_reason?: string }>>((acc, record) => {
        if (record.subjectId !== undefined) {
          acc[String(record.subjectId)] = {
            status: record.status as AttendanceStatus,
            cancellation_reason: record.cancellation_reason || record.notes
          };
          // Debug log removed
        }
        return acc;
      }, {});
      
      // Combine subjects with attendance status
      const subjectsWithAttendance = subjectsResponse.map((subject) => {
        const attendanceInfo = attendanceMap[subject.id.toString()];
        
        console.log(`[FRONTEND DEBUG] Subject ${subject.code} (ID: ${subject.id}): attendanceInfo=`, attendanceInfo, `defaultStatus=${defaultStatus}`);
        
        return {
          ...subject,
          todayStatus: attendanceInfo?.status || defaultStatus,
          cancellation_reason: attendanceInfo?.cancellation_reason,
          hasChanges: false
        };
      });
      
      setSubjects(subjectsWithAttendance);
    } catch (error) {
      console.error('Error fetching student subjects:', error);
      toast({
        title: "Error",
        description: "Failed to fetch student subjects",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, subjects: false }));
    }
  }, [selectedStudent, selectedFaculty, selectedSemester, selectedDate, toast]);

  // Quick search function - searches across all students globally
  const performQuickSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setQuickSearchResults([]);
      setShowQuickSearch(false);
      return;
    }

    setLoading(prev => ({ ...prev, quickSearch: true }));
    setShowQuickSearch(true);
    
    try {
      // Fetch all students
      const response = await api.students.getAll();
      
      // Filter based on search query
      const searchTerm = query.toLowerCase().trim();
      const filtered = Array.isArray(response)
        ? response.filter(isStudentApi).filter((student) => {
            const nameMatch = (student.full_name || student.name || '').toLowerCase().includes(searchTerm);
            const idMatch = (student.student_id || student.studentId || '').toLowerCase().includes(searchTerm);
            const emailMatch = (student.email || '').toLowerCase().includes(searchTerm);
            const facultyMatch = (student.faculty || '').toLowerCase().includes(searchTerm);
            return nameMatch || idMatch || emailMatch || facultyMatch;
          })
        : [];
      
      setQuickSearchResults(
        filtered.slice(0, 50).map(student => ({
          ...toStudentWithAttendance(student),
          status: 'absent' as const,
        }))
      );
    } catch (error) {
      console.error('Error performing quick search:', error);
      toast({
        title: "Error",
        description: "Failed to search students",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, quickSearch: false }));
    }
  }, [toast]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        void performQuickSearch(searchQuery);
      } else {
        setQuickSearchResults([]);
        setShowQuickSearch(false);
      }
    }, 300);
    
    return () => { clearTimeout(timer); };
  }, [searchQuery, performQuickSearch]);

  // Fetch students when subject changes (for subject view)
  useEffect(() => {
    if (viewMode === 'subject' && selectedFaculty && selectedSemester && selectedSubject) {
      void fetchStudents();
    } else {
      setStudents([]);
    }
  }, [viewMode, selectedFaculty, selectedSemester, selectedSubject, fetchStudents]);

  // Fetch all students when faculty/semester changes (for student view)
  useEffect(() => {
    if (viewMode === 'student' && selectedFaculty && selectedSemester) {
      void fetchAllStudents();
    } else {
      setAllStudents([]);
    }
  }, [viewMode, selectedFaculty, selectedSemester, fetchAllStudents, refreshCounter]);

  // Fetch student subjects when student or date is selected
  useEffect(() => {
    if (viewMode === 'student' && selectedStudent && selectedDate) {
      void fetchStudentSubjects();
    } else {
      setSubjects([]);
    }
  }, [viewMode, selectedStudent, selectedDate, fetchStudentSubjects, refreshCounter]);

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return <CheckmarkFilled size={14} className="text-status-success" />;
      case 'late':
        return <Time size={14} className="text-status-warning" />;
      case 'system_inactive':
      case 'no_data':
        return <Time size={14} className="text-text-muted" />;
      case 'cancelled':
        return <Stop size={14} className="text-text-muted" />;
      case 'absent':
      default:
        return <CloseFilled size={14} className="text-status-danger" />;
    }
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    const variants: Record<AttendanceStatus, string> = {
      present: 'bg-status-success/10 text-status-success border-status-success/30',
      late: 'bg-status-warning/10 text-status-warning border-status-warning/30',
      absent: 'bg-status-danger/10 text-status-danger border-status-danger/30',
      system_inactive: 'bg-surface-subtle text-text-muted border-border-default border-dashed',
      no_data: 'bg-surface-subtle text-text-muted border-border-default',
      cancelled: 'bg-surface-subtle text-text-muted border-border-default',
    };
    
    const statusLabel = status === 'system_inactive'
      ? 'System Inactive'
      : status === 'no_data'
        ? 'No Data'
        : status === 'cancelled'
          ? 'Cancelled'
          : status;
    
    return (
      <Badge variant="outline" className={`text-xs gap-1 py-0.5 ${variants[status]}`}>
        {getStatusIcon(status)}
        <span className="capitalize">{statusLabel}</span>
      </Badge>
    );
  };

  const handleFacultyChange = (value: string) => {
    setSelectedFaculty(value);
    setSelectedSemester('');
    setSelectedSubject('');
    setSelectedStudent('');
    setStudents([]);
    setAllStudents([]);
    setStudentSubjectBreakdown([]);
  };

  const handleSemesterChange = (value: string) => {
    setSelectedSemester(value);
    setSelectedSubject('');
    setSelectedStudent('');
    setStudents([]);
    setAllStudents([]);
    setStudentSubjectBreakdown([]);
  };

  const handleSubjectChange = (value: string) => {
    setSelectedSubject(value);
  };

  const handleStudentChange = (value: string) => {
    setSelectedStudent(value);
  };

  const handleViewModeChange = (mode: 'subject' | 'student') => {
    setViewMode(mode);
    setSelectedSubject('');
    setSelectedStudent('');
    setStudents([]);
    setAllStudents([]);
    setStudentSubjectBreakdown([]);
  };

  // Manual attendance marking functions
  const markStudentAttendance = (studentId: number, status: 'present' | 'absent' | 'late') => {
    setStudents(prevStudents => 
      prevStudents.map(student => 
        student.id === studentId 
          ? { ...student, status, hasChanges: true }
          : student
      )
    );
  };

  const markAllStudents = (status: 'present' | 'absent' | 'late') => {
    setStudents(prevStudents => 
      prevStudents.map(student => ({ 
        ...student, 
        status, 
        hasChanges: true 
      }))
    );
  };

  const saveAttendanceChanges = async () => {
    const changedStudents = students.filter(student => student.hasChanges);
    
    if (changedStudents.length === 0) {
      toast({
        title: "No Changes",
        description: "No attendance changes to save.",
        variant: "default",
      });
      return;
    }

    setLoading(prev => ({ ...prev, saving: true }));
    
    try {
      const attendanceData = {
        subject_id: parseInt(selectedSubject),
        date: selectedDate,
        students: changedStudents.map(student => ({
          student_id: student.id,
          status: student.status
        }))
      };

      await api.attendance.markBulk(attendanceData);
      
      // Clear the hasChanges flag after successful save
      setStudents(prevStudents => 
        prevStudents.map(student => ({ 
          ...student, 
          hasChanges: false 
        }))
      );

      toast({
        title: "Attendance Saved",
        description: `Successfully updated attendance for ${changedStudents.length} students.`,
      });
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast({
        title: "Error",
        description: "Failed to save attendance changes.",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, saving: false }));
    }
  };

  // Subject attendance marking functions (for student view)
  const markSubjectAttendance = (subjectId: number, status: 'present' | 'absent' | 'late') => {
    setSubjects(prevSubjects => 
      prevSubjects.map(subject => 
        subject.id === subjectId 
          ? { ...subject, todayStatus: status, hasChanges: true }
          : subject
      )
    );
  };

  const markAllSubjects = (status: 'present' | 'absent' | 'late') => {
    console.log(`\n📋 Mark All Subjects: ${status.toUpperCase()}`);
    console.log(`   Before: ${subjects.filter(s => s.hasChanges).length} subjects with changes`);
    
    setSubjects(prevSubjects => 
      prevSubjects.map(subject => ({ 
        ...subject, 
        todayStatus: status, 
        hasChanges: true 
      }))
    );
    
    console.log(`   After: All ${subjects.length} subjects marked as ${status} with hasChanges=true\n`);
  };

  const saveStudentAttendanceChanges = async () => {
    const changedSubjects = subjects.filter(subject => subject.hasChanges);
    
    console.log('='.repeat(80));
    console.log('SAVE STUDENT ATTENDANCE CHANGES');
    console.log('='.repeat(80));
    console.log('Total subjects loaded:', subjects.length);
    console.log('Subjects with changes:', changedSubjects.length);
    console.log('Changed subjects:', changedSubjects.map(s => ({ id: s.id, name: s.name, status: s.todayStatus })));
    console.log('='.repeat(80));
    
    if (changedSubjects.length === 0) {
      toast({
        title: "No Changes",
        description: "No attendance changes to save.",
        variant: "default",
      });
      return;
    }

    setLoading(prev => ({ ...prev, saving: true }));
    
    try {
      // Save attendance for each subject separately
      let successCount = 0;
      for (const subject of changedSubjects) {
        const attendanceData = {
          subject_id: subject.id,
          date: selectedDate,
          students: [{
            student_id: parseInt(selectedStudent),
            status: subject.todayStatus
          }]
        };

        console.log(`\nSending request for subject: ${subject.name} (ID: ${subject.id})`);
        console.log('Request payload:', JSON.stringify(attendanceData, null, 2));
        
        await api.attendance.markBulk(attendanceData);
        successCount++;
        console.log(`✓ Successfully saved (${successCount}/${changedSubjects.length})`);
      }
      
      console.log(`\n✓ All ${successCount} requests completed successfully\n`);
      console.log('='.repeat(80));
      
      // Clear the hasChanges flag after successful save
      setSubjects(prevSubjects => 
        prevSubjects.map(subject => ({ 
          ...subject, 
          hasChanges: false 
        }))
      );

      toast({
        title: "Attendance Saved",
        description: `Successfully updated attendance for ${changedSubjects.length} subjects.`,
      });
    } catch (error) {
      console.error('Error saving student attendance:', error);
      toast({
        title: "Error",
        description: "Failed to save attendance changes.",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, saving: false }));
    }
  };

  const selectedFacultyName = faculties.find(f => f.id.toString() === selectedFaculty)?.name || '';
  const selectedSubjectName = subjects.find(s => s.id.toString() === selectedSubject)?.name || '';

  const attendanceStats = students.reduce((acc, student) => {
    acc[student.status] = (acc[student.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const hasUnsavedChanges = students.some(student => student.hasChanges);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">Attendance Management</h2>
          <p className="text-sm text-text-muted mt-1">
            Review and adjust attendance records by subject course roster or by individual student profile
          </p>
        </div>
      </div>

      {/* Quick Search */}
      <Card className="border border-border-default bg-surface-default shadow-none">
        <CardHeader className="py-4 border-b border-border-subtle">
          <CardTitle className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Search size={16} className="text-action-primary" />
            Quick Student Search
          </CardTitle>
          <p className="text-xs text-text-muted">
            Search students across all faculties and semesters by name, student ID, email, or department
          </p>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by student name, ID, email, or faculty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 h-10 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <Close size={14} />
              </button>
            )}
            {loading.quickSearch && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Renew size={14} className="animate-spin text-action-primary" />
              </div>
            )}
          </div>

          {/* Search Results */}
          {showQuickSearch && (
            <div className="mt-3">
              {quickSearchResults.length === 0 && !loading.quickSearch ? (
                <div className="text-center py-6 text-text-muted">
                  <UserMultiple size={28} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No students found matching "{searchQuery}"</p>
                  <p className="text-xs text-text-muted mt-0.5">Check spelling or try a different term</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span className="font-medium">
                      Found {quickSearchResults.length} student{quickSearchResults.length !== 1 ? 's' : ''}
                    </span>
                    {quickSearchResults.length === 50 && (
                      <span className="text-action-primary">Showing top 50 results</span>
                    )}
                  </div>
                  
                  <div className="max-h-72 overflow-y-auto rounded-md border border-border-default divide-y divide-border-subtle bg-surface-default">
                    {quickSearchResults.map((student) => (
                      <div
                        key={student.id}
                        onClick={() => {
                          if (student.faculty_id) {
                            setSelectedFaculty(student.faculty_id.toString());
                            setSelectedSemester(student.semester.toString());
                            setViewMode('student');
                            setTimeout(() => {
                              setSelectedStudent(student.id.toString());
                              setSearchQuery('');
                              setShowQuickSearch(false);
                            }, 400);
                          }
                        }}
                        className="p-3 hover:bg-surface-subtle cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-surface-subtle flex items-center justify-center text-action-primary">
                              <User size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-text-primary">{student.name}</p>
                              <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                                <span className="font-mono">{student.student_id}</span>
                                <span>{student.email}</span>
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            Semester {student.semester}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selection Controls */}
      <Card className="border border-border-default bg-surface-default shadow-none">
        <CardHeader className="py-4 border-b border-border-subtle">
          <CardTitle className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Education size={16} className="text-action-primary" />
            Attendance Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {/* View Mode Toggle */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">View Mode</label>
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                variant={viewMode === 'subject' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleViewModeChange('subject')}
                className="flex items-center gap-1.5"
              >
                <Book size={14} />
                <span>By Subject</span>
              </Button>
              <Button
                variant={viewMode === 'student' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleViewModeChange('student')}
                className="flex items-center gap-1.5"
              >
                <UserMultiple size={14} />
                <span>By Student</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRefreshCounter(prev => prev + 1);
                }}
                className="h-8 text-xs ml-auto flex items-center gap-1"
                title="Refresh datasets"
              >
                <Renew size={14} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Faculty Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Faculty</label>
              <Select value={selectedFaculty || undefined} onValueChange={handleFacultyChange}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select Faculty" />
                </SelectTrigger>
                <SelectContent>
                  {loading.faculties ? (
                    <SelectItem value="loading-faculties" disabled>
                      Loading faculties...
                    </SelectItem>
                  ) : (
                    faculties.map((faculty) => (
                      <SelectItem key={faculty.id} value={faculty.id.toString()}>
                        {faculty.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Semester Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Semester</label>
              <Select value={selectedSemester || undefined} onValueChange={handleSemesterChange} disabled={!selectedFaculty}>
                <SelectTrigger className="h-9 text-xs disabled:opacity-50">
                  <SelectValue placeholder="Select Semester" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                    <SelectItem key={sem} value={sem.toString()}>
                      Semester {sem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject Selection - Only show in subject view mode */}
            {viewMode === 'subject' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Subject</label>
                <Select value={selectedSubject || undefined} onValueChange={handleSubjectChange} disabled={!selectedSemester}>
                  <SelectTrigger className="h-9 text-xs disabled:opacity-50">
                    <SelectValue placeholder="Select Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {loading.subjects ? (
                      <SelectItem value="loading-subjects" disabled>
                        Loading subjects...
                      </SelectItem>
                    ) : (
                      subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id.toString()}>
                          {subject.name} ({subject.code})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Student Selection - Only show in student view mode */}
            {viewMode === 'student' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Student</label>
                <Select value={selectedStudent || undefined} onValueChange={handleStudentChange} disabled={!selectedSemester}>
                  <SelectTrigger className="h-9 text-xs disabled:opacity-50">
                    <SelectValue placeholder="Select Student" />
                  </SelectTrigger>
                  <SelectContent>
                    {loading.allStudents ? (
                      <SelectItem value="loading-students" disabled>
                        Loading students...
                      </SelectItem>
                    ) : allStudents.length === 0 ? (
                      <SelectItem value="no-students" disabled>
                        No students available
                      </SelectItem>
                    ) : (
                      allStudents.map((student) => (
                        <SelectItem key={student.id} value={student.id.toString()}>
                          {student.name} ({student.student_id})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Attendance Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-surface-default border border-border-default rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-action-primary"
              />
            </div>
          </div>

          {/* Selection Summary */}
          {selectedFaculty && selectedSemester && (
            <div className="p-3 bg-surface-subtle rounded-md border border-border-subtle">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                <span>
                  <strong className="text-text-primary">Faculty:</strong> {selectedFacultyName}
                </span>
                <span>
                  <strong className="text-text-primary">Semester:</strong> {selectedSemester}
                </span>
                {viewMode === 'subject' && selectedSubject && (
                  <>
                    <span>
                      <strong className="text-text-primary">Subject:</strong> {selectedSubjectName}
                    </span>
                    <span>
                      <strong className="text-text-primary">Date:</strong> {selectedDate}
                    </span>
                  </>
                )}
                {viewMode === 'student' && selectedStudent && (
                  <>
                    <span>
                      <strong className="text-text-primary">Student:</strong> {allStudents.find(s => s.id.toString() === selectedStudent)?.name || 'Unknown'}
                    </span>
                    <span>
                      <strong className="text-text-primary">Date:</strong> {selectedDate}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subject View - Students List */}
      {viewMode === 'subject' && selectedFaculty && selectedSemester && selectedSubject && (
        <div className="bg-surface-default border border-border-default rounded-md overflow-hidden">
          <div className="p-4 border-b border-border-default flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-text-primary">
                  Student Attendance Roster
                </h3>
                {students.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {filteredStudents.length} {searchQuery && `of ${students.length}`} students
                  </Badge>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Showing attendance state for {selectedSubjectName} on {selectedDate}
              </p>
            </div>
            
            {/* Stats & Save */}
            <div className="flex items-center gap-2 flex-wrap">
              {students.length > 0 && (
                <div className="flex gap-1.5 text-xs">
                  <span className="px-2 py-0.5 rounded bg-status-success/10 text-status-success border border-status-success/30 font-medium tabular-nums">
                    Present: {attendanceStats.present || 0}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-status-warning/10 text-status-warning border border-status-warning/30 font-medium tabular-nums">
                    Late: {attendanceStats.late || 0}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-status-danger/10 text-status-danger border border-status-danger/30 font-medium tabular-nums">
                    Absent: {attendanceStats.absent || 0}
                  </span>
                </div>
              )}
              
              {hasUnsavedChanges && (
                <Button 
                  onClick={saveAttendanceChanges}
                  disabled={loading.saving}
                  size="sm"
                  className="flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span>{loading.saving ? 'Saving...' : 'Save Changes'}</span>
                </Button>
              )}
            </div>
          </div>
          
          {/* Search Bar & Bulk Actions */}
          {students.length > 0 && (
            <div className="p-3 bg-surface-subtle/50 border-b border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Filter student list..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-7 h-8 text-xs bg-surface-default"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    <Close size={12} />
                  </button>
                )}
              </div>
              
              {filteredStudents.length > 0 && (
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <span className="text-xs text-text-muted mr-1">Bulk:</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAllStudents('present')}
                    className="h-7 text-xs px-2 text-status-success hover:bg-status-success/10 hover:border-status-success"
                  >
                    <UserFollow size={12} className="mr-1" />
                    All Present
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAllStudents('absent')}
                    className="h-7 text-xs px-2 text-status-danger hover:bg-status-danger/10 hover:border-status-danger"
                  >
                    <UserAdmin size={12} className="mr-1" />
                    All Absent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAllStudents('late')}
                    className="h-7 text-xs px-2 text-status-warning hover:bg-status-warning/10 hover:border-status-warning"
                  >
                    <Time size={12} className="mr-1" />
                    All Late
                  </Button>
                </div>
              )}
            </div>
          )}

          {loading.students ? (
            <div className="p-8 text-center text-xs text-text-muted">
              Loading student roster...
            </div>
          ) : students.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted">
              No students enrolled in this course for Semester {selectedSemester}.
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-muted">
              No students match "{searchQuery}".
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border-default bg-surface-subtle">
                    <TableHead className="w-[120px] text-xs font-semibold text-text-muted uppercase">Student ID</TableHead>
                    <TableHead className="text-xs font-semibold text-text-muted uppercase">Full Name</TableHead>
                    <TableHead className="text-xs font-semibold text-text-muted uppercase">Email Address</TableHead>
                    <TableHead className="w-[100px] text-xs font-semibold text-text-muted uppercase">Semester</TableHead>
                    <TableHead className="w-[130px] text-xs font-semibold text-text-muted uppercase">Status</TableHead>
                    <TableHead className="w-[120px] text-right text-xs font-semibold text-text-muted uppercase">Mark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow 
                      key={student.id} 
                      className={`h-11 border-b border-border-subtle hover:bg-surface-subtle/50 ${
                        student.hasChanges ? 'bg-action-primary/5' : ''
                      }`}
                    >
                      <TableCell className="font-mono text-xs text-text-secondary">
                        <span className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle">
                          {student.student_id}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-text-primary">
                        {student.name}
                        {student.hasChanges && (
                          <Badge variant="outline" className="ml-2 text-[10px] text-action-primary border-action-primary/30">
                            Modified
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-text-muted">
                        {student.email}
                      </TableCell>
                      <TableCell className="text-xs text-text-secondary">
                        Semester {student.semester}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(student.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markStudentAttendance(student.id, 'present')}
                            disabled={student.status === 'present'}
                            className={`h-7 w-7 p-0 ${student.status === 'present' ? 'opacity-40' : 'text-status-success hover:bg-status-success/10'}`}
                            title="Mark Present"
                          >
                            <CheckmarkFilled size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markStudentAttendance(student.id, 'late')}
                            disabled={student.status === 'late'}
                            className={`h-7 w-7 p-0 ${student.status === 'late' ? 'opacity-40' : 'text-status-warning hover:bg-status-warning/10'}`}
                            title="Mark Late"
                          >
                            <Time size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markStudentAttendance(student.id, 'absent')}
                            disabled={student.status === 'absent'}
                            className={`h-7 w-7 p-0 ${student.status === 'absent' ? 'opacity-40' : 'text-status-danger hover:bg-status-danger/10'}`}
                            title="Mark Absent"
                          >
                            <CloseFilled size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Student View - Manual Attendance for All Subjects */}
      {viewMode === 'student' && selectedFaculty && selectedSemester && selectedStudent && (
        <div className="bg-surface-default border border-border-default rounded-md overflow-hidden">
          <div className="p-4 border-b border-border-default flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-text-primary">
                  Student Subject Attendance
                </h3>
                {subjects.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {subjects.length} subjects
                  </Badge>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Marking course attendance across curriculum for selected student
              </p>
            </div>
            
            {/* Stats & Save */}
            <div className="flex items-center gap-2 flex-wrap">
              {subjects.length > 0 && (
                <div className="flex gap-1.5 text-xs">
                  <span className="px-2 py-0.5 rounded bg-status-success/10 text-status-success border border-status-success/30 font-medium tabular-nums">
                    Present: {subjects.filter(s => s.todayStatus === 'present').length}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-status-warning/10 text-status-warning border border-status-warning/30 font-medium tabular-nums">
                    Late: {subjects.filter(s => s.todayStatus === 'late').length}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-status-danger/10 text-status-danger border border-status-danger/30 font-medium tabular-nums">
                    Absent: {subjects.filter(s => s.todayStatus === 'absent').length}
                  </span>
                </div>
              )}
              
              {subjects.some(s => s.hasChanges) && (
                <Button 
                  onClick={saveStudentAttendanceChanges}
                  disabled={loading.saving}
                  size="sm"
                  className="flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span>{loading.saving ? 'Saving...' : 'Save Changes'}</span>
                </Button>
              )}
            </div>
          </div>
          
          {/* Bulk Actions */}
          {subjects.length > 0 && (
            <div className="p-3 bg-surface-subtle/50 border-b border-border-subtle flex items-center justify-end gap-1.5">
              <span className="text-xs text-text-muted mr-1">Bulk:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllSubjects('present')}
                className="h-7 text-xs px-2 text-status-success hover:bg-status-success/10 hover:border-status-success"
              >
                <UserFollow size={12} className="mr-1" />
                All Present
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllSubjects('absent')}
                className="h-7 text-xs px-2 text-status-danger hover:bg-status-danger/10 hover:border-status-danger"
              >
                <UserAdmin size={12} className="mr-1" />
                All Absent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllSubjects('late')}
                className="h-7 text-xs px-2 text-status-warning hover:bg-status-warning/10 hover:border-status-warning"
              >
                <Time size={12} className="mr-1" />
                All Late
              </Button>
            </div>
          )}

          {loading.subjects ? (
            <div className="p-8 text-center text-xs text-text-muted">
              Loading courses...
            </div>
          ) : subjects.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted">
              This student is not enrolled in any courses for this semester.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border-default bg-surface-subtle">
                    <TableHead className="w-[120px] text-xs font-semibold text-text-muted uppercase">Course Code</TableHead>
                    <TableHead className="text-xs font-semibold text-text-muted uppercase">Subject Name</TableHead>
                    <TableHead className="w-[100px] text-xs font-semibold text-text-muted uppercase">Credits</TableHead>
                    <TableHead className="w-[140px] text-xs font-semibold text-text-muted uppercase">Status</TableHead>
                    <TableHead className="w-[120px] text-right text-xs font-semibold text-text-muted uppercase">Mark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.map((subject) => (
                    <TableRow 
                      key={subject.id} 
                      className={`h-11 border-b border-border-subtle hover:bg-surface-subtle/50 ${
                        subject.hasChanges ? 'bg-action-primary/5' : ''
                      }`}
                    >
                      <TableCell className="font-mono text-xs text-text-secondary">
                        <span className="px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle">
                          {subject.code}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-text-primary">
                        {subject.name}
                        {subject.hasChanges && (
                          <Badge variant="outline" className="ml-2 text-[10px] text-action-primary border-action-primary/30">
                            Modified
                          </Badge>
                        )}
                        {subject.todayStatus === 'cancelled' && subject.cancellation_reason && (
                          <div className="text-xs text-text-muted mt-0.5">
                            Reason: {subject.cancellation_reason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-text-secondary tabular-nums">
                        {subject.credits || 3} hrs
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(subject.todayStatus || 'absent')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markSubjectAttendance(subject.id, 'present')}
                            disabled={subject.todayStatus === 'present' || subject.todayStatus === 'cancelled'}
                            className={`h-7 w-7 p-0 ${subject.todayStatus === 'present' ? 'opacity-40' : 'text-status-success hover:bg-status-success/10'}`}
                            title="Mark Present"
                          >
                            <CheckmarkFilled size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markSubjectAttendance(subject.id, 'late')}
                            disabled={subject.todayStatus === 'late' || subject.todayStatus === 'cancelled'}
                            className={`h-7 w-7 p-0 ${subject.todayStatus === 'late' ? 'opacity-40' : 'text-status-warning hover:bg-status-warning/10'}`}
                            title="Mark Late"
                          >
                            <Time size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markSubjectAttendance(subject.id, 'absent')}
                            disabled={subject.todayStatus === 'absent' || subject.todayStatus === 'cancelled'}
                            className={`h-7 w-7 p-0 ${subject.todayStatus === 'absent' ? 'opacity-40' : 'text-status-danger hover:bg-status-danger/10'}`}
                            title="Mark Absent"
                          >
                            <CloseFilled size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedAttendanceManagement;
