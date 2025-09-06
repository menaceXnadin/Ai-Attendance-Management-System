import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, BookOpen, GraduationCap, Calendar, CheckCircle, XCircle, Clock, Save, UserCheck, UserX } from 'lucide-react';
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

const EnhancedAttendanceManagement = () => {
  const { toast } = useToast();
  
  // State management
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<StudentWithAttendance[]>([]);
  const [allStudents, setAllStudents] = useState<StudentWithAttendance[]>([]);
  const [studentSubjectBreakdown, setStudentSubjectBreakdown] = useState<any[]>([]);
  
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'subject' | 'student'>('subject');
  
  const [loading, setLoading] = useState({
    faculties: false,
    subjects: false,
    students: false,
    allStudents: false,
    studentBreakdown: false,
    saving: false,
  });
  
  // Force refresh counter to trigger re-fetches
  const [refreshCounter, setRefreshCounter] = useState(0);

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
        setTimeout(() => fetchFaculties(retryCount + 1), 1000);
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
      setSubjects(response || []);
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
      setStudents(response.students || []);
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
    fetchFaculties();
  }, [fetchFaculties, refreshCounter]);

  // Fetch subjects when faculty or semester changes
  useEffect(() => {
    if (selectedFaculty) {
      fetchSubjects();
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
      const filteredStudents = response.filter(student => 
        student.faculty_id === parseInt(selectedFaculty) && 
        student.semester === parseInt(selectedSemester)
      );
      console.log('Filtered students:', filteredStudents);
      setAllStudents(filteredStudents.map(student => ({
        id: parseInt(student.id),
        student_id: student.studentId,
        name: student.name,
        email: student.email,
        semester: student.semester,
        status: 'absent' as const,
        faculty_id: student.faculty_id
      })));
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
      const subjectsResponse = await api.subjects.getByFacultySemester(
        parseInt(selectedFaculty),
        parseInt(selectedSemester)
      );
      
      // Get attendance for this student across all subjects for selected date
      const attendanceResponse = await api.attendance.getAll({
        studentId: selectedStudent,
        date: selectedDate
      });
      
      // Create attendance map
      const attendanceMap = attendanceResponse.reduce((acc: any, record: any) => {
        acc[record.subjectId] = record.status;
        return acc;
      }, {});
      
      // Combine subjects with attendance status
      const subjectsWithAttendance = subjectsResponse.map((subject: any) => ({
        ...subject,
        todayStatus: attendanceMap[subject.id.toString()] || 'absent',
        hasChanges: false
      }));
      
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

  // Fetch students when subject changes (for subject view)
  useEffect(() => {
    if (viewMode === 'subject' && selectedFaculty && selectedSemester && selectedSubject) {
      fetchStudents();
    } else {
      setStudents([]);
    }
  }, [viewMode, selectedFaculty, selectedSemester, selectedSubject, fetchStudents]);

  // Fetch all students when faculty/semester changes (for student view)
  useEffect(() => {
    if (viewMode === 'student' && selectedFaculty && selectedSemester) {
      fetchAllStudents();
    } else {
      setAllStudents([]);
    }
  }, [viewMode, selectedFaculty, selectedSemester, fetchAllStudents, refreshCounter]);

  // Fetch student subjects when student or date is selected
  useEffect(() => {
    if (viewMode === 'student' && selectedStudent && selectedDate) {
      fetchStudentSubjects();
    } else {
      setSubjects([]);
    }
  }, [viewMode, selectedStudent, selectedDate, fetchStudentSubjects]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'late':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'absent':
      default:
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      present: 'bg-green-500/20 text-green-300 border-green-400/30',
      late: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
      absent: 'bg-red-500/20 text-red-300 border-red-400/30'
    };
    
    return (
      <Badge variant="outline" className={variants[status as keyof typeof variants] || variants.absent}>
        {getStatusIcon(status)}
        <span className="ml-1 capitalize">{status}</span>
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
    setSubjects(prevSubjects => 
      prevSubjects.map(subject => ({ 
        ...subject, 
        todayStatus: status, 
        hasChanges: true 
      }))
    );
  };

  const saveStudentAttendanceChanges = async () => {
    const changedSubjects = subjects.filter(subject => subject.hasChanges);
    
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
      for (const subject of changedSubjects) {
        const attendanceData = {
          subject_id: subject.id,
          date: selectedDate,
          students: [{
            student_id: parseInt(selectedStudent),
            status: subject.todayStatus
          }]
        };

        await api.attendance.markBulk(attendanceData);
      }
      
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
          <h2 className="text-2xl font-bold text-white">Enhanced Attendance Management</h2>
          <p className="text-blue-200/80 mt-1">
            View attendance by subject (for marking) or by student (for overview across all subjects)
          </p>
        </div>
      </div>

      {/* Selection Controls */}
      <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-blue-400" />
            Attendance Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* View Mode Toggle */}
          <div className="mb-6">
            <label className="text-sm font-medium text-slate-300 mb-2 block">View Mode</label>
            <div className="flex gap-2 items-center">
              <Button
                variant={viewMode === 'subject' ? 'default' : 'outline'}
                onClick={() => handleViewModeChange('subject')}
                className={viewMode === 'subject' 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'text-slate-300 border-slate-600 hover:bg-slate-800'
                }
              >
                <BookOpen className="h-4 w-4 mr-2" />
                By Subject
              </Button>
              <Button
                variant={viewMode === 'student' ? 'default' : 'outline'}
                onClick={() => handleViewModeChange('student')}
                className={viewMode === 'student' 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'text-slate-300 border-slate-600 hover:bg-slate-800'
                }
              >
                <Users className="h-4 w-4 mr-2" />
                By Student
              </Button>
              
              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log('Manual refresh triggered');
                  setRefreshCounter(prev => prev + 1);
                }}
                className="text-slate-300 border-slate-600 hover:bg-slate-800 ml-4"
                title="Refresh dropdowns"
              >
                <Loader2 className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Faculty Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Faculty</label>
              <Select value={selectedFaculty || undefined} onValueChange={handleFacultyChange}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="Select Faculty" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {loading.faculties ? (
                    <SelectItem value="loading-faculties" disabled>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Semester</label>
              <Select value={selectedSemester || undefined} onValueChange={handleSemesterChange} disabled={!selectedFaculty}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="Select Semester" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
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
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Subject</label>
                <Select value={selectedSubject || undefined} onValueChange={handleSubjectChange} disabled={!selectedSemester}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="Select Subject" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {loading.subjects ? (
                      <SelectItem value="loading-subjects" disabled>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Student</label>
                <Select value={selectedStudent || undefined} onValueChange={handleStudentChange} disabled={!selectedSemester}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue placeholder="Select Student" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {loading.allStudents ? (
                      <SelectItem value="loading-students" disabled>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Loading students...
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

            {/* Date Selection - Show in both modes */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white"
              />
            </div>
          </div>

          {/* Selection Summary */}
          {selectedFaculty && selectedSemester && (
            <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-4 text-sm text-slate-300">
                <span>
                  <strong>Faculty:</strong> {selectedFacultyName}
                </span>
                <span>
                  <strong>Semester:</strong> {selectedSemester}
                </span>
                {viewMode === 'subject' && selectedSubject && (
                  <>
                    <span>
                      <strong>Subject:</strong> {selectedSubjectName}
                    </span>
                    <span>
                      <strong>Date:</strong> {selectedDate}
                    </span>
                  </>
                )}
                {viewMode === 'student' && selectedStudent && (
                  <>
                    <span>
                      <strong>Student:</strong> {allStudents.find(s => s.id.toString() === selectedStudent)?.name || 'Unknown'}
                    </span>
                    <span>
                      <strong>Date:</strong> {selectedDate}
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
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-green-400" />
                Student Attendance
                {students.length > 0 && (
                  <Badge variant="outline" className="ml-2 bg-blue-500/20 text-blue-300">
                    {students.length} students
                  </Badge>
                )}
              </CardTitle>
              
              {/* Quick Stats & Actions */}
              <div className="flex items-center gap-4">
                {students.length > 0 && (
                  <div className="flex gap-2">
                    <Badge className="bg-green-500/20 text-green-300">
                      Present: {attendanceStats.present || 0}
                    </Badge>
                    <Badge className="bg-yellow-500/20 text-yellow-300">
                      Late: {attendanceStats.late || 0}
                    </Badge>
                    <Badge className="bg-red-500/20 text-red-300">
                      Absent: {attendanceStats.absent || 0}
                    </Badge>
                  </div>
                )}
                
                {/* Save Button */}
                {hasUnsavedChanges && (
                  <Button 
                    onClick={saveAttendanceChanges}
                    disabled={loading.saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {loading.saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            
            {/* Bulk Actions */}
            {students.length > 0 && (
              <div className="flex items-center gap-2 pt-4 border-t border-slate-700">
                <span className="text-sm text-slate-300 mr-2">Bulk Actions:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllStudents('present')}
                  className="text-green-400 border-green-400/30 hover:bg-green-500/10"
                >
                  <UserCheck className="h-4 w-4 mr-1" />
                  Mark All Present
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllStudents('absent')}
                  className="text-red-400 border-red-400/30 hover:bg-red-500/10"
                >
                  <UserX className="h-4 w-4 mr-1" />
                  Mark All Absent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllStudents('late')}
                  className="text-yellow-400 border-yellow-400/30 hover:bg-yellow-500/10"
                >
                  <Clock className="h-4 w-4 mr-1" />
                  Mark All Late
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loading.students ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400 mr-3" />
                <span className="text-slate-300">Loading students...</span>
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 mx-auto mb-4 text-slate-500 opacity-50" />
                <p className="text-slate-400 text-lg">No students found</p>
                <p className="text-slate-500 text-sm">
                  Try selecting different faculty, semester, or subject
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
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
                    {students.map((student) => (
                      <TableRow 
                        key={student.id} 
                        className={`border-slate-700 hover:bg-slate-800/30 ${
                          student.hasChanges ? 'bg-blue-500/10 border-blue-500/30' : ''
                        }`}
                      >
                        <TableCell className="text-white font-medium">
                          {student.student_id}
                        </TableCell>
                        <TableCell className="text-white">
                          {student.name}
                          {student.hasChanges && (
                            <Badge variant="outline" className="ml-2 text-xs bg-blue-500/20 text-blue-300">
                              Modified
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {student.email}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {student.semester}
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
                              className="text-green-400 border-green-400/30 hover:bg-green-500/10 h-8 w-8 p-0"
                              title="Mark Present"
                            >
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => markStudentAttendance(student.id, 'late')}
                              disabled={student.status === 'late'}
                              className="text-yellow-400 border-yellow-400/30 hover:bg-yellow-500/10 h-8 w-8 p-0"
                              title="Mark Late"
                            >
                              <Clock className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => markStudentAttendance(student.id, 'absent')}
                              disabled={student.status === 'absent'}
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
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Student View - Manual Attendance for All Subjects */}
      {viewMode === 'student' && selectedFaculty && selectedSemester && selectedStudent && (
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-green-400" />
                Subject Attendance
                {subjects.length > 0 && (
                  <Badge variant="outline" className="ml-2 bg-blue-500/20 text-blue-300">
                    {subjects.length} subjects
                  </Badge>
                )}
              </CardTitle>
              
              {/* Quick Stats & Actions */}
              <div className="flex items-center gap-4">
                {subjects.length > 0 && (
                  <div className="flex gap-2">
                    <Badge className="bg-green-500/20 text-green-300">
                      Present: {subjects.filter(s => s.todayStatus === 'present').length}
                    </Badge>
                    <Badge className="bg-yellow-500/20 text-yellow-300">
                      Late: {subjects.filter(s => s.todayStatus === 'late').length}
                    </Badge>
                    <Badge className="bg-red-500/20 text-red-300">
                      Absent: {subjects.filter(s => s.todayStatus === 'absent').length}
                    </Badge>
                  </div>
                )}
                
                {/* Save Button */}
                {subjects.some(s => s.hasChanges) && (
                  <Button 
                    onClick={saveStudentAttendanceChanges}
                    disabled={loading.saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {loading.saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            
            {/* Bulk Actions */}
            {subjects.length > 0 && (
              <div className="flex items-center gap-2 pt-4 border-t border-slate-700">
                <span className="text-sm text-slate-300 mr-2">Bulk Actions:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllSubjects('present')}
                  className="text-green-400 border-green-400/30 hover:bg-green-500/10"
                >
                  <UserCheck className="h-4 w-4 mr-1" />
                  Mark All Present
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllSubjects('absent')}
                  className="text-red-400 border-red-400/30 hover:bg-red-500/10"
                >
                  <UserX className="h-4 w-4 mr-1" />
                  Mark All Absent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllSubjects('late')}
                  className="text-yellow-400 border-yellow-400/30 hover:bg-yellow-500/10"
                >
                  <Clock className="h-4 w-4 mr-1" />
                  Mark All Late
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loading.subjects ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400 mr-3" />
                <span className="text-slate-300">Loading subjects...</span>
              </div>
            ) : subjects.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-16 w-16 mx-auto mb-4 text-slate-500 opacity-50" />
                <p className="text-slate-400 text-lg">No subjects found</p>
                <p className="text-slate-500 text-sm">
                  This student may not be enrolled in any subjects
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">Subject Code</TableHead>
                      <TableHead className="text-slate-300">Subject Name</TableHead>
                      <TableHead className="text-slate-300">Credits</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-slate-300 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subjects.map((subject) => (
                      <TableRow 
                        key={subject.id} 
                        className={`border-slate-700 hover:bg-slate-800/30 ${
                          subject.hasChanges ? 'bg-blue-500/10 border-blue-500/30' : ''
                        }`}
                      >
                        <TableCell className="text-white font-medium">
                          {subject.code}
                        </TableCell>
                        <TableCell className="text-white">
                          {subject.name}
                          {subject.hasChanges && (
                            <Badge variant="outline" className="ml-2 text-xs bg-blue-500/20 text-blue-300">
                              Modified
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {subject.credits || 3}
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
                              disabled={subject.todayStatus === 'present'}
                              className="text-green-400 border-green-400/30 hover:bg-green-500/10 h-8 w-8 p-0"
                              title="Mark Present"
                            >
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => markSubjectAttendance(subject.id, 'late')}
                              disabled={subject.todayStatus === 'late'}
                              className="text-yellow-400 border-yellow-400/30 hover:bg-yellow-500/10 h-8 w-8 p-0"
                              title="Mark Late"
                            >
                              <Clock className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => markSubjectAttendance(subject.id, 'absent')}
                              disabled={subject.todayStatus === 'absent'}
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
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EnhancedAttendanceManagement;
