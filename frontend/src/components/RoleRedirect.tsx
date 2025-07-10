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
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    // Not logged in, redirect to login
    return <Navigate to="/login" replace />;
  }

  // Redirect based on user role
  if (user.role === 'admin') {
    return <Navigate to="/app" replace />;
  } else {
    // Default to student dashboard for any other role
    return <Navigate to="/student" replace />;
  }
};

export default RoleRedirect;
