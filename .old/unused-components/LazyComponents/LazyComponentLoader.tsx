/**
 * Lazy Component Loader System
 * 
 * Provides intelligent lazy loading for non-critical UI components to optimize
 * initial page load and reduce bundle size. Includes intersection observer-based
 * loading, error boundaries, and performance monitoring.
 */

import React, { 
  lazy, 
  Suspense, 
  useState, 
  useEffect, 
  useRef, 
  ComponentType, 
  ErrorInfo,
  PropsWithChildren
} from 'react';
import { Skeleton } from '../ui';
import { performanceMonitor } from '../../utils/performanceMonitor';

interface LazyLoadOptions {
  /** Minimum delay before showing component (prevents flash) */
  minDelay?: number;
  /** Intersection observer threshold (0-1) */
  threshold?: number;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Whether to load immediately or wait for viewport */
  loadOnMount?: boolean;
  /** Custom fallback component */
  fallback?: React.ComponentType;
  /** Error fallback component */
  errorFallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  /** Performance tracking name */
  trackingName?: string;
}

interface LazyComponentState {
  isLoading: boolean;
  isLoaded: boolean;
  hasError: boolean;
  error: Error | null;
  isVisible: boolean;
}

/**
 * Default loading skeleton component
 */
const DefaultLoadingSkeleton: React.FC<{ height?: string | number }> = ({ height = '200px' }) => (
  <div className="animate-pulse space-y-4 p-4">
    <Skeleton height="24px" width="60%" />
    <Skeleton height="16px" width="80%" />
    <Skeleton height="16px" width="70%" />
    <div style={{ height }} className="w-full">
      <Skeleton height="100%" width="100%" />
    </div>
  </div>
);

/**
 * Default error boundary component
 */
const DefaultErrorFallback: React.FC<{ error: Error; retry: () => void }> = ({ error, retry }) => (
  <div className="flex flex-col items-center justify-center p-8 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20">
    <div className="text-red-600 mb-4">
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-red-800 mb-2">Component failed to load</h3>
    <p className="text-sm text-red-600 mb-4 text-center max-w-md">
      {error.message || 'An unexpected error occurred while loading this component.'}
    </p>
    <button
      onClick={retry}
      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200"
    >
      Try Again
    </button>
  </div>
);

/**
 * Error boundary wrapper for lazy components
 */
class LazyErrorBoundary extends React.Component<
  PropsWithChildren<{
    fallback: React.ComponentType<{ error: Error; retry: () => void }>;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    trackingName?: string;
  }>,
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Lazy component error:', error, errorInfo);
    
    // Track performance impact of errors
    if (this.props.trackingName) {
      performanceMonitor.captureCurrentMetrics();
    }
    
    this.props.onError?.(error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback;
      return <FallbackComponent error={this.state.error} retry={this.retry} />;
    }

    return this.props.children;
  }
}

/**
 * Hook for managing lazy component loading with intersection observer
 */
export function useLazyLoading(options: LazyLoadOptions = {}) {
  const {
    threshold = 0.1,
    rootMargin = '50px',
    loadOnMount = false,
    minDelay = 100,
    trackingName
  } = options;

  const [state, setState] = useState<LazyComponentState>({
    isLoading: false,
    isLoaded: false,
    hasError: false,
    error: null,
    isVisible: false
  });

  const elementRef = useRef<HTMLElement>(null);
  const loadStartTime = useRef<number>(0);

  useEffect(() => {
    if (loadOnMount) {
      setState(prev => ({ ...prev, isVisible: true }));
      return;
    }

    if (!elementRef.current || typeof IntersectionObserver === 'undefined') {
      setState(prev => ({ ...prev, isVisible: true }));
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !state.isVisible) {
          setState(prev => ({ ...prev, isVisible: true }));
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(elementRef.current);

    return () => observer.disconnect();
  }, [threshold, rootMargin, loadOnMount, state.isVisible]);

  useEffect(() => {
    if (state.isVisible && !state.isLoading && !state.isLoaded) {
      setState(prev => ({ ...prev, isLoading: true }));
      loadStartTime.current = performance.now();

      // Apply minimum delay to prevent loading flicker
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, isLoaded: true, isLoading: false }));
        
        if (trackingName) {
          const loadTime = performance.now() - loadStartTime.current;
          console.log(`[LazyLoad] ${trackingName} loaded in ${loadTime.toFixed(2)}ms`);
        }
      }, minDelay);

      return () => clearTimeout(timer);
    }
  }, [state.isVisible, state.isLoading, state.isLoaded, minDelay, trackingName]);

  const handleError = (error: Error) => {
    setState(prev => ({ ...prev, hasError: true, error, isLoading: false }));
  };

  const retry = () => {
    setState(prev => ({ 
      ...prev, 
      hasError: false, 
      error: null, 
      isLoading: false, 
      isLoaded: false,
      isVisible: true 
    }));
  };

  return {
    elementRef,
    shouldLoad: state.isLoaded,
    isLoading: state.isLoading,
    isVisible: state.isVisible,
    hasError: state.hasError,
    error: state.error,
    handleError,
    retry
  };
}

/**
 * Higher-order component for creating lazy-loaded components
 */
export function withLazyLoading<P extends Record<string, any> = {}>(
  Component: ComponentType<P>,
  options: LazyLoadOptions = {}
) {
  const LazyWrapper: React.FC<P> = (props) => {
    const {
      fallback: CustomFallback = DefaultLoadingSkeleton,
      errorFallback: CustomErrorFallback = DefaultErrorFallback,
      trackingName = Component.displayName || Component.name || 'LazyComponent'
    } = options;

    const {
      elementRef,
      shouldLoad,
      isLoading,
      isVisible,
      hasError,
      error,
      handleError,
      retry
    } = useLazyLoading(options);

    if (hasError && error) {
      return <CustomErrorFallback error={error} retry={retry} />;
    }

    return (
      <div ref={elementRef as any}>
        {shouldLoad ? (
          <LazyErrorBoundary
            fallback={CustomErrorFallback}
            onError={handleError}
            trackingName={trackingName}
          >
            <Component {...(props as any)} />
          </LazyErrorBoundary>
        ) : (
          <CustomFallback />
        )}
      </div>
    );
  };

  LazyWrapper.displayName = `LazyLoaded(${Component.displayName || Component.name})`;
  return LazyWrapper;
}

/**
 * Factory function for creating lazy components with dynamic imports
 */
export function createLazyComponent<P extends Record<string, any> = {}>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: LazyLoadOptions = {}
) {
  const LazyComponent = lazy(importFn);
  
  const {
    fallback: CustomFallback = DefaultLoadingSkeleton,
    errorFallback: CustomErrorFallback = DefaultErrorFallback,
    trackingName = 'DynamicLazyComponent'
  } = options;

  const WrappedComponent: React.FC<P> = (props) => {
    const {
      elementRef,
      shouldLoad,
      isLoading,
      hasError,
      error,
      retry
    } = useLazyLoading(options);

    if (hasError && error) {
      return <CustomErrorFallback error={error} retry={retry} />;
    }

    return (
      <div ref={elementRef as any}>
        {shouldLoad ? (
          <LazyErrorBoundary
            fallback={CustomErrorFallback}
            trackingName={trackingName}
          >
            <Suspense fallback={<CustomFallback />}>
              <LazyComponent {...(props as any)} />
            </Suspense>
          </LazyErrorBoundary>
        ) : (
          <CustomFallback />
        )}
      </div>
    );
  };

  WrappedComponent.displayName = `LazyDynamic(${trackingName})`;
  return WrappedComponent;
}

/**
 * Specific loading skeletons for different component types
 */
export const LoadingSkeletons = {
  EmailCard: () => (
    <div className="animate-pulse p-4 border border-border rounded-lg space-y-3">
      <div className="flex items-center space-x-3">
        <Skeleton height="40px" width="40px" className="rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton height="16px" width="60%" />
          <Skeleton height="14px" width="40%" />
        </div>
        <Skeleton height="20px" width="60px" />
      </div>
      <Skeleton height="14px" width="90%" />
      <Skeleton height="14px" width="75%" />
      <div className="flex justify-between items-center">
        <Skeleton height="12px" width="80px" />
        <Skeleton height="24px" width="80px" />
      </div>
    </div>
  ),

  Chart: ({ height = '300px' }: { height?: string }) => (
    <div className="animate-pulse space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton height="24px" width="150px" />
        <Skeleton height="32px" width="100px" />
      </div>
      <div style={{ height }} className="w-full">
        <Skeleton height="100%" width="100%" />
      </div>
      <div className="flex justify-center space-x-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center space-x-2">
            <Skeleton height="12px" width="12px" className="rounded-full" />
            <Skeleton height="12px" width="60px" />
          </div>
        ))}
      </div>
    </div>
  ),

  Dashboard: () => (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="p-4 border border-border rounded-lg space-y-2">
            <Skeleton height="16px" width="70%" />
            <Skeleton height="32px" width="50%" />
            <Skeleton height="12px" width="80%" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton height="400px" width="100%" />
        <Skeleton height="400px" width="100%" />
      </div>
    </div>
  ),

  Table: ({ rows = 5 }: { rows?: number }) => (
    <div className="animate-pulse space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton height="24px" width="200px" />
        <Skeleton height="36px" width="120px" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex space-x-4">
            <Skeleton height="20px" width="20px" />
            <Skeleton height="20px" width="25%" />
            <Skeleton height="20px" width="20%" />
            <Skeleton height="20px" width="15%" />
            <Skeleton height="20px" width="30%" />
          </div>
        ))}
      </div>
    </div>
  )
};

export default {
  withLazyLoading,
  createLazyComponent,
  useLazyLoading,
  LoadingSkeletons
};