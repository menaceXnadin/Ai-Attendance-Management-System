import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { WarningAlt, Home, ArrowLeft } from "@carbon/icons-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  const isAdminArea = location.pathname.startsWith('/app');
  const isTeacherArea = location.pathname.startsWith('/teacher');
  const isStudentArea = location.pathname.startsWith('/student');

  let homePath = '/';
  let homeLabel = 'Return to Home';

  if (isAdminArea) {
    homePath = '/app';
    homeLabel = 'Return to Admin Dashboard';
  } else if (isTeacherArea) {
    homePath = '/teacher';
    homeLabel = 'Return to Teacher Dashboard';
  } else if (isStudentArea) {
    homePath = '/student';
    homeLabel = 'Return to Student Dashboard';
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4">
      <div className="max-w-md w-full text-center p-8 bg-surface-default border border-border-subtle rounded-lg shadow-card space-y-6">
        <div className="inline-flex p-3 rounded-full bg-status-warning/10 text-status-warning">
          <WarningAlt className="w-8 h-8" />
        </div>
        
        <div className="space-y-2">
          <span className="text-xs font-mono font-semibold tracking-wider text-text-muted uppercase">404 Error</span>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Page Not Found</h1>
          <p className="text-sm text-text-secondary">
            The requested destination <code className="px-1.5 py-0.5 rounded bg-surface-canvas border border-border-subtle text-xs font-mono">{location.pathname}</code> does not exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link to={homePath}>
            <Button size="sm" className="w-full sm:w-auto">
              <Home className="w-4 h-4 mr-1.5" />
              {homeLabel}
            </Button>
          </Link>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.history.back()}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
