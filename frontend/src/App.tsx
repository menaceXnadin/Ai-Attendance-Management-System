
              {/* Unified Analytics Standalone Demo */}

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "@/components/ProtectedRoute";
import RoleRedirect from "@/components/RoleRedirect";
import ApiErrorBoundary from "@/components/ApiErrorBoundary";
import { useAuth } from './contexts/useAuth';

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
import FaceDetectionTest from "./pages/FaceDetectionTest";
import FaceRegistrationPage from "./pages/FaceRegistrationPage";
import ModernFaceRegistrationDemo from "./pages/ModernFaceRegistrationDemo";
import AdvancedAnalyticsDemo from "./pages/AdvancedAnalyticsDemo";
import AttendanceAnalyticsDemo from "./pages/AttendanceAnalyticsDemo";
import NotFound from "./pages/NotFound";

import GlobalAnalyticsDemo from "./pages/UnifiedAnalyticsDemo";
import MergedAnalyticsDemo from "./pages/MergedAnalyticsDemo";

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
  const { user } = useAuth();

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
              {/* Face Detection Test Route */}
              <Route path="/face-test" element={<FaceDetectionTest />} />
              {/* Face Registration for Students */}
              <Route path="/face-registration" element={
                <ProtectedRoute>
                  <ApiErrorBoundary>
                    <FaceRegistrationPage />
                  </ApiErrorBoundary>
                </ProtectedRoute>
              } />
              {/* Modern Face Registration Demo - Remove in production */}
              <Route path="/face-demo" element={<ModernFaceRegistrationDemo />} />
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
              
              {/* Protected App Routes */}
              <Route path="/app" element={
                <ProtectedRoute>
                  <ApiErrorBoundary>
                    <DashboardLayout />
                  </ApiErrorBoundary>
                </ProtectedRoute>
              }>
                <Route index element={<Dashboard />} />
                <Route path="students" element={<StudentsPage />} />
                <Route path="attendance" element={<AttendancePage />} />
                <Route path="faculties" element={<FacultiesPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              
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
