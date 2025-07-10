import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireStudent?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false,
  requireStudent = false
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  if (loading) {
    // You could render a loading spinner here
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    // Redirect to the login page if not authenticated
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Enhanced role-based routing logic
  const isAdmin = user.role === 'admin';
  const isStudent = user.role === 'student';

  // If explicitly requiring admin role and user is not admin
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/student" replace />;
  }

  // If explicitly requiring student role and user is not student
  if (requireStudent && !isStudent) {
    return <Navigate to="/app" replace />;
  }

  // Path-based protection
  if (path.startsWith('/app') && !isAdmin) {
    // If trying to access admin routes but not an admin
    return <Navigate to="/student" replace />;
  }

  if (path.startsWith('/student') && !isStudent) {
    // If trying to access student routes but not a student
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
