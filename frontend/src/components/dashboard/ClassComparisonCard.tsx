import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Users, Award } from 'lucide-react';
import { ClassComparison } from '@/types/dashboard';

interface ClassComparisonProps {
  comparison: ClassComparison;
}

const ClassComparisonCard: React.FC<ClassComparisonProps> = ({ comparison }) => {
  const {
    studentAttendance,
    classAverageAttendance,
    studentMarks,
    classAverageMarks
  } = comparison;

  const attendanceDiff = studentAttendance - classAverageAttendance;
  const marksDiff = studentMarks - classAverageMarks;

  const getComparisonIcon = (diff: number) => {
    if (diff > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (diff < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <div className="h-4 w-4 rounded-full bg-gray-400" />;
  };

  const getComparisonText = (diff: number, isPercentage = false) => {
    const suffix = isPercentage ? '%' : ' points';
    if (diff > 0) return `${diff.toFixed(1)}${suffix} above average`;
    if (diff < 0) return `${Math.abs(diff).toFixed(1)}${suffix} below average`;
    return 'At class average';
  };

  const getComparisonColor = (diff: number) => {
    if (diff > 0) return 'text-green-600';
    if (diff < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-purple-800">
          <Users className="h-5 w-5" />
          Class Performance Comparison
        </CardTitle>
        <CardDescription className="text-purple-600">
          How you compare with your classmates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Attendance Comparison */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Attendance Performance</h4>
            {getComparisonIcon(attendanceDiff)}
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Your attendance</span>
              <span className="font-medium">{studentAttendance.toFixed(1)}%</span>
            </div>
            <Progress value={studentAttendance} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Class average</span>
              <span className="font-medium">{classAverageAttendance.toFixed(1)}%</span>
            </div>
            <Progress value={classAverageAttendance} className="h-2 opacity-60" />
          </div>
          
          <p className={`text-sm font-medium ${getComparisonColor(attendanceDiff)}`}>
            {getComparisonText(attendanceDiff, true)}
          </p>
        </div>

        {/* Marks Comparison */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Academic Performance</h4>
            {getComparisonIcon(marksDiff)}
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Your average</span>
              <span className="font-medium">{studentMarks.toFixed(1)}</span>
            </div>
            <Progress value={(studentMarks / 100) * 100} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Class average</span>
              <span className="font-medium">{classAverageMarks.toFixed(1)}</span>
            </div>
            <Progress value={(classAverageMarks / 100) * 100} className="h-2 opacity-60" />
          </div>
          
          <p className={`text-sm font-medium ${getComparisonColor(marksDiff)}`}>
            {getComparisonText(marksDiff)}
          </p>
        </div>

        {/* Overall Performance Badge */}
        <div className="bg-white/60 rounded-lg p-3 text-center">
          <Award className="h-6 w-6 mx-auto mb-1 text-purple-600" />
          <p className="text-sm font-medium text-purple-800">
            {attendanceDiff > 0 && marksDiff > 0 
              ? "Outstanding Performance!" 
              : attendanceDiff > 0 || marksDiff > 0 
              ? "Above Average Performance" 
              : "Room for Improvement"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClassComparisonCard;
