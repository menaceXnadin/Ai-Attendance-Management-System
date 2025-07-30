import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    localStorage.removeItem('authToken');
    navigate('/login');
  };

  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-xl">{getErrorTitle()}</CardTitle>
          <CardDescription className="text-center">
            {getErrorDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col space-y-2">
            {isAuthError ? (
              <Button 
                onClick={handleAuthRedirect}
                className="w-full"
              >
                Go to Login
              </Button>
            ) : (
              <>
                {showRetry && onRetry && (
                  <Button 
                    onClick={onRetry}
                    variant="default"
                    className="w-full"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                )}
                <Button 
                  onClick={() => navigate('/app/dashboard')}
                  variant="outline"
                  className="w-full"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Go to Dashboard
                </Button>
              </>
            )}
          </div>
          
          {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Error Details (Development)
              </summary>
              <pre className="mt-2 overflow-auto rounded-md bg-muted p-2 text-xs">
                {error.stack || error.message}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Simple function component wrapper for easier use
export const ApiErrorBoundary: React.FC<ApiErrorBoundaryProps> = (props) => {
  return <ApiErrorBatcher {...props} />;
};

export default ApiErrorBoundary;
