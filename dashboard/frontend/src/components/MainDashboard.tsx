import React, { Suspense, lazy, useState, useCallback, useEffect, useMemo } from 'react';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
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
  AlertTriangle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTaskStore } from '../stores/taskStore';
import { useEmailStore, Email } from '../stores/emailStore';
import { useAIStore } from '../stores/aiStore';
import { Task, TaskStatus, TaskPriority } from '../types';
import { 
  usePerformanceOptimization, 
  optimizeComponent, 
  performanceMeasurement 
} from '../hooks/usePerformanceOptimization';
import { 
  LazyTaskKanbanBoard,
  LazyAnalytics,
  LazyEmailList,
  LazyConversationalAIPanel,
  LazyDraftGenerationInterface,
  LazyPerformanceAnalytics,
  bundleOptimization
} from './MainDashboard/LazyLoadedPanels';
import OptimizedTaskList from './MainDashboard/OptimizedTaskList';

// Loading component for Suspense fallbacks
const LoadingFallback = ({ message = "Loading..." }: { message?: string }) => (
  <div className="flex flex-col space-y-4 p-6">
    <Skeleton className="h-8 w-1/3" />
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
    </div>
    <div className="flex items-center justify-center py-8">
      <RefreshCw className="w-6 h-6 animate-spin mr-2" />
      <span className="text-muted-foreground">{message}</span>
    </div>
  </div>
);

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => (
  <Card className="border-red-200 bg-red-50">
    <CardHeader>
      <CardTitle className="flex items-center text-red-600">
        <AlertTriangle className="w-5 h-5 mr-2" />
        Something went wrong
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-red-700 mb-4">{error.message}</p>
      <Button onClick={resetErrorBoundary}  variant="outline">
        Try again
      </Button>
    </CardContent>
  </Card>
);

// Performance metrics interface
interface PerformanceMetrics {
  tasksCompleted: number;
  emailsProcessed: number;
  aiInteractions: number;
  productivity: number;
  responseTime: number;
}

// Main dashboard interface
interface DashboardView {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType<any>;
  badge?: number;
}

export const MainDashboard: React.FC = optimizeComponent.memo(() => {
  // Performance optimization hooks
  const { 
    useDebouncedSearch, 
    useMemoryMonitoring, 
    trackBundleSize 
  } = usePerformanceOptimization();
  
  // Performance measurement
  const renderTimer = performanceMeasurement.measureRenderTime('MainDashboard');

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
  const completedTasks = tasks.filter(t => t.status === "COMPLETED" || t.status === "DONE");
  const metrics = getProductivityMetrics();
  const overdueTasks = metrics.overdueTasks;
  
  const { 
    emails, 
    loading: emailsLoading,
    fetchEmails
  } = useEmailStore();
  
  const unreadCount = emails.filter(e => !e.isRead).length;
  
  const { 
    drafts, 
    isGenerating, 
    currentDraft
  } = useAIStore();

  // Local state
  const [activeView, setActiveView] = useState<string>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userInteractionHistory, setUserInteractionHistory] = useState<string[]>([]);

  // Memory monitoring
  const memoryUsage = useMemoryMonitoring();

  // Performance metrics calculation
  const performanceMetrics = useMemo<PerformanceMetrics>(() => {
    return {
      tasksCompleted: completedTasks.length,
      emailsProcessed: emails.filter(email => email.tags?.includes('processed')).length,
      aiInteractions: drafts.length,
      productivity: Math.round((completedTasks.length / Math.max(tasks.length, 1)) * 100),
      responseTime: 0 // Placeholder
    };
  }, [tasks, completedTasks, emails, drafts]);

  // Task statistics
  const taskStats = useMemo(() => ({
    total: tasks.length,
    completed: completedTasks.length,
    pending: tasks.filter(t => t.status === "TODO").length,
    inProgress: tasks.filter(t => t.status === "IN_PROGRESS").length,
    overdue: overdueTasks
  }), [tasks, completedTasks, overdueTasks]);

  // Optimized search with debouncing
  const debouncedSearch = useDebouncedSearch(useCallback((query: string) => {
    setSearchQuery(query);
  }, []), 300);

  // Filtered tasks based on search and filter
  const filteredTasks = useMemo(() => {
    let result = tasks;
    
    if (searchQuery) {
      result = searchTasks(searchQuery);
    }
    
    if (filterStatus !== 'all') {
      result = getFilteredTasks();
    }
    
    return result;
  }, [tasks, searchQuery, filterStatus, searchTasks, getFilteredTasks]);

  // Stable refresh callback
  const handleRefresh = optimizeComponent.useStableCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchEmails();
      // Add other refresh logic here
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchEmails]);

  // Track view changes for smart preloading
  const handleViewChange = optimizeComponent.useStableCallback((viewId: string) => {
    setActiveView(viewId);
    setUserInteractionHistory(prev => [...prev.slice(-9), viewId]); // Keep last 10 interactions
  }, []);

  // Performance and bundle optimization effects
  useEffect(() => {
    renderTimer.start();
    
    // Preload critical components
    bundleOptimization.preloadCritical();
    
    // Smart preload based on user history
    if (userInteractionHistory.length > 0) {
      bundleOptimization.smartPreload(userInteractionHistory);
    }

    return () => {
      const renderTime = renderTimer.end();
      console.log(`MainDashboard render time: ${renderTime}ms`);
    };
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    const interval = setInterval(handleRefresh, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, [handleRefresh]);

  // Prefetch non-critical components on idle
  useEffect(() => {
    bundleOptimization.prefetchOnIdle();
  }, []);

  // Dashboard views configuration
  const dashboardViews: DashboardView[] = useMemo(() => [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      component: OverviewPanel,
      badge: overdueTasks ? (Array.isArray(overdueTasks) ? overdueTasks.length : 0) : 0
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: CheckSquare,
      component: TasksPanel,
      badge: filteredTasks.length
    },
    {
      id: 'kanban',
      label: 'Kanban',
      icon: Target,
      component: KanbanPanel
    },
    {
      id: 'emails',
      label: 'Emails',
      icon: Mail,
      component: EmailsPanel,
      badge: unreadCount > 0 ? unreadCount : undefined
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      component: AnalyticsPanel
    },
    {
      id: 'ai-assistant',
      label: 'AI Assistant',
      icon: Activity,
      component: AIAssistantPanel,
      badge: isGenerating ? 1 : undefined
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: TrendingUp,
      component: PerformancePanel
    }
  ], [overdueTasks, filteredTasks.length, unreadCount, isGenerating]);
		

  // Quick actions
  const quickActions = [
    {
      label: 'New Task',
      icon: Plus,
      action: () => addTask({
        id: '',
        title: 'New Task',
        description: '',
        status: "TODO",
        priority: "MEDIUM",
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }),
      shortcut: 'Ctrl+N'
    },
    {
      label: 'Refresh',
      icon: RefreshCw,
      action: handleRefresh,
      loading: isRefreshing,
      shortcut: 'Ctrl+R'
    },
    {
      label: 'Search',
      icon: Search,
      action: () => document.getElementById('search-input')?.focus(),
      shortcut: 'Ctrl+K'
    }
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Performance indicator for development */}
      {process.env.NODE_ENV === 'development' && memoryUsage > 0.8 && (
        <div className="fixed top-4 right-4 z-50 bg-yellow-100 border border-yellow-300 rounded-lg p-2 text-xs text-yellow-800">
          Memory usage: {(memoryUsage * 100).toFixed(1)}%
        </div>
      )}
      
      {/* Sidebar */}
      <div className="w-64 border-r bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="p-4 border-b">
          <div className="flex items-center space-x-2">
            <LayoutDashboard className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-semibold">Dashboard</h1>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="p-4 border-b">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-center p-2 rounded bg-primary/10">
              <div className="font-semibold text-primary">{taskStats.total}</div>
              <div className="text-muted-foreground">Tasks</div>
            </div>
            <div className="text-center p-2 rounded bg-green-100 dark:bg-green-900/20">
              <div className="font-semibold text-green-700 dark:text-green-300">{performanceMetrics.productivity}%</div>
              <div className="text-muted-foreground">Complete</div>
            </div>
            <div className="text-center p-2 rounded bg-blue-100 dark:bg-blue-900/20">
              <div className="font-semibold text-blue-700 dark:text-blue-300">{unreadCount}</div>
              <div className="text-muted-foreground">Emails</div>
            </div>
            <div className="text-center p-2 rounded bg-purple-100 dark:bg-purple-900/20">
              <div className="font-semibold text-purple-700 dark:text-purple-300">{performanceMetrics.aiInteractions}</div>
              <div className="text-muted-foreground">AI</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-2">
          {dashboardViews.map((view) => (
            <button
              key={view.id}
              onClick={() => handleViewChange(view.id)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors",
                activeView === view.id 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "hover:bg-muted"
              )}
            >
              <div className="flex items-center space-x-3">
                <view.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{view.label}</span>
              </div>
              {view.badge && (
                <Badge variant={activeView === view.id ? "secondary" : "default"} >
                  {view.badge}
                </Badge>
              )}
            </button>
          ))}
        </nav>

        {/* Quick Actions */}
        <div className="p-4 border-t mt-auto">
          <div className="space-y-2">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                onClick={action.action}
                disabled={action.loading}
                variant="outline"
                
                className="w-full justify-start"
              >
                {action.loading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <action.icon className="w-4 h-4 mr-2" />
                )}
                {action.label}
                <span className="ml-auto text-xs text-muted-foreground">
                  {action.shortcut}
                </span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-semibold capitalize">{activeView.replace('-', ' ')}</h2>
              {(tasksLoading || emailsLoading || isRefreshing) && (
                <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="search-input"
                  type="text"
                  placeholder="Search tasks, emails..."
                  value={searchQuery}
                  onChange={(e) => debouncedSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-80"
                />
              </div>

              {/* Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as TaskStatus | 'all')}
                className="px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="all">All Status</option>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>

              <Button
                onClick={handleRefresh}
                disabled={isRefreshing}
                
                variant="outline"
              >
                <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto bg-muted/20">
          <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
            <Suspense fallback={<LoadingFallback message="Loading dashboard..." />}>
              {(() => {
                const currentView = dashboardViews.find(view => view.id === activeView);
                if (!currentView) return <div>View not found</div>;
                
                const Component = currentView.component;
                return (
                  <Component
                    tasks={filteredTasks}
                    emails={emails}
                    performanceMetrics={performanceMetrics}
                    searchQuery={searchQuery}
                    onTaskUpdate={updateTask}
                    onTaskDelete={deleteTask}
                    onTaskAdd={addTask}
                  />
                );
              })()}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
});

// Panel Components
const OverviewPanel: React.FC<any> = ({ tasks, emails, performanceMetrics }) => (
  <div className="p-6 space-y-6">
    {/* Performance Summary Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center">
            <CheckSquare className="w-4 h-4 mr-2 text-green-600" />
            Tasks Completed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{performanceMetrics.tasksCompleted}</div>
          <p className="text-xs text-muted-foreground">
            {performanceMetrics.productivity}% completion rate
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center">
            <Mail className="w-4 h-4 mr-2 text-blue-600" />
            Emails Processed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{performanceMetrics.emailsProcessed}</div>
          <p className="text-xs text-muted-foreground">
            {emails.length} total emails
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center">
            <Activity className="w-4 h-4 mr-2 text-purple-600" />
            AI Interactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">{performanceMetrics.aiInteractions}</div>
          <p className="text-xs text-muted-foreground">
            {performanceMetrics.responseTime}ms avg response
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center">
            <TrendingUp className="w-4 h-4 mr-2 text-orange-600" />
            Productivity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{performanceMetrics.productivity}%</div>
          <p className="text-xs text-muted-foreground">
            Overall efficiency score
          </p>
        </CardContent>
      </Card>
    </div>

    {/* Recent Activity */}
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Clock className="w-5 h-5 mr-2" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tasks.slice(0, 5).map((task: Task) => (
            <div key={task.id} className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
              <div className={cn(
                "w-3 h-3 rounded-full",
                task.status === TaskStatus.COMPLETED ? 'bg-green-500' :
                task.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-gray-400'
              )} />
              <div className="flex-1">
                <p className="text-sm font-medium">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.priority} priority • {new Date(task.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="outline">{task.status}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);


const TasksPanel: React.FC<any> = optimizeComponent.memo(({ tasks, onTaskUpdate, onTaskDelete, onTaskAdd }) => (
  <div className="p-6">
    <OptimizedTaskList 
      tasks={tasks}
      onTaskUpdate={onTaskUpdate}
      onTaskDelete={onTaskDelete}
      height={600}
      itemHeight={120}
    />
  </div>
));

const KanbanPanel: React.FC<any> = optimizeComponent.memo((props) => (
  <LazyTaskKanbanBoard {...props} />
));

const EmailsPanel: React.FC<any> = optimizeComponent.memo((props) => (
  <LazyEmailList {...props} />
));

const AnalyticsPanel: React.FC<any> = optimizeComponent.memo((props) => (
  <LazyAnalytics {...props} />
));

const AIAssistantPanel: React.FC<any> = optimizeComponent.memo((props) => (
  <div className="p-6 space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <LazyConversationalAIPanel {...props} />
      <LazyDraftGenerationInterface {...props} />
    </div>
  </div>
));

const PerformancePanel: React.FC<any> = optimizeComponent.memo((props) => (
  <LazyPerformanceAnalytics {...props} />
));

MainDashboard.displayName = 'MainDashboard';

export default MainDashboard;