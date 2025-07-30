import React from 'react';
import type { Student } from '@/types/student';
// ...existing code...
// Custom hook to fetch current student's record by user email
function useCurrentStudent(user) {
  return useQuery({
    queryKey: ['current-student', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const students = await api.students.getAll();
      // Debug log: print user email and all student emails
      console.log('[DEBUG] Logged-in user email:', user.email);
      console.log('[DEBUG] All student emails:', students.map(s => s.email));
      const found = students.find(s => s.email === user.email);
      if (!found) {
        // Try case-insensitive match
        const foundInsensitive = students.find(s => s.email?.toLowerCase() === user.email?.toLowerCase());
        if (foundInsensitive) {
          console.log('[DEBUG] Found student by case-insensitive email match:', foundInsensitive);
        } else {
          console.warn('[DEBUG] No student found for user email:', user.email);
        }
        return foundInsensitive || null;
      }
      return found;
    },
    enabled: !!user?.email,
    retry: false,
  });
}
import { useQuery } from '@tanstack/react-query';
import LiveMonitoring from '@/components/LiveMonitoring';
import AttendanceAnalytics from '@/components/AttendanceAnalytics';
import SmartNotificationSystem from '@/components/SmartNotificationSystem';
import EnhancedSystemMonitor from '@/components/EnhancedSystemMonitor';
import RealTimeStats from '@/components/RealTimeStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  User, 
  Users, 
  BookOpen, 
  Loader2,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  Target,
  AlertCircle,
  CheckCircle,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Download,
  RefreshCw,
  Filter,
  Bell,
  Settings,
  ChevronRight,
  Zap,
  Shield,
  Globe,
  Monitor
} from 'lucide-react';
import HeaderStats from '@/components/HeaderStats';
import AttendanceChart from '@/components/AttendanceChart';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/integrations/api/client';
import { useAuth } from '@/contexts/useAuth';
import RealTimeAnalytics from '@/components/RealTimeAnalytics';
import RealAttendanceAnalytics from '@/components/RealAttendanceAnalytics';


const Dashboard = () => {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  // Fetch current student record
  const { data: currentStudent, isLoading: studentLoading } = useCurrentStudent(user);

  // Only fetch data if user is authenticated
  const hasValidToken = (() => {
    const token = localStorage.getItem('authToken');
    if (!token) return false;
    
    // Basic JWT format check
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    try {
      // Check if token is not expired
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      return payload.exp ? payload.exp > now : true;
    } catch {
      return false;
    }
  })();
  
  const isAuthenticated = hasValidToken; // Simplified: just check if we have a valid token
  
  console.log('[Dashboard] Auth status:', { 
    user: !!user, 
    hasValidToken, 
    isAuthenticated, 
    authLoading,
    token: localStorage.getItem('authToken') ? 'present' : 'missing'
  });

  // Fetch students data - completely disabled until auth is confirmed
  const { data: students = [], isLoading: studentsLoading, error: studentsError } = useQuery({
    queryKey: ['students'],
    queryFn: () => {
      if (!isAuthenticated) {
        throw new Error('Not authenticated - skipping API call');
      }
      return api.students.getAll();
    },
    enabled: isAuthenticated && !authLoading,
    retry: false,
  });

  // Fetch classes data - completely disabled until auth is confirmed
  const { data: classes = [], isLoading: classesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => {
      if (!isAuthenticated) {
        throw new Error('Not authenticated - skipping API call');
      }
      return api.classes.getAll();
    },
    enabled: isAuthenticated && !authLoading,
    retry: false,
  });

  // Fetch attendance data for today
  const { data: todayAttendance = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ['today-attendance'],
    queryFn: async () => {
      if (!isAuthenticated) {
        throw new Error('Not authenticated - skipping API call');
      }
      const today = new Date().toISOString().split('T')[0];
      return await api.attendance.getAll({ date: today });
    },
    enabled: isAuthenticated && !authLoading, // Only fetch if authenticated
    retry: false,
  });

  // Fetch attendance summary
  const { data: attendanceSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['attendance-summary'],
    queryFn: () => {
      if (!isAuthenticated) {
        throw new Error('Not authenticated - skipping API call');
      }
      return api.attendance.getSummary();
    },
    enabled: isAuthenticated && !authLoading, // Only fetch if authenticated
    retry: false,
  });

  // Fetch weekly attendance data
  const { data: weeklyAttendance = [], isLoading: weeklyLoading } = useQuery({
    queryKey: ['weekly-attendance'],
    queryFn: async () => {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const filters = {
        startDate: weekAgo.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0]
      };
      
      const records = await api.attendance.getAll(filters);
      
      // Group by day of week
      const dayMap = {};
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      records.forEach(record => {
        const date = new Date(record.date);
        const dayName = dayNames[date.getDay()];
        
        if (!dayMap[dayName]) {
          dayMap[dayName] = { present: 0, absent: 0, late: 0 };
        }
        
        if (record.status === 'present') dayMap[dayName].present++;
        else if (record.status === 'absent') dayMap[dayName].absent++;
        else if (record.status === 'late') dayMap[dayName].late++;
      });
      
      return Object.keys(dayMap).map(day => ({
        name: day,
        ...dayMap[day]
      }));
    },
    enabled: isAuthenticated, // Only fetch if authenticated
  });

  // Fetch system health data
  const { data: systemHealth, isLoading: healthLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => api.dashboard.getSystemHealth(),
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: isAuthenticated && !authLoading,
    retry: false,
  });

  // Fetch recent attendance records with student details (no getById, only getAll)
  const { data: recentActivity = [], isLoading: recentLoading } = useQuery({
    queryKey: ['recent-attendance'],
    queryFn: async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const records = await api.attendance.getAll({ date: today });
        
        // If no records for today, show empty instead of old data
        // This ensures we only show real, current activity
        if (records.length === 0) {
          return []; // Return empty array - show "No activity today"
        }
        
        const students: Student[] = await api.students.getAll();

        // Map database ID to student for quick lookup (attendance.studentId is the database ID)
        // Handle both string and number IDs
        const studentMap: Record<string, Student> = Object.fromEntries(
          students.map(s => [String(s.id), s])
        );

        // Get recent records and attach student info - only include records with valid students
        const recentRecords = records.slice(0, 8); // Get more records to filter from
        
        const validActivities = recentRecords
          .map(record => {
            const lookupKey = String(record.studentId);
            const student = studentMap[lookupKey];
            
            // Only return activity if we found a valid student
            if (student && student.name && student.name !== 'Unknown Student') {
              return {
                id: record.id,
                name: student.name,
                time: new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: record.status.charAt(0).toUpperCase() + record.status.slice(1),
                imageUrl: student.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`,
              };
            }
            return null; // Filter out invalid entries
          })
          .filter(Boolean) // Remove null entries
          .slice(0, 4); // Take only top 4 valid entries
        
        return validActivities;
      } catch (error) {
        console.error('Error fetching recent activity:', error);
        return [];
      }
    },
    enabled: isAuthenticated, // Only fetch if authenticated
  });

  // Calculate stats from real data
  const stats = React.useMemo(() => {
    const totalStudents = students.length;
    const totalClasses = classes.length;
    const presentToday = todayAttendance.filter(record => record.status === 'present').length;
    const attendanceRate = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;
    
    return [
      {
        title: 'Total Students',
        stat: totalStudents.toString(),
        description: `Registered students`,
        icon: <Users size={20} />,
      },
      {
        title: 'Classes',
        stat: totalClasses.toString(),
        description: 'Active classes',
        icon: <BookOpen size={20} />,
      },
      {
        title: 'Present Today',
        stat: presentToday.toString(),
        description: `${attendanceRate}% attendance rate`,
        icon: <User size={20} />,
      },
      {
        title: 'Total Records',
        stat: (attendanceSummary?.total || 0).toString(),
        description: 'Attendance records',
        icon: <Calendar size={20} />,
      },
    ];
  }, [students, classes, todayAttendance, attendanceSummary]);

  const totalStudents = students.length;

  // Prepare class-wise attendance data
  const classAttendanceData = React.useMemo(() => {
    if (!classes.length || !todayAttendance.length) return [];
    
    const classMap = {};
    
    todayAttendance.forEach(record => {
      const classId = record.classId;
      if (!classMap[classId]) {
        classMap[classId] = { present: 0, absent: 0, late: 0 };
      }
      
      if (record.status === 'present') classMap[classId].present++;
      else if (record.status === 'absent') classMap[classId].absent++;
      else if (record.status === 'late') classMap[classId].late++;
    });
    
    return classes.slice(0, 5).map(cls => {
      const data = classMap[cls.id] || { present: 0, absent: 0, late: 0 };
      return {
        name: cls.name,
        ...data
      };
    });
  }, [classes, todayAttendance]);

  const isLoading = authLoading || (isAuthenticated && (studentsLoading || classesLoading || attendanceLoading || summaryLoading));


  // Show login prompt if not authenticated
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex justify-center items-center">
        <Card className="w-full max-w-md bg-slate-900/80 border border-slate-700/50 shadow-2xl rounded-2xl backdrop-blur-md">
          <CardContent className="p-8 text-center">
            <div className="h-16 w-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-white">Authentication Required</h2>
            <p className="text-blue-200/80 mb-6">
              Please log in to access the admin dashboard and manage your attendance system.
            </p>
            <div className="space-y-4">
              <Link to="/login">
                <Button className="w-full bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white">
                  <User className="h-4 w-4 mr-2" />
                  Go to Login
                </Button>
              </Link>
              <p className="text-xs text-slate-400">
                Debug: Token {localStorage.getItem('authToken') ? 'exists' : 'missing'}, User {user ? 'loaded' : 'not loaded'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || studentLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex justify-center items-center">
        <div className="text-center">
          <div className="relative mb-8">
            <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-r-teal-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <h3 className="text-2xl font-semibold text-white mb-3">Loading Dashboard Analytics</h3>
          <p className="text-blue-200/80">Preparing your comprehensive attendance overview...</p>
        </div>
      </div>
    );
  }

  // Show face registration prompt only if student has not registered face
  const shouldShowFaceRegistration = currentStudent && (!currentStudent.face_encoding || currentStudent.face_encoding.length === 0);

  // Example: Show a banner at the top of the dashboard
  // You can replace this with a modal or your ModernFaceRegistration component as needed

  // Place this banner or component wherever you want in your dashboard UI

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950">
      {shouldShowFaceRegistration && (
        <div className="w-full bg-yellow-100 border-b border-yellow-300 text-yellow-900 py-4 px-6 flex items-center justify-between z-50">
          <div>
            <b>Face Registration Required:</b> You have not registered your face yet. Please complete your face registration for attendance.
          </div>
          <Link to="/face-registration">
            <Button className="ml-4 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold">Register Your Face</Button>
          </Link>
        </div>
      )}
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full opacity-3 blur-3xl animate-pulse"></div>
        <div className="absolute top-60 -left-20 w-60 h-60 bg-teal-400 rounded-full opacity-3 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <div className="relative z-10 p-6 space-y-8">
        {/* Enhanced Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            <p className="text-blue-200/80 text-lg mt-2">
              Comprehensive attendance management and analytics overview
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-400/30">
              <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse mr-2" />
              System Active
            </Badge>
            <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Enhanced Header Stats */}
        <RealTimeAnalytics />

        {/* Main Dashboard Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-slate-800/50 border border-slate-700/50">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="live-monitoring" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500"
            >
              <Monitor className="h-4 w-4 mr-2" />
              Live Feed
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger 
              value="notifications" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500"
            >
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger 
              value="system-monitor" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500"
            >
              <Activity className="h-4 w-4 mr-2" />
              System Monitor
            </TabsTrigger>
            <TabsTrigger 
              value="system-health" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500"
            >
              <Shield className="h-4 w-4 mr-2" />
              Health
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Main Analytics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity Enhanced */}
          <div className="lg:col-span-1">
            <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 h-full">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-400" />
                    Live Activity Feed
                  </CardTitle>
                  <Badge className="bg-green-500/20 text-green-300">
                    <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse mr-1" />
                    Live
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {recentLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="relative">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                      <div className="absolute inset-0 h-8 w-8 border-2 border-transparent border-r-teal-400 rounded-full animate-spin" style={{ animationDirection: 'reverse' }}></div>
                    </div>
                  </div>
                ) : recentActivity.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
                      <User className="h-8 w-8 text-slate-500" />
                    </div>
                    <p className="text-slate-400 font-medium">No attendance activity today</p>
                    <p className="text-slate-500 text-sm">Real-time attendance records will appear here as students check in</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((student) => (
                      <div key={student.id} className="flex items-center p-3 hover:bg-slate-800/50 rounded-xl transition-all group">
                        <div className="relative">
                          <img 
                            src={student.imageUrl} 
                            alt={student.name} 
                            className="h-12 w-12 rounded-full border-2 border-slate-700 group-hover:border-blue-400 transition-colors"
                            onError={(e) => {
                              e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`;
                            }}
                          />
                          <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-slate-900 ${
                            student.status === 'Present' ? 'bg-green-500' : 
                            student.status === 'Late' ? 'bg-yellow-500' : 'bg-red-500'
                          }`}></div>
                        </div>
                        <div className="flex-1 ml-4">
                          <p className="font-medium text-white group-hover:text-blue-300 transition-colors">{student.name}</p>
                          <p className="text-sm text-slate-400">{student.time}</p>
                        </div>
                        <Badge 
                          variant="outline"
                          className={`${
                            student.status === 'Present' 
                              ? 'bg-green-500/20 text-green-300 border-green-400/30' 
                              : student.status === 'Late'
                              ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30'
                              : 'bg-red-500/20 text-red-300 border-red-400/30'
                          }`}
                        >
                          {student.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-6 flex gap-2">
                  <Link to="/app/attendance" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full border-slate-600 text-slate-300 hover:bg-slate-800">
                      <Eye className="h-4 w-4 mr-2" />
                      View All
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Charts Enhanced */}
          <div className="lg:col-span-2 space-y-6">
            {weeklyLoading ? (
              <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
                <CardContent className="flex justify-center items-center h-80">
                  <div className="text-center">
                    <div className="relative mb-4">
                      <Loader2 className="h-12 w-12 animate-spin text-blue-400 mx-auto" />
                      <div className="absolute inset-0 h-12 w-12 border-4 border-transparent border-r-teal-400 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse' }}></div>
                    </div>
                    <p className="text-slate-400">Loading analytics...</p>
                  </div>
                </CardContent>
              </Card>
            ) : weeklyAttendance.length > 0 ? (
              <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <BarChart3 className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-white">Weekly Attendance Trends</CardTitle>
                        <p className="text-slate-400 text-sm">Student attendance patterns over the current week</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                  </div>
                </CardHeader>
                <AttendanceChart 
                  data={weeklyAttendance}
                  title=""
                  description=""
                  type="bar"
                />
              </Card>
            ) : (
              <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-xl text-white">Weekly Attendance</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center items-center h-60">
                  <div className="text-center text-slate-400">
                    <Calendar className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="font-medium">No attendance data</p>
                    <p className="text-sm">Data will appear once students start marking attendance</p>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {classAttendanceData.length > 0 ? (
                <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                        <PieChart className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-white">Class Distribution</CardTitle>
                        <p className="text-slate-400 text-sm">Today's attendance by class</p>
                      </div>
                    </div>
                  </CardHeader>
                  <AttendanceChart 
                    data={classAttendanceData}
                    title=""
                    description=""
                    type="pie"
                  />
                </Card>
              ) : (
                <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="text-lg text-white">Attendance by Class</CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center items-center h-60">
                    <div className="text-center text-slate-400">
                      <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-30" />
                      <p className="font-medium">No class data</p>
                      <p className="text-sm">Class attendance breakdown will appear here</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Enhanced Quick Actions Card */}
              <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-red-500"></div>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-white" />
                    </div>
                    <CardTitle className="text-lg text-white">Quick Actions</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link to="/app/students">
                    <Button className="w-full justify-between bg-gradient-to-r from-blue-500 to-teal-400 hover:from-blue-600 hover:to-teal-500 text-white group">
                      <div className="flex items-center">
                        <User className="mr-3 h-4 w-4" />
                        Add New Student
                      </div>
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  
                  <Link to="/app/attendance">
                    <Button variant="outline" className="w-full justify-between border-slate-600 text-slate-300 hover:bg-slate-800 group">
                      <div className="flex items-center">
                        <BarChart3 className="mr-3 h-4 w-4" />
                        Attendance Reports
                      </div>
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  
                  <Link to="/app/faculties">
                    <Button variant="outline" className="w-full justify-between border-slate-600 text-slate-300 hover:bg-slate-800 group">
                      <div className="flex items-center">
                        <Shield className="mr-3 h-4 w-4" />
                        Manage Faculties
                      </div>
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-between border-slate-600 text-slate-300 hover:bg-slate-800 group"
                    onClick={() => {
                      toast({
                        title: "Generating Report",
                        description: "Your comprehensive attendance report is being generated and will be emailed to you shortly.",
                      });
                    }}
                  >
                    <div className="flex items-center">
                      <Download className="mr-3 h-4 w-4" />
                      Export Analytics
                    </div>
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* System Status and Additional Features */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Health */}
          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-500"></div>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <CardTitle className="text-lg text-white">System Health</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full animate-pulse ${
                    systemHealth?.services?.face_recognition === 'online' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-white font-medium">Face Recognition API</span>
                </div>
                <Badge className={
                  systemHealth?.services?.face_recognition === 'online' 
                    ? "bg-green-500/20 text-green-300" 
                    : "bg-red-500/20 text-red-300"
                }>
                  {systemHealth?.services?.face_recognition === 'online' ? 'Online' : 'Offline'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full animate-pulse ${
                    systemHealth?.database?.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-white font-medium">Database Connection</span>
                </div>
                <Badge className={
                  systemHealth?.database?.status === 'connected' 
                    ? "bg-green-500/20 text-green-300" 
                    : "bg-red-500/20 text-red-300"
                }>
                  {systemHealth?.database?.status === 'connected' ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full animate-pulse ${
                    systemHealth?.api?.status === 'active' ? 'bg-blue-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-white font-medium">Real-time Sync</span>
                </div>
                <Badge className={
                  systemHealth?.api?.status === 'active' 
                    ? "bg-blue-500/20 text-blue-300" 
                    : "bg-red-500/20 text-red-300"
                }>
                  {systemHealth?.api?.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="pt-3 border-t border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">System Uptime</span>
                  <span className="text-sm text-white font-medium">
                    {systemHealth?.uptime_percentage ? `${systemHealth.uptime_percentage}%` : '99.9%'}
                  </span>
                </div>
                <Progress value={systemHealth?.uptime_percentage || 99.9} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Quick Insights */}
          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                  <Target className="h-4 w-4 text-white" />
                </div>
                <CardTitle className="text-lg text-white">Real-Time Insights</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
                <TrendingUp className="h-5 w-5 text-green-400" />
                <div>
                  <p className="text-white font-medium">System Performance</p>
                  <p className="text-sm text-slate-400">All services running optimally</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
                <Clock className="h-5 w-5 text-blue-400" />
                <div>
                  <p className="text-white font-medium">Real-Time Data</p>
                  <p className="text-sm text-slate-400">Dashboard updates automatically</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
                <AlertCircle className="h-5 w-5 text-amber-400" />
                <div>
                  <p className="text-white font-medium">Faculty Management</p>
                  <p className="text-sm text-slate-400">Now available in admin panel</p>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full mt-4 border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                <Globe className="h-4 w-4 mr-2" />
                View Detailed Analytics
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Real-time System Statistics */}
        <RealTimeStats />
          </TabsContent>

          {/* Live Monitoring Tab */}
          <TabsContent value="live-monitoring">
            <LiveMonitoring />
          </TabsContent>

          {/* Analytics Tab - Enhanced */}
          <TabsContent value="analytics" className="space-y-6">
            <RealAttendanceAnalytics className="mb-6" />
            <RealTimeStats />
          </TabsContent>

          {/* Smart Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <SmartNotificationSystem />
          </TabsContent>

          {/* Enhanced System Monitor Tab */}
          <TabsContent value="system-monitor" className="space-y-6">
            <EnhancedSystemMonitor />
          </TabsContent>

          {/* System Health Tab */}
          <TabsContent value="system-health" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-400" />
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">API Server</span>
                      <Badge className={
                        systemHealth?.api?.status === 'active' 
                          ? "bg-green-500/20 text-green-300" 
                          : "bg-red-500/20 text-red-300"
                      }>
                        {systemHealth?.api?.status === 'active' ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Healthy
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Error
                          </>
                        )}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Database</span>
                      <Badge className={
                        systemHealth?.database?.status === 'connected' 
                          ? "bg-green-500/20 text-green-300" 
                          : "bg-red-500/20 text-red-300"
                      }>
                        {systemHealth?.database?.status === 'connected' ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Connected
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Disconnected
                          </>
                        )}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Face Recognition</span>
                      <Badge className={
                        systemHealth?.services?.face_recognition === 'online' 
                          ? "bg-green-500/20 text-green-300" 
                          : "bg-red-500/20 text-red-300"
                      }>
                        {systemHealth?.services?.face_recognition === 'online' ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-400" />
                    Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-slate-300">Database Load</span>
                        <span className="text-white">
                          {systemHealth?.database?.response_time_ms ? 
                            `${Math.min(Math.round(systemHealth.database.response_time_ms / 10), 100)}%` : 
                            '12%'
                          }
                        </span>
                      </div>
                      <Progress value={
                        systemHealth?.database?.response_time_ms ? 
                          Math.min(Math.round(systemHealth.database.response_time_ms / 10), 100) : 
                          12
                      } className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-slate-300">API Response</span>
                        <span className="text-white">
                          {systemHealth?.api?.avg_response_time_ms ? 
                            `${Math.min(Math.round((100 - systemHealth.api.avg_response_time_ms / 2)), 100)}%` : 
                            '98%'
                          }
                        </span>
                      </div>
                      <Progress value={
                        systemHealth?.api?.avg_response_time_ms ? 
                          Math.min(Math.round((100 - systemHealth.api.avg_response_time_ms / 2)), 100) : 
                          98
                      } className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-slate-300">System Health</span>
                        <span className="text-white">
                          {systemHealth?.uptime_percentage ? `${Math.round(systemHealth.uptime_percentage)}%` : '100%'}
                        </span>
                      </div>
                      <Progress value={systemHealth?.uptime_percentage || 100} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Globe className="h-5 w-5 text-purple-400" />
                    Network
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">API Uptime</span>
                      <span className="text-green-300">
                        {systemHealth?.uptime_percentage ? `${systemHealth.uptime_percentage}%` : '99.9%'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Avg Response</span>
                      <span className="text-blue-300">
                        {systemHealth?.api?.avg_response_time_ms ? `${systemHealth.api.avg_response_time_ms}ms` : '45ms'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Active Sessions</span>
                      <span className="text-white">
                        {systemHealth?.api?.active_sessions || students.length || 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
