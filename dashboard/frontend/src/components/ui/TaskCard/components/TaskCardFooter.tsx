import React from 'react';
import { Task, TaskStatus, TaskPriority } from '../../../../types/Task';
import { TaskCardConfig, TaskCentricEmail } from '../types';
import { StatusBadge } from './StatusBadge';
import { DueDateDisplay } from './DueDateDisplay';
import { AssigneeDisplay } from './AssigneeDisplay';
import { TagsList } from './TagsList';
import { TaskMetadata } from './TaskMetadata';
import { EmailLink } from './EmailLink';
import { BusinessMetrics } from './BusinessMetrics';

interface TaskCardFooterProps {
  task: Task;
  config: TaskCardConfig;
  email?: TaskCentricEmail;
  onEmailLink?: () => void;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  onPriorityChange?: (taskId: string, priority: TaskPriority) => void;
  isEditing?: boolean;
}

export const TaskCardFooter: React.FC<TaskCardFooterProps> = ({
  task,
  config,
  email,
  onEmailLink,
  onStatusChange,
  onPriorityChange,
  isEditing = false
}) => {
  const taskAny = task as any;

  if (config.layout === 'business') {
    return (
      <>
        {/* Business Metrics Row */}
        {(config.features.relatedEmailsCount || config.features.aiConfidence || 
          config.features.estimatedTime || config.features.draftStatus) && (
          <BusinessMetrics task={taskAny} config={config} />
        )}
        
        {/* Tags for Business Layout */}
        {config.features.tags && taskAny.tags && taskAny.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 justify-center">
            <span className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-300 rounded-md">
              {taskAny.tags[0]}
            </span>
            {taskAny.tags.length > 1 && (
              <span className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded-md">
                +{taskAny.tags.length - 1}
              </span>
            )}
          </div>
        )}
      </>
    );
  }

  // Default/detailed layout footer
  return (
    <div className="task-card-footer">
      {/* Status and Priority Controls for Management Layout */}
      {config.layout === 'detailed' && config.features.inlineEditing && !isEditing && (
        <div className="flex items-center space-x-2 mb-2">
          <select
            value={task.status}
            onChange={(e) => onStatusChange?.(task.id, e.target.value as TaskStatus)}
            className="px-2 py-1 rounded-full text-xs font-medium border-0 focus:ring-2 focus:ring-blue-500"
            aria-label="Change task status"
          >
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={task.priority}
            onChange={(e) => onPriorityChange?.(task.id, e.target.value as TaskPriority)}
            className="px-2 py-1 rounded text-xs font-medium border border-gray-300 focus:ring-2 focus:ring-blue-500"
            aria-label="Change task priority"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Status Badge */}
          {config.features.statusBadge && (
            <StatusBadge text={task.status} />
          )}

          {/* Due Date */}
          {config.features.dueDate && task.dueDate && (
            <DueDateDisplay 
              dueDate={task.dueDate}
              priority={task.priority}
              config={config}
            />
          )}

          {/* Assignee */}
          {config.features.assignee && task.assignedTo && (
            <AssigneeDisplay assignee={task.assignedTo} />
          )}

          {/* Related Email Link */}
          {config.features.relatedEmailLink && email && (
            <EmailLink email={email} onClick={onEmailLink} />
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Metadata */}
          {config.features.metadata && (
            <TaskMetadata task={task} config={config} />
          )}
        </div>
      </div>

      {/* Tags */}
      {config.features.tags && task.tags && task.tags.length > 0 && (
        <TagsList 
          tags={task.tags} 
          maxShown={config.limits.maxTagsShown || 3}
        />
      )}
    </div>
  );
};

TaskCardFooter.displayName = 'TaskCardFooter';