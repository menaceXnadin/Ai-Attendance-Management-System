import React from 'react';
import { Button } from '@/components/ui/button';
import {
  ArrowClockwise16Regular,
  ErrorCircle24Regular,
  Home16Regular,
  LockClosed24Regular,
  PlugDisconnected24Regular,
} from '@fluentui/react-icons';
import { useNavigate } from 'react-router-dom';
import { clearAuthToken } from '@/lib/authToken';

interface ApiErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showRetry?: boolean;
  onRetry?: () => void;
}

interface ApiErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ApiErrorBatcher extends React.Component<ApiErrorBoundaryProps, ApiErrorBoundaryState> {
  constructor(props: ApiErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ApiErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('API Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <DefaultErrorFallback 
        error={this.state.error} 
        onRetry={() => {
          this.setState({ hasError: false, error: null });
          this.props.onRetry?.();
        }}
        showRetry={this.props.showRetry}
      />;
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error | null;
  onRetry?: () => void;
  showRetry?: boolean;
}

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({ 
  error, 
  onRetry, 
  showRetry = true 
}) => {
  const navigate = useNavigate();

  const isAuthError = error?.message.includes('authenticated') || 
                     error?.message.includes('expired') ||
                     error?.message.includes('401');

  const isNetworkError = error?.message.includes('Failed to fetch') ||
                        error?.message.includes('Cannot connect');

  const getErrorTitle = () => {
    if (isAuthError) return 'Authentication Required';
    if (isNetworkError) return 'Connection Error';
    return 'Something went wrong';
  };

  const getErrorDescription = () => {
    if (isAuthError) return 'Your session has expired. Please log in again.';
    if (isNetworkError) return 'Unable to connect to the server. Please check your connection.';
    return error?.message || 'An unexpected error occurred. Please try again.';
  };

  const handleAuthRedirect = () => {
    clearAuthToken();
    navigate('/login');
  };

  const ErrorIcon = isAuthError ? LockClosed24Regular : isNetworkError ? PlugDisconnected24Regular : ErrorCircle24Regular;

  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <div role="alert" className="w-full max-w-md rounded-lg bg-surface-default p-6 text-center shadow">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-status-error-subtle text-status-error">
          <ErrorIcon className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-subheading text-text-primary">{getErrorTitle()}</h2>
        <p className="mt-1 break-words text-body text-text-muted">
          {getErrorDescription()}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          {isAuthError ? (
            <Button 
              onClick={handleAuthRedirect}
              className="w-full sm:w-auto"
            >
              Go to Login
            </Button>
          ) : (
            <>
              <Button 
                onClick={() => navigate('/app/dashboard')}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Home16Regular aria-hidden="true" />
                Go to Dashboard
              </Button>
              {showRetry && onRetry && (
                <Button 
                  onClick={onRetry}
                  variant="default"
                  className="w-full sm:w-auto"
                >
                  <ArrowClockwise16Regular aria-hidden="true" />
                  Try Again
                </Button>
              )}
            </>
          )}
        </div>
          
        {process.env.NODE_ENV === 'development' && error && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-caption text-text-muted hover:text-text-secondary">
              Error Details (Development)
            </summary>
            <pre className="mt-2 max-h-60 overflow-auto rounded-md border border-border-subtle bg-surface-subtle p-3 font-mono text-caption text-text-secondary">
              {error.stack || error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

// Simple function component wrapper for easier use
export const ApiErrorBoundary: React.FC<ApiErrorBoundaryProps> = (props) => {
  return <ApiErrorBatcher {...props} />;
};

export default ApiErrorBoundary;
