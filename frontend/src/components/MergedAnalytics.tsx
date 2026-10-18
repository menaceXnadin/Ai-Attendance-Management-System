
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  People20Regular,
  Clock20Regular,
  Target20Regular,
  ArrowTrending16Regular,
  ArrowTrendingDown16Regular,
  ArrowTrending20Regular,
  ArrowTrendingDown20Regular,
  Warning20Regular,
  DataBarVertical20Regular,
  ErrorCircle20Regular,
  CalendarLtr20Regular,
  Pulse20Regular,
} from '@fluentui/react-icons';

// Demo data merged from both analytics
const analytics = {
  totalStudents: 125,
  presentToday: 98,
  attendanceRate: 78.4,
  weeklyTrend: 5.2,
  monthlyTrend: -2.1,
  averageArrivalTime: '9:12 AM',
  topPerformers: [
    { name: 'Aarohi Sharma', rate: 98.5, trend: 'up' },
    { name: 'Bibek Gurung', rate: 96.8, trend: 'stable' },
    { name: 'Priya Tamang', rate: 95.2, trend: 'up' }
  ],
  attendanceByTime: [
    { hour: '8:00', count: 15 },
    { hour: '9:00', count: 45 },
    { hour: '10:00', count: 28 },
    { hour: '11:00', count: 10 }
  ],
  weeklyData: [
    { day: 'Mon', present: 88, absent: 12, late: 5 },
    { day: 'Tue', present: 92, absent: 8, late: 3 },
    { day: 'Wed', present: 85, absent: 15, late: 8 },
    { day: 'Thu', present: 94, absent: 6, late: 2 },
    { day: 'Fri', present: 78, absent: 22, late: 10 }
  ],
  insights: [
    {
      type: 'positive',
      title: 'Improved Morning Attendance',
      description: 'Students are arriving earlier this week compared to last week',
      action: 'View Details'
    },
    {
      type: 'warning',
      title: 'Friday Attendance Drop',
      description: '15% lower attendance on Fridays. Consider engagement activities',
      action: 'Create Plan'
    }
  ],
  topPerformingClass: 'Computer Science',
  lowAttendanceCount: 8,
  timeSlotData: [
    { time: '8:00-9:00', students: 45, percentage: 78 },
    { time: '9:00-10:00', students: 52, percentage: 90 },
    { time: '10:00-11:00', students: 48, percentage: 83 },
    { time: '11:00-12:00', students: 41, percentage: 71 }
  ],
  departmentData: [
    { name: 'Computer Science', attendance: 92, students: 45 },
    { name: 'Engineering', attendance: 88, students: 38 },
    { name: 'Business', attendance: 85, students: 33 },
    { name: 'Arts', attendance: 79, students: 28 }
  ]
};

const getAttendanceColor = (rate: number) => {
  if (rate >= 90) return 'text-status-success';
  if (rate >= 80) return 'text-status-warning';
  if (rate >= 70) return 'text-status-warning';
  return 'text-status-error';
};

const getTrendIcon = (trend: number) => {
  if (trend > 0) return <ArrowTrending16Regular className="shrink-0 text-status-success" aria-hidden />;
  if (trend < 0) return <ArrowTrendingDown16Regular className="shrink-0 text-status-error" aria-hidden />;
  return <ArrowTrending16Regular className="shrink-0 text-text-muted" aria-hidden />;
};

const getInsightIcon = (type: string) => {
  if (type === 'positive') return <ArrowTrending16Regular className="shrink-0 text-status-success" aria-hidden />;
  if (type === 'warning') return <Warning20Regular className="h-4 w-4 shrink-0 text-status-warning" aria-hidden />;
  return <Pulse20Regular className="h-4 w-4 shrink-0 text-status-info" aria-hidden />;
};

/** KPI tile — Fluent stat card with icon chip. */
const KpiTile: React.FC<{
  label: string;
  icon: React.ReactNode;
  chipClassName?: string;
  muted?: boolean;
  children: React.ReactNode;
}> = ({ label, icon, chipClassName = 'bg-brand-subtle text-brand-foreground', muted = false, children }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className={`min-w-0 ${muted ? 'opacity-60' : ''}`}>
          <span className="text-caption text-text-muted">{label}</span>
          {children}
        </div>
        <div className={`h-10 w-10 shrink-0 rounded-md grid place-items-center ${chipClassName}`}>
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

const kpiValue = 'mt-1 text-[28px] leading-9 font-semibold tabular-nums';

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-subheading text-text-primary mb-3">{children}</h3>
);

// Main component
const MergedAnalytics: React.FC = () => {
  return (
    <div className="w-full space-y-8">
      <div>
        <h2 className="text-section-title text-text-primary">Unified Analytics Dashboard</h2>
        <p className="text-body text-text-muted mt-1">Today, weekly, monthly and yearly attendance at a glance</p>
      </div>

      {/* TODAY SECTION */}
      <section>
        <SectionHeading>Today</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Present Today */}
          <KpiTile
            label="Present Today"
            icon={<People20Regular aria-hidden />}
            chipClassName="bg-status-success-subtle text-status-success"
          >
            <div className={`${kpiValue} text-text-primary`}>{analytics.presentToday}</div>
          </KpiTile>
          {/* Total Students */}
          <KpiTile label="Total Students" icon={<People20Regular aria-hidden />}>
            <div className={`${kpiValue} text-text-primary`}>{analytics.totalStudents}</div>
          </KpiTile>
          {/* Attendance Rate */}
          <KpiTile label="Attendance Rate" icon={<Target20Regular aria-hidden />}>
            <div className={`${kpiValue} ${getAttendanceColor(analytics.attendanceRate)}`}>{analytics.attendanceRate}%</div>
          </KpiTile>
          {/* Need Attention */}
          <KpiTile
            label="Need Attention"
            icon={<ErrorCircle20Regular aria-hidden />}
            chipClassName="bg-status-warning-subtle text-status-warning"
          >
            <div className={`${kpiValue} text-text-primary`}>{analytics.lowAttendanceCount}</div>
          </KpiTile>
        </div>
      </section>

      {/* WEEKLY SECTION */}
      <section>
        <SectionHeading>Weekly</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
          {/* Weekly Trend */}
          <KpiTile label="Weekly Trend" icon={<Clock20Regular aria-hidden />}>
            <div className="flex items-center gap-2">
              <span className={`${kpiValue} ${analytics.weeklyTrend >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                {analytics.weeklyTrend > 0 ? '+' : ''}{analytics.weeklyTrend}%
              </span>
              {analytics.weeklyTrend > 0
                ? <ArrowTrending20Regular className="mt-1 shrink-0 text-status-success" aria-hidden />
                : <ArrowTrendingDown20Regular className="mt-1 shrink-0 text-status-error" aria-hidden />}
            </div>
          </KpiTile>
          {/* Overall Attendance (Weekly) */}
          <KpiTile label="Overall Attendance" icon={<DataBarVertical20Regular aria-hidden />}>
            <div className={`${kpiValue} ${getAttendanceColor(analytics.attendanceRate)}`}>{analytics.attendanceRate}%</div>
            <div className="flex items-center gap-1 mt-0.5">
              {getTrendIcon(analytics.weeklyTrend)}
              <span className="text-caption text-status-success tabular-nums">{Math.abs(analytics.weeklyTrend)}% this week</span>
            </div>
            <Badge variant="warning" shape="pill" className="mt-2">Good</Badge>
          </KpiTile>
          {/* Avg. Arrival Time (Weekly) */}
          <KpiTile label="Avg. Arrival Time" icon={<Clock20Regular aria-hidden />}>
            <div className={`${kpiValue} text-text-primary`}>{analytics.averageArrivalTime}</div>
            <span className="text-caption text-text-muted">across all classes</span>
          </KpiTile>
        </div>

        {/* Weekly Attendance Pattern */}
        <Card>
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <CalendarLtr20Regular className="mt-0.5 shrink-0 text-text-muted" aria-hidden />
              <div>
                <h4 className="text-subheading text-text-primary">Weekly Attendance Pattern</h4>
                <p className="text-caption text-text-muted mt-0.5">Share of present, late and absent students per day</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-caption">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-status-success rounded-sm"></div>
                <span className="text-text-muted">Present</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-status-warning rounded-sm"></div>
                <span className="text-text-muted">Late</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-status-error rounded-sm"></div>
                <span className="text-text-muted">Absent</span>
              </div>
            </div>
          </div>
          <div className="space-y-3 px-5 pb-5">
            {analytics.weeklyData.map((day) => (
              <div key={day.day} className="grid grid-cols-[48px_1fr_auto] items-center gap-3">
                <span className="text-body-strong text-text-primary">{day.day}</span>
                <div className="flex gap-px rounded-sm overflow-hidden h-2.5 bg-surface-selected">
                  <div className="bg-status-success" style={{ width: `${(day.present / (day.present + day.absent + day.late)) * 100}%` }} />
                  <div className="bg-status-warning" style={{ width: `${(day.late / (day.present + day.absent + day.late)) * 100}%` }} />
                  <div className="bg-status-error" style={{ width: `${(day.absent / (day.present + day.absent + day.late)) * 100}%` }} />
                </div>
                <span className="text-caption text-text-muted tabular-nums text-right">{day.present + day.absent + day.late} students</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* MONTHLY SECTION (placeholder, can add more metrics) */}
      <section>
        <SectionHeading>Monthly</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Example: Monthly Trend (using monthlyTrend from analytics) */}
          <KpiTile label="Monthly Trend" icon={<DataBarVertical20Regular aria-hidden />}>
            <div className="flex items-center gap-2">
              <span className={`${kpiValue} ${analytics.monthlyTrend >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                {analytics.monthlyTrend > 0 ? '+' : ''}{analytics.monthlyTrend}%
              </span>
              {analytics.monthlyTrend > 0
                ? <ArrowTrending20Regular className="mt-1 shrink-0 text-status-success" aria-hidden />
                : <ArrowTrendingDown20Regular className="mt-1 shrink-0 text-status-error" aria-hidden />}
            </div>
          </KpiTile>
        </div>
      </section>

      {/* YEARLY SECTION (placeholder, can add more metrics) */}
      <section>
        <SectionHeading>Yearly</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Example: Yearly Attendance (placeholder, no data in analytics) */}
          <KpiTile
            label="Yearly Attendance"
            icon={<DataBarVertical20Regular aria-hidden />}
            chipClassName="bg-surface-subtle text-text-muted"
            muted
          >
            <div className={`${kpiValue} text-text-primary`}>N/A</div>
          </KpiTile>
        </div>
      </section>
    </div>
  );
};

export default MergedAnalytics;
