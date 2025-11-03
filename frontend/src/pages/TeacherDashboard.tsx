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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardContent className="pt-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Subjects</p>
                  <h3 className="text-3xl font-bold">{stats.total_subjects}</h3>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardContent className="pt-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Weekly Slots</p>
                  <h3 className="text-3xl font-bold">{stats.total_classes}</h3>
                  <p className="text-xs text-slate-500 mt-1">Schedule entries/week</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardContent className="pt-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Students</p>
                  <h3 className="text-3xl font-bold">{stats.total_students}</h3>
                </div>
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardContent className="pt-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Classes Today</p>
                  <h3 className="text-3xl font-bold">{stats.classes_today}</h3>
                </div>
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Today's Schedule */}
          <Card className="lg:col-span-2 bg-slate-900/70 border-slate-700/80">
            <CardHeader className="border-b border-slate-800/50">
              <CardTitle className="flex items-center gap-2 text-white">
                <Calendar className="w-5 h-5" />
                Today's Schedule
              </CardTitle>
              <CardDescription className="text-slate-400">Your classes for today</CardDescription>
            </CardHeader>
            <CardContent>
              {today_schedule.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No classes scheduled for today</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {today_schedule.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="flex items-center justify-between p-4 bg-slate-800/60 hover:bg-slate-800/80 rounded-xl border border-slate-700/70 hover:border-slate-600/70 transition-all duration-200"
                    >
                      <div className="flex-1">
                        <h4 className="font-semibold text-white">{schedule.subject_name}</h4>
                        <p className="text-sm text-slate-400">
                          Semester {schedule.semester} • {schedule.classroom}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono bg-slate-700/50 text-slate-200 border-slate-600/50">
                          {schedule.start_time} - {schedule.end_time}
                        </Badge>
                        {schedule.is_cancelled ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-gray-600/30 text-gray-300 border-gray-500/30">Cancelled</Badge>
                          </div>
                        ) : isPastEnd(schedule.end_time) ? (
                          <Badge variant="outline" className="bg-slate-700/50 text-slate-300 border-slate-600/50">Ended</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-rose-600/50 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                            onClick={() => handleOpenCancelDialog(schedule)}
                          >
                            <Ban className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attendance Summary (Last 7 Days) */}
          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardHeader className="border-b border-slate-800/50">
              <CardTitle className="flex items-center gap-2 text-white">
                <TrendingUp className="w-5 h-5" />
                Attendance (7 Days)
              </CardTitle>
              <CardDescription className="text-slate-400">Recent attendance overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm font-medium text-slate-300">Present</span>
                  </div>
                  <span className="text-lg font-bold text-emerald-400">
                    {attendance_last_7_days.present}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-rose-400" />
                    <span className="text-sm font-medium text-slate-300">Absent</span>
                  </div>
                  <span className="text-lg font-bold text-rose-400">
                    {attendance_last_7_days.absent}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                    <span className="text-sm font-medium text-slate-300">Late</span>
                  </div>
                  <span className="text-lg font-bold text-amber-400">
                    {attendance_last_7_days.late}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My Subjects */}
        <Card className="mt-6 bg-slate-900/70 border-slate-700/80">
          <CardHeader className="border-b border-slate-800/50">
            <CardTitle className="flex items-center gap-2 text-white">
              <BookOpen className="w-5 h-5" />
              My Subjects
            </CardTitle>
            <CardDescription className="text-slate-400">Subjects you are currently teaching</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.map((subject) => (
                <Card key={subject.id} className="bg-slate-800/60 border-slate-700/70 hover:border-slate-600/70 transition-all duration-200 cursor-pointer">
                  <CardContent className="pt-6 text-white">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">{subject.name}</h4>
                        <Badge variant="secondary" className="bg-slate-700 text-slate-200 border-slate-600">{subject.code}</Badge>
                      </div>
                      <Badge variant="outline" className="bg-slate-700/50 text-slate-200 border-slate-600/50">{subject.credits} Credits</Badge>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-slate-600 text-slate-200"
                        onClick={() => navigate(`/teacher/subjects/${subject.id}/students?semester=${subject.semesters[0]}`)}
                      >
                        <Users className="w-4 h-4 mr-1" />
                        Students
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-slate-600 text-slate-200"
                        onClick={() => navigate(`/teacher/subjects/${subject.id}/analytics?semester=${subject.semesters[0]}`)}
                      >
                        <TrendingUp className="w-4 h-4 mr-1" />
                        Analytics
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col items-center gap-2 border-slate-600 text-slate-200"
            onClick={() => navigate('/teacher/schedule')}
          >
            <Calendar className="w-8 h-8" />
            <span className="font-semibold">View Full Schedule</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col items-center gap-2 border-slate-600 text-slate-200"
            onClick={() => navigate('/teacher/attendance')}
          >
            <FileText className="w-8 h-8" />
            <span className="font-semibold">Attendance Records</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col items-center gap-2 border-slate-600 text-slate-200"
            onClick={() => navigate('/teacher/profile')}
          >
            <User className="w-8 h-8" />
            <span className="font-semibold">My Profile</span>
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
