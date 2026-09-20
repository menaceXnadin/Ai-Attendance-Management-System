import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckmarkFilled, Information, Security, WarningAlt, Education } from '@carbon/icons-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AcademicCalendarSettings from './AcademicCalendarSettings';

const SemesterConfigurationPage: React.FC = () => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  const currentYear = currentDate.getFullYear();

  // Determine current semester
  const isCurrentlyFall = currentMonth >= 8; // August or later
  const currentSemester = isCurrentlyFall ? 'Fall' : 'Spring';
  const semesterYear = currentYear;

  // Calculate semester dates
  const fallStart = new Date(semesterYear, 7, 1); // August 1
  const fallEnd = new Date(semesterYear, 11, 15); // December 15
  const springStart = new Date(semesterYear, 0, 15); // January 15
  const springEnd = new Date(semesterYear, 4, 30); // May 30

  const currentStart = isCurrentlyFall ? fallStart : springStart;
  const currentEnd = isCurrentlyFall ? fallEnd : springEnd;

  // Next semester
  const nextSemester = isCurrentlyFall ? 'Spring' : 'Fall';
  const nextYear = isCurrentlyFall ? semesterYear + 1 : semesterYear;
  const nextStart = isCurrentlyFall ? new Date(nextYear, 0, 15) : new Date(nextYear, 7, 1);
  const nextEnd = isCurrentlyFall ? new Date(nextYear, 4, 30) : new Date(nextYear, 11, 15);

  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const progressPercent = Math.min(100, Math.max(0, Math.round(((currentDate.getTime() - currentStart.getTime()) / (currentEnd.getTime() - currentStart.getTime())) * 100)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Academic Period Configuration</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Automatic institutional term detection, timeline status, and emergency calendar adjustments
        </p>
      </div>

      {/* Tabs for Organization */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full sm:w-80 grid-cols-2 p-1 bg-surface-canvas border border-border-subtle rounded-md">
          <TabsTrigger 
            value="overview" 
            className="flex items-center justify-center gap-1.5 text-xs py-1.5 data-[state=active]:bg-surface-default data-[state=active]:text-text-primary data-[state=active]:shadow-xs text-text-muted font-medium transition-all"
          >
            <Calendar className="w-3.5 h-3.5" />
            Term Overview
          </TabsTrigger>
          <TabsTrigger 
            value="emergency" 
            className="flex items-center justify-center gap-1.5 text-xs py-1.5 data-[state=active]:bg-surface-default data-[state=active]:text-text-primary data-[state=active]:shadow-xs text-text-muted font-medium transition-all"
          >
            <Security className="w-3.5 h-3.5" />
            Calendar Controls
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Info Card */}
          <Card className="border border-border-subtle bg-surface-default shadow-card">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3.5">
                <Information className="w-5 h-5 text-action-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-text-primary">Automated Institutional Term Calculation</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    The AttendAI engine identifies active academic semesters (Fall / Spring) automatically based on reference institution dates. Attendance thresholds, timetables, and lecture schedules bind dynamically to the active session.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="success" className="text-xs">
                      <CheckmarkFilled className="w-3.5 h-3.5 mr-1" />
                      Zero Manual Rollover
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <Education className="w-3.5 h-3.5 mr-1" />
                      Semester Auto-Detection
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Semester Card */}
          <Card className="border border-border-subtle bg-surface-default shadow-card">
            <CardHeader className="border-b border-border-subtle pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-status-success"></span>
                  Active Term: {currentSemester} {semesterYear}
                </CardTitle>
                <Badge variant="success" className="text-xs">
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3.5 rounded-md bg-surface-canvas border border-border-subtle">
                  <span className="text-xs text-text-muted block mb-1">Session Span</span>
                  <span className="text-sm font-semibold text-text-primary font-mono">
                    {formatDate(currentStart)} – {formatDate(currentEnd)}
                  </span>
                </div>
                <div className="p-3.5 rounded-md bg-surface-canvas border border-border-subtle">
                  <span className="text-xs text-text-muted block mb-1">Session Progress</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-2 bg-surface-default border border-border-subtle rounded-full overflow-hidden">
                      <div
                        className="h-full bg-action-primary rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-semibold text-text-primary">{progressPercent}%</span>
                  </div>
                </div>
                <div className="p-3.5 rounded-md bg-surface-canvas border border-border-subtle">
                  <span className="text-xs text-text-muted block mb-1">Upcoming Next</span>
                  <span className="text-sm font-semibold text-text-primary">
                    {nextSemester} {nextYear}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule Configuration Overview */}
          <Card className="border border-border-subtle bg-surface-default shadow-card">
            <CardHeader className="border-b border-border-subtle pb-4">
              <CardTitle className="text-base font-semibold text-text-primary">
                Annual Semester Configuration Matrix
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Fall Semester */}
                <div className="p-4 rounded-lg bg-surface-canvas border border-border-subtle space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-status-warning"></span>
                      Fall Term (Term 1)
                    </h3>
                    <Badge variant={isCurrentlyFall ? "success" : "secondary"} className="text-xs">
                      {isCurrentlyFall ? "Active Term" : "Upcoming"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-border-subtle">
                      <span className="text-text-muted">Start Date:</span>
                      <span className="font-mono text-text-primary">August 1</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border-subtle">
                      <span className="text-text-muted">End Date:</span>
                      <span className="font-mono text-text-primary">December 15</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-text-muted">Instructional Duration:</span>
                      <span className="font-medium text-text-primary">~16 Academic Weeks</span>
                    </div>
                  </div>
                </div>

                {/* Spring Semester */}
                <div className="p-4 rounded-lg bg-surface-canvas border border-border-subtle space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-status-success"></span>
                      Spring Term (Term 2)
                    </h3>
                    <Badge variant={!isCurrentlyFall ? "success" : "secondary"} className="text-xs">
                      {!isCurrentlyFall ? "Active Term" : "Upcoming"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-border-subtle">
                      <span className="text-text-muted">Start Date:</span>
                      <span className="font-mono text-text-primary">January 15</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border-subtle">
                      <span className="text-text-muted">End Date:</span>
                      <span className="font-mono text-text-primary">May 30</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-text-muted">Instructional Duration:</span>
                      <span className="font-medium text-text-primary">~16 Academic Weeks</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emergency Override Tab */}
        <TabsContent value="emergency" className="mt-6">
          <AcademicCalendarSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SemesterConfigurationPage;