import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FileText, Users, UserCheck } from 'lucide-react';
import { useAttendanceData } from '@/hooks/useAttendanceData';
import AttendanceFilters from '@/components/attendance/AttendanceFilters';
import AttendanceTable from '@/components/attendance/AttendanceTable';
import AttendanceSummary from '@/components/attendance/AttendanceSummary';
import EnhancedAttendanceManagement from '@/components/attendance/EnhancedAttendanceManagement';
import IndividualStudentAnalysis from '@/components/attendance/IndividualStudentAnalysis';

const AttendancePage = () => {
  const {
    selectedDate,
    setSelectedDate,
    selectedClass,
    setSelectedClass,
    activeTab,
    setActiveTab,
    classes,
    classesLoading,
    classesError,
    attendanceRecords,
    attendanceLoading,
    attendanceError,
    user,
    authLoading
  } = useAttendanceData();

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  // Only show authentication error if we're sure the user is not authenticated
  // and we've finished loading and have actually tried to make API calls
  const showAuthError = !authLoading && !user && classesError && 
    (classesError.message === 'Not authenticated' || 
     (classesError as { response?: { status?: number } })?.response?.status === 403 || 
     (classesError as { response?: { status?: number } })?.response?.status === 401);

  if (showAuthError) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50 max-w-md">
          <CardContent className="p-8 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-yellow-400" />
            <h3 className="text-xl font-semibold text-white mb-2">Session Expired</h3>
            <p className="text-slate-300 mb-4">
              Your session has expired. Please log in again to continue.
            </p>
            <Button 
              variant="outline" 
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
              onClick={() => {
                localStorage.removeItem('authToken');
                window.location.href = '/login';
              }}
            >
              Re-login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">
            Attendance Management
          </h1>
          <p className="text-blue-200/80 mt-2">
            Comprehensive attendance tracking and management system 
          </p>
        </div>
        <Button variant="outline" className="gap-2 border-slate-600 text-slate-300 hover:bg-slate-800">
          <FileText className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      <Tabs defaultValue="admin-workflow" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-slate-800/50 border border-slate-700/50">
          <TabsTrigger 
            value="admin-workflow"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500"
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Admin Workflow
          </TabsTrigger>
          <TabsTrigger 
            value="daily-report"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500"
          >
            <Users className="h-4 w-4 mr-2" />
            Daily Report
          </TabsTrigger>
          <TabsTrigger 
            value="summary-report"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500"
          >
            <FileText className="h-4 w-4 mr-2" />
            Summary Report
          </TabsTrigger>
          <TabsTrigger 
            value="individual-analysis"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500"
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Individual Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="admin-workflow" className="mt-6">
          <EnhancedAttendanceManagement />
        </TabsContent>

        <TabsContent value="daily-report" className="mt-6">
          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-white">Daily Attendance Report</CardTitle>
            </CardHeader>
            <CardContent>
              <AttendanceFilters
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                selectedClass={selectedClass}
                setSelectedClass={setSelectedClass}
                classes={classes}
                classesLoading={classesLoading}
              />
              
              <div className="mt-4">
                <AttendanceTable 
                  loading={attendanceLoading} 
                  records={attendanceRecords} 
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary-report" className="mt-6">
          <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-white">Attendance Summary Report</CardTitle>
            </CardHeader>
            <CardContent>
              <AttendanceSummary 
                selectedClass={selectedClass}
                // For summary view, let's use the past 30 days as the default range
                startDate={new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]}
                endDate={new Date().toISOString().split('T')[0]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="individual-analysis" className="mt-6">
          <IndividualStudentAnalysis />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AttendancePage;
