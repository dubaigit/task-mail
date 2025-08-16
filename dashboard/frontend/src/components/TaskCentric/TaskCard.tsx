import React, { useState, useCallback, useMemo } from 'react';
import {
  TaskCardProps,
  TaskItem,
  TaskCentricEmail,
  TaskUrgencyLevel,
  TaskStatus
} from './types';
import {
  ClockIcon,
  UserIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon,
  EllipsisHorizontalIcon,
  TagIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  DocumentTextIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import {
  ExclamationTriangleIcon as ExclamationTriangleSolidIcon,
  FireIcon,
  BoltIcon
} from '@heroicons/react/24/solid';

/**
 * TaskCard - Individual task card component with visual urgency indicators
 * 
 * BRIEF_RATIONALE: Implements whitepaper-specified task card design with sender
 * identification, action summary, urgency indicators, deadlines, and quick actions.
 * Provides compact and expanded views with color-coded urgency levels and progress tracking.
 * 
 * ASSUMPTIONS:
 * - Tasks contain AI-generated summaries and action items from email content
 * - Urgency levels follow CRITICAL/HIGH/MEDIUM/LOW hierarchy with color coding
 * - Progress tracking supports 0-100% completion with visual indicators
 * - Quick actions enable rapid task state changes without detail navigation
 * 
 * DECISION_LOG:
 * - Used card-based design pattern from whitepaper specifications
 * - Implemented urgency color coding: Red (CRITICAL), Orange (HIGH), Blue (MEDIUM), Gray (LOW)
 * - Added hover states and micro-interactions for enhanced UX
 * - Included keyboard navigation support for accessibility compliance
 * 
 * EVIDENCE: Based on whitepaper task card requirements and visual hierarchy
 * specifications for rapid task scanning and processing workflows.
 */

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  email,
  isSelected,
  onClick,
  onUpdate,
  onComplete,
  onDelete,
  config,
  className = ''
}) => {
  // Local state for interactions
  const [isExpanded, setIsExpanded] = useState(config.expandedByDefault);
  const [showActions, setShowActions] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Urgency styling and icons
  const urgencyConfig = useMemo(() => {
    const configs = {
      CRITICAL: {
        color: '#DC2626', // red-600
        bgColor: '#FEE2E2', // red-100
        darkBgColor: '#7F1D1D', // red-900
        icon: FireIcon,
        label: 'Critical',
        pulse: true
      },
      HIGH: {
        color: '#EA580C', // orange-600
        bgColor: '#FED7AA', // orange-100
        darkBgColor: '#9A3412', // orange-900
        icon: ExclamationTriangleSolidIcon,
        label: 'High',
        pulse: false
      },
      MEDIUM: {
        color: '#2563EB', // blue-600
        bgColor: '#DBEAFE', // blue-100
        darkBgColor: '#1E3A8A', // blue-900
        icon: BoltIcon,
        label: 'Medium',
        pulse: false
      },
      LOW: {
        color: '#6B7280', // gray-500
        bgColor: '#F3F4F6', // gray-100
        darkBgColor: '#374151', // gray-700
        icon: ClockIcon,
        label: 'Low',
        pulse: false
      }
    };
    return configs[task.urgency] || configs.LOW;
  }, [task.urgency]);

  // Status styling and icons
  const statusConfig = useMemo(() => {
    const configs = {
      PENDING: {
        color: '#D97706', // amber-600
        bgColor: '#FEF3C7', // amber-100
        icon: ClockIcon,
        label: 'Pending'
      },
      IN_PROGRESS: {
        color: '#059669', // emerald-600
        bgColor: '#D1FAE5', // emerald-100
        icon: PlayIcon,
        label: 'In Progress'
      },
      WAITING: {
        color: '#7C3AED', // violet-600
        bgColor: '#EDE9FE', // violet-100
        icon: PauseIcon,
        label: 'Waiting'
      },
      COMPLETED: {
        color: '#059669', // emerald-600
        bgColor: '#D1FAE5', // emerald-100
        icon: CheckCircleIcon,
        label: 'Completed'
      },
      CANCELLED: {
        color: '#6B7280', // gray-500
        bgColor: '#F3F4F6', // gray-100
        icon: TrashIcon,
        label: 'Cancelled'
      }
    };
    return configs[task.status] || configs.PENDING;
  }, [task.status]);

  // Category icons
  const categoryIcon = useMemo(() => {
    const icons = {
      NEEDS_REPLY: ChatBubbleLeftRightIcon,
      APPROVAL_REQUIRED: CheckCircleIcon,
      DELEGATE: UserGroupIcon,
      DO_MYSELF: UserIcon,
      ASSIGN: UserGroupIcon,
      FOLLOW_UP: ClockIcon,
      FYI_ONLY: DocumentTextIcon,
      MEETING_REQUEST: CalendarDaysIcon,
      RESEARCH: DocumentTextIcon,
      ADMINISTRATIVE: DocumentTextIcon
    };
    return icons[task.category] || DocumentTextIcon;
  }, [task.category]);

  // Format due date
  const formattedDueDate = useMemo(() => {
    if (!task.dueDate) return null;
    
    const dueDate = new Date(task.dueDate);
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return {
        text: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`,
        isOverdue: true,
        color: urgencyConfig.color
      };
    } else if (diffDays === 0) {
      return {
        text: 'Due today',
        isToday: true,
        color: '#EA580C' // orange-600
      };
    } else if (diffDays === 1) {
      return {
        text: 'Due tomorrow',
        isUpcoming: true,
        color: '#D97706' // amber-600
      };
    } else {
      return {
        text: `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`,
        isUpcoming: true,
        color: '#6B7280' // gray-500
      };
    }
  }, [task.dueDate, urgencyConfig.color]);

  // Sender avatar or initials
  const senderAvatar = useMemo(() => {
    if (!email?.sender) return null;
    
    const initials = email.sender
      .split(' ')
      .map(name => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
    
    return initials;
  }, [email?.sender]);

  // Handle quick actions
  const handleQuickAction = useCallback(async (action: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setIsUpdating(true);
    
    try {
      switch (action) {
        case 'complete':
          await onComplete(task.id);
          break;
        case 'start':
          const updatedTask = { ...task, status: 'IN_PROGRESS' as TaskStatus };
          await onUpdate(updatedTask);
          break;
        case 'pause':
          const pausedTask = { ...task, status: 'WAITING' as TaskStatus };
          await onUpdate(pausedTask);
          break;
        case 'delete':
          await onDelete(task.id);
          break;
      }
    } catch (error) {
      console.error('Quick action failed:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [task, onComplete, onUpdate, onDelete]);

  // Handle card click
  const handleCardClick = useCallback((event: React.MouseEvent) => {
    // Don't trigger if clicking on action buttons
    if ((event.target as HTMLElement).closest('.task-card-actions')) {
      return;
    }
    onClick(task);
  }, [onClick, task]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        onClick(task);
        break;
      case 'c':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          handleQuickAction('complete', event as any);
        }
        break;
      case 'd':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          handleQuickAction('delete', event as any);
        }
        break;
    }
  }, [onClick, task, handleQuickAction]);

  // Progress percentage for visual indicator
  const progressPercentage = Math.min(100, Math.max(0, task.progress));

  // Render quick actions based on task status
  const renderQuickActions = () => {
    const actions = [];
    
    if (task.status === 'PENDING') {
      actions.push(
        <button
          key="start"
          onClick={(e) => handleQuickAction('start', e)}
          className="quick-action-button start"
          title="Start task"
          disabled={isUpdating}
        >
          <PlayIcon className="w-4 h-4" />
        </button>
      );
    }
    
    if (task.status === 'IN_PROGRESS') {
      actions.push(
        <button
          key="pause"
          onClick={(e) => handleQuickAction('pause', e)}
          className="quick-action-button pause"
          title="Pause task"
          disabled={isUpdating}
        >
          <PauseIcon className="w-4 h-4" />
        </button>
      );
    }
    
    if (task.status !== 'COMPLETED') {
      actions.push(
        <button
          key="complete"
          onClick={(e) => handleQuickAction('complete', e)}
          className="quick-action-button complete"
          title="Mark as complete"
          disabled={isUpdating}
        >
          <CheckCircleIcon className="w-4 h-4" />
        </button>
      );
    }
    
    actions.push(
      <button
        key="more"
        onClick={(e) => {
          e.stopPropagation();
          setShowActions(!showActions);
        }}
        className="quick-action-button more"
        title="More actions"
      >
        <EllipsisHorizontalIcon className="w-4 h-4" />
      </button>
    );
    
    return actions;
  };

  return (
    <div
      className={`task-card ${isSelected ? 'selected' : ''} ${className}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Task: ${task.title}. ${task.urgency} urgency. Status: ${task.status}. ${formattedDueDate?.text || ''}`}
      style={{
        borderLeftColor: urgencyConfig.color,
        borderLeftWidth: '4px'
      }}
    >
      {/* Urgency indicator pulse for critical tasks */}
      {urgencyConfig.pulse && (
        <div 
          className="urgency-pulse"
          style={{ backgroundColor: urgencyConfig.color }}
        />
      )}

      {/* Card Header */}
      <div className="task-card-header">
        <div className="task-card-meta">
          {/* Sender Avatar */}
          {config.showAvatar && senderAvatar && (
            <div 
              className="sender-avatar"
              style={{ backgroundColor: urgencyConfig.color }}
            >
              {senderAvatar}
            </div>
          )}

          {/* Category Icon */}
          <div className="category-icon">
            {React.createElement(categoryIcon, { 
              className: "w-4 h-4",
              style: { color: urgencyConfig.color }
            })}
          </div>

          {/* Urgency Badge */}
          {config.showUrgencyIndicator && (
            <div 
              className="urgency-badge"
              style={{
                backgroundColor: urgencyConfig.bgColor,
                color: urgencyConfig.color
              }}
            >
              {React.createElement(urgencyConfig.icon, { className: "w-3 h-3" })}
              <span>{urgencyConfig.label}</span>
            </div>
          )}

          {/* Timestamp */}
          <span className="task-timestamp">
            {new Date(task.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Quick Actions */}
        {config.enableQuickActions && (
          <div className="task-card-actions">
            {renderQuickActions()}
          </div>
        )}
      </div>

      {/* Task Title */}
      <h3 className="task-title">{task.title}</h3>

      {/* Task Description */}
      {config.showPreview && task.description && (
        <p className="task-description">
          {task.description.length > config.maxPreviewLength
            ? `${task.description.slice(0, config.maxPreviewLength)}...`
            : task.description
          }
        </p>
      )}

      {/* Progress Bar */}
      {config.showProgress && task.progress > 0 && (
        <div className="progress-container">
          <div 
            className="progress-bar"
            style={{
              width: `${progressPercentage}%`,
              backgroundColor: urgencyConfig.color
            }}
          />
          <span className="progress-text">{progressPercentage}%</span>
        </div>
      )}

      {/* Card Footer */}
      <div className="task-card-footer">
        {/* Status Badge */}
        <div 
          className="status-badge"
          style={{
            backgroundColor: statusConfig.bgColor,
            color: statusConfig.color
          }}
        >
          {React.createElement(statusConfig.icon, { className: "w-3 h-3" })}
          <span>{statusConfig.label}</span>
        </div>

        {/* Due Date */}
        {config.showDueDate && formattedDueDate && (
          <div 
            className={`due-date ${formattedDueDate.isOverdue ? 'overdue' : ''}`}
            style={{ color: formattedDueDate.color }}
          >
            <CalendarDaysIcon className="w-4 h-4" />
            <span>{formattedDueDate.text}</span>
          </div>
        )}

        {/* Assignee */}
        {config.showAssignee && task.assignedTo && (
          <div className="assignee">
            <UserIcon className="w-4 h-4" />
            <span>{task.assignedTo}</span>
          </div>
        )}

        {/* Tags */}
        {config.showTags && task.tags && task.tags.length > 0 && (
          <div className="task-tags">
            {task.tags.slice(0, 3).map((tag, index) => (
              <span key={index} className="task-tag">
                <TagIcon className="w-3 h-3" />
                {tag}
              </span>
            ))}
            {task.tags.length > 3 && (
              <span className="task-tag-more">+{task.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Related Email Link */}
        {email && (
          <button
            className="email-link"
            onClick={(e) => {
              e.stopPropagation();
              // Handle email view navigation
            }}
            title="View related email"
          >
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expanded Actions Menu */}
      {showActions && (
        <div className="expanded-actions">
          <button
            onClick={(e) => handleQuickAction('delete', e)}
            className="action-button delete"
            disabled={isUpdating}
          >
            <TrashIcon className="w-4 h-4" />
            Delete Task
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {isUpdating && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      )}
    </div>
  );
};

export default React.memo(TaskCard);