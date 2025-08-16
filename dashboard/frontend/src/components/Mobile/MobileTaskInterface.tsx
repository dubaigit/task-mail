import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../../App';
import {
  EnvelopeIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  UserIcon,
  ArrowRightIcon,
  EllipsisHorizontalIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import BottomNavigation from './BottomNavigation';
import TouchGestures from './TouchGestures';

interface Task {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delegated';
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'needs_reply' | 'delegate' | 'do_myself' | 'assign' | 'follow_up';
  due_date?: string;
  email_id?: number;
  assignee?: string;
  created_at: string;
  updated_at: string;
  confidence?: number;
}

interface Email {
  id: number;
  subject: string;
  sender: string;
  date: string;
  classification: string;
  urgency: string;
}

interface MobileTaskInterfaceProps {
  tasks: Task[];
  emails: Email[];
  onTaskComplete: (taskId: number) => void;
  onTaskDelegate: (taskId: number, assignee: string) => void;
  onTaskEdit: (task: Task) => void;
  onTaskCreate: (emailId: number) => void;
  onRefresh: () => Promise<void>;
  isOffline?: boolean;
}

type ViewFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'overdue';
type SortOption = 'priority' | 'due_date' | 'created_at' | 'category';

const MobileTaskInterface: React.FC<MobileTaskInterfaceProps> = ({
  tasks,
  emails,
  onTaskComplete,
  onTaskDelegate,
  onTaskEdit,
  onTaskCreate,
  onRefresh,
  isOffline = false
}) => {
  const { isDark } = useTheme();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [swipeActions, setSwipeActions] = useState<{ [key: number]: 'complete' | 'delegate' | null }>({});
  
  const listRef = useRef<HTMLDivElement>(null);
  const pullThreshold = 80;
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  // Priority colors mapping
  const getPriorityColor = (priority: string): string => {
    const colors = {
      critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
      low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  // Category icons mapping
  const getCategoryIcon = (category: string): React.ReactNode => {
    const icons = {
      needs_reply: <EnvelopeIcon className="w-4 h-4" />,
      delegate: <UserIcon className="w-4 h-4" />,
      do_myself: <CheckCircleIcon className="w-4 h-4" />,
      assign: <ArrowRightIcon className="w-4 h-4" />,
      follow_up: <ClockIcon className="w-4 h-4" />
    };
    return icons[category as keyof typeof icons] || <CheckCircleIcon className="w-4 h-4" />;
  };

  // Status colors mapping
  const getStatusColor = (status: string): string => {
    const colors = {
      pending: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      delegated: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
    };
    return colors[status as keyof typeof colors] || colors.pending;
  };

  // Filter tasks based on current filters
  const filteredTasks = tasks.filter(task => {
    // Filter by status
    if (viewFilter !== 'all') {
      if (viewFilter === 'overdue') {
        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
        if (!isOverdue) return false;
      } else if (task.status !== viewFilter) {
        return false;
      }
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = task.title.toLowerCase().includes(query);
      const matchesDescription = task.description.toLowerCase().includes(query);
      const matchesAssignee = task.assignee?.toLowerCase().includes(query);
      if (!matchesTitle && !matchesDescription && !matchesAssignee) {
        return false;
      }
    }

    return true;
  });

  // Sort filtered tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
      case 'due_date':
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      case 'created_at':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'category':
        return a.category.localeCompare(b.category);
      default:
        return 0;
    }
  });

  // Handle pull to refresh
  const handlePullToRefresh = useCallback(async () => {
    if (isOffline || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
      setIsPulling(false);
    }
  }, [onRefresh, isOffline, isRefreshing]);

  // Handle swipe gestures
  const handleSwipeComplete = useCallback((taskId: number) => {
    onTaskComplete(taskId);
    setSwipeActions(prev => ({ ...prev, [taskId]: null }));
  }, [onTaskComplete]);

  const handleSwipeDelegate = useCallback((taskId: number) => {
    // Show delegation options
    setSwipeActions(prev => ({ ...prev, [taskId]: 'delegate' }));
  }, []);

  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Check if task is overdue
  const isTaskOverdue = (task: Task): boolean => {
    return Boolean(task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed');
  };

  return (
    <div className="mobile-task-interface h-full flex flex-col bg-background">
      {/* Mobile Header */}
      <header className="flex-shrink-0 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="mobile-heading text-foreground">Tasks</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="touch-target p-2 rounded-lg bg-secondary text-secondary-foreground"
              aria-label="Toggle filters"
            >
              <FunnelIcon className="w-5 h-5" />
            </button>
            <button
              onClick={handlePullToRefresh}
              disabled={isRefreshing || isOffline}
              className="touch-target p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
              aria-label="Refresh tasks"
            >
              <ArrowRightIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-secondary text-secondary-foreground rounded-lg border-none focus:ring-2 focus:ring-primary mobile-body"
          />
        </div>

        {/* Filter Pills */}
        {showFilters && (
          <div className="mt-3 space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {(['all', 'pending', 'in_progress', 'completed', 'overdue'] as ViewFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setViewFilter(filter)}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    viewFilter === filter
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {filter.replace('_', ' ').charAt(0).toUpperCase() + filter.replace('_', ' ').slice(1)}
                </button>
              ))}
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2">
              {(['priority', 'due_date', 'created_at', 'category'] as SortOption[]).map((sort) => (
                <button
                  key={sort}
                  onClick={() => setSortBy(sort)}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    sortBy === sort
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  Sort by {sort.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status Summary */}
        <div className="mt-3 flex justify-between items-center text-sm text-muted-foreground">
          <span>{sortedTasks.length} tasks</span>
          {isOffline && (
            <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
              <ExclamationTriangleIcon className="w-4 h-4" />
              <span>Offline</span>
            </div>
          )}
          <span>Updated {formatRelativeTime(lastRefresh.toISOString())}</span>
        </div>
      </header>

      {/* Task List */}
      <main className="flex-1 overflow-hidden">
        <TouchGestures
          onPullRefresh={handlePullToRefresh}
          pullThreshold={pullThreshold}
          isRefreshing={isRefreshing}
          disabled={isOffline}
        >
          <div
            ref={listRef}
            className="h-full overflow-y-auto mobile-scroll px-4 pb-20"
            style={{ 
              transform: isPulling ? `translateY(${Math.min(pullDistance, pullThreshold)}px)` : 'none',
              transition: isPulling ? 'none' : 'transform 0.3s ease'
            }}
          >
            {sortedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <CheckCircleIcon className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="mobile-heading text-muted-foreground mb-2">
                  {searchQuery ? 'No matching tasks' : 'No tasks found'}
                </h3>
                <p className="mobile-caption max-w-sm">
                  {searchQuery
                    ? 'Try adjusting your search or filters'
                    : 'Create tasks from emails or add them manually'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => onTaskCreate(0)}
                    className="mt-4 touch-button bg-primary text-primary-foreground"
                  >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Create Task
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3 py-4">
                {sortedTasks.map((task) => (
                  <TouchGestures
                    key={task.id}
                    onSwipeLeft={() => handleSwipeComplete(task.id)}
                    onSwipeRight={() => handleSwipeDelegate(task.id)}
                    swipeThreshold={80}
                    leftAction={{ label: 'Complete', color: 'success' }}
                    rightAction={{ label: 'Delegate', color: 'warning' }}
                  >
                    <div
                      className={`mobile-card touch-feedback relative ${
                        selectedTask?.id === task.id ? 'ring-2 ring-primary' : ''
                      } ${isTaskOverdue(task) ? 'border-red-200 dark:border-red-800' : ''}`}
                      onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                    >
                      {/* Task Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {getCategoryIcon(task.category)}
                          <h3 className="mobile-body font-semibold text-foreground truncate">
                            {task.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                          {task.status === 'completed' && (
                            <CheckCircleSolidIcon className="w-5 h-5 text-green-600" />
                          )}
                        </div>
                      </div>

                      {/* Task Description */}
                      <p className="mobile-caption text-muted-foreground mb-3 line-clamp-2">
                        {task.description}
                      </p>

                      {/* Task Metadata */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                            {task.status.replace('_', ' ')}
                          </span>
                          {task.due_date && (
                            <span className={`text-xs ${isTaskOverdue(task) ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'}`}>
                              Due {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTaskEdit(task);
                          }}
                          className="p-1 text-muted-foreground hover:text-foreground touch-target"
                          aria-label="Edit task"
                        >
                          <EllipsisHorizontalIcon className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Expanded Details */}
                      {selectedTask?.id === task.id && (
                        <div className="mt-4 pt-4 border-t border-border space-y-3">
                          {task.assignee && (
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">Assignee:</span>
                              <p className="mobile-caption">{task.assignee}</p>
                            </div>
                          )}
                          {task.confidence && (
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">AI Confidence:</span>
                              <p className="mobile-caption">{Math.round(task.confidence * 100)}%</p>
                            </div>
                          )}
                          <div>
                            <span className="text-xs font-medium text-muted-foreground">Created:</span>
                            <p className="mobile-caption">{formatRelativeTime(task.created_at)}</p>
                          </div>
                          {task.email_id && (
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">Related Email:</span>
                              <p className="mobile-caption">
                                {emails.find(e => e.id === task.email_id)?.subject || `Email #${task.email_id}`}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Overdue Indicator */}
                      {isTaskOverdue(task) && (
                        <div className="absolute top-2 right-2">
                          <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                        </div>
                      )}
                    </div>
                  </TouchGestures>
                ))}
              </div>
            )}
          </div>
        </TouchGestures>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation 
        currentView="tasks"
        onViewChange={() => {}}
        taskCount={tasks.length}
        unreadCount={emails.filter(e => !e.classification.includes('READ')).length}
      />
    </div>
  );
};

export default MobileTaskInterface;