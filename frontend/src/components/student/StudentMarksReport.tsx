
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Book20Regular,
  Book24Regular,
  DataTrending20Regular,
  Ribbon20Regular,
} from '@fluentui/react-icons';
import { useAuth } from '@/contexts/useAuth';
import { api } from '@/integrations/api/client';

interface MarkRecord {
  subject_name: string;
  subject_code: string;
  exam_type: string;
  marks_obtained: number;
  total_marks: number;
  percentage: number;
  grade: string;
  exam_date: string;
}

interface PerformanceData {
  student_name: string;
  student_id: string;
  performance: MarkRecord[];
  total_exams: number;
}

const StudentMarksReport = () => {
  const { user } = useAuth();

  // Fetch marks data from the backend
  const { data: performanceData, isLoading } = useQuery<PerformanceData>({
    queryKey: ['student-performance', user?.id],
    queryFn: async () => {
      const response = await api.dashboard.getStudentPerformance();
      return response;
    },
    enabled: !!user?.id && user?.role === 'student'
  });

  const marksData = performanceData?.performance || [];

  const getGradeBadgeVariant = (grade: string) => {
    if (grade.startsWith('A')) return 'default';
    if (grade.startsWith('B')) return 'secondary';
    return 'outline';
  };

  const averageMarks = marksData.length > 0 
    ? marksData.reduce((sum: number, subject: MarkRecord) => sum + subject.percentage, 0) / marksData.length 
    : 0;

  const highestScore = marksData.length > 0 
    ? Math.max(...marksData.map((subject: MarkRecord) => subject.percentage)) 
    : 0;

  const highestSubject = marksData.find((subject: MarkRecord) => subject.percentage === highestScore);

  // Calculate grade distribution
  const gradeDistribution = marksData.reduce((acc: Record<string, number>, subject: MarkRecord) => {
    if (subject.grade?.startsWith('A+')) acc.aPlus++;
    else if (subject.grade?.startsWith('A')) acc.a++;
    else if (subject.grade?.startsWith('B+')) acc.bPlus++;
    else if (subject.grade?.startsWith('B')) acc.b++;
    else acc.below++;
    return acc;
  }, { aPlus: 0, a: 0, bPlus: 0, b: 0, below: 0 });

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <div
          className="mb-4 h-8 w-8 animate-spin rounded-full border-[3px] border-brand-subtle border-t-brand"
          role="progressbar"
          aria-label="Loading"
        />
        <p className="text-body text-text-muted">Loading marks data...</p>
      </div>
    );
  }

  // Show empty state
  if (!marksData.length) {
    return (
      <div className="flex flex-col items-center rounded-lg bg-surface-default p-12 text-center shadow">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
          <Book24Regular aria-hidden />
        </div>
        <h3 className="text-subheading text-text-primary">No Marks Available</h3>
        <p className="mt-1 max-w-sm text-body text-text-muted">
          No marks have been recorded yet. Check back later for your exam results.
        </p>
      </div>
    );
  }

  const gradeCells = [
    { label: 'A+ Grades', value: gradeDistribution.aPlus, color: 'var(--chart-8)' },
    { label: 'A Grades', value: gradeDistribution.a, color: 'var(--chart-3)' },
    { label: 'B+ Grades', value: gradeDistribution.bPlus, color: 'var(--chart-2)' },
    { label: 'Below B+', value: gradeDistribution.below, color: 'var(--text-muted)' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <section aria-label="Overall average" className="rounded-lg bg-surface-default p-4 shadow">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-caption text-text-muted">Overall Average</p>
              <p className="mt-1 text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{averageMarks.toFixed(1)}%</p>
              <p className="mt-0.5 text-caption text-text-muted">Across all subjects</p>
            </div>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
              <DataTrending20Regular aria-hidden />
            </div>
          </div>
        </section>

        <section aria-label="Highest score" className="rounded-lg bg-surface-default p-4 shadow">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-caption text-text-muted">Highest Score</p>
              <p className="mt-1 text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{highestScore}%</p>
              <p className="mt-0.5 truncate text-caption text-text-muted">{highestSubject?.subject_name || 'N/A'}</p>
            </div>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-status-success-subtle text-status-success">
              <Ribbon20Regular aria-hidden />
            </div>
          </div>
        </section>

        <section aria-label="Total subjects" className="rounded-lg bg-surface-default p-4 shadow">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-caption text-text-muted">Total Subjects</p>
              <p className="mt-1 text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{marksData.length}</p>
              <p className="mt-0.5 text-caption text-text-muted">Active courses</p>
            </div>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-surface-subtle text-text-secondary">
              <Book20Regular aria-hidden />
            </div>
          </div>
        </section>
      </div>

      <Card className="overflow-hidden border-0 bg-surface-default shadow">
        <CardHeader className="space-y-0 border-b border-border-subtle px-5 py-4">
          <CardTitle className="text-subheading text-text-primary">Subject-wise Performance</CardTitle>
          <CardDescription className="mt-0.5 text-caption text-text-muted">
            Your marks and grades for each subject
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-body">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-subtle text-left text-caption-strong text-text-secondary">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Subject</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Grade</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Marks</th>
                  <th scope="col" className="w-[38%] px-4 py-2.5 font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                {marksData.map((subject, index) => (
                  <tr
                    key={index}
                    className="border-b border-border-subtle transition-colors duration-150 ease-fluent-standard last:border-b-0 hover:bg-surface-hover"
                  >
                    <td className="px-4 py-2.5 text-body-strong text-text-primary">{subject.subject_name}</td>
                    <td className="px-4 py-2.5">
                      <Badge shape="pill" variant={getGradeBadgeVariant(subject.grade)}>
                        {subject.grade}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
                      {subject.marks_obtained}/{subject.total_marks}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-1 flex-1 overflow-hidden rounded-full bg-border-subtle"
                          role="progressbar"
                          aria-valuenow={subject.percentage}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full rounded-full bg-brand transition-[width] duration-500 ease-fluent-decelerate"
                            style={{ width: `${Math.min(100, Math.max(0, subject.percentage))}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-body-strong tabular-nums text-text-primary">
                          {subject.percentage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 bg-surface-default shadow">
        <CardHeader className="space-y-0 border-b border-border-subtle px-5 py-4">
          <CardTitle className="text-subheading text-text-primary">Grade Distribution</CardTitle>
          <CardDescription className="mt-0.5 text-caption text-text-muted">
            Your performance summary
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {gradeCells.map((cell) => (
              <div key={cell.label} className="rounded-md bg-surface-subtle p-3">
                <p className="flex items-center gap-1.5 text-caption text-text-muted">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cell.color }} aria-hidden />
                  {cell.label}
                </p>
                <p className="mt-1 text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{cell.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentMarksReport;
