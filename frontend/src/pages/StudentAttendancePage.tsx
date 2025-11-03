import React from 'react';
import StudentSidebar from '@/components/StudentSidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Calendar as CalendarIcon, Trophy } from 'lucide-react';
import StudentAttendanceCalendar from '@/pages/StudentAttendanceCalendar';
import EnhancedAttendanceStreak from '@/components/student/EnhancedAttendanceStreak';
import { useAuth } from '@/contexts/useAuth';

const StudentAttendancePage = () => {
  const { user } = useAuth();
  const studentId = user?.id;
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
            <Tabs defaultValue="calendar" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 border-slate-700">
                <TabsTrigger value="calendar" className="flex items-center gap-2 data-[state=active]:bg-slate-700">
                  <CalendarIcon className="w-4 h-4" />
                  Calendar
                </TabsTrigger>
                <TabsTrigger value="streaks" className="flex items-center gap-2 data-[state=active]:bg-slate-700">
                  <Trophy className="w-4 h-4" />
                  Streaks & Badges
                </TabsTrigger>
              </TabsList>

              <TabsContent value="calendar" className="space-y-6">
                <StudentAttendanceCalendar 
                  studentId={studentId?.toString()}
                  hideBackButton={true}
                />
              </TabsContent>

              <TabsContent value="streaks" className="space-y-6">
                <EnhancedAttendanceStreak />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </StudentSidebar>
  );
};

export default StudentAttendancePage;
