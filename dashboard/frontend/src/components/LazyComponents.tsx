import React, { Suspense } from 'react';

// Loading component for lazy-loaded routes
export const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-900">
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-8">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-white font-medium">Loading...</span>
      </div>
    </div>
    <span className="sr-only">Loading...</span>
  </div>
);

// Enhanced loading fallback with message
const LoadingFallback: React.FC<{ message?: string }> = ({ message = "Loading..." }) => (
  <div className="flex items-center justify-center min-h-screen bg-slate-900">
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-8">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-white font-medium">{message}</span>
      </div>
    </div>
  </div>
);

// Error boundary for lazy components
class LazyErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ComponentType }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback || (() => (
        <div className="flex items-center justify-center min-h-screen bg-slate-900">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center">
            <h2 className="text-white text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-gray-300 mb-4">Please refresh the page to try again</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      ));
      
      return <Fallback />;
    }

    return this.props.children;
  }
}

// HOC for lazy loading with Suspense and error boundary
export const withLazyLoading = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType,
  errorFallback?: React.ComponentType
) => {
  const LazyComponent = React.lazy(() => 
    Promise.resolve({ default: Component })
  );
  
  return (props: P) => (
    <LazyErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback ? React.createElement(fallback) : <LoadingSpinner />}>
        <LazyComponent {...(props as any)} />
      </Suspense>
    </LazyErrorBoundary>
  );
};

// Lazy wrapper component
const LazyWrapper: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorFallback?: React.ComponentType;
}> = ({ children, fallback, errorFallback }) => (
  <LazyErrorBoundary fallback={errorFallback}>
    <Suspense fallback={fallback || <LoadingSpinner />}>
      {children}
    </Suspense>
  </LazyErrorBoundary>
);

// Lazy load components for performance
const EmailTaskDashboard = React.lazy(() => import('./TaskCentric/EmailTaskDashboardRefactored'));
const AnalyticsDashboard = React.lazy(() => import('./Analytics/AnalyticsDashboard'));
const ConversationalAIPanel = React.lazy(() => 
  import('./AIAssistant/ConversationalAIPanel').then(module => ({ 
    default: module.ConversationalAIPanel 
  }))
);

// Exported lazy components
export const LazyEmailTaskDashboard: React.FC = () => (
  <LazyWrapper fallback={<LoadingFallback message="Loading Task Dashboard..." />}>
    <EmailTaskDashboard />
  </LazyWrapper>
);

export const LazyAnalyticsDashboard: React.FC<{ 
  tasks: any[]; 
  syncStatus?: any;
  categoryCounts?: Record<string, number>;
  showDetailed?: boolean 
}> = (props) => (
  <LazyWrapper fallback={<LoadingFallback message="Loading Analytics..." />}>
    <AnalyticsDashboard 
      {...props} 
      syncStatus={props.syncStatus || null}
      categoryCounts={props.categoryCounts || {}}
    />
  </LazyWrapper>
);

// Default async function to avoid inline async in JSX
const defaultRefinementHandler = async () => {
  console.log('Default refinement handler called');
};

export const LazyConversationalAIPanel: React.FC<{
  draft?: any;
  email?: any;
  onRefinementInstruction?: (instruction: string) => Promise<void>;
  isProcessing?: boolean;
  className?: string;
}> = (props) => (
  <LazyWrapper fallback={<LoadingFallback message="Loading AI Panel..." />}>
    <ConversationalAIPanel 
      draft={props.draft || null}
      email={props.email || null}
      onRefinementInstruction={props.onRefinementInstruction || defaultRefinementHandler}
      isProcessing={props.isProcessing}
      className={props.className}
    />
  </LazyWrapper>
);

// Pre-load components for better UX
export const preloadComponents = () => {
  // Pre-load on user interaction or route change
  setTimeout(() => {
    import('./TaskCentric/EmailTaskDashboardRefactored');
    import('./Analytics/AnalyticsDashboard');
  }, 2000);
  
  // Pre-load AI components after main dashboard
  setTimeout(() => {
    import('./AIAssistant/ConversationalAIPanel');
  }, 5000);
};

// Lazy-loaded route components - TODO: Implement these pages
// export const LazyDashboard = React.lazy(() => 
//   import('../pages/Dashboard').then(module => ({ default: module.Dashboard }))
// );

// export const LazyTasks = React.lazy(() => 
//   import('../pages/Tasks').then(module => ({ default: module.Tasks }))
// );

// export const LazySettings = React.lazy(() => 
//   import('../pages/Settings').then(module => ({ default: module.Settings }))
// );

// Lazy-loaded heavy components - TODO: Implement these components
// export const LazyPerformanceMonitor = React.lazy(() => 
//   import('../components/Performance/PerformanceMonitor').then(module => ({ 
//     default: module.PerformanceMonitor 
//   }))
// );

// export const LazyTaskList = React.lazy(() => 
//   import('../components/TaskList').then(module => ({ default: module.TaskList }))
// );

// export const LazyChat = React.lazy(() => 
//   import('../components/Chat/Chat').then(module => ({ default: module.Chat }))
// );