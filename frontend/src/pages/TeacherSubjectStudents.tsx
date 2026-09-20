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
          size="sm"
          className="mb-6 border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-subtle"
          onClick={() => navigate('/teacher')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="bg-surface-default border-border-subtle shadow-card">
          <CardHeader className="border-b border-border-subtle pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <Users className="w-4 h-4 text-action-primary" />
                  Students Enrolled
                </CardTitle>
                <CardDescription className="text-text-muted text-xs">
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
              <div className="text-center py-12 text-text-muted">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-xs">No students enrolled in this subject</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3.5 bg-surface-canvas/60 hover:bg-surface-subtle rounded-lg border border-border-subtle transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-action-primary text-white flex items-center justify-center text-xs font-semibold shrink-0">
                        {student.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-semibold text-text-primary text-sm">{student.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                          <span className="font-mono">{student.student_id}</span>
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
