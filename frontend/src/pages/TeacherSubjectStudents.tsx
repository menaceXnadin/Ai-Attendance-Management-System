import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import TeacherSidebar from '@/components/TeacherSidebar';
import { ArrowLeft20Regular, ArrowSync20Regular, Mail16Regular, People20Regular, People24Regular } from '@fluentui/react-icons';
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

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

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
          <div className="text-center space-y-3">
            <ArrowSync20Regular className="mx-auto h-8 w-8 animate-spin text-brand-foreground" aria-hidden />
            <p className="text-body text-text-muted">Loading students...</p>
          </div>
        </div>
      </TeacherSidebar>
    );
  }

  return (
    <TeacherSidebar>
      <div className="mx-auto max-w-7xl space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-text-secondary"
          onClick={() => navigate('/teacher')}
        >
          <ArrowLeft20Regular aria-hidden />
          Back to Dashboard
        </Button>

        <section className="overflow-hidden rounded-lg bg-surface-default shadow">
          <div className="flex flex-col gap-4 border-b border-border-subtle px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
                <People20Regular aria-hidden />
              </div>
              <div>
                <h1 className="text-subheading text-text-primary">Students Enrolled</h1>
                <p className="text-caption text-text-muted tabular-nums">
                  Semester {semester} · {students.length} students
                </p>
              </div>
            </div>
            <SemesterFilter
              value={semester}
              onChange={setSemester}
              className="mt-1"
            />
          </div>

          {students.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
                <People24Regular aria-hidden />
              </div>
              <p className="text-subheading text-text-primary">No students enrolled in this subject</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="normal-case tracking-normal text-caption-strong text-text-secondary">Name</TableHead>
                  <TableHead className="normal-case tracking-normal text-caption-strong text-text-secondary">Student ID</TableHead>
                  <TableHead className="hidden normal-case tracking-normal text-caption-strong text-text-secondary md:table-cell">Email</TableHead>
                  <TableHead className="normal-case tracking-normal text-caption-strong text-text-secondary">Year</TableHead>
                  <TableHead className="normal-case tracking-normal text-caption-strong text-text-secondary">Semester</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id} className="hover:bg-surface-hover">
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-subtle text-caption-strong text-brand-foreground"
                          aria-hidden
                        >
                          {getInitials(student.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-body-strong text-text-primary">{student.name}</p>
                          <p className="flex items-center gap-1 truncate text-caption text-text-muted md:hidden">
                            <Mail16Regular aria-hidden />
                            {student.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 font-mono text-body text-text-secondary">{student.student_id}</TableCell>
                    <TableCell className="hidden py-2.5 text-body text-text-muted md:table-cell">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail16Regular aria-hidden />
                        {student.email}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant="secondary">Year {student.year}</Badge>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant="secondary">Sem {student.semester}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </TeacherSidebar>
  );
};

export default TeacherSubjectStudents;
