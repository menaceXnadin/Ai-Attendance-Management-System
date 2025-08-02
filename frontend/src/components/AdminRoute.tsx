import React from 'react';
import { useAuth } from '@/contexts/useAuth';
import { Navigate } from 'react-router-dom';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Verifying permissions...</p>
        </div>
      </div>
    );
  }

  // Check if user has admin role (you may need to adjust this based on your user structure)
  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    // Redirect non-admin users to their appropriate dashboard
    return <Navigate to="/student" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
