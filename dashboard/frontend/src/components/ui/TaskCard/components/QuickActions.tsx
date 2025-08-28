import React from 'react';
import { Task } from '../../../../types/Task';
import { TaskStatus } from '../../../../types/core';
import { TaskCardConfig } from '../types';
import { PlayIcon, PauseIcon, CheckCircleIcon, EllipsisHorizontalIcon } from '../../icons';

interface QuickActionsProps {
  task: Task;
  onAction: (action: string) => void;
  config: TaskCardConfig;
  disabled?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  task,
  onAction,
  config,
  disabled = false
}) => {
  const actions = [];
  
  if (task.status === TaskStatus.TODO) {
    actions.push(
      <button
        key="start"
        onClick={(e) => {
          e.stopPropagation();
          onAction('start');
        }}
        className="quick-action-button start"
        title="Start task"
        disabled={disabled}
        aria-label="Start task"
      >
        <PlayIcon className="w-4 h-4" />
      </button>
    );
  }
  
  if (task.status === TaskStatus.IN_PROGRESS) {
    actions.push(
      <button
        key="pause"
        onClick={(e) => {
          e.stopPropagation();
          onAction('pause');
        }}
        className="quick-action-button pause"
        title="Pause task"
        disabled={disabled}
        aria-label="Pause task"
      >
        <PauseIcon className="w-4 h-4" />
      </button>
    );
  }
  
  if (task.status !== TaskStatus.COMPLETED) {
    actions.push(
      <button
        key="complete"
        onClick={(e) => {
          e.stopPropagation();
          onAction('complete');
        }}
        className="quick-action-button complete"
        title="Mark as complete"
        disabled={disabled}
        aria-label="Complete task"
      >
        <CheckCircleIcon className="w-4 h-4" />
      </button>
    );
  }
  
  if (config.features.expandableActions) {
    actions.push(
      <button
        key="more"
        onClick={(e) => {
          e.stopPropagation();
          onAction('more');
        }}
        className="quick-action-button more"
        title="More actions"
        aria-label="More actions"
      >
        <EllipsisHorizontalIcon className="w-4 h-4" />
      </button>
    );
  }
  
  return (
    <div className="task-card-actions">
      {actions}
    </div>
  );
};

QuickActions.displayName = 'QuickActions';