import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowTrending20Regular, ArrowTrendingDown20Regular, CalendarLtr20Regular, Target20Regular } from '@fluentui/react-icons';
import { AttendancePrediction } from '@/types/dashboard';
import {
  bandForPercentage,
  formatCount,
  formatPercent,
  isFiniteNumber,
  useAttendancePolicy,
} from '@/components/attendance-admin/metrics';

interface AttendancePredictionProps {
  prediction: AttendancePrediction;
}

const AttendancePredictionCard: React.FC<AttendancePredictionProps> = ({ prediction }) => {
  const { totalClasses, presentDays, remainingClasses } = prediction;
  // Values may be null when the server has no countable classes yet (§13.12).
  const currentPercentage: number | null = isFiniteNumber(prediction.currentPercentage) ? prediction.currentPercentage : null;
  const projectedPercentage: number | null = isFiniteNumber(prediction.projectedPercentage) ? prediction.projectedPercentage : null;
  const { bands, minimum } = useAttendancePolicy();

  const getProgressColor = (percentage: number | null) => {
    const band = bandForPercentage(percentage, bands);
    if (!band) return '[&>div]:bg-border-strong';
    if (band.min < minimum) return '[&>div]:bg-status-error';
    if (band.min === minimum) return '[&>div]:bg-status-warning';
    return '[&>div]:bg-status-success';
  };

  const getTrendDirection = () => {
    if (currentPercentage === null || projectedPercentage === null) {
      return { icon: Target20Regular, color: 'text-text-muted', bg: 'bg-surface-subtle border-border-subtle', text: 'Not enough data for a' };
    }
    if (projectedPercentage > currentPercentage) return { icon: ArrowTrending20Regular, color: 'text-status-success', bg: 'bg-status-success-subtle border-status-success-border', text: 'Improving' };
    if (projectedPercentage < currentPercentage) return { icon: ArrowTrendingDown20Regular, color: 'text-status-error', bg: 'bg-status-error-subtle border-status-error-border', text: 'Declining' };
    return { icon: Target20Regular, color: 'text-status-info', bg: 'bg-status-info-subtle border-status-info-border', text: 'Stable' };
  };

  const trend = getTrendDirection();
  const TrendIcon = trend.icon;

  return (
    <Card className="border-0 bg-surface-default shadow">
      <CardHeader className="flex-row items-start gap-3 space-y-0 px-5 py-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
          <CalendarLtr20Regular aria-hidden />
        </div>
        <div className="min-w-0">
          <CardTitle className="text-subheading text-text-primary">
            AI Attendance Prediction
          </CardTitle>
          <CardDescription className="text-caption text-text-muted">
            Based on your current attendance pattern
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-caption text-text-muted">Current Attendance</p>
            <p className="text-[28px] font-semibold leading-9 tabular-nums text-text-primary">{formatPercent(currentPercentage)}</p>
          </div>
          <div className="text-right">
            <p className="text-caption text-text-muted">Projected Final</p>
            <p className="text-[28px] font-semibold leading-9 tabular-nums text-brand-foreground">{formatPercent(projectedPercentage)}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-caption text-text-secondary">
            <span>Progress to target</span>
            <span className="tabular-nums">{formatPercent(projectedPercentage)}</span>
          </div>
          <Progress
            value={projectedPercentage ?? 0}
            className={`h-1 ${getProgressColor(projectedPercentage)}`}
          />
        </div>

        <div className="grid grid-cols-3 divide-x divide-border-subtle rounded-md border border-border-subtle bg-surface-subtle text-center">
          <div className="p-2">
            <p className="text-caption text-text-muted">Present</p>
            <p className="text-body-strong tabular-nums text-status-success">{formatCount(presentDays)}</p>
          </div>
          <div className="p-2">
            <p className="text-caption text-text-muted">Total Classes</p>
            <p className="text-body-strong tabular-nums text-text-primary">{formatCount(totalClasses)}</p>
          </div>
          <div className="p-2">
            <p className="text-caption text-text-muted">Remaining</p>
            <p className="text-body-strong tabular-nums text-brand-foreground">{formatCount(remainingClasses)}</p>
          </div>
        </div>

        <div className={`flex items-center gap-2 rounded-md border px-3 py-2 ${trend.bg}`}>
          <TrendIcon className={`shrink-0 ${trend.color}`} aria-hidden />
          <span className="text-body text-text-primary">{trend.text} trend</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendancePredictionCard;
