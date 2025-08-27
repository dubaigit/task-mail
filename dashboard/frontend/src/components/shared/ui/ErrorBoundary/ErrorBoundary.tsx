import React, { Component, ErrorInfo, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

// Error boundary state interface
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

// Error boundary variants
const errorBoundaryVariants = cva(
  'flex flex-col items-center justify-center p-6 rounded-lg border',
  {
    variants: {
      variant: {
        default: 'border-destructive/20 bg-destructive/5 text-destructive',
        minimal: 'border-muted bg-muted/50 text-muted-foreground',
        card: 'border-border bg-card text-card-foreground shadow-sm',
        ghost: 'border-none bg-transparent text-muted-foreground',
      },
      size: {
        sm: 'p-4 text-sm',
        md: 'p-6 text-base',
        lg: 'p-8 text-lg',
      },
      fullHeight: {
        true: 'min-h-screen',
        false: 'min-h-[200px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      fullHeight: false,
    },
  }
);

// Props for the ErrorBoundary component
export interface ErrorBoundaryProps extends VariantProps<typeof errorBoundaryVariants> {
  children: ReactNode;
  fallback?: ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  isolate?: boolean;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  className?: string;
  enableReporting?: boolean;
  showErrorDetails?: boolean;
  maxRetries?: number;
}

// Props for error fallback components
export interface ErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo;
  resetError: () => void;
  retry: () => void;
  retryCount: number;
  maxRetries: number;
  hasReachedMaxRetries: boolean;
  errorId: string;
}

// Main ErrorBoundary class component
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;
  private retryCount: number = 0;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Generate unique error ID
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Call onError callback if provided
    this.props.onError?.(error, errorInfo);

    // Report error if enabled
    if (this.props.enableReporting) {
      this.reportError(error, errorInfo);
    }

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught Error');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Auto-reset on props change if enabled
    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetError();
    }

    // Reset based on resetKeys
    if (hasError && resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (resetKey, index) => prevProps.resetKeys?.[index] !== resetKey
      );
      
      if (hasResetKeyChanged) {
        this.resetError();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  resetError = () => {
    this.retryCount = 0;
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    });
  };

  retry = () => {
    const { maxRetries = 3 } = this.props;
    
    if (this.retryCount < maxRetries) {
      this.retryCount += 1;
      this.resetError();
    }
  };

  reportError = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      // In a real app, send this to your error reporting service
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: this.getUserId(), // Implement based on your auth system
      };

      // Example: Send to your error reporting service
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorReport),
      // });

    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  getUserId = () => {
    // Implement based on your authentication system
    return 'anonymous';
  };

  render() {
    const { hasError, error, errorInfo, errorId } = this.state;
    const {
      children,
      fallback: Fallback,
      variant,
      size,
      fullHeight,
      className,
      maxRetries = 3,
      showErrorDetails = process.env.NODE_ENV === 'development',
    } = this.props;

    if (hasError && error) {
      const hasReachedMaxRetries = this.retryCount >= maxRetries;

      const fallbackProps: ErrorFallbackProps = {
        error,
        errorInfo: errorInfo!,
        resetError: this.resetError,
        retry: this.retry,
        retryCount: this.retryCount,
        maxRetries,
        hasReachedMaxRetries,
        errorId,
      };

      // Use custom fallback component if provided
      if (Fallback) {
        return <Fallback {...fallbackProps} />;
      }

      // Default error fallback UI
      return (
        <div className={cn(
          errorBoundaryVariants({ variant, size, fullHeight }),
          className
        )}>
          <div className="text-center space-y-4 max-w-md">
            {/* Error icon */}
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-destructive"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.464 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            {/* Error message */}
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Something went wrong
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {showErrorDetails ? error.message : 
                 'An unexpected error occurred. Please try again or contact support if the problem persists.'}
              </p>
              {showErrorDetails && (
                <details className="text-left">
                  <summary className="cursor-pointer text-sm font-medium mb-2">
                    Technical Details
                  </summary>
                  <div className="text-xs bg-muted p-3 rounded border space-y-2">
                    <div>
                      <strong>Error ID:</strong> {errorId}
                    </div>
                    <div>
                      <strong>Message:</strong> {error.message}
                    </div>
                    {error.stack && (
                      <div>
                        <strong>Stack Trace:</strong>
                        <pre className="whitespace-pre-wrap mt-1 text-xs">
                          {error.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {!hasReachedMaxRetries && (
                <button
                  onClick={this.retry}
                  className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors"
                >
                  Try Again ({maxRetries - this.retryCount} attempts left)
                </button>
              )}
              <button
                onClick={this.resetError}
                className="px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-md text-sm font-medium transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/90 rounded-md text-sm font-medium transition-colors"
              >
                Refresh Page
              </button>
            </div>

            {/* Additional help */}
            <div className="text-xs text-muted-foreground">
              Error ID: {errorId}
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = 
    `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundaryComponent;
}

// Hook for handling errors in functional components
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error; // This will be caught by the nearest error boundary
    }
  }, [error]);

  return { captureError, resetError };
}

// Pre-built error fallback components

// Minimal error fallback
export const MinimalErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  retry,
  hasReachedMaxRetries,
}) => (
  <div className="flex items-center justify-center p-4 text-center">
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Something went wrong
      </p>
      <div className="flex gap-2 justify-center">
        {!hasReachedMaxRetries && (
          <button
            onClick={retry}
            className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Retry
          </button>
        )}
        <button
          onClick={resetError}
          className="text-xs px-3 py-1 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
        >
          Reset
        </button>
      </div>
    </div>
  </div>
);

// Card error fallback
export const CardErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  retry,
  hasReachedMaxRetries,
  errorId,
}) => (
  <div className="p-6 border border-destructive/20 bg-destructive/5 rounded-lg">
    <div className="flex items-start space-x-3">
      <div className="flex-shrink-0">
        <svg
          className="w-5 h-5 text-destructive"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-medium text-destructive">
          Error Loading Component
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {error.message}
        </p>
        <div className="mt-3 flex space-x-3">
          {!hasReachedMaxRetries && (
            <button
              onClick={retry}
              className="text-sm text-primary hover:text-primary/90 font-medium"
            >
              Try again
            </button>
          )}
          <button
            onClick={resetError}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Error ID: {errorId}
        </p>
      </div>
    </div>
  </div>
);

// Page error fallback
export const PageErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  retry,
  hasReachedMaxRetries,
  errorId,
}) => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center space-y-6 max-w-md px-4">
      <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
        <svg
          className="w-10 h-10 text-destructive"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>
      
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Oops! Something went wrong
        </h1>
        <p className="text-muted-foreground mb-4">
          We encountered an unexpected error. This has been logged and our team has been notified.
        </p>
        <details className="text-left mb-4">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Technical Details
          </summary>
          <div className="mt-2 p-3 bg-muted rounded border text-sm">
            <div className="mb-2">
              <strong>Error:</strong> {error.message}
            </div>
            <div>
              <strong>Error ID:</strong> {errorId}
            </div>
          </div>
        </details>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {!hasReachedMaxRetries && (
          <button
            onClick={retry}
            className="px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        )}
        <button
          onClick={() => window.location.href = '/'}
          className="px-6 py-3 bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-lg font-medium transition-colors"
        >
          Go Home
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 border border-border hover:bg-muted rounded-lg font-medium transition-colors"
        >
          Refresh Page
        </button>
      </div>
    </div>
  </div>
);

// Section error fallback
export const SectionErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  retry,
  hasReachedMaxRetries,
}) => (
  <div className="p-8 border-2 border-dashed border-destructive/20 rounded-lg text-center">
    <div className="space-y-3">
      <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-destructive"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div>
        <h3 className="font-medium text-foreground">
          Failed to load content
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {error.message}
        </p>
      </div>
      <div className="flex justify-center gap-2">
        {!hasReachedMaxRetries && (
          <button
            onClick={retry}
            className="px-3 py-1 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        )}
        <button
          onClick={resetError}
          className="px-3 py-1 bg-secondary text-secondary-foreground text-sm rounded hover:bg-secondary/90 transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  </div>
);

// Type definitions for component type
type ComponentType<P = {}> = React.ComponentType<P>;

export default ErrorBoundary;
