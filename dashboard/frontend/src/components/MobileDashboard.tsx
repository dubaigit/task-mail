import { TaskStatus, TaskPriority, TaskCategory } from '../types/core';
import React, { Suspense, lazy, useState, useCallback, useEffect, useMemo } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import Button from './ui/ModernButton';
import { StatusBadge as Badge } from './ui/TaskCard/components/StatusBadge';
import { Skeleton } from './ui/skeleton';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Mail, 
  BarChart3, 
  Settings,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Users,
  Calendar,
  Target,
  TrendingUp,
  Activity,
  Clock,
  Star,
  Archive,
  AlertTriangle,
  Menu,
  X,
  Home,
  MessageSquare,
  Bell,
  User
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTaskStore } from '../stores/taskStore';
import { useEmailStore } from '../stores/emailStore';
import { useAIStore } from '../stores/aiStore';
import { TaskItem, EmailMessage, AIUsageMetrics } from '../types';
import BottomNavigation from './Mobile/BottomNavigation';
import TouchGestures from './Mobile/TouchGestures';
import { 
  usePerformanceOptimization, 
  optimizeComponent, 
  performanceMeasurement 
} from '../hooks/usePerformanceOptimization';

// Lazy load mobile-optimized components
const LazyMobileTaskList = lazy(() => import('./Mobile/MobileTaskInterface'));
const LazyMobileEmailList = lazy(() => import('./Email/ModernEmailInterface'));
const LazyMobileAnalytics = lazy(() => import('./Analytics/Analytics'));
const LazyMobileAIPanel = lazy(() => import('./AIAssistant/ConversationalAIPanel'));

// Mobile loading component
const MobileLoadingFallback = ({ message = "Loading..." }: { message?: string }) => (
  <div className="flex flex-col space-y-4 p-4">
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded w-full"></div>
        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        <div className="h-3 bg-gray-200 rounded w-4/6"></div>
      </div>
    </div>
    <div className="flex items-center justify-center py-8">
      <RefreshCw className="w-5 h-5 animate-spin mr-2 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  </div>
);

// Mobile error fallback
const MobileErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="p-4">
    <Card className="border-red-200 bg-red-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-red-600 text-base">
          <AlertTriangle className="w-4 h-4 mr-2" />
          Oops! Something went wrong
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-red-700 mb-3">{error.message}</p>
        <Button onClick={resetErrorBoundary}  variant="outline">
          Try again
        </Button>
      </CardContent>
    </Card>
  </div>
);

// Mobile performance metrics interface
interface MobilePerformanceMetrics {
  tasksCompleted: number;
  emailsProcessed: number;
  aiInteractions: number;
  productivity: number;
  responseTime: number;
}

// Mobile view configuration
interface MobileView {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType<any>;
  badge?: number;
  pullToRefresh?: boolean;
}

export const MobileDashboard: React.FC = optimizeComponent.memo(() => {
  // Performance optimization hooks
  const { 
    useDebouncedSearch, 
    useMemoryMonitoring, 
    trackBundleSize 
  } = usePerformanceOptimization();
  
  const renderTimer = performanceMeasurement.measureRenderTime('MobileDashboard');

  // Store hooks
  const { 
    tasks, 
    addTask, 
    updateTask, 
    deleteTask,
    getFilteredTasks,
    getTasksByStatus,
    searchTasks,
    getProductivityMetrics,
    loading: tasksLoading 
  } = useTaskStore();
  
  // Derive computed values
  const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED || t.status === 'DONE');
  const metrics = getProductivityMetrics();
  const overdueTasks = metrics.overdueTasks;
  
  const { 
    emails, 
    unreadCount, 
    syncEmails, 
    isLoading: emailsLoading 
  } = useEmailStore();
  
  const { 
    aiMetrics, 
    isGeneratingDraft, 
    conversationHistory,
    usageStats 
  } = useAIStore();

  // Mobile-specific state
  const [activeView, setActiveView] = useState<'overview' | 'tasks' | 'emails' | 'ai' | 'analytics'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Performance metrics calculation
  const performanceMetrics = useMemo<MobilePerformanceMetrics>(() => {
    const todayTasks = tasks.filter(task => {
      const today = new Date().toDateString();
      return new Date(task.updatedAt).toDateString() === today;
    });

    return {
      tasksCompleted: completedTasks.length,
      emailsProcessed: emails.filter(email => email.processed).length,
      aiInteractions: conversationHistory.length,
      productivity: Math.round((completedTasks.length / Math.max(tasks.length, 1)) * 100),
      responseTime: aiMetrics?.averageResponseTime || 0
    };
  }, [tasks, completedTasks, emails, conversationHistory, aiMetrics]);

  // Task statistics
  const taskStats = useMemo(() => ({
    total: tasks.length,
    completed: completedTasks.length,
    pending: tasks.filter(t => t.status === 'TODO').length,
    inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    overdue: overdueTasks
  }), [tasks, completedTasks, overdueTasks]);

  // Optimized search with debouncing
  const debouncedSearch = useDebouncedSearch(useCallback((query: string) => {
    setSearchQuery(query);
  }, []), 300);

  // Filtered tasks for mobile
  const filteredTasks = useMemo(() => {
    if (searchQuery) {
      return searchTasks(searchQuery);
    }
    return tasks.slice(0, 10); // Limit for mobile performance
  }, [tasks, searchQuery, searchTasks]);

  // Pull-to-refresh handler
  const handlePullRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await syncEmails();
      // Add vibration feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 100, 50]);
      }
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [syncEmails]);

  // Swipe navigation handlers
  const handleSwipeLeft = useCallback(() => {
    const views = ['overview', 'tasks', 'emails', 'ai', 'analytics'];
    const currentIndex = views.indexOf(activeView);
    if (currentIndex < views.length - 1) {
      setActiveView(views[currentIndex + 1] as any);
    }
  }, [activeView]);

  const handleSwipeRight = useCallback(() => {
    const views = ['overview', 'tasks', 'emails', 'ai', 'analytics'];
    const currentIndex = views.indexOf(activeView);
    if (currentIndex > 0) {
      setActiveView(views[currentIndex - 1] as any);
    }
  }, [activeView]);

  // Quick action handler
  const handleQuickAction = useCallback(() => {
    switch (activeView) {
      case 'tasks':
        addTask({
          title: 'New Task',
          description: '',
          status: 'todo',
          priority: 'medium',
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        break;
      case 'emails':
        // Handle email composition
        break;
      default:
        setIsSidebarOpen(true);
    }
  }, [activeView, addTask]);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Performance monitoring
  useEffect(() => {
    renderTimer.start();
    
    return () => {
      const renderTime = renderTimer.end();
      // Performance logging removed for production
    };
  }, []);

  // Mobile view configuration
  const mobileViews: Record<string, MobileView> = {
    overview: {
      id: 'overview',
      label: 'Overview',
      icon: Home,
      component: MobileOverviewPanel,
      pullToRefresh: true
    },
    tasks: {
      id: 'tasks',
      label: 'Tasks',
      icon: CheckSquare,
      component: MobileTasksPanel,
              badge: tasks.filter(t => t.status !== TaskStatus.COMPLETED).length,
      pullToRefresh: true
    },
    emails: {
      id: 'emails',
      label: 'Emails',
      icon: Mail,
      component: MobileEmailsPanel,
      badge: unreadCount,
      pullToRefresh: true
    },
    ai: {
      id: 'ai',
      label: 'AI Assistant',
      icon: MessageSquare,
      component: MobileAIPanel,
      badge: isGeneratingDraft ? 1 : undefined
    },
    analytics: {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      component: MobileAnalyticsPanel
    }
  };

  const currentView = mobileViews[activeView];

  return (
    <div className="mobile-dashboard flex flex-col h-screen bg-background overflow-hidden">
      {/* Mobile Header */}
      <header className="mobile-header sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-accent rounded-lg touch-feedback"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="flex items-center space-x-2">
              <currentView.icon className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-semibold">{currentView.label}</h1>
              {currentView.badge && (
                <Badge variant="secondary" className="text-xs">
                  {currentView.badge}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Search Toggle */}
            <button
              onClick={() => setIsSearchVisible(!isSearchVisible)}
              className={cn(
                "p-2 rounded-lg touch-feedback transition-colors",
                isSearchVisible ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              )}
              aria-label="Toggle search"
            >
              <Search className="w-5 h-5" />
            </button>
            
            {/* Loading indicator */}
            {(tasksLoading || emailsLoading || isRefreshing) && (
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Mobile Search Bar */}
        {isSearchVisible && (
          <div className="px-4 pb-3 slide-in-down">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tasks, emails..."
                value={searchQuery}
                onChange={(e) => debouncedSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-muted rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background transition-colors"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    debouncedSearch('');
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 fade-in"
          onClick={() => setIsSidebarOpen(false)}
        >
          <div 
            className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background border-r slide-in-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <LayoutDashboard className="w-6 h-6 text-primary" />
                  <h2 className="text-lg font-semibold">Dashboard</h2>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 hover:bg-accent rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="p-4 border-b">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-center p-3 rounded-lg bg-primary/10">
                  <div className="font-bold text-primary text-lg">{taskStats.total}</div>
                  <div className="text-muted-foreground">Tasks</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-100 dark:bg-green-900/20">
                  <div className="font-bold text-green-700 dark:text-green-300 text-lg">
                    {performanceMetrics.productivity}%
                  </div>
                  <div className="text-muted-foreground">Complete</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                  <div className="font-bold text-blue-700 dark:text-blue-300 text-lg">{unreadCount}</div>
                  <div className="text-muted-foreground">Emails</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                  <div className="font-bold text-purple-700 dark:text-purple-300 text-lg">
                    {performanceMetrics.aiInteractions}
                  </div>
                  <div className="text-muted-foreground">AI</div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-4 space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h3>
              <Button
                onClick={() => {
                  handleQuickAction();
                  setIsSidebarOpen(false);
                }}
                variant="outline"
                
                className="w-full justify-start"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Task
              </Button>
              <Button
                onClick={() => {
                  handlePullRefresh();
                  setIsSidebarOpen(false);
                }}
                variant="outline"
                
                className="w-full justify-start"
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
                Refresh Data
              </Button>
            </div>

            {/* Settings */}
            <div className="absolute bottom-4 left-4 right-4">
              <Button
                variant="secondary"
                
                className="w-full justify-start"
                onClick={() => setIsSidebarOpen(false)}
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content with Touch Gestures */}
      <main className="flex-1 overflow-hidden">
        <TouchGestures
          onSwipeLeft={swipeEnabled ? handleSwipeLeft : undefined}
          onSwipeRight={swipeEnabled ? handleSwipeRight : undefined}
          onPullRefresh={currentView.pullToRefresh ? handlePullRefresh : undefined}
          isRefreshing={isRefreshing}
          className="h-full overflow-y-auto scrollbar-hide"
          leftAction={{
            label: 'Previous',
            color: 'info',
            icon: Clock
          }}
          rightAction={{
            label: 'Next', 
            color: 'success',
            icon: CheckSquare
          }}
        >
          <ErrorBoundary FallbackComponent={MobileErrorFallback} onReset={() => window.location.reload()}>
            <Suspense fallback={<MobileLoadingFallback message={`Loading ${currentView.label.toLowerCase()}...`} />}>
              {(() => {
                const Component = currentView.component;
                return (
                  <div className="min-h-full pb-20">
                    <Component
                      tasks={filteredTasks}
                      emails={emails}
                      performanceMetrics={performanceMetrics}
                      searchQuery={searchQuery}
                      onTaskUpdate={updateTask}
                      onTaskDelete={deleteTask}
                      onTaskAdd={addTask}
                      isOffline={isOffline}
                    />
                  </div>
                );
              })()
            }
            </Suspense>
          </ErrorBoundary>
        </TouchGestures>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation
        currentView={activeView as any}
        onViewChange={(view: any) => {
          setActiveView(view);
          setIsSearchVisible(false);
        }}
        taskCount={tasks.filter(t => t.status !== TaskStatus.COMPLETED).length}
        unreadCount={unreadCount}
        draftCount={0} // Add draft count logic
        onQuickAction={handleQuickAction}
        isOffline={isOffline}
      />

      {/* Offline indicator */}
      {isOffline && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg z-40 fade-in">
          You're offline. Changes will sync when connected.
        </div>
      )}
    </div>
  );
});

// Mobile Panel Components
const MobileOverviewPanel: React.FC<any> = ({ tasks, emails, performanceMetrics, isOffline }) => (
  <div className="p-4 space-y-6">
    {/* Performance Summary Cards */}
    <div className="grid grid-cols-2 gap-3">
      <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {performanceMetrics.tasksCompleted}
              </div>
              <div className="text-xs text-green-700 dark:text-green-300">Tasks Done</div>
            </div>
            <CheckSquare className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {performanceMetrics.emailsProcessed}
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300">Emails</div>
            </div>
            <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {performanceMetrics.aiInteractions}
              </div>
              <div className="text-xs text-purple-700 dark:text-purple-300">AI Chats</div>
            </div>
            <Activity className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {performanceMetrics.productivity}%
              </div>
              <div className="text-xs text-orange-700 dark:text-orange-300">Efficiency</div>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          </div>
        </CardContent>
      </Card>
    </div>

    {/* Recent Activity */}
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center">
          <Clock className="w-4 h-4 mr-2" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tasks.slice(0, 4).map((task: any) => (
            <div key={task.id} className="flex items-center space-x-3 p-2 rounded-lg bg-muted/50">
              <div className={cn(
                "w-2 h-2 rounded-full flex-shrink-0",
                task.status === TaskStatus.COMPLETED ? 'bg-green-500' :
                task.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-400'
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.priority} • {new Date(task.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">{task.status}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

const MobileTasksPanel: React.FC<any> = optimizeComponent.memo((props) => (
  <Suspense fallback={<MobileLoadingFallback />}>
    <LazyMobileTaskList {...props} />
  </Suspense>
));

const MobileEmailsPanel: React.FC<any> = optimizeComponent.memo((props) => (
  <div className="h-full">
    <Suspense fallback={<MobileLoadingFallback />}>
      <LazyMobileEmailList {...props} />
    </Suspense>
  </div>
));

const MobileAIPanel: React.FC<any> = optimizeComponent.memo((props) => (
  <div className="h-full">
    <Suspense fallback={<MobileLoadingFallback />}>
      <LazyMobileAIPanel {...props} />
    </Suspense>
  </div>
));

const MobileAnalyticsPanel: React.FC<any> = optimizeComponent.memo((props) => (
  <div className="h-full">
    <Suspense fallback={<MobileLoadingFallback />}>
      <LazyMobileAnalytics {...props} />
    </Suspense>
  </div>
));

MobileDashboard.displayName = 'MobileDashboard';

export default MobileDashboard;
