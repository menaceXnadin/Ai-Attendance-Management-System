import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, BookOpen, GraduationCap, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
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
}

const EnhancedAttendanceManagement = () => {
  const { toast } = useToast();
  
  // State management
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<StudentWithAttendance[]>([]);
  
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState({
    faculties: false,
    subjects: false,
    students: false,
  });

  // Fetch faculties on component mount
  const fetchFaculties = useCallback(async () => {
    setLoading(prev => ({ ...prev, faculties: true }));
    try {
      const response = await api.faculties.getAll();
      setFaculties(response);
    } catch (error) {
      console.error('Error fetching faculties:', error);
      toast({
        title: "Error",
        description: "Failed to fetch faculties",
        variant: "destructive",
      });
    } finally {
      setLoading(prev => ({ ...prev, faculties: false }));
    }
  }, [toast]);

  const fetchSubjects = useCallback(async () => {
    if (!selectedFaculty) return;
    
    setLoading(prev => ({ ...prev, subjects: true }));
    try {
      const response = await api.subjects.getByFacultySemester(
        parseInt(selectedFaculty),
        selectedSemester ? parseInt(selectedSemester) : undefined
      );
      setSubjects(response);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      toast({
        title: "Error",
        description: "Failed to fetch subjects",
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
  }, [fetchFaculties]);

  // Fetch subjects when faculty or semester changes
  useEffect(() => {
    if (selectedFaculty) {
      fetchSubjects();
    } else {
      setSubjects([]);
      setSelectedSubject('');
    }
  }, [selectedFaculty, fetchSubjects]);

  // Fetch students when subject changes
  useEffect(() => {
    if (selectedFaculty && selectedSemester && selectedSubject) {
      fetchStudents();
    } else {
      setStudents([]);
    }
  }, [selectedFaculty, selectedSemester, selectedSubject, fetchStudents]);

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
    setStudents([]);
  };

  const handleSemesterChange = (value: string) => {
    setSelectedSemester(value);
    setSelectedSubject('');
    setStudents([]);
  };

  const handleSubjectChange = (value: string) => {
    setSelectedSubject(value);
  };

  const selectedFacultyName = faculties.find(f => f.id.toString() === selectedFaculty)?.name || '';
  const selectedSubjectName = subjects.find(s => s.id.toString() === selectedSubject)?.name || '';

  const attendanceStats = students.reduce((acc, student) => {
    acc[student.status] = (acc[student.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Enhanced Attendance Management</h2>
          <p className="text-blue-200/80 mt-1">
            Select faculty, semester, and subject to view student attendance
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

            {/* Subject Selection */}
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

            {/* Date Selection */}
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
          {selectedFaculty && selectedSemester && selectedSubject && (
            <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-4 text-sm text-slate-300">
                <span>
                  <strong>Faculty:</strong> {selectedFacultyName}
                </span>
                <span>
                  <strong>Semester:</strong> {selectedSemester}
                </span>
                <span>
                  <strong>Subject:</strong> {selectedSubjectName}
                </span>
                <span>
                  <strong>Date:</strong> {selectedDate}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Students List */}
      {selectedFaculty && selectedSemester && selectedSubject && (
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
              
              {/* Quick Stats */}
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
            </div>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id} className="border-slate-700 hover:bg-slate-800/30">
                        <TableCell className="text-white font-medium">
                          {student.student_id}
                        </TableCell>
                        <TableCell className="text-white">
                          {student.name}
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
