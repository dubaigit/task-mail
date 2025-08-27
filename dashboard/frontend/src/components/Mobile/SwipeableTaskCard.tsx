import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { StatusBadge as Badge } from '../ui/TaskCard/components/StatusBadge';
import Button from '../ui/ModernButton';
import TouchGestures from './TouchGestures';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Star,
  Calendar,
  User,
  Trash2,
  Edit,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Task, TaskStatus, TaskPriority } from '../../types';

interface SwipeableTaskCardProps {
  task: Task;
  onTaskUpdate: (id: string, updates: Partial<Task>) => void;
  onTaskDelete: (id: string) => void;
  onTaskEdit?: (task: Task) => void;
  isSelected?: boolean;
  compact?: boolean;
}

const SwipeableTaskCard: React.FC<SwipeableTaskCardProps> = ({
  task,
  onTaskUpdate,
  onTaskDelete,
  onTaskEdit,
  isSelected = false,
  compact = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // Priority colors and icons
  const getPriorityConfig = (priority: TaskPriority) => {
    const configs: Record<TaskPriority, { color: string; icon: any; textColor: string }> = {
      [TaskPriority.CRITICAL]: { color: 'bg-red-500', icon: AlertTriangle, textColor: 'text-red-600' },
      [TaskPriority.URGENT]: { color: 'bg-red-500', icon: AlertTriangle, textColor: 'text-red-600' },
      [TaskPriority.HIGH]: { color: 'bg-orange-500', icon: Star, textColor: 'text-orange-600' },
      [TaskPriority.MEDIUM]: { color: 'bg-yellow-500', icon: Clock, textColor: 'text-yellow-600' },
      [TaskPriority.LOW]: { color: 'bg-blue-500', icon: User, textColor: 'text-blue-600' }
    };
    return configs[priority] || configs[TaskPriority.MEDIUM];
  };

  // Status colors
  const getStatusColor = (status: TaskStatus) => {
    const colors: Record<TaskStatus, string> = {
      [TaskStatus.TODO]: 'bg-gray-100 text-gray-800',
      [TaskStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-800',
      [TaskStatus.COMPLETED]: 'bg-green-100 text-green-800',
      [TaskStatus.DONE]: 'bg-green-100 text-green-800',
      [TaskStatus.BLOCKED]: 'bg-red-100 text-red-800',
      [TaskStatus.WAITING_FOR_REPLY]: 'bg-yellow-100 text-yellow-800',
      [TaskStatus.DELEGATED]: 'bg-blue-100 text-blue-800',
      [TaskStatus.DEFERRED]: 'bg-gray-100 text-gray-600',
      [TaskStatus.REVIEW]: 'bg-purple-100 text-purple-800',
      [TaskStatus.CANCELLED]: 'bg-red-100 text-red-800'
    };
    return colors[status] || colors[TaskStatus.TODO];
  };

  // Handle task completion toggle
  const handleToggleComplete = useCallback(() => {
    const newStatus = task.status === TaskStatus.COMPLETED ? TaskStatus.TODO : TaskStatus.COMPLETED;
    onTaskUpdate(task.id, { status: newStatus });
  }, [task.id, task.status, onTaskUpdate]);

  // Handle task deletion with confirmation
  const handleDelete = useCallback(() => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      onTaskDelete(task.id);
    }
  }, [task.id, onTaskDelete]);

  // Handle task editing
  const handleEdit = useCallback(() => {
    if (onTaskEdit) {
      onTaskEdit(task);
    }
    setShowActions(false);
  }, [task, onTaskEdit]);

  // Calculate if task is overdue
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== TaskStatus.COMPLETED;
  const priorityConfig = getPriorityConfig(task.priority);

  return (
    <TouchGestures
      onSwipeLeft={() => {
        if (task.status !== TaskStatus.COMPLETED) {
          handleToggleComplete();
        }
      }}
      onSwipeRight={() => setShowActions(!showActions)}
      leftAction={{
        label: task.status === TaskStatus.COMPLETED ? 'Undo' : 'Complete',
        color: task.status === TaskStatus.COMPLETED ? 'warning' : 'success',
        icon: CheckCircle
      }}
      rightAction={{
        label: 'Actions',
        color: 'info',
        icon: MoreHorizontal
      }}
      disabled={showActions}
      className={cn(
        "mb-3 transition-all duration-200",
        isSelected && "ring-2 ring-primary"
      )}
    >
      <Card className={cn(
        "touch-feedback transition-all duration-200",
        task.status === TaskStatus.COMPLETED && "opacity-75",
        isOverdue && "border-red-300 bg-red-50/50",
        isSelected && "shadow-md",
        compact && "py-2"
      )}>
        <CardContent className={cn(
          "p-4",
          compact && "py-3 px-4"
        )}>
          {/* Main Task Content */}
          <div className="flex items-start space-x-3">
            {/* Priority Indicator */}
            <div className={cn(
              "w-1 h-full rounded-full flex-shrink-0 mt-1",
              priorityConfig.color
            )} style={{ minHeight: '60px' }} />

            {/* Task Details */}
            <div className="flex-1 min-w-0">
              {/* Header Row */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className={cn(
                    "font-medium leading-tight",
                    task.status === TaskStatus.COMPLETED && "line-through text-muted-foreground",
                    compact ? "text-sm" : "text-base"
                  )}>
                    {task.title}
                  </h3>
                  
                  {/* Task Meta */}
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs px-2 py-0.5", getStatusColor(task.status))}
                    >
                      {task.status.replace('-', ' ')}
                    </Badge>
                    
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs px-2 py-0.5", priorityConfig.textColor)}
                    >
                      {task.priority}
                    </Badge>

                    {isOverdue && (
                      <Badge variant="destructive" className="text-xs px-2 py-0.5">
                        Overdue
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Completion Button */}
                <button
                  onClick={handleToggleComplete}
                  className={cn(
                    "flex-shrink-0 p-2 rounded-full touch-feedback transition-colors",
                    task.status === TaskStatus.COMPLETED 
                      ? "bg-green-100 text-green-600" 
                      : "bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600"
                  )}
                  aria-label={task.status === TaskStatus.COMPLETED ? 'Mark incomplete' : 'Mark complete'}
                >
                  <CheckCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Description */}
              {task.description && !compact && (
                <p className={cn(
                  "text-sm text-muted-foreground mb-3 leading-relaxed",
                  isExpanded ? "" : "line-clamp-2"
                )}>
                  {task.description}
                </p>
              )}

              {/* Extended Info */}
              {!compact && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center space-x-3">
                    {task.dueDate && (
                      <div className={cn(
                        "flex items-center space-x-1",
                        isOverdue && "text-red-600"
                      )}>
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    
                    {task.sender && (
                      <div className="flex items-center space-x-1">
                        <User className="w-3 h-3" />
                        <span>{task.sender}</span>
                      </div>
                    )}
                  </div>

                  {task.description && task.description.length > 100 && (
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="text-primary hover:text-primary/80 font-medium"
                    >
                      {isExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              )}

              {/* Tags */}
              {task.tags && task.tags.length > 0 && !compact && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {task.tags.slice(0, 3).map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs px-2 py-0.5">
                      {tag}
                    </Badge>
                  ))}
                  {task.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs px-2 py-0.5">
                      +{task.tags.length - 3} more
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Expanded Actions */}
          {showActions && (
            <div className="mt-4 pt-3 border-t border-border slide-in-up">
              <div className="flex space-x-2">
                {onTaskEdit && (
                  <Button
                    onClick={handleEdit}
                    variant="outline"
                    
                    className="flex-1 text-xs"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                )}
                
                <Button
                  onClick={handleToggleComplete}
                  variant="outline"
                  
                  className={cn(
                    "flex-1 text-xs",
                    task.status === TaskStatus.COMPLETED 
                      ? "text-orange-600 border-orange-200 hover:bg-orange-50" 
                      : "text-green-600 border-green-200 hover:bg-green-50"
                  )}
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {task.status === TaskStatus.COMPLETED ? 'Undo' : 'Complete'}
                </Button>
                
                <Button
                  onClick={handleDelete}
                  variant="outline"
                  
                  className="flex-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TouchGestures>
  );
};

export default SwipeableTaskCard;