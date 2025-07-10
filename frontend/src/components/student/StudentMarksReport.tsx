
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Award, BookOpen } from 'lucide-react';

const StudentMarksReport = () => {
  // Mock data - in real app, this would come from API
  const marksData = [
    { subject: 'Mathematics', marks: 92, totalMarks: 100, grade: 'A+', percentage: 92 },
    { subject: 'Physics', marks: 85, totalMarks: 100, grade: 'A', percentage: 85 },
    { subject: 'Chemistry', marks: 78, totalMarks: 100, grade: 'B+', percentage: 78 },
    { subject: 'Biology', marks: 88, totalMarks: 100, grade: 'A', percentage: 88 },
    { subject: 'English', marks: 82, totalMarks: 100, grade: 'A', percentage: 82 },
    { subject: 'History', marks: 76, totalMarks: 100, grade: 'B+', percentage: 76 },
  ];

  const getGradeBadgeVariant = (grade: string) => {
    if (grade.startsWith('A')) return 'default';
    if (grade.startsWith('B')) return 'secondary';
    return 'outline';
  };

  const averageMarks = marksData.reduce((sum, subject) => sum + subject.percentage, 0) / marksData.length;

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
            <div className="text-2xl font-bold text-green-600">92%</div>
            <p className="text-sm text-muted-foreground">Mathematics</p>
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
            <div className="text-2xl font-bold">6</div>
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
                    <h4 className="font-medium">{subject.subject}</h4>
                    <Badge variant={getGradeBadgeVariant(subject.grade)}>
                      {subject.grade}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{subject.marks}/{subject.totalMarks}</p>
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
              <div className="text-2xl font-bold text-green-600">3</div>
              <p className="text-sm text-muted-foreground">A Grades</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">2</div>
              <p className="text-sm text-muted-foreground">B+ Grades</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">1</div>
              <p className="text-sm text-muted-foreground">A+ Grades</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">0</div>
              <p className="text-sm text-muted-foreground">Below B</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentMarksReport;
