import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Icons } from '../ui/icons';
import { ShieldCheck as ShieldCheckIcon, AlertTriangle as ExclamationTriangleIcon } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class AdminDashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AdminDashboard Error Boundary caught an error:', error, errorInfo);
    
    // Log to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      // Send to error tracking service (Sentry, LogRocket, etc.)
      console.error('Production error in AdminDashboard:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString()
      });
    }

    this.setState({
      error,
      errorInfo
    });
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined 
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="admin-dashboard-error min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-md w-full mx-auto p-6">
            <div className="text-center">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <ExclamationTriangleIcon className="w-10 h-10 text-red-600" />
              </div>
              
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Admin Dashboard Error
              </h1>
              
              <p className="text-muted-foreground mb-6">
                Something went wrong while loading the administrative interface. 
                This error has been logged for review.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mb-6 p-4 bg-secondary/50 rounded-lg text-left">
                  <summary className="cursor-pointer font-medium text-foreground mb-2">
                    Error Details (Development Mode)
                  </summary>
                  <div className="text-sm text-muted-foreground space-y-2">
                    <div>
                      <strong>Error:</strong> {this.state.error.message}
                    </div>
                    <div>
                      <strong>Stack:</strong>
                      <pre className="mt-1 text-xs overflow-auto bg-background p-2 rounded border">
                        {this.state.error.stack}
                      </pre>
                    </div>
                    {this.state.errorInfo && (
                      <div>
                        <strong>Component Stack:</strong>
                        <pre className="mt-1 text-xs overflow-auto bg-background p-2 rounded border">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={this.handleRetry}
                  className="flex items-center justify-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Icons.refresh className="w-4 h-4" />
                  Try Again
                </button>
                
                <button
                  onClick={() => window.location.href = '/'}
                  className="flex items-center justify-center gap-2 px-6 py-2 border border-border rounded-lg hover:bg-secondary transition-colors"
                >
                  <Icons.home className="w-4 h-4" />
                  Return to Dashboard
                </button>
              </div>
              
              <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <ShieldCheckIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <div className="font-medium mb-1">Security Notice</div>
                    <div>
                      For security reasons, detailed error information is only shown in development mode. 
                      If this error persists, please contact your system administrator.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AdminDashboardErrorBoundary;