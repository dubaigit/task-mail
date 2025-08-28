import React, { useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Card, CardContent } from '../ui/card';
import { StatusBadge as Badge } from '../ui/TaskCard/components/StatusBadge';
import Button from '../ui/ModernButton';
import { CheckSquare, Archive, Clock, AlertTriangle } from 'lucide-react';
import { TaskItem, TaskStatus, TaskPriority } from '../../types/index';
import { cn } from '../../lib/utils';
import { optimizeComponent } from '../../hooks/usePerformanceOptimization';



interface OptimizedTaskListProps {
  tasks: TaskItem[];
  onTaskUpdate: (id: string, updates: Partial<TaskItem>) => void;
  onTaskDelete: (id: string) => void;
  height?: number;
  itemHeight?: number;
  className?: string;
}

// Memoized task item component
const TaskListItem = React.memo<{
  index: number;
  style: React.CSSProperties;
  data: {
    tasks: TaskItem[];
    onTaskUpdate: (id: string, updates: Partial<TaskItem>) => void;
    onTaskDelete: (id: string) => void;
  };
}>(({ index, style, data }) => {
  const { tasks, onTaskUpdate, onTaskDelete } = data;
  const task = tasks[index];

  const handleStatusChange = useCallback(() => {
    const nextStatus = task.status === TaskStatus.COMPLETED ? TaskStatus.TODO : 
                      task.status === TaskStatus.TODO ? TaskStatus.IN_PROGRESS : TaskStatus.COMPLETED;
    onTaskUpdate(task.id, { status: nextStatus });
  }, [task.id, task.status, onTaskUpdate]);

  const handleDelete = useCallback(() => {
    onTaskDelete(task.id);
  }, [task.id, onTaskDelete]);

  const getStatusIcon = () => {
    switch (task.status) {
      case TaskStatus.COMPLETED:
        return <CheckSquare className="w-4 h-4 text-green-600" />;
      case TaskStatus.IN_PROGRESS:
        return <Clock className="w-4 h-4 text-blue-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getPriorityColor = () => {
    switch (task.priority) {
      case TaskPriority.HIGH:
        return 'border-l-red-500 bg-red-50 dark:bg-red-950/10';
      case TaskPriority.MEDIUM:
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/10';
      case TaskPriority.LOW:
        return 'border-l-green-500 bg-green-50 dark:bg-green-950/10';
      default:
        return 'border-l-gray-300';
    }
  };

  const isOverdue = useMemo(() => {
    if (!task.dueDate) return false;
    return new Date(task.dueDate) < new Date() && task.status !== TaskStatus.COMPLETED;
  }, [task.dueDate, task.status]);
		

  return (
    <div style={style} className="p-1">
      <Card className={cn(
        "border-l-4 hover:shadow-sm transition-all duration-200",
        getPriorityColor(),
        isOverdue && "ring-2 ring-red-200"
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3">
                <button
                  onClick={handleStatusChange}
                  className="mt-1 hover:scale-110 transition-transform"
                  aria-label={`Mark task as ${task.status === TaskStatus.COMPLETED ? 'incomplete' : 'complete'}`}
                >
                  {getStatusIcon()}
                </button>
                
                <div className="flex-1 min-w-0">
                  <h3 className={cn(
                    "font-medium text-sm",
                    task.status === TaskStatus.COMPLETED && "line-through text-muted-foreground"
                  )}>
                    {task.title}
                  </h3>
                  
                  {task.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {task.tags && task.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline"  className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    
                    {task.tags && task.tags.length > 2 && (
                      <Badge variant="outline"  className="text-xs">
                        +{task.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                  
                  {task.dueDate && (
                    <div className={cn(
                      "text-xs mt-2",
                      isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"
                    )}>
                      Due: {new Date(task.dueDate).toLocaleDateString()}
                      {isOverdue && " (Overdue)"}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                
                variant="secondary"
                onClick={handleDelete}
                className="h-8 w-8 p-0 opacity-60 hover:opacity-100"
                aria-label="Delete task"
              >
                <Archive className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

TaskListItem.displayName = 'TaskListItem';

// Main optimized task list component
export const OptimizedTaskList: React.FC<OptimizedTaskListProps> = optimizeComponent.memo(({
  tasks,
  onTaskUpdate,
  onTaskDelete,
  height = 600,
  itemHeight = 120,
  className
}) => {
  // Memoize the data passed to the virtual list
  const itemData = useMemo(() => ({
    tasks,
    onTaskUpdate,
    onTaskDelete
  }), [tasks, onTaskUpdate, onTaskDelete]);

  // Stable callbacks
  const stableOnTaskUpdate = optimizeComponent.useStableCallback(onTaskUpdate, [onTaskUpdate]);
  const stableOnTaskDelete = optimizeComponent.useStableCallback(onTaskDelete, [onTaskDelete]);

  if (tasks.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-64", className)}>
        <div className="text-center">
          <CheckSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No tasks found</h3>
          <p className="text-sm text-muted-foreground">Create a new task to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        style={{
          width: 800,
          height: height,
          overflow: 'auto'
        }}
        className="scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
      >
        {tasks.map((task: TaskItem, index: number) => (
          <TaskListItem
            key={task.id}
            index={index}
            style={{ height: itemHeight }}
            data={{
              tasks,
              onTaskUpdate: stableOnTaskUpdate,
              onTaskDelete: stableOnTaskDelete
            }}
          />
        ))}
      </div>
    </div>
  );
});

OptimizedTaskList.displayName = 'OptimizedTaskList';

export default OptimizedTaskList;