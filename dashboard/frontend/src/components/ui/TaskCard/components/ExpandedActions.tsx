import React from 'react';
import { Task } from '../../../../types/Task';
import { Icons } from '../../icons';

interface ExpandedActionsProps {
  task: Task;
  onAction: (action: string) => void;
  onClose: () => void;
  disabled?: boolean;
}

export const ExpandedActions: React.FC<ExpandedActionsProps> = ({
  task,
  onAction,
  onClose,
  disabled = false
}) => {
  return (
    <div className="expanded-actions">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAction('delete');
          onClose();
        }}
        className="action-button delete"
        disabled={disabled}
        aria-label="Delete task"
      >
        <Icons.trash className="w-4 h-4" />
        Delete Task
      </button>
    </div>
  );
};

ExpandedActions.displayName = 'ExpandedActions';