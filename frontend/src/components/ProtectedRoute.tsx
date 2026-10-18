import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { FullPageLoader } from '@/components/layout/FullPageLoader';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireStudent?: boolean;
}

type PortalRole = 'admin' | 'teacher' | 'student';

/** Normalise the backend role (`faculty` is the teacher role). */
const portalRole = (role: string | undefined): PortalRole => {
  if (role === 'admin') return 'admin';
  if (role === 'teacher' || role === 'faculty') return 'teacher';
  return 'student';
};

const HOME: Record<PortalRole, string> = {
  admin: '/app',
  teacher: '/teacher',
  student: '/student',
};

/** Which portal a path belongs to (null = any signed-in user). */
const portalForPath = (path: string): PortalRole | null => {
  if (path === '/app' || path.startsWith('/app/')) return 'admin';
  if (path === '/teacher' || path.startsWith('/teacher/')) return 'teacher';
  if (path === '/student' || path.startsWith('/student/') || path === '/face-registration') return 'student';
  return null;
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  requireStudent = false
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <FullPageLoader
        title="Verifying Authorization"
        caption="Checking credential tokens..."
      />
    );
  }

  if (!user) {
    // Redirect to the login page if not authenticated
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Every wrong-portal case sends the user to their own home, so redirects can't loop
  // (e.g. a teacher opening /app used to bounce between /student and /app).
  const role = portalRole(user.role);
  const home = HOME[role];

  if (requireAdmin && role !== 'admin') return <Navigate to={home} replace />;
  if (requireStudent && role !== 'student') return <Navigate to={home} replace />;

  const required = portalForPath(location.pathname);
  if (required && required !== role) return <Navigate to={home} replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
