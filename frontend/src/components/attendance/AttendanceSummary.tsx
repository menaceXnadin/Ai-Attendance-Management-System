
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AttendanceChart from '@/components/AttendanceChart';
import { Progress } from '@/components/ui/progress';
import { api, apiClient } from '@/integrations/api/client';
import {
  formatPercent,
  isFiniteNumber,
  resolveBand,
  resolvePercentage,
  toneClasses,
  useAttendancePolicy,
} from '@/components/attendance-admin/metrics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DataTrending20Regular,
  CheckmarkCircle20Regular,
  DismissCircle20Regular,
  Clock20Regular,
  Info20Regular,
  Lightbulb20Regular,
  ChartMultiple24Regular,
} from '@fluentui/react-icons';

interface AttendanceSummaryProps {
  selectedClass?: string;
  startDate?: string;
  endDate?: string;
}

const AttendanceSummary: React.FC<AttendanceSummaryProps> = ({ 
  selectedClass, 
  startDate, 
  endDate 
}) => {
  const policyView = useAttendancePolicy();

  // Raw summary payload so the server's §13.12 fields (percentage/has_data/band) are kept.
  const { data: summary, isLoading } = useQuery({
    queryKey: ['attendance-summary', selectedClass, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      const qs = params.toString();
      const { data } = await apiClient.get<Record<string, unknown>>(`/attendance/summary${qs ? `?${qs}` : ''}`);
      return (data ?? {}) as Record<string, unknown>;
    }
  });

  // Generate chart data for weekly attendance patterns
  const { data: attendanceData } = useQuery({
    queryKey: ['attendance-data', selectedClass, startDate, endDate],
    queryFn: async () => {
      const filters = {
        classId: selectedClass,
        startDate,
        endDate
      };
      
      const response = await api.attendance.getAll(filters);
      const records = response?.records ?? [];
      
      // Group records by date
      const recordsByDate = records.reduce((acc, record) => {
        const date = record.date.substring(0, 10); // Get YYYY-MM-DD part
        if (!acc[date]) {
          acc[date] = { present: 0, absent: 0, late: 0 };
        }
        
        if (record.status === 'present') acc[date].present++;
        else if (record.status === 'absent') acc[date].absent++;
        else if (record.status === 'late') acc[date].late++;
        
        return acc;
      }, {});
      
      // Convert to chart data array
      return Object.keys(recordsByDate).map(date => ({
        name: date,
        present: recordsByDate[date].present,
        absent: recordsByDate[date].absent,
        late: recordsByDate[date].late
      }));
    },
    enabled: !isLoading && !!summary // Only run after summary loads
  });

  const percentagePresent = useMemo(() => resolvePercentage(summary), [summary]);
  const band = useMemo(() => resolveBand(summary, policyView, percentagePresent), [summary, policyView, percentagePresent]);
  const statusColor = band ? toneClasses[band.tone].text : 'text-text-muted';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-12 text-body text-text-muted">
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-brand-subtle border-t-brand"
          aria-hidden
        />
        <span>Loading attendance data...</span>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg bg-surface-default px-6 py-12 text-center shadow">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-subtle text-text-muted">
          <ChartMultiple24Regular aria-hidden />
        </div>
        <p className="text-body text-text-muted">No attendance data available for the selected criteria.</p>
      </div>
    );
  }

  const count = (key: string) => (isFiniteNumber(summary[key]) ? (summary[key] as number) : 0);
  const totalPresent = count('present');
  const totalAbsent = count('absent');
  const totalLate = count('late');
  const totalExcused = count('excused');
  const total = count('total');
  // Share-of-records percentages are only shown when the server provides them.
  const serverPct = (key: string): number | null => (isFiniteNumber(summary[key]) ? (summary[key] as number) : null);
  const absentPercentage = serverPct('percentage_absent');
  const latePercentage = serverPct('percentage_late');
  const excusedPercentage = serverPct('percentage_excused');
  const unrecorded = serverPct('unrecorded');

  // Prepare chart data for the pie chart
  const pieChartData = [
    { name: "Present", present: totalPresent, absent: 0, late: 0 },
    { name: "Absent", present: 0, absent: totalAbsent, late: 0 },
    { name: "Late", present: 0, absent: 0, late: totalLate }
  ];

  const kpis = [
    {
      label: 'Attendance rate',
      value: formatPercent(percentagePresent),
      caption: percentagePresent === null ? 'No classes counted yet' : band ? band.label : `${total} total records`,
      icon: <DataTrending20Regular aria-hidden />,
      chip: 'bg-brand-subtle text-brand-foreground',
      valueClass: statusColor,
    },
    {
      label: 'Present',
      value: totalPresent,
      caption: `${total} total classes`,
      icon: <CheckmarkCircle20Regular aria-hidden />,
      chip: 'bg-status-success-subtle text-status-success',
      valueClass: 'text-text-primary',
    },
    {
      label: 'Absent',
      value: totalAbsent,
      caption: absentPercentage !== null ? `${formatPercent(absentPercentage)} of records` : 'Absences recorded',
      icon: <DismissCircle20Regular aria-hidden />,
      chip: 'bg-status-error-subtle text-status-error',
      valueClass: 'text-text-primary',
    },
    {
      label: 'Late',
      value: totalLate,
      caption: latePercentage !== null ? `${formatPercent(latePercentage)} of records` : 'Late arrivals recorded',
      icon: <Clock20Regular aria-hidden />,
      chip: 'bg-status-warning-subtle text-status-warning',
      valueClass: 'text-text-primary',
    },
  ];

  const breakdown = [
    { label: 'Present', count: totalPresent, pct: percentagePresent, bar: '[&>div]:bg-status-success', show: true },
    { label: 'Absent', count: totalAbsent, pct: absentPercentage, bar: '[&>div]:bg-status-error', show: true },
    { label: 'Late', count: totalLate, pct: latePercentage, bar: '[&>div]:bg-status-warning', show: true },
    { label: 'Excused', count: totalExcused, pct: excusedPercentage, bar: '[&>div]:bg-status-info', show: totalExcused > 0 },
  ];

  return (
    <div className="space-y-4">
      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="flex items-start gap-3 rounded-lg bg-surface-default p-4 shadow">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${kpi.chip}`}>
              {kpi.icon}
            </div>
            <div className="min-w-0">
              <p className="text-caption text-text-muted">{kpi.label}</p>
              <p className={`text-[28px] font-semibold leading-9 tabular-nums ${kpi.valueClass}`}>{kpi.value}</p>
              <p className="text-caption text-text-muted">{kpi.caption}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-lg bg-surface-default shadow">
          <header className="border-b border-border-subtle px-5 py-4">
            <h3 className="text-subheading text-text-primary">Overall Attendance Rate</h3>
          </header>
          <div className="p-5">
            <div className="mb-5 flex items-baseline gap-2">
              <span className={`text-[40px] font-semibold leading-[52px] tabular-nums ${statusColor}`}>
                {formatPercent(percentagePresent)}
              </span>
              <span className="text-caption text-text-muted">present</span>
            </div>

            <div className="space-y-3">
              {breakdown.filter((row) => row.show).map((row) => (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex justify-between text-body">
                    <span className="text-text-secondary">{row.label} ({row.count})</span>
                    <span className="font-semibold tabular-nums text-text-primary">{formatPercent(row.pct)}</span>
                  </div>
                  {row.pct !== null && <Progress value={row.pct} className={`h-1.5 bg-surface-pressed ${row.bar}`} />}
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-border-subtle pt-3 text-caption text-text-muted">
              Total classes: <span className="tabular-nums">{total}</span>
              {unrecorded ? <span className="ml-2 text-status-warning">· {unrecorded} unrecorded session{unrecorded === 1 ? '' : 's'} not counted</span> : null}
            </div>
          </div>
        </section>

        <AttendanceChart
          data={pieChartData}
          title="Attendance Distribution"
          description="Breakdown by attendance status"
          type="pie"
        />
      </div>

      {attendanceData && attendanceData.length > 0 && (
        <Tabs defaultValue="bar" className="space-y-3">
          <TabsList>
            <TabsTrigger value="bar">Bar Chart</TabsTrigger>
            <TabsTrigger value="line">Line Chart</TabsTrigger>
          </TabsList>

          <TabsContent value="bar" className="mt-0">
            <AttendanceChart
              data={attendanceData}
              title="Attendance Trends"
              description="Daily attendance breakdown"
              type="bar"
            />
          </TabsContent>

          <TabsContent value="line" className="mt-0">
            <AttendanceChart
              data={attendanceData}
              title="Attendance Trends"
              description="Daily attendance patterns"
              type="line"
            />
          </TabsContent>
        </Tabs>
      )}

      <section className="rounded-lg bg-surface-default shadow">
        <header className="flex items-center gap-2 border-b border-border-subtle px-5 py-4">
          <Lightbulb20Regular className="text-brand-foreground" aria-hidden />
          <h3 className="text-subheading text-text-primary">Attendance Insights</h3>
        </header>
        <div className="space-y-2 p-5">
          <div className="flex items-start gap-2 rounded-md border border-status-info-border bg-status-info-subtle px-3 py-2 text-body text-text-primary">
            <Info20Regular className="mt-px shrink-0 text-status-info" aria-hidden />
            <p>
              <strong className="font-semibold">Overall Performance: </strong>
              {percentagePresent === null || !band
                ? "No classes have been counted yet."
                : band.tone === 'destructive'
                ? `Attendance (${formatPercent(percentagePresent)}) is in the ${band.label} band — below the ${policyView.minimum}% minimum.`
                : band.tone === 'warning'
                ? `Attendance is ${formatPercent(percentagePresent)} (${band.label}) — there's room for improvement.`
                : `Attendance is ${formatPercent(percentagePresent)} (${band.label}). Keep up the good work!`}
            </p>
          </div>

          {totalLate > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-status-warning-border bg-status-warning-subtle px-3 py-2 text-body text-text-primary">
              <Clock20Regular className="mt-px shrink-0 text-status-warning" aria-hidden />
              <p>
                <strong className="font-semibold">Punctuality: </strong>
                {totalLate} late arrival{totalLate === 1 ? '' : 's'} recorded
                {latePercentage !== null ? ` (${formatPercent(latePercentage)} of records)` : ''}.
              </p>
            </div>
          )}

          {totalAbsent > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-status-error-border bg-status-error-subtle px-3 py-2 text-body text-text-primary">
              <DismissCircle20Regular className="mt-px shrink-0 text-status-error" aria-hidden />
              <p>
                <strong className="font-semibold">Absences: </strong>
                {totalAbsent} absence{totalAbsent === 1 ? '' : 's'} recorded
                {absentPercentage !== null ? ` (${formatPercent(absentPercentage)} of records)` : ''}.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AttendanceSummary;
