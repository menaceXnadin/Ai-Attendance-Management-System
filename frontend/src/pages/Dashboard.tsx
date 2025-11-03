import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  BookOpen, 
  Calendar,
  Bell,
  BarChart3,
  Monitor,
  CheckCircle,
  TrendingUp,
  ArrowRight,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/integrations/api/client';
import { useAuth } from '@/contexts/useAuth';

type QuickLinkCardProps = {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
};

const QuickLinkCard: React.FC<QuickLinkCardProps> = ({ href, icon, title, description, gradient }) => (
  <Link to={href} className="block group">
    <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 hover:border-slate-600 transition-all hover:shadow-lg hover:shadow-blue-500/10">
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`}></div>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center group-hover:scale-110 transition-transform`}>
              {icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-blue-300 transition-colors">{title}</h3>
              <p className="text-sm text-slate-400">{description}</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
        </div>
      </CardContent>
    </Card>
  </Link>
);

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
  trendValue?: string;
  gradient: string;
};

const StatCard: React.FC<StatCardProps> = ({ label, value, hint, icon, trend, trendValue, gradient }) => (
  <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`}></div>
    <CardContent className="pt-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          {icon}
        </div>
        {trend && trendValue && (
          <Badge variant="outline" className={`${
            trend === 'up' ? 'bg-green-500/20 text-green-300 border-green-400/30' : 'bg-red-500/20 text-red-300 border-red-400/30'
          }`}>
            <TrendingUp className={`h-3 w-3 mr-1 ${trend === 'down' ? 'rotate-180' : ''}`} />
            {trendValue}
          </Badge>
        )}
      </div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">{label}</div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </CardContent>
  </Card>
);

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  // Fetch summary data - show placeholders while loading
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => api.students.getAll(),
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

  // Calculate simple stats
  const totalStudents = students.length;
  const presentToday = todayAttendance.filter(r => r.status === 'present').length;
  const attendanceRate = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;

  const isLoading = studentsLoading || attendanceLoading;

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full opacity-10 blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500 rounded-full opacity-10 blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 w-full p-6 md:p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            <p className="text-blue-200/80 text-lg mt-2">
              Comprehensive attendance management and analytics hub
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-400/30">
              <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse mr-2" />
              System Active
            </Badge>
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
              <Clock className="h-4 w-4 mr-2" />
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <section aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="sr-only">Summary Statistics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard 
              label="Total Students" 
              value={isLoading ? '—' : totalStudents}
              hint="Registered in the system"
              icon={<Users className="h-5 w-5 text-white" />}
              gradient="from-blue-500 to-cyan-500"
            />
            <StatCard 
              label="Present Today" 
              value={isLoading ? '—' : presentToday}
              hint={`${attendanceRate}% attendance rate`}
              icon={<CheckCircle className="h-5 w-5 text-white" />}
              gradient="from-green-500 to-emerald-500"
              trend="up"
              trendValue={`${attendanceRate}%`}
            />
            <StatCard 
              label="Notifications" 
              value="—"
              hint="Pending items"
              icon={<Bell className="h-5 w-5 text-white" />}
              gradient="from-orange-500 to-red-500"
            />
          </div>
        </section>

        {/* Quick Navigation */}
        <section aria-labelledby="quick-nav-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="quick-nav-heading" className="text-2xl font-semibold text-white">
              Quick Navigation
            </h2>
            <p className="text-sm text-slate-400">Access key features and detailed pages</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <QuickLinkCard
              href="/app/analytics"
              icon={<BarChart3 className="h-6 w-6 text-white" />}
              title="Analytics"
              description="Detailed trends, insights, and reports"
              gradient="from-blue-500 to-cyan-500"
            />
            <QuickLinkCard
              href="/app/monitoring"
              icon={<Monitor className="h-6 w-6 text-white" />}
              title="System Monitor"
              description="Live monitoring and system status"
              gradient="from-purple-500 to-pink-500"
            />
            <QuickLinkCard
              href="/app/attendance"
              icon={<Calendar className="h-6 w-6 text-white" />}
              title="Attendance"
              description="Mark, review, and manage attendance"
              gradient="from-green-500 to-emerald-500"
            />
            <QuickLinkCard
              href="/app/students"
              icon={<Users className="h-6 w-6 text-white" />}
              title="Students"
              description="Student directory and management"
              gradient="from-orange-500 to-red-500"
            />
            <QuickLinkCard
              href="/app/notifications"
              icon={<Bell className="h-6 w-6 text-white" />}
              title="Notifications"
              description="Announcements and alerts"
              gradient="from-teal-500 to-cyan-500"
            />
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
