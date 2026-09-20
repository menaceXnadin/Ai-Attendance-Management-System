import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import TeacherSidebar from '@/components/TeacherSidebar';
import {
  Book,
  Calendar,
  UserMultiple,
  ChartLineData,
  Time,
  User,
  Document,
  CheckmarkFilled,
  CloseFilled,
  WarningAlt,
  Stop,
  Renew
} from '@carbon/icons-react';
import { api } from '@/integrations/api/client';

interface ScheduleEntry {
  id: number;
  subject_name: string;
  start_time: string;
  end_time: string;
  classroom: string;
  semester: number;
  is_cancelled?: boolean;
  cancellation_reason?: string | null;
}

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
    semesters: number[];
  }>;
  today_schedule: ScheduleEntry[];
}

const TeacherDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dashboardData, setDashboardData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleEntry | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [notifyStudents, setNotifyStudents] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.teacher.getDashboard();
      setDashboardData(response);
      setError(null);
    } catch (err: unknown) {
      console.error('Error fetching dashboard data:', err);
      const errorObj = err as { response?: { data?: { detail?: string } } };
      setError(errorObj.response?.data?.detail || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCancelDialog = (schedule: ScheduleEntry) => {
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
        description: `${selectedSchedule.subject_name} has been marked cancelled.`,
      });

      setCancelDialogOpen(false);
      void fetchDashboardData();
    } catch (err: unknown) {
      console.error('Error cancelling class:', err);
      const errorObj = err as { response?: { data?: { detail?: string } } };
      toast({
        title: 'Error',
        description: errorObj.response?.data?.detail || 'Failed to cancel class',
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
          <div className="text-center space-y-3">
            <Renew size={28} className="animate-spin text-action-primary mx-auto" />
            <p className="text-xs text-text-muted">Loading teacher workspace...</p>
          </div>
        </div>
      </TeacherSidebar>
    );
  }

  if (error) {
    return (
      <TeacherSidebar>
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <Card className="max-w-md border border-status-danger/30 bg-surface-default shadow-none">
            <CardHeader>
              <CardTitle className="text-base text-status-danger">Workspace Error</CardTitle>
              <CardDescription className="text-xs text-text-muted">{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={fetchDashboardData} className="w-full">
                Retry Loading
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

  const totalWeeklyAttendance =
    attendance_last_7_days.present +
    attendance_last_7_days.absent +
    attendance_last_7_days.late || 1;

  return (
    <TeacherSidebar>
      <div className="space-y-6 max-w-7xl mx-auto py-2">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border-subtle">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Welcome back, {teacher.name.split(' ')[0]}
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              Faculty Instructor Portal • {teacher.department || 'Academic Department'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 px-3 rounded-md border border-border-default bg-surface-default flex items-center gap-1.5 text-xs text-text-secondary">
              <Calendar size={14} className="text-text-muted" />
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-border-default bg-surface-default shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Assigned Courses</p>
                  <p className="text-2xl font-bold text-text-primary tabular-nums mt-1">{stats.total_subjects}</p>
                  <p className="text-xs text-text-muted mt-0.5">Active curriculum</p>
                </div>
                <div className="h-10 w-10 rounded-md bg-surface-subtle flex items-center justify-center text-action-primary">
                  <Book size={20} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border-default bg-surface-default shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Weekly Sessions</p>
                  <p className="text-2xl font-bold text-text-primary tabular-nums mt-1">{stats.total_classes}</p>
                  <p className="text-xs text-text-muted mt-0.5">Teaching slots</p>
                </div>
                <div className="h-10 w-10 rounded-md bg-surface-subtle flex items-center justify-center text-action-primary">
                  <Calendar size={20} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border-default bg-surface-default shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Enrolled Students</p>
                  <p className="text-2xl font-bold text-text-primary tabular-nums mt-1">{stats.total_students}</p>
                  <p className="text-xs text-text-muted mt-0.5">Across classes</p>
                </div>
                <div className="h-10 w-10 rounded-md bg-surface-subtle flex items-center justify-center text-action-primary">
                  <UserMultiple size={20} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border-default bg-surface-default shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Classes Today</p>
                  <p className="text-2xl font-bold text-text-primary tabular-nums mt-1">{stats.classes_today}</p>
                  <p className="text-xs text-text-muted mt-0.5">Scheduled slots</p>
                </div>
                <div className="h-10 w-10 rounded-md bg-surface-subtle flex items-center justify-center text-status-warning">
                  <Time size={20} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Schedule & Attendance Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Schedule */}
          <Card className="lg:col-span-2 border border-border-default bg-surface-default shadow-none">
            <CardHeader className="py-4 border-b border-border-subtle">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-text-primary flex items-center gap-2">
                    <Calendar size={18} className="text-action-primary" />
                    Today's Teaching Schedule
                  </CardTitle>
                  <CardDescription className="text-xs text-text-muted mt-0.5">
                    Live timetable for today's active and upcoming courses
                  </CardDescription>
                </div>
                {today_schedule.length > 0 && (
                  <Badge variant="outline" className="text-xs tabular-nums">
                    {today_schedule.length} {today_schedule.length === 1 ? 'class' : 'classes'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {today_schedule.length === 0 ? (
                <div className="text-center py-10 text-text-muted">
                  <Calendar size={28} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium text-text-primary">No classes scheduled for today</p>
                  <p className="text-xs text-text-muted mt-0.5">Check your full weekly schedule for upcoming lectures</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {today_schedule.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="p-3.5 rounded-md border border-border-default bg-surface-default hover:bg-surface-subtle transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h2 className="text-sm font-semibold text-text-primary truncate">
                            {schedule.subject_name}
                          </h2>
                          {!schedule.is_cancelled && !isPastEnd(schedule.end_time) && (
                            <span className="flex h-2 w-2 relative" title="Class in session / pending">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-status-success"></span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-text-muted">
                          <span>Semester {schedule.semester}</span>
                          <span>•</span>
                          <span>{schedule.classroom || 'Classroom N/A'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs text-text-secondary bg-surface-subtle px-2.5 py-1 rounded border border-border-subtle flex items-center gap-1">
                          <Time size={12} className="text-text-muted" />
                          {schedule.start_time} - {schedule.end_time}
                        </span>

                        {schedule.is_cancelled ? (
                          <Badge variant="outline" className="text-xs text-status-danger border-status-danger/30 bg-status-danger/10">
                            Cancelled
                          </Badge>
                        ) : isPastEnd(schedule.end_time) ? (
                          <Badge variant="outline" className="text-xs text-text-muted bg-surface-subtle border-border-default">
                            Concluded
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2 text-status-danger border-border-default hover:border-status-danger hover:bg-status-danger/10"
                            onClick={() => handleOpenCancelDialog(schedule)}
                          >
                            <Stop size={12} className="mr-1" />
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
          <Card className="border border-border-default bg-surface-default shadow-none">
            <CardHeader className="py-4 border-b border-border-subtle">
              <CardTitle className="text-base font-semibold text-text-primary flex items-center gap-2">
                <ChartLineData size={18} className="text-action-primary" />
                Attendance Summary
              </CardTitle>
              <CardDescription className="text-xs text-text-muted mt-0.5">Last 7 operational days</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="p-3 rounded-md border border-status-success/30 bg-status-success/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckmarkFilled size={16} className="text-status-success" />
                    <span className="text-xs font-semibold text-text-primary">Present</span>
                  </div>
                  <span className="text-lg font-bold text-status-success tabular-nums">
                    {attendance_last_7_days.present}
                  </span>
                </div>
                <div className="h-1.5 bg-surface-subtle rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-status-success rounded-full transition-all"
                    style={{ width: `${Math.min(100, (attendance_last_7_days.present / totalWeeklyAttendance) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-md border border-status-danger/30 bg-status-danger/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CloseFilled size={16} className="text-status-danger" />
                    <span className="text-xs font-semibold text-text-primary">Absent</span>
                  </div>
                  <span className="text-lg font-bold text-status-danger tabular-nums">
                    {attendance_last_7_days.absent}
                  </span>
                </div>
                <div className="h-1.5 bg-surface-subtle rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-status-danger rounded-full transition-all"
                    style={{ width: `${Math.min(100, (attendance_last_7_days.absent / totalWeeklyAttendance) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-md border border-status-warning/30 bg-status-warning/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <WarningAlt size={16} className="text-status-warning" />
                    <span className="text-xs font-semibold text-text-primary">Late</span>
                  </div>
                  <span className="text-lg font-bold text-status-warning tabular-nums">
                    {attendance_last_7_days.late}
                  </span>
                </div>
                <div className="h-1.5 bg-surface-subtle rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-status-warning rounded-full transition-all"
                    style={{ width: `${Math.min(100, (attendance_last_7_days.late / totalWeeklyAttendance) * 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My Subjects */}
        <Card className="border border-border-default bg-surface-default shadow-none">
          <CardHeader className="py-4 border-b border-border-subtle">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <Book size={18} className="text-action-primary" />
                  My Assigned Courses
                </CardTitle>
                <CardDescription className="text-xs text-text-muted mt-0.5">Curriculum subjects under your instruction</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs tabular-nums">
                {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {subjects.map((subject) => (
                <div 
                  key={subject.id} 
                  className="p-4 rounded-md border border-border-default bg-surface-default hover:border-action-primary/70 transition-colors flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-text-primary">
                          {subject.name}
                        </h2>
                        <span className="font-mono text-xs text-text-muted">{subject.code}</span>
                      </div>
                      <Badge variant="outline" className="text-xs tabular-nums">
                        {subject.credits} Credits
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {subject.semesters.map((sem) => (
                        <Badge key={sem} variant="secondary" className="text-[10px] px-1.5 py-0">
                          Semester {sem}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-border-subtle mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-xs flex items-center justify-center gap-1"
                      onClick={() => navigate(`/teacher/subjects/${subject.id}/students?semester=${subject.semesters[0]}`)}
                    >
                      <UserMultiple size={12} />
                      <span>Students</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-xs flex items-center justify-center gap-1"
                      onClick={() => navigate(`/teacher/subjects/${subject.id}/analytics?semester=${subject.semesters[0]}`)}
                    >
                      <ChartLineData size={12} />
                      <span>Analytics</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="h-auto p-4 flex items-center justify-between border-border-default bg-surface-default hover:border-action-primary text-left transition-colors"
            onClick={() => navigate('/teacher/schedule')}
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-surface-subtle flex items-center justify-center text-action-primary shrink-0">
                <Calendar size={18} />
              </div>
              <div>
                <span className="font-semibold text-sm text-text-primary block">Full Schedule</span>
                <span className="text-xs text-text-muted block mt-0.5">Inspect weekly timetables</span>
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto p-4 flex items-center justify-between border-border-default bg-surface-default hover:border-action-primary text-left transition-colors"
            onClick={() => navigate('/teacher/attendance')}
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-surface-subtle flex items-center justify-center text-status-success shrink-0">
                <Document size={18} />
              </div>
              <div>
                <span className="font-semibold text-sm text-text-primary block">Mark Attendance</span>
                <span className="text-xs text-text-muted block mt-0.5">Record live student check-ins</span>
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto p-4 flex items-center justify-between border-border-default bg-surface-default hover:border-action-primary text-left transition-colors"
            onClick={() => navigate('/teacher/profile')}
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-surface-subtle flex items-center justify-center text-action-primary shrink-0">
                <User size={18} />
              </div>
              <div>
                <span className="font-semibold text-sm text-text-primary block">Teacher Profile</span>
                <span className="text-xs text-text-muted block mt-0.5">Contact and office details</span>
              </div>
            </div>
          </Button>
        </div>

        {/* Cancel Class Dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-status-danger">
                <Stop size={18} />
                <span>Cancel Class Session</span>
              </DialogTitle>
              <DialogDescription>
                {selectedSchedule && (
                  <>
                    Authorize cancellation for <strong className="text-text-primary">{selectedSchedule.subject_name}</strong> scheduled today at {selectedSchedule.start_time}.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="reason">Reason for Cancellation</Label>
                <Textarea
                  id="reason"
                  placeholder="e.g., Illness, emergency conference, authorized campus closure..."
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-md bg-surface-subtle border border-border-subtle">
                <div>
                  <Label htmlFor="notify" className="text-xs font-semibold text-text-primary cursor-pointer">
                    Notify Enrolled Students
                  </Label>
                  <p className="text-xs text-text-muted mt-0.5">
                    Broadcast cancellation notification immediately
                  </p>
                </div>
                <Switch
                  id="notify"
                  checked={notifyStudents}
                  onCheckedChange={setNotifyStudents}
                />
              </div>

              <div className="p-3 rounded-md bg-surface-subtle border border-border-subtle text-xs text-text-muted">
                <strong className="text-text-primary">Calendar update: </strong> 
                This session will be marked as cancelled. Students will not be penalized with auto-absent entries.
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(false)}
                disabled={cancelling}
              >
                Keep Class
              </Button>
              <Button
                onClick={handleCancelClass}
                disabled={cancelling}
                className="bg-status-danger text-white hover:bg-status-danger/90"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TeacherSidebar>
  );
};

export default TeacherDashboard;
