import React, { useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Task, TaskStatus, TaskPriority } from '../types';
import { Card, Badge } from './ui';

interface VirtualizedTaskListProps {
  tasks: Task[];
  onTaskSelect?: (task: Task) => void;
  selectedTaskId?: string;
  height?: number;
}

export const VirtualizedTaskList: React.FC<VirtualizedTaskListProps> = ({
  tasks,
  onTaskSelect,
  selectedTaskId,
  height = 600
}) => {
  // Ref for the parent container
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Create virtualizer instance
  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated height per task item
    overscan: 5, // Number of items to render outside visible area
  });

  // Memoize task items to prevent unnecessary re-renders
  const taskItems = useMemo(() => {
    return virtualizer.getVirtualItems().map((virtualItem) => {
      const task = tasks[virtualItem.index];
      if (!task) return null;

      const isSelected = selectedTaskId === task.id;
      
      const priorityColors: Record<TaskPriority, string> = {
        [TaskPriority.LOW]: 'bg-gray-100 text-gray-800',
        [TaskPriority.MEDIUM]: 'bg-blue-100 text-blue-800',
        [TaskPriority.HIGH]: 'bg-orange-100 text-orange-800',
        [TaskPriority.URGENT]: 'bg-red-100 text-red-800',
        [TaskPriority.CRITICAL]: 'bg-red-100 text-red-800'
      };

      const statusColors: Record<TaskStatus, string> = {
        [TaskStatus.TODO]: 'bg-gray-100 text-gray-800',
        [TaskStatus.IN_PROGRESS]: 'bg-yellow-100 text-yellow-800',
        [TaskStatus.COMPLETED]: 'bg-green-100 text-gray-800',
        [TaskStatus.DONE]: 'bg-green-100 text-gray-800',
        [TaskStatus.BLOCKED]: 'bg-red-100 text-red-800',
        [TaskStatus.WAITING_FOR_REPLY]: 'bg-yellow-100 text-yellow-800',
        [TaskStatus.DELEGATED]: 'bg-blue-100 text-blue-800',
        [TaskStatus.DEFERRED]: 'bg-gray-100 text-gray-600',
        [TaskStatus.REVIEW]: 'bg-purple-100 text-purple-800',
        [TaskStatus.CANCELLED]: 'bg-red-100 text-red-800'
      };

      return (
        <div
          key={virtualItem.key}
          data-index={virtualItem.index}
          ref={virtualizer.measureElement}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualItem.start}px)`,
          }}
        >
          <div 
            className={`m-2 p-4 cursor-pointer transition-colors hover:bg-accent/50 rounded-lg border bg-card text-card-foreground shadow-sm ${
              isSelected ? 'ring-2 ring-primary bg-accent/20' : ''
            }`}
            onClick={() => onTaskSelect?.(task)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate" title={task.title}>
                  {task.title}
                </h3>
                {task.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {task.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.LOW}`}
                  >
                    {task.priority}
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${statusColors[task.status] || 'bg-gray-100 text-gray-800'}`}
                  >
                    {task.status}
                  </Badge>
                  {task.dueDate && (
                    <span className="text-xs text-muted-foreground">
                      Due: {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              {task.assignedTo && (
                <div className="ml-2 flex-shrink-0">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">
                      {task.assignedTo.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    });
  }, [virtualizer.getVirtualItems(), tasks, selectedTaskId, onTaskSelect]);

  return (
    <div className="w-full">
      <div className="text-sm text-muted-foreground mb-2">
        Showing {tasks.length} tasks (virtualized)
      </div>
      <div
        ref={parentRef}
        className="w-full overflow-auto border rounded-lg"
        style={{ height }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {taskItems}
        </div>
      </div>
    </div>
  );
};

export default VirtualizedTaskList;