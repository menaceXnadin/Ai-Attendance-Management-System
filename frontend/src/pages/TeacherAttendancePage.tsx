import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  CalendarIcon,
  Users,
  BookOpen,
  CheckCircle,
  XCircle,
  Save,
  Loader2,
  Clock,
  Ban,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TeacherSidebar from '@/components/TeacherSidebar';
import { api } from '@/integrations/api/client';
import { format } from 'date-fns';
import { DayPicker } from 'react-day-picker';

interface Subject {
  id: number;
  name: string;
  code: string;
  semesters: number[];
}

interface Student {
  id: number;
  student_id: string;
  name: string;
  email: string;
  semester: number;
  year: number;
  attendance_status?: string;
}

const TeacherAttendancePage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State management
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [semesterFilter, setSemesterFilter] = useState<number | null>(null); // Optional filter
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [studentAttendance, setStudentAttendance] = useState<Record<number, string>>({});

  // Fetch teacher's subjects from dashboard
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: () => api.teacher.getDashboard(),
  });

  const allSubjects = (dashboardData?.subjects || []) as Subject[];

  // Filter subjects by optional semester filter
  const filteredSubjects = semesterFilter
    ? allSubjects.filter(s => s.semesters.includes(semesterFilter))
    : allSubjects;

  // Get all unique semesters across all teacher's subjects for the filter dropdown
  const allSemesters = Array.from(
    new Set(allSubjects.flatMap(s => s.semesters))
  ).sort((a, b) => a - b);

  // Get the semester to use for fetching students (first semester of selected subject)
  const selectedSubjectData = selectedSubject
    ? allSubjects.find(s => s.id === selectedSubject)
    : null;
  const semesterForFetch = selectedSubjectData?.semesters[0] || null;

  // Fetch students for selected subject WITH attendance status (like admin)
  const {
    data: attendanceData,
    isLoading: studentsLoading,
    refetch: refetchStudents,
  } = useQuery({
    queryKey: ['teacher-subject-attendance', selectedSubject, semesterForFetch, selectedDate],
    queryFn: async () => {
      if (!selectedSubject || !semesterForFetch) return null;
      return await api.teacher.getSubjectStudentsWithAttendance(
        selectedSubject,
        semesterForFetch,
        selectedDate
      );
    },
    enabled: !!(selectedSubject && semesterForFetch),
  });

  const students = attendanceData?.students || [];

  // Bulk attendance mutation
  const markAttendanceMutation = useMutation({
    mutationFn: async (data: {
      subject_id: number;
      semester: number;
      faculty_id: number;
      date: string;
      attendance_records: Array<{ student_id: number; status: string }>;
    }) => {
      return await api.teacher.bulkMarkAttendance(data);
    },
    onSuccess: () => {
      toast({
        title: 'Attendance Marked',
        description: 'Attendance has been successfully saved for all students.',
      });
      refetchStudents();
      queryClient.invalidateQueries({ queryKey: ['teacher-attendance'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to mark attendance. Please try again.',
        variant: 'destructive',
      });
      console.error('Attendance marking error:', error);
    },
  });

  // Reset subject when semester filter changes
  useEffect(() => {
    setSelectedSubject(null);
  }, [semesterFilter]);

  // Initialize attendance records from fetched data (like admin)
  useEffect(() => {
    if (attendanceData?.students) {
      const initialAttendance: Record<number, string> = {};
      attendanceData.students.forEach((student: Student) => {
        initialAttendance[student.id] = student.attendance_status || 'no_data';
      });
      setStudentAttendance(initialAttendance);
    }
  }, [attendanceData]);

  const handleAttendanceChange = (studentId: number, status: string) => {
    setStudentAttendance(prev => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleMarkAllPresent = () => {
    if (students.length > 0) {
      const allPresent: Record<number, string> = {};
      students.forEach((student: Student) => {
        allPresent[student.id] = 'present';
      });
      setStudentAttendance(allPresent);
    }
  };

  const handleMarkAllAbsent = () => {
    if (students.length > 0) {
      const allAbsent: Record<number, string> = {};
      students.forEach((student: Student) => {
        allAbsent[student.id] = 'absent';
      });
      setStudentAttendance(allAbsent);
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedSubject || !semesterForFetch || students.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select a subject and ensure students are loaded.',
        variant: 'destructive',
      });
      return;
    }

    // Only save students with valid attendance status (not no_data or system_inactive)
    const studentsData = students
      .filter((student: Student) => {
        const status = studentAttendance[student.id];
        return status && ['present', 'absent', 'late'].includes(status);
      })
      .map((student: Student) => ({
        student_id: student.id,
        status: studentAttendance[student.id],
      }));

    if (studentsData.length === 0) {
      toast({
        title: 'No Attendance to Save',
        description: 'Please mark attendance for at least one student.',
        variant: 'destructive',
      });
      return;
    }

    // Get faculty_id from the first student (all students have same faculty_id)
    const facultyId = students[0]?.faculty_id || dashboardData?.teacher?.faculty_id || 0;

    markAttendanceMutation.mutate({
      subject_id: selectedSubject,
      semester: semesterForFetch,
      faculty_id: facultyId,
      date: selectedDate,
      attendance_records: studentsData,
    });
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-500/20 text-green-300 border-green-400/30';
      case 'late':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30';
      case 'absent':
        return 'bg-red-500/20 text-red-300 border-red-400/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-400/30';
    }
  };

  return (
    <TeacherSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">
              Mark Attendance
            </h1>
            <p className="text-slate-400 mt-2 text-lg">
              Record attendance for students in your assigned subjects
            </p>
          </div>
          <div className="flex items-center gap-3 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 rounded-2xl px-5 py-3">
            <CalendarIcon className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Selected Date</p>
              <p className="text-sm font-bold text-white">{format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}</p>
            </div>
          </div>
        </div>

        {/* Selection Controls */}
        <Card className="bg-gradient-to-br from-slate-900/90 to-slate-900/50 border-slate-700/50 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-white flex items-center gap-3 text-2xl font-bold">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-blue-400" />
              </div>
              Select Subject & Date
            </CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              Choose a date, optionally filter by semester, then select the subject to mark attendance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">\n            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Date Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between bg-slate-800/50 border-slate-600/50 hover:bg-slate-700/60 hover:border-slate-500/60 h-11 relative group !text-white transition-all duration-200"
                    >
                      <span className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-blue-400" />
                        <span className="font-medium">
                          {selectedDate
                            ? format(new Date(selectedDate), 'MMMM dd, yyyy')
                            : 'Pick a date'}
                        </span>
                      </span>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-70 group-hover:opacity-100 transition-opacity text-slate-400"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 bg-slate-900 border-slate-700 shadow-2xl"
                    align="start"
                  >
                    <style>{`
                      .rdp {
                        margin: 0 !important;
                        --rdp-cell-size: 44px !important;
                        --rdp-accent-color: #3b82f6 !important;
                        --rdp-background-color: rgba(59, 130, 246, 0.1) !important;
                      }
                      .rdp-months {
                        justify-content: center !important;
                      }
                      .rdp-month {
                        width: 100% !important;
                      }
                      .rdp-table {
                        max-width: 100% !important;
                      }
                      .rdp-nav_button {
                        color: #ffffff !important;
                        background-color: #334155 !important;
                        border: 1px solid #475569 !important;
                        width: 36px !important;
                        height: 36px !important;
                      }
                      .rdp-nav_button:hover {
                        background-color: #475569 !important;
                        border-color: #64748b !important;
                      }
                      .rdp-caption_label {
                        color: #ffffff !important;
                        font-weight: 600 !important;
                        font-size: 1rem !important;
                      }
                      .rdp-head_cell {
                        color: #94a3b8 !important;
                        font-weight: 600 !important;
                        font-size: 0.875rem !important;
                        text-transform: uppercase !important;
                        padding: 8px 0 !important;
                      }
                      .rdp-cell {
                        padding: 2px !important;
                      }
                      .rdp-day {
                        color: #ffffff !important;
                        border: 2px solid transparent !important;
                        border-radius: 10px !important;
                        font-weight: 500 !important;
                        width: 44px !important;
                        height: 44px !important;
                        transition: all 0.2s !important;
                      }
                      .rdp-day:hover:not(.rdp-day_selected):not(.rdp-day_disabled) {
                        background-color: #475569 !important;
                        border-color: #64748b !important;
                      }
                      .rdp-day_selected {
                        background-color: #3b82f6 !important;
                        color: #ffffff !important;
                        border-color: #60a5fa !important;
                        font-weight: 700 !important;
                      }
                      .rdp-day_selected:hover {
                        background-color: #2563eb !important;
                        border-color: #3b82f6 !important;
                      }
                      .rdp-day_today:not(.rdp-day_selected) {
                        background-color: #334155 !important;
                        font-weight: 700 !important;
                        border-color: #475569 !important;
                      }
                      .rdp-day_outside {
                        color: #475569 !important;
                        opacity: 0.5 !important;
                      }
                      .rdp-day_disabled {
                        color: #475569 !important;
                        opacity: 0.3 !important;
                        cursor: not-allowed !important;
                      }
                    `}</style>
                    <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg border border-slate-700">
                      <DayPicker
                        mode="single"
                        selected={selectedDate ? new Date(selectedDate + 'T00:00:00') : undefined}
                        onSelect={(date) => {
                          if (date) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            setSelectedDate(`${year}-${month}-${day}`);
                          }
                        }}
                        className="text-white rdp-custom"
                        showOutsideDays={false}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Semester Filter (Optional) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  Filter by Semester <span className="text-xs text-slate-500 font-normal">(Optional)</span>
                </label>
                <Select
                    value={semesterFilter === null ? 'all' : semesterFilter.toString()}
                    onValueChange={(value) => {
                      if (value === 'all') {
                        setSemesterFilter(null);
                      } else {
                        setSemesterFilter(parseInt(value));
                      }
                    }}
                >
                  <SelectTrigger className="bg-slate-800/50 border-slate-600/50 text-white hover:bg-slate-700/60 hover:border-slate-500/60 h-11 transition-all duration-200">
                    <SelectValue placeholder="All Semesters" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                      <SelectItem value="all">All Semesters</SelectItem>
                    {allSemesters.map((semester: number) => (
                      <SelectItem key={semester} value={semester.toString()}>
                        Semester {semester}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  Subject
                  {filteredSubjects.length > 0 && (
                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30 text-xs px-2 py-0">
                      {filteredSubjects.length}
                    </Badge>
                  )}
                </label>
                <Select
                  value={selectedSubject?.toString() || ''}
                  onValueChange={(value) => setSelectedSubject(parseInt(value))}
                >
                  <SelectTrigger className="bg-slate-800/50 border-slate-600/50 text-white hover:bg-slate-700/60 hover:border-slate-500/60 h-11 transition-all duration-200">
                    <SelectValue placeholder="Select Subject" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600 max-h-[300px]">
                    {dashboardLoading ? (
                      <SelectItem value="loading" disabled>
                        Loading subjects...
                      </SelectItem>
                    ) : filteredSubjects.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No subjects available
                      </SelectItem>
                    ) : (
                      filteredSubjects.map((subject: Subject) => (
                        <SelectItem key={subject.id} value={subject.id.toString()}>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{subject.name}</span>
                            <span className="text-slate-400">({subject.code})</span>
                            <span className="text-xs text-slate-500">
                              Sem {subject.semesters.join(', ')}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Selected Subject Info */}
            {selectedSubjectData && (
              <div className="p-5 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/30 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">Selected Subject</p>
                    <p className="text-xl font-bold text-white mb-1">
                      {selectedSubjectData.name}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-400/30">{selectedSubjectData.code}</Badge>
                      <span className="text-sm text-slate-400">
                        Loading students for Semester {semesterForFetch}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center">
                      <Users className="w-7 h-7 text-blue-400" />
                    </div>
                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30 text-lg font-bold px-3 py-1">
                      {students.length}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cancellation Warning Banner */}
        {attendanceData?.is_cancelled && (
          <Card className="bg-gradient-to-br from-rose-900/30 to-rose-800/20 border-rose-600/50 backdrop-blur-md shadow-xl shadow-rose-500/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="mt-0.5">
                  <div className="rounded-full bg-rose-500/20 p-3 animate-pulse">
                    <Ban className="h-7 w-7 text-rose-400" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-rose-300 mb-2 flex items-center gap-2">
                    Class Cancelled
                  </h3>
                  <p className="text-slate-200 mb-3 text-base">
                    This class was cancelled for <span className="font-semibold">{format(new Date(selectedDate), 'MMMM d, yyyy')}</span>. 
                    Attendance cannot be marked for cancelled classes.
                  </p>
                  {attendanceData.cancellation_reason && (
                    <div className="flex items-start gap-2 text-sm text-slate-300 bg-slate-800/50 p-4 rounded-xl border border-rose-500/20">
                      <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-amber-300">Reason:</span>{' '}
                        {attendanceData.cancellation_reason}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Students List with Attendance */}
        {selectedSubject && !attendanceData?.is_cancelled && (
          <Card className="bg-gradient-to-br from-slate-900/90 to-slate-900/50 border-slate-700/50 shadow-xl">
            <CardHeader className="pb-4 border-b border-slate-800/50">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-white flex items-center gap-3 text-2xl font-bold">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-green-400" />
                    </div>
                    Student Attendance
                    {students.length > 0 && (
                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30 text-sm">
                        {students.length} {students.length === 1 ? 'student' : 'students'}
                      </Badge>
                    )}
                  </CardTitle>
                  {students.length > 0 && (
                    <div className="flex gap-6 text-sm text-slate-400 mt-3">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        Present: <span className="font-semibold text-emerald-400">
                          {Object.values(studentAttendance).filter(s => s === 'present').length}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                        Absent: <span className="font-semibold text-rose-400">
                          {Object.values(studentAttendance).filter(s => s === 'absent').length}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                        Late: <span className="font-semibold text-amber-400">
                          {Object.values(studentAttendance).filter(s => s === 'late').length}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 flex-wrap">
                  <Button
                    onClick={handleMarkAllPresent}
                    variant="outline"
                    size="sm"
                    className="border-green-600/50 text-green-300 hover:bg-green-500/20 hover:border-green-500/70 transition-all duration-200"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark All Present
                  </Button>
                  <Button
                    onClick={handleMarkAllAbsent}
                    variant="outline"
                    size="sm"
                    className="border-red-600/50 text-red-300 hover:bg-red-500/20 hover:border-red-500/70 transition-all duration-200"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Mark All Absent
                  </Button>
                  <Button
                    onClick={handleSaveAttendance}
                    disabled={markAttendanceMutation.isPending}
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg shadow-blue-500/30 transition-all duration-200"
                  >
                    {markAttendanceMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Attendance
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {studentsLoading ? (
                <div className="flex flex-col justify-center items-center py-16">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                  </div>
                  <p className="mt-4 text-slate-400 font-medium">Loading students...</p>
                </div>
              ) : students.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700/50 hover:bg-slate-800/30">
                        <TableHead className="text-slate-300 font-semibold">Student ID</TableHead>
                        <TableHead className="text-slate-300 font-semibold">Name</TableHead>
                        <TableHead className="text-slate-300 font-semibold">Email</TableHead>
                        <TableHead className="text-slate-300 font-semibold">Semester</TableHead>
                        <TableHead className="text-slate-300 font-semibold">Status</TableHead>
                        <TableHead className="text-slate-300 font-semibold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student: Student) => (
                        <TableRow
                          key={student.id}
                          className="border-slate-700/50 hover:bg-slate-800/40 transition-colors duration-150"
                        >
                          <TableCell className="text-white font-mono font-semibold">
                            {student.student_id}
                          </TableCell>
                          <TableCell className="text-white font-medium">{student.name}</TableCell>
                          <TableCell className="text-slate-400">{student.email}</TableCell>
                          <TableCell className="text-slate-300">
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-300 border-blue-500/30">
                              Sem {student.semester}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getStatusBadgeColor(studentAttendance[student.id] || 'no_data')}
                            >
                              {studentAttendance[student.id] === 'present' && <CheckCircle className="h-3.5 w-3.5 mr-1.5" />}
                              {studentAttendance[student.id] === 'absent' && <XCircle className="h-3.5 w-3.5 mr-1.5" />}
                              {studentAttendance[student.id] === 'late' && <Clock className="h-3.5 w-3.5 mr-1.5" />}
                              {studentAttendance[student.id] 
                                ? studentAttendance[student.id].charAt(0).toUpperCase() + studentAttendance[student.id].slice(1)
                                : 'Not Marked'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAttendanceChange(student.id, 'present')}
                                disabled={studentAttendance[student.id] === 'present'}
                                className="text-green-400 border-green-400/30 hover:bg-green-500/20 hover:border-green-400/50 h-9 w-9 p-0 transition-all duration-200"
                                title="Mark Present"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAttendanceChange(student.id, 'late')}
                                disabled={studentAttendance[student.id] === 'late'}
                                className="text-yellow-400 border-yellow-400/30 hover:bg-yellow-500/20 hover:border-yellow-400/50 h-9 w-9 p-0 transition-all duration-200"
                                title="Mark Late"
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAttendanceChange(student.id, 'absent')}
                                disabled={studentAttendance[student.id] === 'absent'}
                                className="text-red-400 border-red-400/30 hover:bg-red-500/20 hover:border-red-400/50 h-9 w-9 p-0 transition-all duration-200"
                                title="Mark Absent"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
                    <Users className="h-10 w-10 text-slate-500" />
                  </div>
                  <p className="font-semibold text-slate-400 mb-1">No students found</p>
                  <p className="text-sm text-slate-500">
                    No students are enrolled in this subject for the selected semester.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        {!selectedSubject && (
          <Card className="bg-gradient-to-br from-slate-900/90 to-slate-900/50 border-slate-700/50 shadow-xl">
            <CardContent className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
                <BookOpen className="h-10 w-10 text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                Welcome to Attendance Management
              </h3>
              <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
                Select a subject and date to view and mark attendance for your students. Follow the steps below to get started.
              </p>
              <div className="flex items-center justify-center gap-6 flex-wrap text-sm">
                <div className="flex flex-col items-center gap-3 max-w-xs">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 text-white flex items-center justify-center text-lg font-bold shadow-lg">
                    1
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-white mb-1">Pick a Date</p>
                    <p className="text-xs text-slate-500">Select the date for attendance</p>
                  </div>
                </div>
                <div className="text-slate-600 text-2xl">→</div>
                <div className="flex flex-col items-center gap-3 max-w-xs">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 text-white flex items-center justify-center text-lg font-bold shadow-lg">
                    2
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-white mb-1">Filter Semester</p>
                    <p className="text-xs text-slate-500">Optional step</p>
                  </div>
                </div>
                <div className="text-slate-600 text-2xl">→</div>
                <div className="flex flex-col items-center gap-3 max-w-xs">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 text-white flex items-center justify-center text-lg font-bold shadow-lg">
                    3
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-white mb-1">Choose Subject</p>
                    <p className="text-xs text-slate-500">Select from your subjects</p>
                  </div>
                </div>
                <div className="text-slate-600 text-2xl">→</div>
                <div className="flex flex-col items-center gap-3 max-w-xs">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/10 text-white flex items-center justify-center text-lg font-bold shadow-lg">
                    4
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-white mb-1">Mark & Save</p>
                    <p className="text-xs text-slate-500">Record attendance</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TeacherSidebar>
  );
};

export default TeacherAttendancePage;
