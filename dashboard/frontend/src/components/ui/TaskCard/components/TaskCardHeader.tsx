import React from 'react';
import { Task } from '../../../../types/Task';
import { TaskPriority, TaskStatus } from '../../../../types/core';
import { TaskCardConfig, TaskCentricEmail } from '../types';
import { cn, getUrgencyConfig, getCategoryIcon } from '../utils/styling';
import { QuickActions } from './QuickActions';
import { UrgencyBadge } from './UrgencyBadge';
import { ImportanceScore } from './ImportanceScore';

interface TaskCardHeaderProps {
  task: Task;
  config: TaskCardConfig;
  email?: TaskCentricEmail;
  senderAvatar?: string | null;
  onToggleExpanded?: () => void;
  onQuickAction?: (action: string) => void;
  isExpanded?: boolean;
  showQuickActions?: boolean;
  importanceScore?: number;
}

export const TaskCardHeader: React.FC<TaskCardHeaderProps> = ({
  task,
  config,
  email,
  senderAvatar,
  onToggleExpanded,
  onQuickAction,
  isExpanded,
  showQuickActions,
  importanceScore = 0
}) => {
  const urgencyConfig = getUrgencyConfig(task.priority, config.visual);
  const categoryIcon = getCategoryIcon((task as any).category || 'DEFAULT');
  const CategoryIcon = categoryIcon;

  if (config.layout === 'business') {
    // Business layout header
    return (
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Status Icon */}
          <div className={cn(
            "w-4 h-4 flex-shrink-0",
            task.status === TaskStatus.COMPLETED ? 'text-emerald-400' : 'text-slate-300'
          )}>
            {React.createElement(urgencyConfig.icon, { className: "w-4 h-4" })}
          </div>
          
          {/* Priority Badge */}
          {config.features.urgencyIndicator && (
            <span className={`text-xs font-medium px-2 py-1 rounded-md bg-slate-900/40 flex-shrink-0`}>
              {task.priority.toUpperCase()}
            </span>
          )}
          
          {/* Classification Badge */}
          {(task as any).classification && (
            <span className="text-xs font-medium px-2 py-1 rounded-md text-slate-300 bg-slate-900/40 truncate">
              {(task as any).classification.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        
        {/* Importance Score */}
        {config.features.importanceScore && (
          <ImportanceScore score={importanceScore} />
        )}
      </div>
    );
  }

  // Default/detailed layout header
  return (
    <div className="task-card-header">
      <div className="task-card-meta">
        {/* Sender Avatar */}
        {config.features.avatar && senderAvatar && (
          <div 
            className="sender-avatar"
            style={{ backgroundColor: urgencyConfig.color }}
          >
            {senderAvatar}
          </div>
        )}

        {/* Category Icon */}
        <div className="category-icon">
          <CategoryIcon 
            className="w-4 h-4"
            style={{ color: urgencyConfig.color }}
          />
        </div>

        {/* Urgency Badge */}
        {config.features.urgencyIndicator && (
          <UrgencyBadge
            urgencyConfig={urgencyConfig}
            priority={task.priority}
            urgencySystem={config.visual.urgencySystem}
          />
        )}

        {/* Timestamp */}
        <span className="task-timestamp">
          {new Date(task.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Quick Actions */}
      {config.features.quickActions && showQuickActions && onQuickAction && (
        <QuickActions
          task={task}
          onAction={onQuickAction}
          config={config}
        />
      )}
    </div>
  );
};

TaskCardHeader.displayName = 'TaskCardHeader';