import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import TeacherSidebar from '@/components/TeacherSidebar';
import {
  BookOpen,
  Calendar,
  Users,
  TrendingUp,
  Clock,
  LogOut,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Ban
} from 'lucide-react';
import { api } from '@/integrations/api/client';

interface TeacherDashboardData {
  teacher: {
    id: number;
    teacher_id: string;
    name: string;
    department: string;
    office_location: string;
  };
  stats: {
    total_subjects: number;
    total_classes: number;
    total_students: number;
    classes_today: number;
  };
  attendance_last_7_days: {
    present: number;
    absent: number;
    late: number;
  };
  subjects: Array<{
    id: number;
    name: string;
    code: string;
    credits: number;
    semesters: number[];  // Semesters this subject is taught in
  }>;
  today_schedule: Array<{
    id: number;
    subject_name: string;
    start_time: string;
    end_time: string;
    classroom: string;
    semester: number;
    is_cancelled?: boolean;
    cancellation_reason?: string | null;
  }>;
}

const TeacherDashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dashboardData, setDashboardData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [notifyStudents, setNotifyStudents] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  // Keep dynamic time hooks before any conditional returns to satisfy React hook rules
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.teacher.getDashboard();
      setDashboardData(response);
      setError(null);
    } catch (err: unknown) {
      console.error('Error fetching dashboard data:', err);
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleOpenCancelDialog = (schedule: any) => {
    setSelectedSchedule(schedule);
    setCancellationReason('');
    setNotifyStudents(true);
    setCancelDialogOpen(true);
  };

  const handleCancelClass = async () => {
    if (!selectedSchedule) return;

    try {
      setCancelling(true);
      const today = new Date().toISOString().split('T')[0];
      
      await api.teacher.cancelClass({
        schedule_id: selectedSchedule.id,
        date: today,
        reason: cancellationReason || 'Teacher unavailable',
        notify_students: notifyStudents,
      });

      toast({
        title: 'Class Cancelled',
        description: `${selectedSchedule.subject_name} has been cancelled${notifyStudents ? ' and students have been notified' : ''}.`,
      });

      setCancelDialogOpen(false);
      // Refresh dashboard data
      fetchDashboardData();
    } catch (err: any) {
      console.error('Error cancelling class:', err);
      toast({
        title: 'Error',
        description: err.response?.data?.detail || 'Failed to cancel class',
        variant: 'destructive',
      });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <TeacherSidebar>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-300">Loading dashboard...</p>
          </div>
        </div>
      </TeacherSidebar>
    );
  }

  if (error) {
    return (
      <TeacherSidebar>
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <Card className="max-w-md bg-slate-900/70 border-slate-700/70">
            <CardHeader>
              <CardTitle className="text-rose-400">Error</CardTitle>
              <CardDescription className="text-slate-400">{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={fetchDashboardData} className="w-full">
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </TeacherSidebar>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const { teacher, stats, attendance_last_7_days, subjects, today_schedule } = dashboardData;

  const isPastEnd = (end: string) => {
    const [hh, mm] = end.split(':').map(Number);
    const endDt = new Date();
    endDt.setHours(hh, mm, 0, 0);
    return now.getTime() > endDt.getTime();
  };

  return (
    <TeacherSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">
            Welcome back, {teacher.name.split(' ')[0]}
          </h1>
          <p className="text-slate-400 text-lg">Here's an overview of your teaching activities</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="group relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-900/50 border-slate-700/50 hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <CardContent className="pt-6 pb-6 relative">
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Subjects Teaching</p>
                  <h3 className="text-4xl font-bold text-white group-hover:scale-110 transition-transform duration-300 origin-left">{stats.total_subjects}</h3>
                  <p className="text-xs text-slate-500 mt-2">Active courses</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg shadow-blue-500/20">
                  <BookOpen className="w-7 h-7 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-900/50 border-slate-700/50 hover:border-green-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/10 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <CardContent className="pt-6 pb-6 relative">
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Weekly Slots</p>
                  <h3 className="text-4xl font-bold text-white group-hover:scale-110 transition-transform duration-300 origin-left">{stats.total_classes}</h3>
                  <p className="text-xs text-slate-500 mt-2">Schedule entries</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/10 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg shadow-green-500/20">
                  <Calendar className="w-7 h-7 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-900/50 border-slate-700/50 hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <CardContent className="pt-6 pb-6 relative">
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Students</p>
                  <h3 className="text-4xl font-bold text-white group-hover:scale-110 transition-transform duration-300 origin-left">{stats.total_students}</h3>
                  <p className="text-xs text-slate-500 mt-2">Across all subjects</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg shadow-purple-500/20">
                  <Users className="w-7 h-7 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-900/50 border-slate-700/50 hover:border-orange-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/10 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <CardContent className="pt-6 pb-6 relative">
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Classes Today</p>
                  <h3 className="text-4xl font-bold text-white group-hover:scale-110 transition-transform duration-300 origin-left">{stats.classes_today}</h3>
                  <p className="text-xs text-slate-500 mt-2">Scheduled sessions</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg shadow-orange-500/20">
                  <Clock className="w-7 h-7 text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Schedule */}
          <Card className="lg:col-span-2 bg-gradient-to-br from-slate-900/90 to-slate-900/50 border-slate-700/50 hover:border-slate-600/50 transition-all duration-300 shadow-xl">
            <CardHeader className="border-b border-slate-800/50 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-white text-2xl font-bold">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-blue-400" />
                    </div>
                    Today's Schedule
                  </CardTitle>
                  <CardDescription className="text-slate-400 mt-2">Your classes for {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</CardDescription>
                </div>
                {today_schedule.length > 0 && (
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30 px-3 py-1 text-sm">
                    {today_schedule.length} {today_schedule.length === 1 ? 'class' : 'classes'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {today_schedule.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
                    <Calendar className="w-10 h-10 text-slate-500" />
                  </div>
                  <p className="text-slate-400 font-medium mb-1">No classes scheduled for today</p>
                  <p className="text-sm text-slate-500">Enjoy your free day!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {today_schedule.map((schedule, index) => (
                    <div
                      key={schedule.id}
                      className="group relative overflow-hidden p-5 bg-slate-800/40 hover:bg-slate-800/60 rounded-2xl border border-slate-700/50 hover:border-slate-600/70 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-white text-lg truncate">{schedule.subject_name}</h4>
                            {!schedule.is_cancelled && !isPastEnd(schedule.end_time) && (
                              <span className="flex-shrink-0 relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-400">
                            <span className="flex items-center gap-1.5">
                              <Users className="w-4 h-4" />
                              Semester {schedule.semester}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <BookOpen className="w-4 h-4" />
                              {schedule.classroom}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <Badge variant="outline" className="font-mono text-sm bg-slate-700/50 text-slate-200 border-slate-600/50 px-3 py-1.5">
                            <Clock className="w-3.5 h-3.5 mr-2 inline" />
                            {schedule.start_time} - {schedule.end_time}
                          </Badge>
                          {schedule.is_cancelled ? (
                            <Badge variant="outline" className="bg-red-500/10 text-red-300 border-red-500/30 px-3 py-1.5">
                              <Ban className="w-3.5 h-3.5 mr-1.5 inline" />
                              Cancelled
                            </Badge>
                          ) : isPastEnd(schedule.end_time) ? (
                            <Badge variant="outline" className="bg-slate-700/30 text-slate-400 border-slate-600/30 px-3 py-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 inline" />
                              Ended
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-rose-600/50 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/70 transition-all duration-200"
                              onClick={() => handleOpenCancelDialog(schedule)}
                            >
                              <Ban className="w-4 h-4 mr-1.5" />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attendance Summary (Last 7 Days) */}
          <Card className="bg-gradient-to-br from-slate-900/90 to-slate-900/50 border-slate-700/50 hover:border-slate-600/50 transition-all duration-300 shadow-xl">
            <CardHeader className="border-b border-slate-800/50 pb-4">
              <CardTitle className="flex items-center gap-3 text-white text-xl font-bold">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                Attendance
              </CardTitle>
              <CardDescription className="text-slate-400 mt-2">Last 7 days overview</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-5">
                <div className="group p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <span className="text-sm font-semibold text-slate-200">Present</span>
                    </div>
                    <span className="text-2xl font-bold text-emerald-400">
                      {attendance_last_7_days.present}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (attendance_last_7_days.present / (attendance_last_7_days.present + attendance_last_7_days.absent + attendance_last_7_days.late || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="group p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center">
                        <XCircle className="w-5 h-5 text-rose-400" />
                      </div>
                      <span className="text-sm font-semibold text-slate-200">Absent</span>
                    </div>
                    <span className="text-2xl font-bold text-rose-400">
                      {attendance_last_7_days.absent}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (attendance_last_7_days.absent / (attendance_last_7_days.present + attendance_last_7_days.absent + attendance_last_7_days.late || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="group p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all duration-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-amber-400" />
                      </div>
                      <span className="text-sm font-semibold text-slate-200">Late</span>
                    </div>
                    <span className="text-2xl font-bold text-amber-400">
                      {attendance_last_7_days.late}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (attendance_last_7_days.late / (attendance_last_7_days.present + attendance_last_7_days.absent + attendance_last_7_days.late || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My Subjects */}
        <Card className="bg-gradient-to-br from-slate-900/90 to-slate-900/50 border-slate-700/50 shadow-xl">
          <CardHeader className="border-b border-slate-800/50 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-3 text-white text-2xl font-bold">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-indigo-400" />
                  </div>
                  My Subjects
                </CardTitle>
                <CardDescription className="text-slate-400 mt-2">Courses you are currently teaching</CardDescription>
              </div>
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-400/30 px-3 py-1 text-sm">
                {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {subjects.map((subject, index) => (
                <Card 
                  key={subject.id} 
                  className="group relative overflow-hidden bg-slate-800/40 border-slate-700/50 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                  style={{ animationDelay: `${index * 75}ms` }}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
                  <CardContent className="pt-6 pb-6 relative">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-white text-lg mb-2 truncate group-hover:text-indigo-300 transition-colors">{subject.name}</h4>
                          <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">{subject.code}</Badge>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant="outline" className="bg-slate-700/50 text-slate-200 border-slate-600/50 whitespace-nowrap">
                            {subject.credits} Credits
                          </Badge>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {subject.semesters.map(sem => (
                              <Badge key={sem} variant="outline" className="text-xs bg-blue-500/10 text-blue-300 border-blue-500/30">S{sem}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-slate-600/50 text-slate-200 hover:bg-purple-500/10 hover:border-purple-500/50 hover:text-purple-300 transition-all duration-200"
                          onClick={() => navigate(`/teacher/subjects/${subject.id}/students?semester=${subject.semesters[0]}`)}
                        >
                          <Users className="w-4 h-4 mr-1.5" />
                          Students
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-slate-600/50 text-slate-200 hover:bg-green-500/10 hover:border-green-500/50 hover:text-green-300 transition-all duration-200"
                          onClick={() => navigate(`/teacher/subjects/${subject.id}/analytics?semester=${subject.semesters[0]}`)}
                        >
                          <TrendingUp className="w-4 h-4 mr-1.5" />
                          Analytics
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Button
            variant="outline"
            className="group h-auto py-8 flex flex-col items-center gap-4 border-slate-700/50 bg-slate-900/40 hover:bg-slate-800/60 hover:border-blue-500/50 text-slate-200 hover:text-white transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1"
            onClick={() => navigate('/teacher/schedule')}
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Calendar className="w-8 h-8 text-blue-400" />
            </div>
            <div className="text-center">
              <span className="font-bold text-lg block">View Full Schedule</span>
              <span className="text-xs text-slate-400 mt-1 block">Check all your classes</span>
            </div>
          </Button>
          <Button
            variant="outline"
            className="group h-auto py-8 flex flex-col items-center gap-4 border-slate-700/50 bg-slate-900/40 hover:bg-slate-800/60 hover:border-green-500/50 text-slate-200 hover:text-white transition-all duration-300 hover:shadow-lg hover:shadow-green-500/10 hover:-translate-y-1"
            onClick={() => navigate('/teacher/attendance')}
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <FileText className="w-8 h-8 text-green-400" />
            </div>
            <div className="text-center">
              <span className="font-bold text-lg block">Mark Attendance</span>
              <span className="text-xs text-slate-400 mt-1 block">Record student attendance</span>
            </div>
          </Button>
          <Button
            variant="outline"
            className="group h-auto py-8 flex flex-col items-center gap-4 border-slate-700/50 bg-slate-900/40 hover:bg-slate-800/60 hover:border-purple-500/50 text-slate-200 hover:text-white transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1"
            onClick={() => navigate('/teacher/profile')}
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <User className="w-8 h-8 text-purple-400" />
            </div>
            <div className="text-center">
              <span className="font-bold text-lg block">My Profile</span>
              <span className="text-xs text-slate-400 mt-1 block">View and edit details</span>
            </div>
          </Button>
        </div>

        {/* Cancel Class Dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-400" />
                Cancel Class
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {selectedSchedule && (
                  <>
                    Cancel <span className="font-semibold">{selectedSchedule.subject_name}</span> scheduled for today at {selectedSchedule.start_time}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reason" className="text-slate-300">
                  Reason for Cancellation
                </Label>
                <Textarea
                  id="reason"
                  placeholder="e.g., Personal emergency, Faculty meeting, etc."
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="notify" className="text-slate-300 font-semibold cursor-pointer">
                    Notify Students
                  </Label>
                  <p className="text-sm text-slate-400">
                    Send notification to all students in this class
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${notifyStudents ? 'text-green-400' : 'text-slate-500'}`}>
                    {notifyStudents ? 'ON' : 'OFF'}
                  </span>
                  <Switch
                    id="notify"
                    checked={notifyStudents}
                    onCheckedChange={setNotifyStudents}
                    className="data-[state=checked]:bg-green-500"
                  />
                </div>
              </div>

              {selectedSchedule && (
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-400/30">
                  <p className="text-sm text-blue-300">
                    <strong>Note:</strong> This will mark today's class as cancelled in the academic calendar. 
                    Attendance will not be required for this session.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(false)}
                disabled={cancelling}
                className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              >
                Keep Class
              </Button>
              <Button
                onClick={handleCancelClass}
                disabled={cancelling}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Class'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TeacherSidebar>
  );
};

export default TeacherDashboard;
