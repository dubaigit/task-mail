import React, { Suspense, lazy } from 'react';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { Skeleton } from '../ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import Button from '../ui/ModernButton';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// Lazy load all dashboard panels with chunk names for better debugging
const TaskKanbanBoard = lazy(() => import('../TaskCentric/TaskKanbanBoard'));

const Analytics = lazy(() => import('../Analytics/Analytics'));

const EmailList = lazy(() => import('../Email/EmailList'));

const ConversationalAIPanel = lazy(() => import('../AIAssistant/ConversationalAIPanel'));

const DraftGenerationInterface = lazy(() => import('../AIAssistant/DraftGenerationInterface'));

const PerformanceAnalytics = lazy(() => import('../Performance/PerformanceAnalytics'));

const EnhancedAIStatus = lazy(() => import('../AI/EnhancedAIStatus'));

const AIUsageMetrics = lazy(() => import('../AI/AIUsageMetrics'));

// Advanced loading skeleton component
const AdvancedSkeleton: React.FC<{ 
  type?: 'grid' | 'list' | 'chart' | 'kanban' | 'email' | 'ai';
  message?: string;
}> = ({ type = 'list', message = "Loading..." }) => {
  const renderSkeletonContent = () => {
    switch (type) {
      case 'grid':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        );
      
      case 'kanban':
        return (
          <div className="flex space-x-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex-1 space-y-4">
                <Skeleton className="h-8 w-24" />
                {Array.from({ length: 3 }).map((_, j) => (
                  <Card key={j}>
                    <CardContent className="p-4 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}
          </div>
        );
      
      case 'chart':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-3 w-20" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          </div>
        );
      
      case 'email':
        return (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center space-x-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        );
      
      case 'ai':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-10 w-24" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      
      default:
        return (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        );
    }
  };

  return (
    <div className="animate-pulse p-6">
      <div className="flex items-center justify-center mb-6">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-primary" />
        <span className="text-muted-foreground font-medium">{message}</span>
      </div>
      {renderSkeletonContent()}
    </div>
  );
};

// Enhanced error boundary for better error handling
const PanelErrorBoundary: React.FC<{
  children: React.ReactNode;
  panelName: string;
  onRetry?: () => void;
}> = ({ children, panelName, onRetry }) => {
  const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
    <Card className="border-red-200 bg-red-50 dark:bg-red-950/10">
      <CardHeader>
        <CardTitle className="flex items-center text-red-600">
          <AlertTriangle className="w-5 h-5 mr-2" />
          {panelName} Error
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-red-700 dark:text-red-300">
          {error.message || 'An unexpected error occurred while loading this panel.'}
        </p>
        <div className="flex space-x-2">
          <Button 
            onClick={resetErrorBoundary} 
             
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-100"
          >
            Retry
          </Button>
          {onRetry && (
            <Button 
              onClick={onRetry} 
               
              variant="secondary"
              className="text-red-600"
            >
              Reset Panel
            </Button>
          )}
        </div>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4">
            <summary className="text-xs cursor-pointer text-red-600 hover:text-red-800">
              Technical Details
            </summary>
            <pre className="mt-2 text-xs bg-red-100 dark:bg-red-950 p-2 rounded overflow-auto max-h-32">
              {error.stack}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );

  return (
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onError={(error: Error) => {
        // Could send to error reporting service here
      }}
      onReset={() => {
        // Clear any cached data or reset state if needed
        onRetry?.();
      }}
    >
      {children}
    </ErrorBoundary>
  );
};

// Lazy-loaded panel wrapper with enhanced loading and error handling
export const LazyPanel: React.FC<{
  component: React.ComponentType<any>;
  props: any;
  panelName: string;
  skeletonType?: 'grid' | 'list' | 'chart' | 'kanban' | 'email' | 'ai';
  loadingMessage?: string;
  onRetry?: () => void;
}> = ({ 
  component: Component, 
  props, 
  panelName, 
  skeletonType = 'list', 
  loadingMessage,
  onRetry 
}) => (
  <PanelErrorBoundary panelName={panelName} onRetry={onRetry}>
    <Suspense 
      fallback={
        <AdvancedSkeleton 
          type={skeletonType} 
          message={loadingMessage || `Loading ${panelName}...`} 
        />
      }
    >
      <Component {...props} />
    </Suspense>
  </PanelErrorBoundary>
);

// Pre-configured lazy panels
export const LazyTaskKanbanBoard: React.FC<any> = (props) => (
  <LazyPanel
    component={TaskKanbanBoard}
    props={props}
    panelName="Kanban Board"
    skeletonType="kanban"
    loadingMessage="Loading Kanban board..."
  />
);

export const LazyAnalytics: React.FC<any> = (props) => (
  <LazyPanel
    component={Analytics}
    props={props}
    panelName="Analytics"
    skeletonType="chart"
    loadingMessage="Loading analytics data..."
  />
);

export const LazyEmailList: React.FC<any> = (props) => (
  <LazyPanel
    component={EmailList}
    props={props}
    panelName="Email List"
    skeletonType="email"
    loadingMessage="Loading emails..."
  />
);

export const LazyConversationalAIPanel: React.FC<any> = (props) => (
  <LazyPanel
    component={ConversationalAIPanel}
    props={props}
    panelName="AI Conversation"
    skeletonType="ai"
    loadingMessage="Initializing AI assistant..."
  />
);

export const LazyDraftGenerationInterface: React.FC<any> = (props) => (
  <LazyPanel
    component={DraftGenerationInterface}
    props={props}
    panelName="Draft Generator"
    skeletonType="ai"
    loadingMessage="Loading draft generation..."
  />
);

export const LazyPerformanceAnalytics: React.FC<any> = (props) => (
  <LazyPanel
    component={PerformanceAnalytics}
    props={props}
    panelName="Performance Analytics"
    skeletonType="chart"
    loadingMessage="Analyzing performance data..."
  />
);

export const LazyEnhancedAIStatus: React.FC<any> = (props) => (
  <LazyPanel
    component={EnhancedAIStatus}
    props={props}
    panelName="AI Status"
    skeletonType="grid"
    loadingMessage="Loading AI status..."
  />
);

export const LazyAIUsageMetrics: React.FC<any> = (props) => (
  <LazyPanel
    component={AIUsageMetrics}
    props={props}
    panelName="AI Usage Metrics"
    skeletonType="chart"
    loadingMessage="Loading usage metrics..."
  />
);

// Bundle size optimization helper
export const bundleOptimization = {
  // Pre-load critical components
  preloadCritical: () => {
    // Preload the most commonly used panels
    import('../TaskCentric/TaskKanbanBoard');
    import('../Analytics/Analytics');
  },

  // Prefetch non-critical components on idle
  prefetchOnIdle: () => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        import('../Email/EmailList');
        import('../AIAssistant/ConversationalAIPanel');
        import('../AIAssistant/DraftGenerationInterface');
        import('../Performance/PerformanceAnalytics');
      });
    }
  },

  // Load components based on user interaction patterns
  smartPreload: (userInteractionHistory: string[]) => {
    const priorityMap = {
      'kanban': () => import('../TaskCentric/TaskKanbanBoard'),
      'analytics': () => import('../Analytics/Analytics'),
      'emails': () => import('../Email/EmailList'),
      'ai': () => Promise.all([
        import('../AIAssistant/ConversationalAIPanel'),
        import('../AIAssistant/DraftGenerationInterface')
      ])
    };

    // Preload based on most frequently used panels
    const frequency = userInteractionHistory.reduce((acc, panel) => {
      acc[panel] = (acc[panel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sortedPanels = Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    sortedPanels.forEach(([panel]) => {
      const loader = priorityMap[panel as keyof typeof priorityMap];
      if (loader) {
        setTimeout(loader, 100); // Small delay to not block initial render
      }
    });
  }
};

export default {
  LazyTaskKanbanBoard,
  LazyAnalytics,
  LazyEmailList,
  LazyConversationalAIPanel,
  LazyDraftGenerationInterface,
  LazyPerformanceAnalytics,
  LazyEnhancedAIStatus,
  LazyAIUsageMetrics,
  LazyPanel,
  bundleOptimization
};
