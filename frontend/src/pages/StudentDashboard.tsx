
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CalendarIcon, TrendingUp, User, LogOut, Calendar, Download, Target, AlertTriangle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/useAuth';
import StudentAttendanceReport from '@/components/student/StudentAttendanceReport';
import StudentMarksReport from '@/components/student/StudentMarksReport';
import StudentProfile from '@/components/student/StudentProfile';
import FaceRecognition from '@/components/FaceRecognition';

// Import new AI dashboard components
import AttendancePredictionCard from '@/components/dashboard/AttendancePredictionCard';
import SmartAlertsCard from '@/components/dashboard/SmartAlertsCard';
import ClassComparisonCard from '@/components/dashboard/ClassComparisonCard';
import AttendanceCalendar from '@/components/dashboard/AttendanceCalendar';
import PDFExportCard from '@/components/dashboard/PDFExportCard';
import SmartAttendanceReminder from '@/components/dashboard/SmartAttendanceReminder';

const StudentDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showFaceRecognition, setShowFaceRecognition] = useState(false);
  const [hasMarkedAttendanceToday, setHasMarkedAttendanceToday] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [lastAttendance, setLastAttendance] = useState<{
    timestamp: string;
    recognized: boolean;
  } | null>(null);

  // Mock data for AI components
  const mockPrediction = {
    currentPercentage: 92,
    projectedPercentage: 94,
    totalClasses: 20,
    presentDays: 18,
    remainingClasses: 2,
    projectedGrade: 'A',
    recommendation: 'Maintain excellent attendance! You\'re on track for an A grade.',
    confidence: 85,
    daysToImprove: 5,
    impact: '+2%'
  };

  const mockAlerts = [
    {
      id: '1',
      type: 'warning' as const,
      title: 'Low Attendance Alert',
      message: 'Your attendance in Mathematics is below 75%. Consider attending the next 3 classes.',
      priority: 'high' as const,
      timestamp: new Date(),
      actionRequired: true,
      course: 'Mathematics'
    },
    {
      id: '2',
      type: 'info' as const,
      title: 'Upcoming Exam',
      message: 'Physics exam is scheduled for next week. Your current attendance is good.',
      priority: 'medium' as const,
      timestamp: new Date(),
      actionRequired: false,
      course: 'Physics'
    }
  ];

  const mockComparison = {
    studentAttendance: 92,
    classAverageAttendance: 78,
    studentMarks: 85.4,
    classAverageMarks: 76.2,
    performance: 'excellent' as const,
    ranking: 3,
    totalStudents: 45,
    improvementAreas: ['Mathematics', 'Chemistry'],
    strongSubjects: ['Physics', 'English']
  };

  const mockCalendarData = [
    { 
      date: '2024-12-01', 
      status: 'present' as const,
      subjects: [
        { name: 'Mathematics', time: '09:00', status: 'present' as const },
        { name: 'Physics', time: '11:00', status: 'present' as const }
      ]
    },
    { 
      date: '2024-12-02', 
      status: 'absent' as const,
      subjects: [
        { name: 'Chemistry', time: '10:00', status: 'absent' as const }
      ]
    },
    { 
      date: '2024-12-03', 
      status: 'present' as const,
      subjects: [
        { name: 'English', time: '09:00', status: 'present' as const },
        { name: 'Mathematics', time: '14:00', status: 'present' as const }
      ]
    },
    { 
      date: '2024-12-04'
      // No status or subjects - weekend/holiday
    },
    { 
      date: '2024-12-05', 
      status: 'late' as const,
      subjects: [
        { name: 'Physics', time: '09:00', status: 'late' as const }
      ]
    },
  ];

  const mockStudentData = {
    name: user?.name || 'John Doe',
    id: 'STU001',
    class: 'Computer Science - 3rd Year',
    email: user?.email || 'john@example.com'
  };

  const mockAttendanceData = {
    percentage: 92,
    total: 80,
    present: 74,
    absent: 6,
    late: 2
  };

  const mockMarksData = [
    { subject: 'Mathematics', marks: 85, totalMarks: 100, grade: 'A-', percentage: 85 },
    { subject: 'Physics', marks: 92, totalMarks: 100, grade: 'A', percentage: 92 },
    { subject: 'Chemistry', marks: 78, totalMarks: 100, grade: 'B+', percentage: 78 },
    { subject: 'English', marks: 88, totalMarks: 100, grade: 'A-', percentage: 88 }
  ];
  
  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Logged out successfully",
      description: "You have been logged out of your account.",
    });
    navigate("/login");
  };
  
  const handleFaceCapture = (dataUrl: string, recognized: boolean) => {
    setLastAttendance({
      timestamp: new Date().toLocaleString(),
      recognized
    });
    
    if (recognized) {
      setHasMarkedAttendanceToday(true);
      // In a real app, you would send this data to your backend
      toast({
        title: "Attendance Marked",
        description: `Successfully marked attendance at ${new Date().toLocaleTimeString()}`,
      });
    }
    
    // Hide the face recognition component after processing
    setTimeout(() => {
      setShowFaceRecognition(false);
    }, 3000);
  };

  const handleMarkAttendanceFromReminder = () => {
    setShowFaceRecognition(true);
    toast({
      title: "Face Recognition Started",
      description: "Please position your face within the camera frame.",
    });
  };

  const handleDismissReminder = () => {
    // Handle reminder dismissal logic if needed
  };

  const handleMonthChange = (month: number, year: number) => {
    setCurrentMonth(month);
    setCurrentYear(year);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Smart Attendance Reminder */}
      <SmartAttendanceReminder
        hasMarkedAttendanceToday={hasMarkedAttendanceToday}
        onMarkAttendance={handleMarkAttendanceFromReminder}
        onDismiss={handleDismissReminder}
      />

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="h-8 w-8 rounded-full bg-brand-500 flex items-center justify-center">
                <span className="text-white font-bold">A</span>
              </span>
              <span className="ml-2 text-xl font-bold text-brand-600">AttendAI Student</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.name || 'Student'}!</span>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">AI-Powered Student Dashboard</h1>
          <p className="text-gray-600 mt-2">Smart insights, predictions, and tools to optimize your academic performance</p>
        </div>

        {/* AI Dashboard Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-brand-500" />
            Smart AI Features
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <AttendancePredictionCard prediction={mockPrediction} />
            <SmartAlertsCard alerts={mockAlerts} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ClassComparisonCard comparison={mockComparison} />
            <AttendanceCalendar 
              calendarData={mockCalendarData}
              currentMonth={currentMonth}
              currentYear={currentYear}
              onMonthChange={handleMonthChange}
            />
            <PDFExportCard 
              studentData={mockStudentData}
              attendanceData={mockAttendanceData}
              marksData={mockMarksData}
            />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">92%</div>
              <p className="text-xs text-muted-foreground">
                +2% from last month
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Marks</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">85.4</div>
              <p className="text-xs text-muted-foreground">
                +3.2 from last exam
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">6</div>
              <p className="text-xs text-muted-foreground">
                Active courses
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        {/* Mark Attendance Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Mark Today's Attendance</CardTitle>
            <CardDescription>
              Use face recognition to mark your attendance for today's classes
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {showFaceRecognition ? (
              <div className="w-full max-w-lg">
                <FaceRecognition onCapture={handleFaceCapture} />
              </div>
            ) : (
              <div className="space-y-6 text-center">
                {lastAttendance && (
                  <div className={`p-4 rounded-md ${lastAttendance.recognized ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    <h4 className="font-medium">
                      {lastAttendance.recognized 
                        ? "Attendance Successfully Marked!" 
                        : "Face Recognition Failed"}
                    </h4>
                    <p className="text-sm">
                      {lastAttendance.timestamp}
                    </p>
                  </div>
                )}
                
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-400 to-brand-600 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
                  <Button 
                    className="relative bg-brand-500 hover:bg-brand-600 px-10 py-8 text-lg shadow-xl rounded-lg flex items-center gap-3"
                    onClick={() => {
                      setShowFaceRecognition(true);
                      toast({
                        title: "Face Recognition Started",
                        description: "Please position your face within the camera frame.",
                      });
                    }}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className="h-6 w-6"
                    >
                      <path d="M9 4h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"></path>
                      <rect x="9" y="8" width="6" height="4" rx="1"></rect>
                      <circle cx="12" cy="16" r="1"></circle>
                    </svg>
                    Start Face Recognition
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-5">
                  Make sure you're in a well-lit area and your face is clearly visible
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Student Portal Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Student Portal</CardTitle>
            <CardDescription>
              Access your academic information and reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="attendance" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="attendance">Attendance Report</TabsTrigger>
                <TabsTrigger value="marks">Marks & Grades</TabsTrigger>
                <TabsTrigger value="profile">Profile</TabsTrigger>
              </TabsList>
              
              <TabsContent value="attendance" className="mt-6">
                <StudentAttendanceReport />
              </TabsContent>
              
              <TabsContent value="marks" className="mt-6">
                <StudentMarksReport />
              </TabsContent>
              
              <TabsContent value="profile" className="mt-6">
                <StudentProfile />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentDashboard;
