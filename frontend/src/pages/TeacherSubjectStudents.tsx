import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import TeacherSidebar from '@/components/TeacherSidebar';
import { Users, ArrowLeft, Mail, Loader2 } from 'lucide-react';
import { api } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';
import SemesterFilter from '@/components/filters/SemesterFilter';

interface Student {
  id: number;
  student_id: string;
  name: string;
  email: string;
  semester: number;
  year: number;
}

const TeacherSubjectStudents: React.FC = () => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSemester = Number(searchParams.get('semester') || 1);
  const [semester, setSemester] = useState<number>(initialSemester);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.teacher.getSubjectStudents(parseInt(subjectId!), semester);
      setStudents(data);
    } catch (err: unknown) {
      console.error('Error fetching students:', err);
      const error = err as { message?: string };
      toast({
        title: 'Error',
        description: error.message || 'Failed to load students',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [subjectId, semester, toast]);

  useEffect(() => {
    if (subjectId) {
      fetchStudents();
    }
  }, [subjectId, fetchStudents]);

  // Keep URL in sync when semester changes
  useEffect(() => {
    // avoid referencing searchParams directly to keep deps minimal
    const next = new URLSearchParams(window.location.search || '');
    next.set('semester', String(semester));
    setSearchParams(next, { replace: true });
  }, [semester, setSearchParams]);

  if (loading) {
    return (
      <TeacherSidebar>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-400 mx-auto" />
            <p className="text-slate-300">Loading students...</p>
          </div>
        </div>
      </TeacherSidebar>
    );
  }

  return (
    <TeacherSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button
          variant="outline"
          className="mb-6 border-slate-600 text-slate-200"
          onClick={() => navigate('/teacher')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="bg-slate-900/70 border-slate-700/80">
          <CardHeader className="border-b border-slate-800/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Students Enrolled
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Semester {semester} • {students.length} students
                </CardDescription>
              </div>
              <SemesterFilter
                value={semester}
                onChange={setSemester}
                className="mt-1"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {students.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No students enrolled in this subject</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-4 bg-slate-800/60 hover:bg-slate-800/80 rounded-xl border border-slate-700/70 hover:border-slate-600/70 transition-all duration-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-400 flex items-center justify-center text-white font-bold">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{student.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <span>{student.student_id}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {student.email}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-slate-700/50 text-slate-200 border-slate-600/50">
                        Year {student.year}
                      </Badge>
                      <Badge variant="outline" className="bg-slate-700/50 text-slate-200 border-slate-600/50">
                        Sem {student.semester}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TeacherSidebar>
  );
};

export default TeacherSubjectStudents;
