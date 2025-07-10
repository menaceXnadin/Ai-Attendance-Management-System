import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Calendar, Target } from 'lucide-react';
import { AttendancePrediction } from '@/types/dashboard';

interface AttendancePredictionProps {
  prediction: AttendancePrediction;
}

const AttendancePredictionCard: React.FC<AttendancePredictionProps> = ({ prediction }) => {
  const { currentPercentage, projectedPercentage, totalClasses, presentDays, remainingClasses } = prediction;
  
  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTrendDirection = () => {
    if (projectedPercentage > currentPercentage) return { icon: TrendingUp, color: 'text-green-500', text: 'Improving' };
    if (projectedPercentage < currentPercentage) return { icon: TrendingUp, color: 'text-red-500', text: 'Declining', rotation: 'rotate-180' };
    return { icon: Target, color: 'text-blue-500', text: 'Stable' };
  };

  const trend = getTrendDirection();
  const TrendIcon = trend.icon;

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-blue-800">
          <Calendar className="h-5 w-5" />
          AI Attendance Prediction
        </CardTitle>
        <CardDescription className="text-blue-600">
          Based on your current attendance pattern
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Current Attendance</p>
            <p className="text-2xl font-bold text-gray-900">{currentPercentage.toFixed(1)}%</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-600">Projected Final</p>
            <p className="text-2xl font-bold text-blue-600">{projectedPercentage.toFixed(1)}%</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress to target</span>
            <span>{projectedPercentage.toFixed(1)}%</span>
          </div>
          <Progress 
            value={projectedPercentage} 
            className="h-2"
          />
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-white/60 rounded-lg p-2">
            <p className="text-xs text-gray-600">Present</p>
            <p className="font-semibold text-green-600">{presentDays}</p>
          </div>
          <div className="bg-white/60 rounded-lg p-2">
            <p className="text-xs text-gray-600">Total Classes</p>
            <p className="font-semibold">{totalClasses}</p>
          </div>
          <div className="bg-white/60 rounded-lg p-2">
            <p className="text-xs text-gray-600">Remaining</p>
            <p className="font-semibold text-blue-600">{remainingClasses}</p>
          </div>
        </div>

        <div className={`flex items-center gap-2 p-2 rounded-lg bg-white/60`}>
          <TrendIcon className={`h-4 w-4 ${trend.color} ${trend.rotation || ''}`} />
          <span className="text-sm font-medium">{trend.text} trend</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendancePredictionCard;
