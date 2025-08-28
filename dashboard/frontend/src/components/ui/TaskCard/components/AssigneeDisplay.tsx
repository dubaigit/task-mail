import React from 'react';
import { Icons } from '../../icons';

interface AssigneeDisplayProps {
  assignee: string;
}

export const AssigneeDisplay: React.FC<AssigneeDisplayProps> = ({ assignee }) => {
  return (
    <div className="assignee">
      <Icons.user className="w-4 h-4" />
      <span>{assignee}</span>
    </div>
  );
};

AssigneeDisplay.displayName = 'AssigneeDisplay';