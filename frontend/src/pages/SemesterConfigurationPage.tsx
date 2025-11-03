import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, CheckCircle, Sparkles, Info, Shield, AlertTriangle } from 'lucide-react';
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

  return (
    <div className="p-6 md:p-8">
      <div className="w-full">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
              <Sparkles className="h-10 w-10 text-purple-400" />
              Academic Period Configuration
            </h1>
            <p className="text-gray-400">Manage automatic semester detection and emergency overrides</p>
          </div>
        </div>

        {/* Tabs for Organization */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
            <TabsTrigger 
              value="overview" 
              className="relative data-[state=active]:bg-slate-700 data-[state=active]:text-white rounded-md transition-colors duration-150 overflow-hidden active:transform-none focus:transform-none"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Semester Overview
            </TabsTrigger>
            <TabsTrigger 
              value="emergency" 
              className="relative data-[state=active]:bg-slate-700 data-[state=active]:text-white rounded-md transition-colors duration-150 overflow-hidden active:transform-none focus:transform-none"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Shield className="h-4 w-4 mr-2" />
              Emergency Override
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">{/* Info Card */}
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Info className="h-6 w-6 text-blue-400 mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-blue-300 mb-2">Automatic Semester Detection Active</h3>
                <p className="text-gray-300 mb-3">
                  The system now automatically detects Fall and Spring semesters based on the current date. No manual
                  configuration is required anymore. The system works for all past, present, and future dates.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-green-500 text-green-400">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Zero Configuration
                  </Badge>
                  <Badge variant="outline" className="border-purple-500 text-purple-400">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Automatic Detection
                  </Badge>
                  <Badge variant="outline" className="border-blue-500 text-blue-400">
                    <Calendar className="h-3 w-3 mr-1" />
                    Works Forever
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Semester Card */}
        <Card className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-purple-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <CheckCircle className="h-6 w-6 text-green-400" />
              Active Academic Period (University-Wide)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Period Name</span>
                <span className="text-2xl font-bold text-white">{currentSemester} {semesterYear}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Duration (All Students)</span>
                <span className="text-white font-medium">{formatDate(currentStart)} - {formatDate(currentEnd)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Progress</span>
                <div className="flex items-center gap-2">
                  <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, ((currentDate.getTime() - currentStart.getTime()) / (currentEnd.getTime() - currentStart.getTime())) * 100))}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-400">
                    {Math.min(100, Math.max(0, Math.round(((currentDate.getTime() - currentStart.getTime()) / (currentEnd.getTime() - currentStart.getTime())) * 100)))}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Semester Card */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Calendar className="h-5 w-5 text-blue-400" />
              {nextSemester} {nextYear}
              <Badge variant="outline" className="border-blue-500 text-blue-400">
                Upcoming
              </Badge>
              <Badge
                variant="outline"
                className="ml-auto border-blue-500 text-blue-400"
                title="Period type label used for ordering/debugging. Numeric map: S1=Fall, S2=Spring. Not a student semester."
              >
                Type: {nextSemester}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Start Date</span><span className="text-white">{formatDate(nextStart)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">End Date</span><span className="text-white">{formatDate(nextEnd)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Duration</span><span className="text-white">{Math.ceil((nextEnd.getTime() - nextStart.getTime()) / (1000 * 60 * 60 * 24 * 7))} weeks</span></div>
              <div className="pt-2 border-t border-gray-700">
                <p className="text-gray-400 text-xs">
                  <CheckCircle className="h-3 w-3 inline mr-1" />
                  Applies to all students and faculties during this period.
                  <span
                    className="ml-2 text-slate-500"
                    title="Ref: Sem 1 (Fall), Ref: Sem 2 (Spring) — used for ordering/debugging only; not a student semester."
                  >
                    Ref code is for ordering/debugging only.
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuration Info Card */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Semester Schedule Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Fall Semester */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-5 w-5 text-orange-400" />
                  <h3 className="text-lg font-semibold text-orange-300">Fall Semester</h3>
                  {isCurrentlyFall && (
                    <Badge variant="outline" className="border-green-500 text-green-400">
                      Current
                    </Badge>
                  )}
                  {!isCurrentlyFall && (
                    <Badge variant="outline" className="border-blue-500 text-blue-400">
                      Upcoming
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className="ml-auto border-orange-500 text-orange-400"
                    title="Fall period type. Numeric map: S1=Fall. Used for ordering/debugging; not a student semester."
                  >
                    Type: Fall
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Start Date</span><span className="text-white font-mono">August 1</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">End Date</span><span className="text-white font-mono">December 15</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Typical Duration</span><span className="text-white">~16 weeks</span></div>
                </div>
              </div>

              {/* Spring Semester */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-5 w-5 text-green-400" />
                  <h3 className="text-lg font-semibold text-green-300">Spring Semester</h3>
                  {!isCurrentlyFall && (
                    <Badge variant="outline" className="border-green-500 text-green-400">
                      Current
                    </Badge>
                  )}
                  {isCurrentlyFall && (
                    <Badge variant="outline" className="border-blue-500 text-blue-400">
                      Upcoming
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className="ml-auto border-green-500 text-green-400"
                    title="Spring period type. Numeric map: S2=Spring. Used for ordering/debugging; not a student semester."
                  >
                    Type: Spring
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Start Date</span><span className="text-white font-mono">January 15</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">End Date</span><span className="text-white font-mono">May 30</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Typical Duration</span><span className="text-white">~16 weeks</span></div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-900/50 rounded-lg">
              <p className="text-sm text-gray-400"><strong className="text-white">Note:</strong> These dates are automatically applied to all students and faculty. The system detects the current semester based on today's date and automatically uses the appropriate date ranges for attendance calculation, calendar generation, and analytics.</p>
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
      </div>
    </div>
  );
};

export default SemesterConfigurationPage;