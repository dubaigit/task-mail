/**
 * Unified Task Card Component
 * Implements the design system foundation with consistent styling and behavior
 */

import React from 'react';
import { clsx } from 'clsx';
import '../../styles/design-system/components/task-card.scss';

// Use the unified Task interface from main types
import { Task, TaskStatus } from '../../types/core';

export interface UnifiedTaskCardProps {
  task: Task;
  variant?: 'default' | 'compact' | 'spacious';
  isSelected?: boolean;
  isDisabled?: boolean;
  isLoading?: boolean;
  onSelect?: (task: Task) => void;
  onStatusChange?: (taskId: string, status: Task['status']) => void;
  onPriorityChange?: (taskId: string, priority: Task['priority']) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  className?: string;
  actions?: React.ReactNode;
  showActions?: boolean;
  showMeta?: boolean;
  showTags?: boolean;
  showDueDate?: boolean;
}

const getStatusDisplayName = (status: Task['status']): string => {
  const statusMap: Record<string, string> = {
    'TODO': 'To Do',
    'IN_PROGRESS': 'In Progress',
    'WAITING_FOR_REPLY': 'Waiting',
    'REVIEW': 'Review',
    'COMPLETED': 'Completed',
    'CANCELLED': 'Cancelled',
    'BLOCKED': 'Blocked',
    'DONE': 'Done',
    // Legacy mappings
    'todo': 'To Do',
    'in-progress': 'In Progress',
    'waiting': 'Waiting',
    'review': 'Review',
    'cancelled': 'Cancelled',
    'blocked': 'Blocked',
  };
  return statusMap[status] || status;
};

const getPriorityDisplayName = (priority: Task['priority']): string => {
  const priorityMap: Record<string, string> = {
    'LOW': 'Low',
    'MEDIUM': 'Medium',
    'HIGH': 'High',
    'CRITICAL': 'Critical',
    'URGENT': 'Urgent',
    // Legacy mappings
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'critical': 'Critical',
  };
  return priorityMap[priority] || priority;
};

const getDueDateStatus = (dueDate?: Date): 'overdue' | 'due-soon' | 'normal' => {
  if (!dueDate) return 'normal';
  
  const now = new Date();
  const diffTime = dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 2) return 'due-soon';
  return 'normal';
};

const isUrgent = (task: Task): boolean => {
  if (task.priority === 'CRITICAL' || task.priority === 'URGENT') return true;
  if (!task.dueDate) return false;
  return getDueDateStatus(new Date(task.dueDate)) === 'overdue';
};

const formatDueDate = (dueDate: Date): string => {
  const now = new Date();
  const diffTime = dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`;
  }
  
  if (diffDays === 0) {
    return 'Due today';
  }
  
  if (diffDays === 1) {
    return 'Due tomorrow';
  }
  
  if (diffDays <= 7) {
    return `Due in ${diffDays} days`;
  }
  
  return dueDate.toLocaleDateString();
};

export const UnifiedTaskCard: React.FC<UnifiedTaskCardProps> = ({
  task,
  variant = 'default',
  isSelected = false,
  isDisabled = false,
  isLoading = false,
  onSelect,
  onStatusChange,
  onPriorityChange: _onPriorityChange,
  onEdit,
  onDelete,
  className,
  actions,
  showActions = true,
  showMeta = true,
  showTags = true,
  showDueDate = true,
}) => {
  const dueDateStatus = task.dueDate ? getDueDateStatus(new Date(task.dueDate)) : 'normal';
  const urgent = isUrgent(task);
  
  const handleClick = () => {
    if (isDisabled || isLoading) return;
    onSelect?.(task);
  };
  
  const handleStatusChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDisabled || isLoading) return;
    
    // Cycle through statuses (simplified for demo)
    const statusOrder: Task['status'][] = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.COMPLETED];
    const currentIndex = statusOrder.indexOf(task.status);
    const nextIndex = (currentIndex + 1) % statusOrder.length;
    onStatusChange?.(task.id, statusOrder[nextIndex]);
  };
  
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDisabled || isLoading) return;
    onEdit?.(task);
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDisabled || isLoading) return;
    onDelete?.(task.id);
  };
  
  return (
    <div
      className={clsx(
        'unified-task-card',
        `task-card--priority-${task.priority}`,
        `task-card--status-${task.status}`,
        {
          [`unified-task-card--${variant}`]: variant !== 'default',
          'unified-task-card--selected': isSelected,
          'unified-task-card--disabled': isDisabled,
          'unified-task-card--loading': isLoading,
        },
        className
      )}
      onClick={handleClick}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect && !isDisabled ? 0 : undefined}
      aria-selected={isSelected}
      aria-disabled={isDisabled}
    >
      <div className="task-card__header">
        <h3 className="task-card__title">
          {task.title}
        </h3>
        
        {task.description && variant !== 'compact' && (
          <p className="task-card__description">
            {task.description}
          </p>
        )}
      </div>
      
      {showMeta && (
        <div className="task-card__meta">
          <div className={clsx(
            'task-card__status',
            `task-card__status--${task.status}`
          )}>
            <span>{getStatusDisplayName(task.status)}</span>
          </div>
          
          <span className="task-card__meta-separator" aria-hidden="true" />
          
          <div className="task-card__priority">
            <span>{getPriorityDisplayName(task.priority)}</span>
          </div>
          
          {task.assignedTo && (
            <>
              <span className="task-card__meta-separator" aria-hidden="true" />
              <div className="task-card__meta-item">
                <span>Assigned to {task.assignedTo}</span>
              </div>
            </>
          )}
          
          {showDueDate && task.dueDate && (
            <>
              <span className="task-card__meta-separator" aria-hidden="true" />
              <div className={clsx(
                'task-card__due-date',
                {
                  'task-card__due-date--overdue': dueDateStatus === 'overdue',
                  'task-card__due-date--due-soon': dueDateStatus === 'due-soon',
                  'task-card__due-date--urgent': urgent,
                }
              )}>
                <span>{formatDueDate(new Date(task.dueDate))}</span>
              </div>
            </>
          )}
        </div>
      )}
      
      {showTags && task.tags && task.tags.length > 0 && (
        <div className="task-card__tags">
          {task.tags.map((tag, index) => (
            <span key={index} className="task-card__tag">
              {tag}
            </span>
          ))}
        </div>
      )}
      
      {showActions && (actions || onEdit || onDelete || onStatusChange) && (
        <div className="task-card__actions">
          {actions}
          
          {onStatusChange && (
            <button
              type="button"
              className="task-card__action"
              onClick={handleStatusChange}
              title="Change status"
              aria-label={`Change status from ${getStatusDisplayName(task.status)}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.5 3.5L6 11l-3.5-3.5L1 9l5 5 9-9-1.5-1.5z" />
              </svg>
            </button>
          )}
          
          {onEdit && (
            <button
              type="button"
              className="task-card__action"
              onClick={handleEdit}
              title="Edit task"
              aria-label={`Edit task: ${task.title}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758L11.013 1.427z" />
              </svg>
            </button>
          )}
          
          {onDelete && (
            <button
              type="button"
              className="task-card__action"
              onClick={handleDelete}
              title="Delete task"
              aria-label={`Delete task: ${task.title}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149L10.844 13.5a.25.25 0 01-.249.219h-5.19a.25.25 0 01-.249-.219L4.496 6.675z" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default UnifiedTaskCard;