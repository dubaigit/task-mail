import { TaskStatus, TaskPriority, TaskCategory } from '../../types/core';
import React, { useState, useEffect } from 'react';
import { Icons } from '../ui/icons';
import {
  Users as UsersIcon,
  CalendarDays as CalendarDaysIcon,
  MessageSquare as ChatBubbleLeftRightIcon,
  RefreshCw as ArrowPathIcon,
  CheckCircle as CheckCircleSolid,
  AlertTriangle as ExclamationTriangleSolid
} from 'lucide-react';

interface ColleagueInfo {
  email: string;
  name: string;
  initials: string;
  status: 'replied' | 'pending' | 'overdue';
  lastResponse?: string;
  avatar?: string;
}

interface DelegatedTask {
  id: string;
  title: string;
  description: string;
  assignedTo: ColleagueInfo;
  assignedBy: string;
  dueDate?: string;
  status: 'pending' | 'in_progress' | TaskStatus.COMPLETED | 'overdue';
  priority: 'critical' | 'high' | 'medium' | 'low';
  emailSubject: string;
  delegatedAt: string;
  lastActivity?: string;
  responseReceived: boolean;
  completionConfirmed: boolean;
}

interface ColleagueTrackingDashboardProps {
  tasks?: DelegatedTask[];
  onTaskUpdate?: (taskId: string, updates: Partial<DelegatedTask>) => void;
  onViewTask?: (taskId: string) => void;
  className?: string;
}

export const ColleagueTrackingDashboard: React.FC<ColleagueTrackingDashboardProps> = ({
  tasks = [],
  onTaskUpdate,
  onViewTask,
  className = ''
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'overdue' | TaskStatus.COMPLETED>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'delegatedAt' | 'priority'>('dueDate');

  // Mock data for demonstration
  const mockTasks: DelegatedTask[] = [
    {
      id: 'task-1',
      title: 'Review quarterly budget proposal',
      description: 'Please review the Q4 budget proposal and provide feedback',
      assignedTo: {
        email: 'sarah.johnson@company.com',
        name: 'Sarah Johnson',
        initials: 'SJ',
        status: 'pending',
        lastResponse: undefined
      },
      assignedBy: 'John Doe',
      dueDate: '2025-08-20T10:00:00Z',
      status: 'pending',
      priority: 'high',
      emailSubject: 'Q4 Budget Review Required',
      delegatedAt: '2025-08-14T09:00:00Z',
      responseReceived: false,
      completionConfirmed: false
    },
    {
      id: 'task-2', 
      title: 'Approve marketing campaign assets',
      description: 'Final approval needed for the new product launch campaign',
      assignedTo: {
        email: 'mike.chen@company.com',
        name: 'Mike Chen',
        initials: 'MC',
        status: 'overdue',
        lastResponse: '2025-08-12T15:30:00Z'
      },
      assignedBy: 'John Doe',
      dueDate: '2025-08-15T17:00:00Z',
      status: 'overdue',
      priority: 'critical',
      emailSubject: 'URGENT: Campaign Approval Needed',
      delegatedAt: '2025-08-12T08:00:00Z',
      responseReceived: true,
      completionConfirmed: false
    },
    {
      id: 'task-3',
      title: 'Schedule team meeting for project kickoff',
      description: 'Coordinate with the team to schedule the project kickoff meeting',
      assignedTo: {
        email: 'lisa.wong@company.com',
        name: 'Lisa Wong',
        initials: 'LW',
        status: 'replied',
        lastResponse: '2025-08-15T11:20:00Z'
      },
      assignedBy: 'John Doe',
      dueDate: '2025-08-18T12:00:00Z',
      status: TaskStatus.COMPLETED,
      priority: 'medium',
      emailSubject: 'Project Kickoff Meeting Coordination',
      delegatedAt: '2025-08-13T14:00:00Z',
      responseReceived: true,
      completionConfirmed: true
    }
  ];

  const displayTasks = tasks.length > 0 ? tasks : mockTasks;

  const getStatusIcon = (status: DelegatedTask['status']) => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return <CheckCircleSolid className="w-4 h-4 text-green-600" aria-label="Completed" />;
      case 'pending':
        return <Icons.clock className="w-4 h-4 text-yellow-600" aria-label="Pending" />;
      case 'overdue':
        return <ExclamationTriangleSolid className="w-4 h-4 text-red-600" aria-label="Overdue" />;
      case 'in_progress':
        return <ArrowPathIcon className="w-4 h-4 text-blue-600" aria-label="In progress" />;
      default:
        return <Icons.clock className="w-4 h-4 text-gray-600" aria-label="Unknown status" />;
    }
  };

  const getPriorityColor = (priority: DelegatedTask['priority']) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200';
    }
  };

  const getTaskStatusColor = (status: DelegatedTask['status']) => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'bg-green-50 dark:bg-green-950/20 border-green-200';
      case 'pending':
        return 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200';
      case 'overdue':
        return 'bg-red-50 dark:bg-red-950/20 border-red-200';
      case 'in_progress':
        return 'bg-blue-50 dark:bg-blue-950/20 border-blue-200';
      default:
        return 'bg-gray-50 dark:bg-gray-950/20 border-gray-200';
    }
  };

  const filteredTasks = displayTasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    switch (sortBy) {
      case 'dueDate':
        return new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
      case 'delegatedAt':
        return new Date(b.delegatedAt).getTime() - new Date(a.delegatedAt).getTime();
      case 'priority':
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      default:
        return 0;
    }
  });

  const stats = {
    total: displayTasks.length,
    pending: displayTasks.filter(t => t.status === 'pending').length,
    overdue: displayTasks.filter(t => t.status === 'overdue').length,
    completed: displayTasks.filter(t => t.status === TaskStatus.COMPLETED).length,
    responseRate: displayTasks.length > 0 
      ? Math.round((displayTasks.filter(t => t.responseReceived).length / displayTasks.length) * 100) 
      : 0
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className={`colleague-tracking-dashboard ${className}`}>
      {/* Dashboard Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
              <UsersIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Colleague Tracking</h2>
              <p className="text-sm text-muted-foreground">
                Monitor delegated tasks and colleague responses
              </p>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-semibold text-foreground">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-yellow-600">{stats.pending}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600">{stats.overdue}</div>
              <div className="text-xs text-muted-foreground">Overdue</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">{stats.responseRate}%</div>
              <div className="text-xs text-muted-foreground">Response Rate</div>
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex items-center justify-between bg-secondary/30 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">Filter:</span>
            <div className="flex items-center bg-background border border-border rounded-lg p-1">
              {(['all', 'pending', 'overdue', TaskStatus.COMPLETED] as const).map((filterOption) => (
                <button
                  key={filterOption}
                  onClick={() => setFilter(filterOption)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    filter === filterOption
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                  {filterOption !== 'all' && (
                    <span className="ml-1 text-xs">
                      ({filterOption === 'pending' ? stats.pending : 
                        filterOption === 'overdue' ? stats.overdue : 
                        filterOption === TaskStatus.COMPLETED ? stats.completed : 0})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-sm bg-background border border-border rounded-md px-3 py-1 text-foreground"
            >
              <option value="dueDate">Due Date</option>
              <option value="delegatedAt">Date Delegated</option>
              <option value="priority">Priority</option>
            </select>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {sortedTasks.length === 0 ? (
          <div className="text-center py-12">
            <UsersIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No delegated tasks</h3>
            <p className="text-sm text-muted-foreground">
              {filter === 'all' 
                ? 'You haven\'t delegated any tasks to colleagues yet.'
                : `No ${filter} tasks found.`
              }
            </p>
          </div>
        ) : (
          sortedTasks.map((task) => (
            <div
              key={task.id}
              className={`colleague-task-card p-4 rounded-lg border shadow-sm hover:shadow-md transition-all duration-200 ${getTaskStatusColor(task.status)}`}
            >
              {/* Task Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getStatusIcon(task.status)}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm mb-1 text-foreground line-clamp-1">
                      {task.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      From: {task.emailSubject}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${getPriorityColor(task.priority)}`}>
                    {task.priority.toUpperCase()}
                  </span>
                  {task.status === 'overdue' && (
                    <div className="flex items-center gap-1 text-xs text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full">
                      <ExclamationTriangleSolid className="w-3 h-3" />
                      <span>OVERDUE</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Colleague Info */}
              <div className="flex items-center justify-between mb-3 bg-background/50 rounded-md p-2">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-xs font-semibold text-white">
                        {task.assignedTo.initials}
                      </span>
                    </div>
                    <div className="absolute -top-1 -right-1">
                      {task.assignedTo.status === 'replied' && (
                        <CheckCircleSolid className="w-3 h-3 text-green-600" />
                      )}
                      {task.assignedTo.status === 'pending' && (
                        <Icons.clock className="w-3 h-3 text-yellow-600" />
                      )}
                      {task.assignedTo.status === 'overdue' && (
                        <ExclamationTriangleSolid className="w-3 h-3 text-red-600" />
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <div className="font-medium text-sm text-foreground">
                      {task.assignedTo.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {task.assignedTo.email}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <ChatBubbleLeftRightIcon className="w-3 h-3" />
                    <span>Status: {task.assignedTo.status}</span>
                  </div>
                  {task.assignedTo.lastResponse && (
                    <div className="text-xs text-muted-foreground">
                      Last response: {formatDate(task.assignedTo.lastResponse)}
                    </div>
                  )}
                </div>
              </div>

              {/* Task Details */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <CalendarDaysIcon className="w-3 h-3" />
                    <span>Delegated: {formatDate(task.delegatedAt)}</span>
                  </div>
                  {task.dueDate && (
                    <div className="flex items-center gap-1">
                      <Icons.clock className="w-3 h-3" />
                      <span className={isOverdue(task.dueDate) ? 'text-red-600 font-medium' : ''}>
                        Due: {formatDate(task.dueDate)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {task.responseReceived && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircleSolid className="w-3 h-3" />
                      <span>Response received</span>
                    </div>
                  )}
                  {task.completionConfirmed && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <CheckCircleSolid className="w-3 h-3" />
                      <span>Confirmed complete</span>
                    </div>
                  )}
                  
                  <button
                    onClick={() => onViewTask?.(task.id)}
                    className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                  >
                    <Icons.eye className="w-3 h-3" />
                    <span>View</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ColleagueTrackingDashboard;