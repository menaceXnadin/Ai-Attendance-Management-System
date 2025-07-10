
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "@/contexts/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleRedirect from "@/components/RoleRedirect";

import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import BlogPage from "./pages/BlogPage";
import LoginPage from "./pages/LoginPage";
import StudentDashboard from "./pages/StudentDashboard";
import DashboardLayout from "./pages/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import StudentsPage from "./pages/StudentsPage";
import AttendancePage from "./pages/AttendancePage";
import ClassesPage from "./pages/ClassesPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/login" element={<LoginPage />} />
            {/* Registration route removed - only admins can register new students */}
            <Route path="/register" element={<Navigate to="/login" replace />} />
            <Route path="/dashboard" element={<RoleRedirect />} />
            
            {/* Student Route - Protected */}
            <Route path="/student" element={
              <ProtectedRoute>
                <StudentDashboard />
              </ProtectedRoute>
            } />
            
            {/* Protected App Routes */}
            <Route path="/app" element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="classes" element={<ClassesPage />} />
              <Route path="settings" element={<SettingsPage />} />
              {/* Additional app routes would go here */}
            </Route>
            
            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
