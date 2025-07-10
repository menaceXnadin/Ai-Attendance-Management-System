
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { useAttendanceData } from '@/hooks/useAttendanceData';
import AttendanceFilters from '@/components/attendance/AttendanceFilters';
import AttendanceTable from '@/components/attendance/AttendanceTable';
import AttendanceSummary from '@/components/attendance/AttendanceSummary';

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
        <h1 className="text-2xl font-bold">Attendance Management</h1>
        <Button variant="outline" className="gap-2">
          <FileText className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Report</CardTitle>
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

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="daily">Daily Report</TabsTrigger>
              <TabsTrigger value="summary">Summary Report</TabsTrigger>
            </TabsList>
            
            <TabsContent value="daily" className="mt-4">
              <AttendanceTable 
                loading={attendanceLoading} 
                records={attendanceRecords} 
              />
            </TabsContent>
            
            <TabsContent value="summary" className="mt-4">
              <AttendanceSummary />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendancePage;
