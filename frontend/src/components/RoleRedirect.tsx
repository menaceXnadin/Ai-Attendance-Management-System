import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { FullPageLoader } from '@/components/layout/FullPageLoader';

/**
 * Component that redirects users based on their role
 * Used at routes like "/" to send users to the appropriate dashboard
 */
const RoleRedirect: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <FullPageLoader
        title="Authenticating Session"
        caption="Directing you to your institutional portal..."
      />
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
