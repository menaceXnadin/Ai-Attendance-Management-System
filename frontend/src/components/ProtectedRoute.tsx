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
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-border-subtle border-t-action-primary animate-spin" />
          <div className="text-center">
            <h2 className="text-sm font-semibold text-text-primary">Verifying Authorization</h2>
            <p className="text-xs text-text-muted mt-1">Checking credential tokens...</p>
          </div>
        </div>
      </div>
    );
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
