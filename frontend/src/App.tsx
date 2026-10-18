import React, { Suspense, lazy, useContext } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import RoleRedirect from "@/components/RoleRedirect";
import ApiErrorBoundary from "@/components/ApiErrorBoundary";
import { FullPageLoader } from "@/components/layout/FullPageLoader";
import { LoadingState } from "@/components/feedback/LoadingState";
import { AuthContext } from './contexts/AuthContext';

// Eager: the public landing page, login and 404 must render without a loader.
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

// Everything else is code-split per route (React.lazy), so `/` doesn't download the portals.
// Public pages
const AboutPage = lazy(() => import("./pages/AboutPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));

// Standalone demo pages
const AdvancedAnalyticsDemo = lazy(() => import("./pages/AdvancedAnalyticsDemo"));
const AttendanceAnalyticsDemo = lazy(() => import("./pages/AttendanceAnalyticsDemo"));
const GlobalAnalyticsDemo = lazy(() => import("./pages/UnifiedAnalyticsDemo"));
const MergedAnalyticsDemo = lazy(() => import("./pages/MergedAnalyticsDemo"));
const AnalyticsShowcase = lazy(() => import("./pages/AnalyticsShowcase"));
const SystemStatusPage = lazy(() => import("./pages/SystemStatusPage"));

// Admin portal (/app/*)
const DashboardLayout = lazy(() => import("./pages/DashboardLayout"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const StudentsPage = lazy(() => import("./pages/StudentsPage"));
const StudentAttendanceCalendar = lazy(() => import("./pages/StudentAttendanceCalendar"));
const TeachersPage = lazy(() => import("./pages/TeachersPage"));
const AcademicCalendar = lazy(() => import("./pages/AcademicCalendar"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const FacultiesPage = lazy(() => import("./pages/FacultiesPage"));
const ScheduleManagement = lazy(() => import("./components/ScheduleManagement"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AttendanceThresholdSettings = lazy(() => import("./pages/AttendanceThresholdSettings"));
const AdminNotificationsPage = lazy(() => import("./pages/AdminNotificationsPage"));
const LiveMonitoringPage = lazy(() => import("./pages/LiveMonitoringPage"));
const AutoAbsentManagementPage = lazy(() => import("./pages/AutoAbsentManagementPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const SemesterConfigurationPage = lazy(() => import("./pages/SemesterConfigurationPage"));
const AdminGenerateResetLinkPage = lazy(() => import("./pages/AdminGenerateResetLinkPage"));

// Student portal (/student*, /face-registration)
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const StudentAttendancePage = lazy(() => import("./pages/StudentAttendancePage"));
const StudentMarkAttendancePage = lazy(() => import("./pages/StudentMarkAttendancePage"));
const StudentCalendar = lazy(() => import("./pages/StudentCalendar"));
const StudentNotificationsPage = lazy(() => import("./pages/StudentNotificationsPage"));
const StudentFaceRegistrationPage = lazy(() => import("./pages/StudentFaceRegistrationPage"));

// Teacher portal (/teacher*)
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const TeacherSubjectStudents = lazy(() => import("./pages/TeacherSubjectStudents"));
const TeacherSubjectAnalytics = lazy(() => import("./pages/TeacherSubjectAnalytics"));
const TeacherAttendancePage = lazy(() => import("./pages/TeacherAttendancePage"));
const TeacherNotificationsPage = lazy(() => import("./pages/TeacherNotificationsPage"));
const TeacherSchedulePage = lazy(() => import("./pages/TeacherSchedulePage"));
const TeacherProfilePage = lazy(() => import("./pages/TeacherProfilePage"));

/** Route-level fallback while a page chunk loads (same look as the auth guards). */
const routeFallback = <FullPageLoader title="Loading…" />;

/**
 * Admin pages render inside DashboardLayout's <Outlet/>. Suspending here keeps the
 * shell (nav + title bar) on screen and shows the spinner in the content pane only.
 */
const adminPage = (page: React.ReactNode) => (
  <Suspense fallback={<LoadingState variant="spinner" label="Loading…" />}>{page}</Suspense>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on authentication errors
        if (error.message.includes('authenticated') || error.message.includes('401')) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false, // Disable auto-refetch when switching tabs
      refetchOnReconnect: false, // Disable auto-refetch on internet reconnect
    },
  },
});

const App = () => {
  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error('App must be wrapped with AuthProvider');
  }
  const { user } = authContext;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {/* v7_startTransition keeps the current page on screen while a lazy route chunk loads. */}
        <BrowserRouter future={{ v7_startTransition: true }}>
          <ApiErrorBoundary>
            <Suspense fallback={routeFallback}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<HomePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/blog" element={<BlogPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                {/* Attendance Analytics Standalone Demo */}
                <Route path="/attendance-analytics-demo" element={<AttendanceAnalyticsDemo />} />
                {/* Advanced Analytics Standalone Demo */}
                <Route path="/advanced-analytics-demo" element={<AdvancedAnalyticsDemo />} />
                {/* Global Analytics Standalone Demo */}
                <Route path="/global-analytics-demo" element={<GlobalAnalyticsDemo />} />
                {/* Merged Analytics Standalone Demo */}
                <Route path="/merged-analytics-demo" element={<MergedAnalyticsDemo />} />
                {/* Registration route removed - only admins can register new students */}
                <Route path="/register" element={<Navigate to="/login" replace />} />
                <Route path="/dashboard" element={<RoleRedirect />} />

                {/* Student Route - Protected */}
                <Route path="/student" element={
                  <ProtectedRoute>
                    <ApiErrorBoundary>
                      <StudentDashboard />
                    </ApiErrorBoundary>
                  </ProtectedRoute>
                } />
                {/* My Marks route removed */}
                <Route path="/student/profile" element={
                  <ProtectedRoute>
                    <ApiErrorBoundary>
                      <ProfilePage />
                    </ApiErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/student/attendance" element={
                  <ProtectedRoute>
                    <ApiErrorBoundary>
                      <StudentAttendancePage />
                    </ApiErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/student/attendance/mark" element={
                  <ProtectedRoute>
                    <ApiErrorBoundary>
                      <StudentMarkAttendancePage />
                    </ApiErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/student/calendar" element={
                  <ProtectedRoute>
                    <ApiErrorBoundary>
                      <StudentCalendar />
                    </ApiErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/student/notifications" element={
                  <ProtectedRoute>
                    <ApiErrorBoundary>
                      <StudentNotificationsPage />
                    </ApiErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/face-registration" element={
                  <ProtectedRoute>
                    <ApiErrorBoundary>
                      <StudentFaceRegistrationPage />
                    </ApiErrorBoundary>
                  </ProtectedRoute>
                } />
                
                {/* Teacher Routes - Protected */}
                <Route path="/teacher" element={
                  <ProtectedRoute>
                    <ApiErrorBoundary>
                      <TeacherDashboard />
                    </ApiErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/teacher/subjects/:subjectId/students" element={
                  <ProtectedRoute>
                    <ApiErrorBoundary>
                      <TeacherSubjectStudents />
                    </ApiErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/teacher/subjects/:subjectId/analytics" element={
                  <ProtectedRoute>
                    <ApiErrorBoundary>
                      <TeacherSubjectAnalytics />
                    </ApiErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/teacher/attendance" element={
                  <ProtectedRoute>
                    <ApiErrorBoundary>
                      <TeacherAttendancePage />
                    </ApiErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/teacher/notifications" element={
                  <ProtectedRoute>
                    <ApiErrorBoundary>
                      <TeacherNotificationsPage />
                    </ApiErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/teacher/schedule" element={
                  <ProtectedRoute>
                    <ApiErrorBoundary>
                      <TeacherSchedulePage />
                    </ApiErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/teacher/profile" element={
                  <ProtectedRoute>
                    <ApiErrorBoundary>
                      <TeacherProfilePage />
                    </ApiErrorBoundary>
                  </ProtectedRoute>
                } />
                
                {/* Protected Admin Routes */}
                <Route path="/app" element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <ApiErrorBoundary>
                        <DashboardLayout />
                      </ApiErrorBoundary>
                    </AdminRoute>
                  </ProtectedRoute>
                }>
                  <Route index element={adminPage(<Dashboard />)} />
                  <Route path="students" element={adminPage(<StudentsPage />)} />
                  <Route path="students/:studentId/calendar" element={adminPage(<StudentAttendanceCalendar />)} />
                  <Route path="teachers" element={adminPage(<TeachersPage />)} />
                  <Route path="calendar" element={adminPage(<AcademicCalendar embedded />)} />
                  <Route path="attendance" element={adminPage(<AttendancePage />)} />
                  <Route path="faculties" element={adminPage(<FacultiesPage />)} />
                  <Route path="schedules" element={adminPage(<ScheduleManagement />)} />
                  <Route path="settings" element={adminPage(<SettingsPage />)} />
                  <Route path="settings/attendance-thresholds" element={adminPage(<AttendanceThresholdSettings />)} />
                  <Route path="notifications" element={adminPage(<AdminNotificationsPage />)} />
                  <Route path="monitoring" element={adminPage(<LiveMonitoringPage />)} />
                  <Route path="auto-absent" element={adminPage(<AutoAbsentManagementPage />)} />
                  <Route path="analytics" element={adminPage(<ApiErrorBoundary><AnalyticsPage /></ApiErrorBoundary>)} />
                  <Route path="admin/semester-configuration" element={adminPage(<SemesterConfigurationPage />)} />
                  <Route path="tools/reset-link" element={adminPage(<AdminGenerateResetLinkPage />)} />
                </Route>
                
                <Route path="analytics-showcase" element={<AnalyticsShowcase />} />
                <Route path="/status" element={
                  <ProtectedRoute>
                    <SystemStatusPage />
                  </ProtectedRoute>
                } />
                {/* Catch-all route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ApiErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
