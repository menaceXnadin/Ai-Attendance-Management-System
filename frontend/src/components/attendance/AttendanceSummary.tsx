
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AttendanceChart from '@/components/AttendanceChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { api } from '@/integrations/api/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';

interface AttendanceSummaryProps {
  selectedClass?: string;
  startDate?: string;
  endDate?: string;
}

const AttendanceSummary: React.FC<AttendanceSummaryProps> = ({ 
  selectedClass, 
  startDate, 
  endDate 
}) => {
  // Fetch attendance summary data from API
  const { data: summary, isLoading } = useQuery({
    queryKey: ['attendance-summary', selectedClass, startDate, endDate],
    queryFn: async () => {
      const filters = {
        classId: selectedClass,
        startDate,
        endDate
      };
      
      return await api.attendance.getSummary(filters);
    }
  });

  // Generate chart data for weekly attendance patterns
  const { data: attendanceData } = useQuery({
    queryKey: ['attendance-data', selectedClass, startDate, endDate],
    queryFn: async () => {
      const filters = {
        classId: selectedClass,
        startDate,
        endDate
      };
      
      const response = await api.attendance.getAll(filters);
      const records = response?.records ?? [];
      
      // Group records by date
      const recordsByDate = records.reduce((acc, record) => {
        const date = record.date.substring(0, 10); // Get YYYY-MM-DD part
        if (!acc[date]) {
          acc[date] = { present: 0, absent: 0, late: 0 };
        }
        
        if (record.status === 'present') acc[date].present++;
        else if (record.status === 'absent') acc[date].absent++;
        else if (record.status === 'late') acc[date].late++;
        
        return acc;
      }, {});
      
      // Convert to chart data array
      return Object.keys(recordsByDate).map(date => ({
        name: date,
        present: recordsByDate[date].present,
        absent: recordsByDate[date].absent,
        late: recordsByDate[date].late
      }));
    },
    enabled: !isLoading && !!summary // Only run after summary loads
  });

  const statusColor = useMemo(() => {
    if (!summary) return 'text-gray-500';
    const percentage = summary.percentagePresent;
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-amber-500';
    return 'text-red-500';
  }, [summary]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        <span className="ml-2">Loading attendance data...</span>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No attendance data available for the selected criteria.</p>
      </div>
    );
  }

  const totalPresent = summary.present;
  const totalAbsent = summary.absent;
  const totalLate = summary.late;
  const totalExcused = summary.excused;
  const total = summary.total;
  const percentagePresent = summary.percentagePresent;

  // Calculate percentages for the visualization
  const absentPercentage = (totalAbsent / total) * 100;
  const latePercentage = (totalLate / total) * 100;
  const excusedPercentage = (totalExcused / total) * 100;

  // Prepare chart data for the pie chart
  const pieChartData = [
    { name: "Present", present: totalPresent, absent: 0, late: 0 },
    { name: "Absent", present: 0, absent: totalAbsent, late: 0 },
    { name: "Late", present: 0, absent: 0, late: totalLate }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Overall Attendance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <div className={`text-5xl font-bold ${statusColor} mb-4`}>
                {percentagePresent.toFixed(1)}%
              </div>
              
              <div className="w-full space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Present ({totalPresent})</span>
                  <span>{percentagePresent.toFixed(1)}%</span>
                </div>
                <Progress value={percentagePresent} className="h-2 bg-gray-200" />
                
                <div className="flex justify-between text-sm">
                  <span>Absent ({totalAbsent})</span>
                  <span>{absentPercentage.toFixed(1)}%</span>
                </div>
                <Progress value={absentPercentage} className="h-2 bg-gray-200" />
                
                <div className="flex justify-between text-sm">
                  <span>Late ({totalLate})</span>
                  <span>{latePercentage.toFixed(1)}%</span>
                </div>
                <Progress value={latePercentage} className="h-2 bg-gray-200" />
                
                {totalExcused > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>Excused ({totalExcused})</span>
                      <span>{excusedPercentage.toFixed(1)}%</span>
                    </div>
                    <Progress value={excusedPercentage} className="h-2 bg-gray-200" />
                  </>
                )}
              </div>
              
              <div className="mt-4 text-sm text-gray-500">
                Total Records: {total}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <AttendanceChart 
          data={pieChartData} 
          title="Attendance Distribution"
          description="Breakdown by attendance status"
          type="pie"
        />
      </div>
      
      {attendanceData && attendanceData.length > 0 && (
        <Tabs defaultValue="bar">
          <TabsList>
            <TabsTrigger value="bar">Bar Chart</TabsTrigger>
            <TabsTrigger value="line">Line Chart</TabsTrigger>
          </TabsList>
          
          <TabsContent value="bar">
            <AttendanceChart 
              data={attendanceData} 
              title="Attendance Trends"
              description="Daily attendance breakdown"
              type="bar"
            />
          </TabsContent>
          
          <TabsContent value="line">
            <AttendanceChart 
              data={attendanceData}
              title="Attendance Trends"
              description="Daily attendance patterns"
              type="line"
            />
          </TabsContent>
        </Tabs>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Attendance Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p>
              <strong>Overall Performance: </strong>
              {percentagePresent >= 90
                ? "Excellent attendance record. Keep up the good work!"
                : percentagePresent >= 75
                ? "Good attendance, but there's room for improvement."
                : "Attendance needs significant improvement."}
            </p>
            
            {totalLate > 0 && (
              <p>
                <strong>Punctuality: </strong>
                {((totalLate / total) * 100) > 10
                  ? "Punctuality is a concern. Consider addressing late arrivals."
                  : "Occasional tardiness, but generally punctual."}
              </p>
            )}
            
            {totalAbsent > 0 && (
              <p>
                <strong>Absences: </strong>
                {((totalAbsent / total) * 100) > 20
                  ? "High absence rate. Follow-up may be required."
                  : "Acceptable number of absences."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceSummary;
