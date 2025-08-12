import React, { useState } from 'react';
import StudentSidebar from '@/components/StudentSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Calendar, BarChart3, Trophy } from 'lucide-react';
import StudentAttendanceReport from '@/components/student/StudentAttendanceReport';
import AttendanceCalendar from '@/components/student/AttendanceCalendar';
import AttendanceStreak from '@/components/student/AttendanceStreak';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/integrations/api/client';
import { useAuth } from '@/contexts/useAuth';

const StudentAttendancePage = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { user } = useAuth();
  const studentId = user?.id;

  // Fetch attendance data for all components
  const { data: attendanceData = [] } = useQuery({
    queryKey: ['student-attendance-full', studentId, currentMonth.getFullYear(), currentMonth.getMonth()],
    queryFn: async () => {
      try {
        if (!studentId) return [];
        
        // Get a broader range for streak calculation
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3); // Get last 3 months for better streak data
        
        const filters = {
          studentId: studentId,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        };
        
        const records = await api.attendance.getAll(filters);
        
        // Get subject details for each record
        const subjectIds = [...new Set(records.map(record => record.subjectId))]
          .filter(id => id && !isNaN(parseInt(id)));
        
        if (subjectIds.length === 0) {
          return [];
        }
        
        const subjectPromises = subjectIds.map(id => {
          const numericId = parseInt(id);
          return api.subjects.getById(numericId);
        });
        
        const subjects = await Promise.all(subjectPromises.map(promise => 
          promise.catch(() => null)
        )).then(results => results.filter(subject => subject !== null));
        
        // Create a map of subjectId -> subjectName
        const subjectMap = subjects.reduce((map, subj) => {
          if (subj && subj.id && subj.name) {
            map[subj.id] = subj.name;
          }
          return map;
        }, {} as Record<string, string>);
        
        // Format records with subject names
        return records
          .filter(record => record.subjectId && record.date)
          .map(record => ({
            date: record.date,
            subject: subjectMap[record.subjectId] || `Subject ${record.subjectId}` || 'Unknown Subject',
            status: record.status || 'absent',
            time: new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      } catch (error) {
        console.error('Error fetching student attendance:', error);
        return [];
      }
    },
    enabled: !!studentId
  });

  return (
    <StudentSidebar>
      <div className="px-6 py-6">
        <Card className="bg-slate-900/60 backdrop-blur-md border-slate-700/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">My Attendance</CardTitle>
              <Button variant="outline" className="gap-2 border-slate-600 text-slate-300 hover:bg-slate-800">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 border-slate-700">
                <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-slate-700">
                  <BarChart3 className="w-4 h-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="calendar" className="flex items-center gap-2 data-[state=active]:bg-slate-700">
                  <Calendar className="w-4 h-4" />
                  Calendar
                </TabsTrigger>
                <TabsTrigger value="streaks" className="flex items-center gap-2 data-[state=active]:bg-slate-700">
                  <Trophy className="w-4 h-4" />
                  Streaks & Badges
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <StudentAttendanceReport />
              </TabsContent>

              <TabsContent value="calendar" className="space-y-6">
                <AttendanceCalendar 
                  attendanceData={attendanceData}
                  currentMonth={currentMonth}
                  onMonthChange={setCurrentMonth}
                />
              </TabsContent>

              <TabsContent value="streaks" className="space-y-6">
                <AttendanceStreak attendanceData={attendanceData} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </StudentSidebar>
  );
};

export default StudentAttendancePage;
