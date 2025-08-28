import React, { useMemo, useCallback } from 'react';
import { Task, TaskFilters } from '../../types/Task';
import { TaskPriority } from '../../types/core';
import { UnifiedTaskCard } from '../ui/UnifiedTaskCard';
import { TaskFilters as TaskFiltersComponent } from './TaskFilters';
import { InfiniteScrollController } from './InfiniteScrollController';
import { usePerformanceTracking } from '../../hooks/usePerformanceTracking';

interface TaskListContainerProps {
  tasks: Task[];
  filters: TaskFilters;
  onTaskUpdate: (task: Task) => void;
  onFilterChange: (filters: TaskFilters) => void;
  onTaskDelete: (taskId: string) => void;
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export const TaskListContainer: React.FC<TaskListContainerProps> = ({
  tasks,
  filters,
  onTaskUpdate,
  onFilterChange,
  onTaskDelete,
  loading = false,
  hasMore = false,
  onLoadMore
}) => {
  const { trackUserInteraction } = usePerformanceTracking();

  // Memoized filtered and sorted tasks
  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    // Apply status filter
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(task => task.status === filters.status);
    }

    // Apply priority filter
    if (filters.priority && filters.priority !== 'all') {
      filtered = filtered.filter(task => task.priority === filters.priority);
    }

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower) ||
        task.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Apply date filter
    if (filters.dueDateRange) {
      const { start, end } = filters.dueDateRange;
      filtered = filtered.filter(task => {
        if (!task.createdAt) return false;
        const taskDate = new Date(task.createdAt);
        const start = new Date(filters.dueDateRange!.start!);
        const end = new Date(filters.dueDateRange!.end!);
        return taskDate >= start && taskDate <= end;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'priority':
          const priorityOrder: Record<TaskPriority, number> = { 
            [TaskPriority.CRITICAL]: 5, 
            [TaskPriority.URGENT]: 4, 
            [TaskPriority.HIGH]: 3, 
            [TaskPriority.MEDIUM]: 2, 
            [TaskPriority.LOW]: 1 
          };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'status':
          return a.status.localeCompare(b.status);
        case 'createdAt':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filters.sortOrder === 'desc' ? filtered : filtered.reverse();
  }, [tasks, filters]);

  const handleTaskUpdate = useCallback((task: Task) => {
    trackUserInteraction('task_update');
    onTaskUpdate(task);
  }, [onTaskUpdate, trackUserInteraction]);

  const handleTaskDelete = useCallback((taskId: string) => {
    trackUserInteraction('task_delete');
    onTaskDelete(taskId);
  }, [onTaskDelete, trackUserInteraction]);

  const handleFilterChange = useCallback((newFilters: TaskFilters) => {
    onFilterChange(newFilters);
  }, [onFilterChange]);

  return (
    <div 
      className="task-list-container h-full flex flex-col"
      role="region"
      aria-label="Task list"
    >
      {/* Filters Section */}
      <div className="flex-shrink-0 mb-4">
        <TaskFiltersComponent
          filters={filters}
          onFiltersChange={handleFilterChange}
        />
      </div>

      {/* Task List Section */}
      <div className="flex-1 overflow-hidden">
        <InfiniteScrollController
          hasMore={hasMore}
          isLoading={loading}
          onLoadMore={onLoadMore || (() => {})}
          className="space-y-2 p-4"
        >
          {filteredTasks.map((task, index) => (
            <UnifiedTaskCard
              key={task.id}
              task={task}
              onEdit={handleTaskUpdate}
              onDelete={handleTaskDelete}
            />
          ))}
        </InfiniteScrollController>
      </div>

      {/* Loading State */}
      {loading && (
        <div 
          className="flex justify-center items-center py-4"
          aria-live="polite"
          aria-label="Loading more tasks"
        >
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          <span className="ml-2 text-sm text-gray-600">Loading tasks...</span>
        </div>
      )}

      {/* Empty State */}
      {filteredTasks.length === 0 && !loading && (
        <div 
          className="flex flex-col items-center justify-center py-12 text-center"
          role="status"
          aria-live="polite"
        >
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            {filters.search || filters.status !== 'all' || filters.priority !== 'all'
              ? 'Try adjusting your filters to see more tasks.'
              : 'Get started by creating your first task or processing some emails.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default TaskListContainer;