import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft16Regular, Home16Regular } from "@fluentui/react-icons";

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
    <main className="flex min-h-dvh items-center justify-center bg-surface-canvas px-4 py-12">
      <div className="w-full max-w-lg text-center">
        <p
          aria-hidden="true"
          className="select-none text-display tabular-nums text-text-muted sm:text-[64px] sm:leading-[72px]"
        >
          404
        </p>
        <span className="sr-only">404 Error</span>

        <h1 className="mt-2 text-section-title text-text-primary">Page Not Found</h1>
        <p className="mx-auto mt-2 max-w-md text-body text-text-muted">
          The requested destination{' '}
          <code className="break-all rounded-sm border border-border-subtle bg-surface-default px-1.5 py-0.5 font-mono text-caption text-text-secondary">
            {location.pathname}
          </code>{' '}
          does not exist or has been moved.
        </p>

        <div className="mt-8 flex flex-col-reverse justify-center gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="w-full sm:w-auto"
          >
            <ArrowLeft16Regular aria-hidden="true" />
            Go Back
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link to={homePath}>
              <Home16Regular aria-hidden="true" />
              {homeLabel}
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
