
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Award, BookOpen, Loader2 } from 'lucide-react';
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
        <Loader2 className="h-12 w-12 animate-spin text-brand-500 mb-4" />
        <p className="text-muted-foreground">Loading marks data...</p>
      </div>
    );
  }

  // Show empty state
  if (!marksData.length) {
    return (
      <Card className="p-12">
        <div className="text-center">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-4" />
          <h3 className="text-lg font-medium mb-2">No Marks Available</h3>
          <p className="text-muted-foreground">
            No marks have been recorded yet. Check back later for your exam results.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Overall Average
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{averageMarks.toFixed(1)}%</div>
            <p className="text-sm text-muted-foreground">Across all subjects</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-4 w-4" />
              Highest Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{highestScore}%</div>
            <p className="text-sm text-muted-foreground">{highestSubject?.subject_name || 'N/A'}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Total Subjects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marksData.length}</div>
            <p className="text-sm text-muted-foreground">Active courses</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subject-wise Performance</CardTitle>
          <CardDescription>
            Your marks and grades for each subject
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {marksData.map((subject, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <h4 className="font-medium">{subject.subject_name}</h4>
                    <Badge variant={getGradeBadgeVariant(subject.grade)}>
                      {subject.grade}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{subject.marks_obtained}/{subject.total_marks}</p>
                    <p className="text-sm text-muted-foreground">{subject.percentage}%</p>
                  </div>
                </div>
                <Progress value={subject.percentage} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grade Distribution</CardTitle>
          <CardDescription>
            Your performance summary
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{gradeDistribution.aPlus}</div>
              <p className="text-sm text-muted-foreground">A+ Grades</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{gradeDistribution.a}</div>
              <p className="text-sm text-muted-foreground">A Grades</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{gradeDistribution.bPlus}</div>
              <p className="text-sm text-muted-foreground">B+ Grades</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{gradeDistribution.below}</div>
              <p className="text-sm text-muted-foreground">Below B+</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentMarksReport;
