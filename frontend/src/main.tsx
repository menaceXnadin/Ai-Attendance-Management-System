import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import React from 'react'
import { AuthProvider } from './contexts/AuthProvider'
import { ThemeProvider } from './components/ThemeProvider'
import { ArrowClockwise16Regular, ErrorCircle24Regular } from '@fluentui/react-icons'

// Create an error boundary component for better error handling
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("React Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface-canvas p-4 text-text-primary">
          <div role="alert" className="w-full max-w-md rounded-lg bg-surface-default p-6 text-center shadow">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-status-error-subtle text-status-error">
              <ErrorCircle24Regular className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="text-subheading text-text-primary">Something went wrong.</h1>
            <p className="mt-1 break-words text-body text-text-muted">Error: {this.state.error?.message}</p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex h-8 items-center justify-center gap-2 rounded-md bg-brand px-3 text-body-strong text-brand-on transition-colors duration-150 hover:bg-brand-hover active:bg-brand-pressed"
              >
                <ArrowClockwise16Regular className="h-4 w-4" aria-hidden="true" />
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Initialize the app
try {
  const rootElement = document.getElementById("root");
  
  if (!rootElement) {
    console.error('Root element not found');
  } else {
    const root = createRoot(rootElement);
    root.render(
      <ErrorBoundary>
        <AuthProvider>
          <ThemeProvider defaultTheme="light" storageKey="attendai-theme">
            <App />
          </ThemeProvider>
        </AuthProvider>
      </ErrorBoundary>
    );
  }
} catch (error) {
  console.error('Failed to render app:', error);
}
