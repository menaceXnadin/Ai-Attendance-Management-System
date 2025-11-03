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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">
              Mark Attendance
            </h1>
            <p className="text-blue-200/80 mt-2">
              Mark attendance for students in your assigned subjects
            </p>
          </div>
          <Badge
            variant="outline"
            className="bg-blue-500/20 text-blue-300 border-blue-400/30"
          >
            <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-600 mr-2">
              <CalendarIcon className="h-4 w-4 text-white fill-white" />
            </span>
            {format(new Date(selectedDate), 'PPP')}
          </Badge>
        </div>

        {/* Selection Controls */}
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-400" />
              Select Subject & Date
            </CardTitle>
            <CardDescription className="text-slate-400">
              Optional: Filter by semester first, or select any subject directly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between bg-slate-800 border-slate-600 hover:bg-slate-700 h-10 relative group !text-white"
                    >
                      <span className="flex items-center">
                        {selectedDate
                          ? format(new Date(selectedDate), 'MM/dd/yyyy')
                          : 'Pick a date'}
                      </span>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-90 group-hover:opacity-100 transition-opacity text-white"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 bg-slate-800 border-slate-600 shadow-2xl"
                    align="start"
                  >
                    <style>{`
                      .rdp {
                        margin: 0 !important;
                      }
                      .rdp-nav_button {
                        color: #ffffff !important;
                        background-color: #334155 !important;
                        border: 1px solid #475569 !important;
                      }
                      .rdp-nav_button:hover {
                        background-color: #475569 !important;
                      }
                      .rdp-caption_label {
                        color: #ffffff !important;
                        font-weight: 600 !important;
                      }
                      .rdp-head_cell {
                        color: #cbd5e1 !important;
                      }
                      .rdp-day {
                        color: #ffffff !important;
                        border: 1px solid transparent !important;
                      }
                      .rdp-day:hover {
                        background-color: #475569 !important;
                        border-color: #64748b !important;
                      }
                      .rdp-day_selected {
                        background-color: #2563eb !important;
                        color: #ffffff !important;
                        border-color: #3b82f6 !important;
                      }
                      .rdp-day_today {
                        background-color: #334155 !important;
                        font-weight: bold !important;
                      }
                      .rdp-day_outside {
                        color: #64748b !important;
                      }
                    `}</style>
                    <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg">
                      <DayPicker
                        mode="single"
                        selected={selectedDate ? new Date(selectedDate) : undefined}
                        onSelect={(date) => {
                          if (date) setSelectedDate(date.toISOString().split('T')[0]);
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
                <label className="text-sm font-medium text-slate-300">
                  Filter by Semester <span className="text-slate-500">(Optional)</span>
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
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
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
                <label className="text-sm font-medium text-slate-300">
                  Subject
                  {filteredSubjects.length > 0 && (
                    <span className="text-slate-500 ml-2">
                      ({filteredSubjects.length} available)
                    </span>
                  )}
                </label>
                <Select
                  value={selectedSubject?.toString() || ''}
                  onValueChange={(value) => setSelectedSubject(parseInt(value))}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
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
                          {subject.name} ({subject.code})
                          <span className="text-xs text-slate-400 ml-2">
                            Sem {subject.semesters.join(', ')}
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Selected Subject Info */}
            {selectedSubjectData && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-300 font-medium">Selected Subject</p>
                    <p className="text-lg font-semibold text-white">
                      {selectedSubjectData.name} ({selectedSubjectData.code})
                    </p>
                    <p className="text-sm text-slate-400">
                      Loading students for Semester {semesterForFetch}
                    </p>
                  </div>
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30">
                    {students.length} students
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cancellation Warning Banner */}
        {attendanceData?.is_cancelled && (
          <Card className="bg-rose-900/20 border-rose-600/50 backdrop-blur-md">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="mt-0.5">
                  <div className="rounded-full bg-rose-500/20 p-3">
                    <Ban className="h-6 w-6 text-rose-400" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-rose-300 mb-2">
                    Class Cancelled
                  </h3>
                  <p className="text-slate-300 mb-3">
                    This class was cancelled for {format(new Date(selectedDate), 'MMMM d, yyyy')}. 
                    Attendance cannot be marked for cancelled classes.
                  </p>
                  {attendanceData.cancellation_reason && (
                    <div className="flex items-start gap-2 text-sm text-slate-400 bg-slate-800/50 p-3 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-amber-300">Reason:</span>{' '}
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
          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-400" />
                  Student Attendance
                  {students.length > 0 && (
                    <Badge className="ml-2 bg-blue-500/20 text-blue-300">
                      {students.length} students
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    onClick={handleMarkAllPresent}
                    variant="outline"
                    size="sm"
                    className="border-green-600 text-green-300 hover:bg-green-800"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark All Present
                  </Button>
                  <Button
                    onClick={handleMarkAllAbsent}
                    variant="outline"
                    size="sm"
                    className="border-red-600 text-red-300 hover:bg-red-800"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Mark All Absent
                  </Button>
                  <Button
                    onClick={handleSaveAttendance}
                    disabled={markAttendanceMutation.isPending}
                    className="bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white"
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
              {students.length > 0 && (
                <div className="flex gap-4 text-sm text-slate-400">
                  <span>
                    Present:{' '}
                    {Object.values(studentAttendance).filter(s => s === 'present').length}
                  </span>
                  <span>
                    Absent:{' '}
                    {Object.values(studentAttendance).filter(s => s === 'absent').length}
                  </span>
                  <span>
                    Late: {Object.values(studentAttendance).filter(s => s === 'late').length}
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {studentsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                  <span className="ml-2 text-slate-400">Loading students...</span>
                </div>
              ) : students.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">Student ID</TableHead>
                      <TableHead className="text-slate-300">Name</TableHead>
                      <TableHead className="text-slate-300">Email</TableHead>
                      <TableHead className="text-slate-300">Semester</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-slate-300 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student: Student) => (
                      <TableRow
                        key={student.id}
                        className="border-slate-700 hover:bg-slate-800/50"
                      >
                        <TableCell className="text-white font-medium">
                          {student.student_id}
                        </TableCell>
                        <TableCell className="text-white">{student.name}</TableCell>
                        <TableCell className="text-slate-400">{student.email}</TableCell>
                        <TableCell className="text-slate-300">{student.semester}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getStatusBadgeColor(studentAttendance[student.id] || 'no_data')}
                          >
                            {studentAttendance[student.id] === 'present' && <CheckCircle className="h-3 w-3 mr-1" />}
                            {studentAttendance[student.id] === 'absent' && <XCircle className="h-3 w-3 mr-1" />}
                            {studentAttendance[student.id] === 'late' && <Clock className="h-3 w-3 mr-1" />}
                            {studentAttendance[student.id] 
                              ? studentAttendance[student.id].charAt(0).toUpperCase() + studentAttendance[student.id].slice(1)
                              : 'Not Marked'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAttendanceChange(student.id, 'present')}
                              disabled={studentAttendance[student.id] === 'present'}
                              className="text-green-400 border-green-400/30 hover:bg-green-500/10 h-8 w-8 p-0"
                              title="Mark Present"
                            >
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAttendanceChange(student.id, 'late')}
                              disabled={studentAttendance[student.id] === 'late'}
                              className="text-yellow-400 border-yellow-400/30 hover:bg-yellow-500/10 h-8 w-8 p-0"
                              title="Mark Late"
                            >
                              <Clock className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAttendanceChange(student.id, 'absent')}
                              disabled={studentAttendance[student.id] === 'absent'}
                              className="text-red-400 border-red-400/30 hover:bg-red-500/10 h-8 w-8 p-0"
                              title="Mark Absent"
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <Users className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">No students found</p>
                  <p className="text-sm">
                    No students are enrolled in this subject for the selected semester.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        {!selectedSubject && (
          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
            <CardContent className="text-center py-12">
              <BookOpen className="h-16 w-16 mx-auto mb-4 text-slate-500 opacity-30" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Welcome to Attendance Management
              </h3>
              <p className="text-slate-400 mb-4">
                Select a subject and semester to view and mark attendance for your students.
              </p>
              <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                    1
                  </span>
                  Pick Date
                </span>
                <span>→</span>
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                    2
                  </span>
                  Filter Semester (Optional)
                </span>
                <span>→</span>
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                    3
                  </span>
                  Choose Subject
                </span>
                <span>→</span>
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                    4
                  </span>
                  Mark & Save
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TeacherSidebar>
  );
};

export default TeacherAttendancePage;
