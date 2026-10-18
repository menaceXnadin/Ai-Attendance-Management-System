import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  ArrowDownload20Regular,
  ClipboardTaskListLtr20Regular,
  CalendarLtr20Regular,
  PersonCircle20Regular,
  LockClosed24Regular,
} from '@fluentui/react-icons';
import { useAttendanceData } from '@/hooks/useAttendanceData';
import AttendanceFilters from '@/components/attendance/AttendanceFilters';
import AttendanceTable from '@/components/attendance/AttendanceTable';
import EnhancedAttendanceManagement from '@/components/attendance/EnhancedAttendanceManagement';
import IndividualStudentAnalysis from '@/components/attendance/IndividualStudentAnalysis';
import TermStateBanner from '@/components/layout/TermStateBanner';
import { clearAuthToken } from '@/lib/authToken';

const AttendancePage = () => {
  const {
    selectedDate,
    setSelectedDate,
    selectedFaculty,
    setSelectedFaculty,
    selectedSemester,
    setSelectedSemester,
    selectedClass,
    setSelectedClass,
    activeTab,
    setActiveTab,
    classes,
    classesLoading,
    classesError,
    faculties,
    facultiesLoading,
    attendanceRecords,
    attendanceLoading,
    attendanceError,
    user,
    authLoading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalRecords
  } = useAttendanceData();

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-brand-subtle border-t-brand"
            aria-hidden
          />
          <p className="text-body text-text-muted">Loading...</p>
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
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="w-full max-w-md rounded-lg bg-surface-default p-8 text-center shadow">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-status-warning-subtle text-status-warning">
            <LockClosed24Regular aria-hidden />
          </div>
          <h3 className="text-section-title text-text-primary">Session Expired</h3>
          <p className="mt-1 mb-5 text-body text-text-muted">
            Your session has expired. Please log in again to continue.
          </p>
          <Button 
            onClick={() => {
              clearAuthToken();
              window.location.href = '/login';
            }}
          >
            Re-login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-page-title text-text-primary">
            Attendance Management
          </h1>
          <p className="mt-1 text-body text-text-muted">
            Comprehensive attendance tracking and management system 
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <ArrowDownload20Regular aria-hidden />
            Export Report
          </Button>
        </div>
      </div>

      <TermStateBanner
        showSetupLink
        className="mb-4"
        context="Registers stay available for correcting past sessions."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="justify-start">
          <TabsTrigger value="admin-workflow" className="gap-2">
            <ClipboardTaskListLtr20Regular className="shrink-0" aria-hidden />
            Mark Attendance
          </TabsTrigger>
          <TabsTrigger value="daily-report" className="gap-2">
            <CalendarLtr20Regular className="shrink-0" aria-hidden />
            Daily Report
          </TabsTrigger>
          <TabsTrigger value="individual-analysis" className="gap-2">
            <PersonCircle20Regular className="shrink-0" aria-hidden />
            Individual Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="admin-workflow" className="mt-0">
          <EnhancedAttendanceManagement />
        </TabsContent>

        <TabsContent value="daily-report" className="mt-0">
          <section className="overflow-hidden rounded-lg bg-surface-default shadow">
            <header className="flex flex-col gap-1 border-b border-border-subtle px-5 py-4">
              <h2 className="text-subheading text-text-primary">Daily Attendance Report</h2>
              <p className="text-caption text-text-muted">
                Filter by faculty, semester, class, date and status to review attendance records.
              </p>
            </header>
            <div className="border-b border-border-subtle px-5 py-4">
              <AttendanceFilters
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                selectedFaculty={selectedFaculty}
                setSelectedFaculty={setSelectedFaculty}
                selectedSemester={selectedSemester}
                setSelectedSemester={setSelectedSemester}
                selectedClass={selectedClass}
                setSelectedClass={setSelectedClass}
                classes={classes}
                classesLoading={classesLoading}
                faculties={faculties}
                facultiesLoading={facultiesLoading}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
              />
            </div>

            <AttendanceTable 
              loading={attendanceLoading} 
              records={attendanceRecords}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              selectedClass={selectedClass}
              classes={classes}
              currentPage={currentPage}
              pageSize={pageSize}
              totalRecords={totalRecords}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </section>
        </TabsContent>

        <TabsContent value="individual-analysis" className="mt-0">
          <IndividualStudentAnalysis />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AttendancePage;
