import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  UserMultiple, 
  Calendar,
  Notification,
  ChartLineData,
  Screen,
  CheckmarkFilled,
  ArrowRight,
  Time,
  Education,
  Collaborate,
  Activity,
  EventSchedule
} from '@carbon/icons-react';
import { Link } from 'react-router-dom';
import { api } from '@/integrations/api/client';
import { useAuth } from '@/contexts/useAuth';

type QuickNavCardProps = {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
};

const QuickNavCard: React.FC<QuickNavCardProps> = ({ href, icon, title, description }) => (
  <Link to={href} className="block group">
    <Card className="border border-border-default bg-surface-default hover:border-action-primary/80 transition-all shadow-none p-4 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-md bg-surface-subtle flex items-center justify-center text-action-primary shrink-0">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary group-hover:text-action-primary transition-colors">
              {title}
            </h3>
            <p className="text-xs text-text-muted mt-0.5">{description}</p>
          </div>
        </div>
        <ArrowRight size={16} className="text-text-muted group-hover:text-action-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
      </div>
    </Card>
  </Link>
);

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  badge?: {
    text: string;
    variant?: 'success' | 'warning' | 'neutral';
  };
};

const StatCard: React.FC<StatCardProps> = ({ label, value, hint, icon, badge }) => (
  <Card className="border border-border-default bg-surface-default shadow-none">
    <CardContent className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="h-9 w-9 rounded-md bg-surface-subtle flex items-center justify-center text-action-primary">
          {icon}
        </div>
        {badge && (
          <Badge 
            variant="outline" 
            className={`text-xs tabular-nums ${
              badge.variant === 'success' 
                ? 'bg-status-success/10 text-status-success border-status-success/30' 
                : badge.variant === 'warning'
                  ? 'bg-status-warning/10 text-status-warning border-status-warning/30'
                  : 'bg-surface-subtle text-text-secondary border-border-default'
            }`}
          >
            {badge.text}
          </Badge>
        )}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{label}</p>
      <p className="text-2xl font-bold text-text-primary tabular-nums mt-1">{value}</p>
      {hint && <p className="text-xs text-text-muted mt-0.5">{hint}</p>}
    </CardContent>
  </Card>
);

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  // Fetch summary data
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => api.students.getAll(),
    retry: false,
  });

  const { data: faculties = [] } = useQuery({
    queryKey: ['faculties'],
    queryFn: () => api.faculties.getAll(),
    retry: false,
  });

  const { data: todayAttendance = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ['today-attendance'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await api.attendance.getAll({ date: today, limit: 200, skip: 0 });
      return response.records || [];
    },
    retry: false,
  });

  const totalStudents = students.length;
  const presentToday = todayAttendance.filter((r) => r.status === 'present').length;
  const attendanceRate = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;
  const isLoading = studentsLoading || attendanceLoading;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border-subtle">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Admin Dashboard
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Institutional overview, attendance metrics, and operational command modules
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Badge variant="outline" className="text-xs py-1 px-2.5 gap-1.5 border-status-success/30 bg-status-success/10 text-status-success">
            <span className="h-1.5 w-1.5 rounded-full bg-status-success inline-block" />
            <span>Operational</span>
          </Badge>
          <div className="h-8 px-3 rounded-md border border-border-default bg-surface-default flex items-center gap-1.5 text-xs text-text-secondary">
            <Time size={14} className="text-text-muted" />
            <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Summary Metrics Strip */}
      <section aria-labelledby="summary-metrics-heading">
        <h2 id="summary-metrics-heading" className="sr-only">Key Statistics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            label="Total Students" 
            value={isLoading ? '—' : totalStudents}
            hint="Active registered student roster"
            icon={<UserMultiple size={20} />}
          />
          <StatCard 
            label="Present Today" 
            value={isLoading ? '—' : presentToday}
            hint={`${attendanceRate}% average daily attendance`}
            icon={<CheckmarkFilled size={20} />}
            badge={{
              text: `${attendanceRate}% rate`,
              variant: attendanceRate >= 75 ? 'success' : 'warning',
            }}
          />
          <StatCard 
            label="Academic Faculties" 
            value={faculties.length || '—'}
            hint="Configured institutional faculties"
            icon={<Education size={20} />}
          />
          <StatCard 
            label="Background Workers" 
            value="Active"
            hint="Automated attendance daemon"
            icon={<Activity size={20} />}
            badge={{
              text: 'Auto-Absent On',
              variant: 'success',
            }}
          />
        </div>
      </section>

      {/* Quick Navigation Hub */}
      <section aria-labelledby="quick-nav-heading" className="space-y-3">
        <div>
          <h2 id="quick-nav-heading" className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Management Operations
          </h2>
          <p className="text-xs text-text-muted">Quick access to key administrative controls and monitoring tools</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickNavCard
            href="/app/attendance"
            icon={<Calendar size={20} />}
            title="Attendance Hub"
            description="Inspect, log, and adjust daily student attendance"
          />
          <QuickNavCard
            href="/app/students"
            icon={<UserMultiple size={20} />}
            title="Students Directory"
            description="Manage student records, biometrics, and enrollments"
          />
          <QuickNavCard
            href="/app/teachers"
            icon={<Collaborate size={20} />}
            title="Teachers Management"
            description="Instructor accounts and course scheduling"
          />
          <QuickNavCard
            href="/app/faculties"
            icon={<Education size={20} />}
            title="Faculties & Curriculum"
            description="Manage degree departments and semester courses"
          />
          <QuickNavCard
            href="/app/auto-absent"
            icon={<Activity size={20} />}
            title="Auto-Absent System"
            description="Monitor and execute scheduled automated absent tracking"
          />
          <QuickNavCard
            href="/app/calendar-settings"
            icon={<EventSchedule size={20} />}
            title="Academic Calendar"
            description="Configure semesters, institutional holidays, and terms"
          />
          <QuickNavCard
            href="/app/analytics"
            icon={<ChartLineData size={20} />}
            title="Analytics & Reports"
            description="Aggregated trends, risk alerts, and exportable logs"
          />
          <QuickNavCard
            href="/app/monitoring"
            icon={<Screen size={20} />}
            title="System Monitor"
            description="Live daemon status and health diagnostics"
          />
          <QuickNavCard
            href="/app/notifications"
            icon={<Notification size={20} />}
            title="Notifications"
            description="Campus-wide announcements and alerts"
          />
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
