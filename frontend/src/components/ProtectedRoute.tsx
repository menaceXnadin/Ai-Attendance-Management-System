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
        <div className="flex flex-col items-center gap-6">
          {/* Animated spinner */}
          <div className="relative">
            <div className="w-20 h-20 border-4 border-slate-700 rounded-full"></div>
            <div className="w-20 h-20 border-4 border-blue-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
            <div className="w-16 h-16 border-4 border-cyan-400 rounded-full border-t-transparent animate-spin absolute top-2 left-2" style={{ animationDirection: 'reverse', animationDuration: '1s' }}></div>
          </div>
          
          {/* Loading text with animation */}
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-2xl font-bold text-white animate-pulse">Loading</h2>
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
          
          {/* Subtext */}
          <p className="text-slate-400 text-sm">Please wait while we prepare your experience</p>
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
