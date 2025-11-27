import React, { useContext } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import RoleRedirect from "@/components/RoleRedirect";
import ApiErrorBoundary from "@/components/ApiErrorBoundary";
import { AuthContext } from './contexts/AuthContext';

import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import BlogPage from "./pages/BlogPage";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import StudentDashboard from "./pages/StudentDashboard";
import DashboardLayout from "./pages/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import StudentsPage from "./pages/StudentsPage";
import AttendancePage from "./pages/AttendancePage";
import FacultiesPage from "./pages/FacultiesPage";
import SettingsPage from "./pages/SettingsPage";
import FaceIntegrationTest from "./pages/FaceIntegrationTest";
import AdvancedAnalyticsDemo from "./pages/AdvancedAnalyticsDemo";
import AttendanceAnalyticsDemo from "./pages/AttendanceAnalyticsDemo";
import NotFound from "./pages/NotFound";
import ScheduleManagement from "./components/ScheduleManagement";

import GlobalAnalyticsDemo from "./pages/UnifiedAnalyticsDemo";
import MergedAnalyticsDemo from "./pages/MergedAnalyticsDemo";

import AnalyticsPage from "./pages/AnalyticsPage";
import SemesterConfigurationPage from "./pages/SemesterConfigurationPage";
import AcademicCalendarSettings from "./pages/AcademicCalendarSettings";

import AnalyticsShowcase from "./pages/AnalyticsShowcase";
import SystemStatusPage from "./pages/SystemStatusPage";
import AdminNotificationsPage from "./pages/AdminNotificationsPage";

import LiveMonitoringPage from "./pages/LiveMonitoringPage";

import StudentAttendancePage from "./pages/StudentAttendancePage";
import StudentMarkAttendancePage from "./pages/StudentMarkAttendancePage";
import StudentFaceRegistrationPage from "./pages/StudentFaceRegistrationPage";

import StudentNotificationsPage from "./pages/StudentNotificationsPage";
import ProfilePage from "./pages/ProfilePage";
import FaceRegistrationDemoPage from "./pages/FaceRegistrationDemoPage";
import FaceRegistrationDebugPage from "./pages/FaceRegistrationDebugPage";
import FaceTestingPage from "./components/FaceTestingPage";
import AcademicCalendar from "./pages/AcademicCalendar";
import StudentCalendar from "./pages/StudentCalendar";
import StudentAttendanceCalendar from "./pages/StudentAttendanceCalendar";
import AutoAbsentManagementPage from "./pages/AutoAbsentManagementPage";
import AttendanceThresholdSettings from "./pages/AttendanceThresholdSettings";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherSubjectStudents from "./pages/TeacherSubjectStudents";
import TeacherSubjectAnalytics from "./pages/TeacherSubjectAnalytics";
import TeacherAttendancePage from "./pages/TeacherAttendancePage";
import TeacherNotificationsPage from "./pages/TeacherNotificationsPage";
import TeacherSchedulePage from "./pages/TeacherSchedulePage";
import TeacherProfilePage from "./pages/TeacherProfilePage";
import TeachersPage from "./pages/TeachersPage";
import AdminGenerateResetLinkPage from "./pages/AdminGenerateResetLinkPage";

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
        <BrowserRouter>
          <ApiErrorBoundary>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              {/* Face Integration Test Route - MediaPipe + InsightFace */}
              <Route path="/face-integration-test" element={<FaceIntegrationTest />} />
              {/* Face Testing Page - Simple component testing */}
              <Route path="/face-testing" element={<FaceTestingPage />} />
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
              <Route path="/face-registration-demo" element={<FaceRegistrationDemoPage />} />
              <Route path="/face-registration-debug" element={<FaceRegistrationDebugPage />} />
              
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
                <Route index element={<Dashboard />} />
                <Route path="students" element={<StudentsPage />} />
                <Route path="students/:studentId/calendar" element={<StudentAttendanceCalendar />} />
                <Route path="teachers" element={<TeachersPage />} />
                <Route path="calendar" element={<AcademicCalendar embedded />} />
                <Route path="attendance" element={<AttendancePage />} />
                <Route path="faculties" element={<FacultiesPage />} />
                <Route path="schedules" element={<ScheduleManagement />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="settings/attendance-thresholds" element={<AttendanceThresholdSettings />} />
                <Route path="notifications" element={<AdminNotificationsPage />} />
                <Route path="monitoring" element={<LiveMonitoringPage />} />
                <Route path="auto-absent" element={<AutoAbsentManagementPage />} />
                <Route path="analytics" element={<ApiErrorBoundary><AnalyticsPage /></ApiErrorBoundary>} />
                <Route path="admin/semester-configuration" element={<SemesterConfigurationPage />} />
                <Route path="tools/reset-link" element={<AdminGenerateResetLinkPage />} />
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
          </ApiErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
