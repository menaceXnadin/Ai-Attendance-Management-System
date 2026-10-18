import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DataBarVertical16Regular,
  DataBarVertical20Regular,
  ArrowTrending16Regular,
  ArrowTrendingDown16Regular,
  ArrowTrending20Regular,
  ArrowTrendingDown20Regular,
  People16Regular,
  CalendarLtr16Regular,
  Clock16Regular,
  Target16Regular,
  Target20Regular,
  Trophy16Regular,
  Warning20Regular,
  ArrowDownload16Regular,
  Filter16Regular,
  ChevronRight12Regular,
} from '@fluentui/react-icons';

interface AttendanceAnalyticsProps {
  className?: string;
}

interface AnalyticsData {
  totalStudents: number;
  presentToday: number;
  attendanceRate: number;
  weeklyTrend: number;
  monthlyTrend: number;
  topPerformers: Array<{
    name: string;
    rate: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  attendanceByTime: Array<{
    hour: string;
    count: number;
  }>;
  weeklyData: Array<{
    day: string;
    present: number;
    absent: number;
    late: number;
  }>;
  insights: Array<{
    type: 'positive' | 'warning' | 'negative';
    title: string;
    description: string;
    action?: string;
  }>;
}

const AttendanceAnalytics: React.FC<AttendanceAnalyticsProps> = ({ className = '' }) => {
  const [data, setData] = useState<AnalyticsData>({
    totalStudents: 125,
    presentToday: 98,
    attendanceRate: 78.4,
    weeklyTrend: 5.2,
    monthlyTrend: -2.1,
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
    ]
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'insights'>('overview');

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return 'text-status-success';
    if (rate >= 75) return 'text-status-warning';
    return 'text-status-error';
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'positive':
        return <ArrowTrending20Regular className="shrink-0 text-status-success" aria-hidden />;
      case 'warning':
        return <Warning20Regular className="shrink-0 text-status-warning" aria-hidden />;
      case 'negative':
        return <ArrowTrendingDown20Regular className="shrink-0 text-status-error" aria-hidden />;
      default:
        return <Target20Regular className="shrink-0 text-status-info" aria-hidden />;
    }
  };

  /** MessageBar tone per insight type. */
  const getInsightTone = (type: string) => {
    switch (type) {
      case 'positive':
        return 'bg-status-success-subtle border-status-success-border';
      case 'warning':
        return 'bg-status-warning-subtle border-status-warning-border';
      case 'negative':
        return 'bg-status-error-subtle border-status-error-border';
      default:
        return 'bg-status-info-subtle border-status-info-border';
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-md bg-brand-subtle text-brand-foreground grid place-items-center">
              <DataBarVertical20Regular aria-hidden />
            </div>
            <div>
              <CardTitle>Attendance Analytics</CardTitle>
              <p className="text-caption text-text-muted mt-0.5">Comprehensive insights and trends</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter16Regular aria-hidden />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <ArrowDownload16Regular aria-hidden />
              Export
            </Button>
          </div>
        </div>

        {/* Tab Navigation — Fluent TabList (underline indicator) */}
        <div role="tablist" className="flex items-center gap-1 border-b border-border-subtle mt-4 -mx-5 px-3 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: DataBarVertical16Regular },
            { id: 'trends', label: 'Trends', icon: ArrowTrending16Regular },
            { id: 'insights', label: 'Insights', icon: Target16Regular }
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id as 'overview' | 'trends' | 'insights')}
              className={`relative flex items-center gap-1.5 px-3 py-3 text-body transition-colors duration-150 ease-fluent-standard after:absolute after:left-3 after:right-3 after:-bottom-px after:h-[3px] after:rounded-full after:transition-colors ${
                activeTab === tab.id
                  ? 'text-text-primary font-semibold after:bg-brand'
                  : 'text-text-secondary hover:text-text-primary after:bg-transparent hover:after:bg-border-default'
              }`}
            >
              <tab.icon className={`shrink-0 ${activeTab === tab.id ? 'text-brand-foreground' : ''}`} aria-hidden />
              {tab.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-5">
        {activeTab === 'overview' && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-md bg-surface-subtle border border-border-subtle">
                <div className="flex items-center gap-2 mb-1">
                  <People16Regular className="shrink-0 text-brand-foreground" aria-hidden />
                  <span className="text-caption text-text-muted">Total Students</span>
                </div>
                <p className="text-section-title tabular-nums text-text-primary">{data.totalStudents}</p>
              </div>

              <div className="p-3 rounded-md bg-surface-subtle border border-border-subtle">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarLtr16Regular className="shrink-0 text-status-success" aria-hidden />
                  <span className="text-caption text-text-muted">Present Today</span>
                </div>
                <p className="text-section-title tabular-nums text-text-primary">{data.presentToday}</p>
              </div>

              <div className="p-3 rounded-md bg-surface-subtle border border-border-subtle">
                <div className="flex items-center gap-2 mb-1">
                  <Target16Regular className="shrink-0 text-brand-foreground" aria-hidden />
                  <span className="text-caption text-text-muted">Attendance Rate</span>
                </div>
                <p className={`text-section-title tabular-nums ${getAttendanceColor(data.attendanceRate)}`}>
                  {data.attendanceRate}%
                </p>
              </div>

              <div className="p-3 rounded-md bg-surface-subtle border border-border-subtle">
                <div className="flex items-center gap-2 mb-1">
                  <Clock16Regular className="shrink-0 text-text-muted" aria-hidden />
                  <span className="text-caption text-text-muted">Weekly Trend</span>
                </div>
                <div className="flex items-center gap-1">
                  <p className={`text-section-title tabular-nums ${data.weeklyTrend > 0 ? 'text-status-success' : 'text-status-error'}`}>
                    {data.weeklyTrend > 0 ? '+' : ''}{data.weeklyTrend}%
                  </p>
                  {data.weeklyTrend > 0 ? (
                    <ArrowTrending16Regular className="shrink-0 text-status-success" aria-hidden />
                  ) : (
                    <ArrowTrendingDown16Regular className="shrink-0 text-status-error" aria-hidden />
                  )}
                </div>
              </div>
            </div>

            {/* Attendance Rate Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-body text-text-secondary">Today's Attendance Progress</span>
                <span className="text-body-strong text-text-primary tabular-nums">
                  {data.presentToday} / {data.totalStudents}
                </span>
              </div>
              <Progress value={(data.presentToday / data.totalStudents) * 100} className="h-1.5" />
            </div>
          </>
        )}

        {activeTab === 'trends' && (
          <>
            {/* Weekly Data */}
            <div className="space-y-4">
              <h4 className="text-body-strong text-text-primary">Weekly Attendance Pattern</h4>
              {data.weeklyData.map((day) => (
                <div key={day.day} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-body text-text-secondary">{day.day}</span>
                    <span className="text-caption text-text-muted tabular-nums">
                      {day.present + day.absent + day.late} students
                    </span>
                  </div>
                  <div className="flex gap-px rounded-sm overflow-hidden h-2 bg-surface-selected">
                    <div
                      className="bg-status-success"
                      style={{ width: `${(day.present / (day.present + day.absent + day.late)) * 100}%` }}
                    />
                    <div
                      className="bg-status-warning"
                      style={{ width: `${(day.late / (day.present + day.absent + day.late)) * 100}%` }}
                    />
                    <div
                      className="bg-status-error"
                      style={{ width: `${(day.absent / (day.present + day.absent + day.late)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
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
          </>
        )}

        {activeTab === 'insights' && (
          <>
            {/* Top Performers */}
            <div className="space-y-2">
              <h4 className="text-body-strong text-text-primary flex items-center gap-2">
                <Trophy16Regular className="shrink-0 text-text-muted" aria-hidden />
                Top Performers
              </h4>
              <div className="-mx-3">
                {data.topPerformers.map((student, index) => (
                  <div key={index} className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-surface-hover transition-colors duration-150 ease-fluent-standard">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-brand-subtle text-brand-foreground grid place-items-center">
                        <span className="text-caption-strong tabular-nums">{index + 1}</span>
                      </div>
                      <span className="text-body-strong text-text-primary">{student.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-body-strong text-status-success tabular-nums">{student.rate}%</span>
                      {student.trend === 'up' && <ArrowTrending16Regular className="shrink-0 text-status-success" aria-hidden />}
                      {student.trend === 'down' && <ArrowTrendingDown16Regular className="shrink-0 text-status-error" aria-hidden />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insights */}
            <div className="space-y-2">
              <h4 className="text-body-strong text-text-primary">AI Insights</h4>
              {data.insights.map((insight, index) => (
                <div key={index} className={`rounded-md border px-3 py-2.5 ${getInsightTone(insight.type)}`}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5">{getInsightIcon(insight.type)}</span>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-body-strong text-text-primary">{insight.title}</h5>
                      <p className="text-body text-text-secondary mt-0.5">{insight.description}</p>
                      {insight.action && (
                        <button className="mt-1.5 text-body text-brand-foreground hover:text-brand-foreground-hover hover:underline underline-offset-2 inline-flex items-center gap-1 transition-colors duration-150">
                          {insight.action}
                          <ChevronRight12Regular aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AttendanceAnalytics;
