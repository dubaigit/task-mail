import React, { useMemo } from 'react';
import { UnifiedTaskCard } from '../../ui/UnifiedTaskCard';
import { Task as UnifiedTask } from '../../../types/core';
import { useAccessibility } from '../../../hooks/useAccessibility';

interface TaskColumnsProps {
  filteredTasks: any[];
  convertToUnifiedTask: (legacyTask: any) => UnifiedTask;
  onTaskClick: (task: UnifiedTask) => void;
  onTaskUpdate?: (task: UnifiedTask) => void;
  loading?: boolean;
  hasMore?: boolean;
  className?: string;
}

export const TaskColumns: React.FC<TaskColumnsProps> = ({
  filteredTasks,
  convertToUnifiedTask,
  onTaskClick,
  onTaskUpdate,
  loading = false,
  hasMore = false,
  className = ""
}) => {
  const { announceToScreenReader } = useAccessibility();

  // PERFORMANCE OPTIMIZATION: Transform tasks once using useMemo instead of in render loop
  const unifiedTasks = useMemo(() => {
    return filteredTasks.map(task => convertToUnifiedTask(task));
  }, [filteredTasks, convertToUnifiedTask]);

  // Announce loading state changes
  React.useEffect(() => {
    if (loading) {
      announceToScreenReader("Loading tasks...");
    } else {
      announceToScreenReader(`Loaded ${unifiedTasks.length} tasks`);
    }
  }, [loading, unifiedTasks.length, announceToScreenReader]);

  const handleTaskClick = (task: UnifiedTask) => {
    announceToScreenReader(`Selected task: ${task.title}`);
    onTaskClick(task);
  };

  const handleTaskUpdate = (updatedTask: UnifiedTask) => {
    announceToScreenReader(`Task updated: ${updatedTask.title}`);
    onTaskUpdate?.(updatedTask);
  };

  if (loading && unifiedTasks.length === 0) {
    return (
      <div className={`space-y-4 ${className}`} role="main" aria-label="Task list loading">
        {[...Array(6)].map((_, index) => (
          <div
            key={index}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 animate-pulse"
            aria-hidden="true"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="h-4 bg-white/10 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-white/10 rounded w-1/2 mb-4"></div>
                <div className="flex gap-2">
                  <div className="h-6 bg-white/10 rounded w-16"></div>
                  <div className="h-6 bg-white/10 rounded w-20"></div>
                </div>
              </div>
              <div className="h-8 w-8 bg-white/10 rounded-full"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (unifiedTasks.length === 0 && !loading) {
    return (
      <div 
        className={`text-center py-12 ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="text-gray-400 text-lg mb-2">No tasks found</div>
        <div className="text-gray-500 text-sm">
          Try adjusting your filters or search criteria
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`space-y-4 ${className}`}
      role="main"
      aria-label={`Task list with ${unifiedTasks.length} tasks`}
    >
      {/* Task Grid */}
      <div className="grid gap-4">
        {unifiedTasks.map((task, index) => (
          <div
            key={task.id}
            className="transform transition-all duration-200 hover:scale-[1.02]"
          >
            <UnifiedTaskCard
              task={task}
              onSelect={() => handleTaskClick(task)}
              variant="spacious"
              showActions={true}
              showMeta={true}
              showTags={true}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6"
            />
          </div>
        ))}
      </div>

      {/* Loading More */}
      {loading && unifiedTasks.length > 0 && (
        <div 
          className="text-center py-8"
          role="status"
          aria-live="polite"
        >
          <div className="inline-flex items-center gap-3 text-gray-400">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            Loading more tasks...
          </div>
        </div>
      )}

      {/* No More Tasks */}
      {!hasMore && !loading && unifiedTasks.length > 0 && (
        <div 
          className="text-center py-4 text-gray-500 text-sm"
          role="status"
          aria-live="polite"
        >
          All tasks loaded
        </div>
      )}
    </div>
  );
};