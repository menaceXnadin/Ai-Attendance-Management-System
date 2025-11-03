import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';

/**
 * Component that redirects users based on their role
 * Used at routes like "/" to send users to the appropriate dashboard
 */
const RoleRedirect: React.FC = () => {
  const { user, loading } = useAuth();

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
          <p className="text-slate-400 text-sm">Redirecting you to the right place</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Not logged in, redirect to login
    return <Navigate to="/login" replace />;
  }

  // Redirect based on user role
  if (user.role === 'admin') {
    return <Navigate to="/app" replace />;
  } else if (user.role === 'teacher' || user.role === 'faculty') {
    return <Navigate to="/teacher" replace />;
  } else {
    // Default to student dashboard for any other role
    return <Navigate to="/student" replace />;
  }
};

export default RoleRedirect;
