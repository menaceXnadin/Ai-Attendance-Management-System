{/* Unified Analytics Standalone Demo */}

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import RoleRedirect from "@/components/RoleRedirect";
import ApiErrorBoundary from "@/components/ApiErrorBoundary";
import { useContext } from 'react';
import { AuthContext } from './contexts/AuthContext';

import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import BlogPage from "./pages/BlogPage";
import LoginPage from "./pages/LoginPage";
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

import GlobalAnalyticsDemo from "./pages/UnifiedAnalyticsDemo";
import MergedAnalyticsDemo from "./pages/MergedAnalyticsDemo";

import AnalyticsPage from "./pages/AnalyticsPage";

import AnalyticsShowcase from "./pages/AnalyticsShowcase";
import SystemStatusPage from "./pages/SystemStatusPage";
import AdminNotificationsPage from "./pages/AdminNotificationsPage";

import LiveMonitoringPage from "./pages/LiveMonitoringPage";

import StudentAttendancePage from "./pages/StudentAttendancePage";
import StudentMarkAttendancePage from "./pages/StudentMarkAttendancePage";
import StudentFaceRegistrationPage from "./pages/StudentFaceRegistrationPage";
import MarksPage from "./pages/MarksPage";
import ProfilePage from "./pages/ProfilePage";
import FaceRegistrationDemoPage from "./pages/FaceRegistrationDemoPage";
import AcademicCalendar from "./pages/AcademicCalendar";

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
              {/* Face Integration Test Route - MediaPipe + InsightFace */}
              <Route path="/face-integration-test" element={<FaceIntegrationTest />} />
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
              
              {/* Student Route - Protected */}
              <Route path="/student" element={
                <ProtectedRoute>
                  <ApiErrorBoundary>
                    <StudentDashboard />
                  </ApiErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/student/marks" element={
                <ProtectedRoute>
                  <ApiErrorBoundary>
                    <MarksPage />
                  </ApiErrorBoundary>
                </ProtectedRoute>
              } />
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
                    <AcademicCalendar />
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
                <Route path="calendar" element={<AcademicCalendar />} />
                <Route path="attendance" element={<AttendancePage />} />
                <Route path="faculties" element={<FacultiesPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="notifications" element={<AdminNotificationsPage />} />
                <Route path="monitoring" element={<LiveMonitoringPage />} />
                <Route path="analytics" element={<ApiErrorBoundary><AnalyticsPage /></ApiErrorBoundary>} />
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
