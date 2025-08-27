import React from 'react';
import { Task } from '../../../../types/Task';
import { TaskCardConfig } from '../types';
import { formatRelativeTime } from '../utils/dateHelpers';

interface TaskMetadataProps {
  task: Task;
  config: TaskCardConfig;
}

export const TaskMetadata: React.FC<TaskMetadataProps> = ({ task, config }) => {
  return (
    <div className="task-metadata">
      <div className="metadata-item">
        <span className="metadata-label">Created:</span>
        <span className="metadata-value">{formatRelativeTime(task.createdAt)}</span>
      </div>
      {task.updatedAt && task.updatedAt !== task.createdAt && (
        <div className="metadata-item">
          <span className="metadata-label">Updated:</span>
          <span className="metadata-value">{formatRelativeTime(task.updatedAt)}</span>
        </div>
      )}
      {task.estimatedTime && (
        <div className="metadata-item">
          <span className="metadata-label">Est. Time:</span>
          <span className="metadata-value">{task.estimatedTime}h</span>
        </div>
      )}
    </div>
  );
};

TaskMetadata.displayName = 'TaskMetadata';