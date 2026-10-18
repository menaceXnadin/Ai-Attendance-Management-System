import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowTrending20Regular, ArrowTrendingDown20Regular, People20Regular, Trophy20Regular } from '@fluentui/react-icons';
import { ClassComparison } from '@/types/dashboard';
import { NO_DATA, formatPercent, isFiniteNumber } from '@/components/attendance-admin/metrics';

interface ClassComparisonProps {
  comparison: ClassComparison;
}

const ClassComparisonCard: React.FC<ClassComparisonProps> = ({ comparison }) => {
  // Any value may be null when the server has no data; never compare or format null.
  const num = (v: unknown): number | null => (isFiniteNumber(v) ? v : null);
  const studentAttendance = num(comparison.studentAttendance);
  const classAverageAttendance = num(comparison.classAverageAttendance);
  const studentMarks = num(comparison.studentMarks);
  const classAverageMarks = num(comparison.classAverageMarks);

  const attendanceDiff =
    studentAttendance !== null && classAverageAttendance !== null ? studentAttendance - classAverageAttendance : null;
  const marksDiff = studentMarks !== null && classAverageMarks !== null ? studentMarks - classAverageMarks : null;
  const fmtScore = (v: number | null) => (v === null ? NO_DATA : v.toFixed(1));

  const getComparisonIcon = (diff: number | null) => {
    if (diff === null) return <div className="h-2.5 w-2.5 rounded-full bg-presence-offline" aria-hidden />;
    if (diff > 0) return <ArrowTrending20Regular className="text-status-success" aria-hidden />;
    if (diff < 0) return <ArrowTrendingDown20Regular className="text-status-error" aria-hidden />;
    return <div className="h-2.5 w-2.5 rounded-full bg-presence-offline" aria-hidden />;
  };

  const getComparisonText = (diff: number | null, isPercentage = false) => {
    if (diff === null) return 'No comparison available yet';
    const suffix = isPercentage ? '%' : ' points';
    if (diff > 0) return `${diff.toFixed(1)}${suffix} above average`;
    if (diff < 0) return `${Math.abs(diff).toFixed(1)}${suffix} below average`;
    return 'At class average';
  };

  const getComparisonColor = (diff: number | null) => {
    if (diff === null) return 'text-text-muted';
    if (diff > 0) return 'text-status-success';
    if (diff < 0) return 'text-status-error';
    return 'text-text-muted';
  };

  return (
    <Card className="border-0 bg-surface-default shadow">
      <CardHeader className="flex-row items-start gap-3 space-y-0 px-5 py-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand-foreground">
          <People20Regular aria-hidden />
        </div>
        <div className="min-w-0">
          <CardTitle className="text-subheading text-text-primary">
            Class Performance Comparison
          </CardTitle>
          <CardDescription className="text-caption text-text-muted">
            How you compare with your classmates
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-5 pb-5">
        {/* Attendance Comparison */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-body-strong text-text-primary">Attendance Performance</h4>
            {getComparisonIcon(attendanceDiff)}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-caption">
              <span className="text-text-muted">Your attendance</span>
              <span className="font-semibold tabular-nums text-text-primary">{formatPercent(studentAttendance)}</span>
            </div>
            <Progress value={studentAttendance ?? 0} className="h-1" />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-caption">
              <span className="text-text-muted">Class average</span>
              <span className="font-semibold tabular-nums text-text-primary">{formatPercent(classAverageAttendance)}</span>
            </div>
            <Progress value={classAverageAttendance ?? 0} className="h-1 [&>div]:bg-border-strong" />
          </div>

          <p className={`text-caption-strong ${getComparisonColor(attendanceDiff)}`}>
            {getComparisonText(attendanceDiff, true)}
          </p>
        </div>

        <div className="border-t border-border-subtle" />

        {/* Marks Comparison */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-body-strong text-text-primary">Academic Performance</h4>
            {getComparisonIcon(marksDiff)}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-caption">
              <span className="text-text-muted">Your average</span>
              <span className="font-semibold tabular-nums text-text-primary">{fmtScore(studentMarks)}</span>
            </div>
            <Progress value={studentMarks ?? 0} className="h-1" />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-caption">
              <span className="text-text-muted">Class average</span>
              <span className="font-semibold tabular-nums text-text-primary">{fmtScore(classAverageMarks)}</span>
            </div>
            <Progress value={classAverageMarks ?? 0} className="h-1 [&>div]:bg-border-strong" />
          </div>

          <p className={`text-caption-strong ${getComparisonColor(marksDiff)}`}>
            {getComparisonText(marksDiff)}
          </p>
        </div>

        {/* Overall Performance Badge */}
        <div className="flex items-center gap-3 rounded-md border border-border-subtle bg-surface-subtle px-3 py-2.5">
          <Trophy20Regular className="shrink-0 text-brand-foreground" aria-hidden />
          <p className="text-body-strong text-text-primary">
            {attendanceDiff === null && marksDiff === null
              ? "Not enough data to compare yet"
              : (attendanceDiff ?? 0) > 0 && (marksDiff ?? 0) > 0
              ? "Outstanding Performance!"
              : (attendanceDiff ?? 0) > 0 || (marksDiff ?? 0) > 0
              ? "Above Average Performance"
              : "Room for Improvement"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClassComparisonCard;
