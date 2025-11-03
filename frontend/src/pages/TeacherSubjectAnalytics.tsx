import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import TeacherSidebar from '@/components/TeacherSidebar';
import { BarChart3, ArrowLeft, TrendingUp, Users, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/integrations/api/client';
import { useToast } from '@/hooks/use-toast';
import SemesterFilter from '@/components/filters/SemesterFilter';

interface StudentAttendance {
  student_id: string;
  student_name: string;
  total_classes: number;
  present: number;
  absent: number;
  late: number;
  attendance_percentage: number;
}

interface AnalyticsData {
  subject_id: number;
  total_students: number;
  overall_stats: {
    present: number;
    absent: number;
    late: number;
  };
  student_attendance: StudentAttendance[];
}

const TeacherSubjectAnalytics: React.FC = () => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSemester = Number(searchParams.get('semester') || 1);
  const [semester, setSemester] = useState<number>(initialSemester);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.teacher.getSubjectAnalytics(parseInt(subjectId!), semester);
      setAnalytics(data);
    } catch (err: unknown) {
      console.error('Error fetching analytics:', err);
      const error = err as { message?: string };
      toast({
        title: 'Error',
        description: error.message || 'Failed to load analytics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [subjectId, semester, toast]);

  useEffect(() => {
    if (subjectId) {
      fetchAnalytics();
    }
  }, [subjectId, fetchAnalytics]);

  // Keep URL in sync when semester changes
  useEffect(() => {
    const next = new URLSearchParams(window.location.search || '');
    next.set('semester', String(semester));
    setSearchParams(next, { replace: true });
  }, [semester, setSearchParams]);

  if (loading) {
    return (
      <TeacherSidebar>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-400 mx-auto" />
            <p className="text-slate-300">Loading analytics...</p>
          </div>
        </div>
      </TeacherSidebar>
    );
  }

  if (!analytics) {
    return (
      <TeacherSidebar>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Button
            variant="outline"
            className="mb-6 border-slate-600 text-slate-200"
            onClick={() => navigate('/teacher')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardContent className="pt-6">
              <p className="text-slate-400 text-center">No analytics data available</p>
            </CardContent>
          </Card>
        </div>
      </TeacherSidebar>
    );
  }

  const totalRecords = analytics.overall_stats.present + analytics.overall_stats.absent + analytics.overall_stats.late;
  const overallPercentage = totalRecords > 0 
    ? Math.round((analytics.overall_stats.present / totalRecords) * 100) 
    : 0;

  return (
    <TeacherSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Button
          variant="outline"
          className="mb-6 border-slate-600 text-slate-200"
          onClick={() => navigate('/teacher')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Quick Filter Bar */}
        <div className="flex items-center justify-between mb-4">
          <div />
          <SemesterFilter value={semester} onChange={setSemester} />
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardContent className="pt-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Students</p>
                  <h3 className="text-3xl font-bold">{analytics.total_students}</h3>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardContent className="pt-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Present</p>
                  <h3 className="text-3xl font-bold text-emerald-400">{analytics.overall_stats.present}</h3>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardContent className="pt-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Absent</p>
                  <h3 className="text-3xl font-bold text-rose-400">{analytics.overall_stats.absent}</h3>
                </div>
                <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-rose-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700/80">
            <CardContent className="pt-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Overall Rate</p>
                  <h3 className="text-3xl font-bold text-blue-400">{overallPercentage}%</h3>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Student Attendance List */}
        <Card className="bg-slate-900/70 border-slate-700/80">
          <CardHeader className="border-b border-slate-800/50">
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Student Attendance Details
            </CardTitle>
            <CardDescription className="text-slate-400">
              Individual attendance breakdown for all students
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {analytics.student_attendance.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No attendance records available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {analytics.student_attendance.map((student) => (
                  <div
                    key={student.student_id}
                    className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/70"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-white">{student.student_name}</h4>
                        <p className="text-sm text-slate-400">{student.student_id}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`${
                          student.attendance_percentage >= 90
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : student.attendance_percentage >= 75
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {student.attendance_percentage}%
                      </Badge>
                    </div>
                    <Progress
                      value={student.attendance_percentage}
                      className="h-2 mb-3"
                    />
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span className="text-slate-300">
                          Present: <span className="font-semibold text-white">{student.present}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-rose-400" />
                        <span className="text-slate-300">
                          Absent: <span className="font-semibold text-white">{student.absent}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400" />
                        <span className="text-slate-300">
                          Late: <span className="font-semibold text-white">{student.late}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TeacherSidebar>
  );
};

export default TeacherSubjectAnalytics;
