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
    attendanceRecords,
    attendanceLoading
  } = useAttendanceData();

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
        <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 border border-slate-700/50">
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
      </Tabs>
    </div>
  );
};

export default AttendancePage;
