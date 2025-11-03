import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import React from 'react'
import { AuthProvider } from './contexts/AuthProvider'
import { ThemeProvider } from './components/ThemeProvider'

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
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
          <h1>Something went wrong.</h1>
          <p>Error: {this.state.error?.message}</p>
          <div style={{ marginTop: '20px' }}>
            <button onClick={() => window.location.reload()} 
                  style={{ padding: '8px 16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Reload Page
            </button>
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
          <ThemeProvider defaultTheme="dark" storageKey="attendai-theme">
            <App />
          </ThemeProvider>
        </AuthProvider>
      </ErrorBoundary>
    );
  }
} catch (error) {
  console.error('Failed to render app:', error);
}
