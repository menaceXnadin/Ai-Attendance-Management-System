import React from 'react';
import StudentSidebar from '@/components/StudentSidebar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowDownload16Regular, CalendarLtr20Regular, Trophy20Regular } from '@fluentui/react-icons';
import StudentAttendanceCalendar from '@/pages/StudentAttendanceCalendar';
import EnhancedAttendanceStreak from '@/components/student/EnhancedAttendanceStreak';
import { useAuth } from '@/contexts/useAuth';

const StudentAttendancePage = () => {
  const { user } = useAuth();
  const studentId = user?.id;
  return (
    <StudentSidebar>
      <div className="mx-auto max-w-7xl py-2">
        <div className="page-header">
          <div>
            <h1 className="text-page-title text-text-primary">My Attendance</h1>
            <p className="mt-1 text-body text-text-muted">
              Review your attendance calendar, streaks and badges
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowDownload16Regular aria-hidden />
              Export
            </Button>
          </div>
        </div>

        <Tabs defaultValue="calendar" className="space-y-6">
          <TabsList>
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarLtr20Regular className="shrink-0" aria-hidden />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="streaks" className="gap-2">
              <Trophy20Regular className="shrink-0" aria-hidden />
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
      </div>
    </StudentSidebar>
  );
};

export default StudentAttendancePage;
