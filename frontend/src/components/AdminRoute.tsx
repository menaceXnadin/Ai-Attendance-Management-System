import React from 'react';
import { useAuth } from '@/contexts/useAuth';
import { Navigate } from 'react-router-dom';
import { FullPageLoader } from '@/components/layout/FullPageLoader';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullPageLoader title="Verifying permissions..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    // Send non-admins to their own portal (teachers/faculty → /teacher, students → /student)
    const home = user.role === 'teacher' || user.role === 'faculty' ? '/teacher' : '/student';
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
