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
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-border-subtle border-t-action-primary animate-spin" />
          <div className="text-center">
            <h2 className="text-sm font-semibold text-text-primary">Authenticating Session</h2>
            <p className="text-xs text-text-muted mt-1">Directing you to your institutional portal...</p>
          </div>
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
