import React from 'react';
import { Icons } from '../../icons';
import { TaskPriority } from '../../../../types/Task';
import { TaskCardConfig } from '../types';
import { formatDueDate } from '../utils/dateHelpers';
import { getUrgencyConfig } from '../utils/styling';

interface DueDateDisplayProps {
  dueDate: Date | string;
  priority: TaskPriority;
  config: TaskCardConfig;
}

export const DueDateDisplay: React.FC<DueDateDisplayProps> = ({
  dueDate,
  priority,
  config
}) => {
  const urgencyConfig = getUrgencyConfig(priority, config.visual);
  const formattedDueDate = formatDueDate(dueDate, urgencyConfig.color);

  if (!formattedDueDate) return null;

  return (
    <div 
      className={`due-date ${formattedDueDate.isOverdue ? 'overdue' : ''}`}
      style={{ color: formattedDueDate.color }}
    >
      <Icons.calendarDays className="w-4 h-4" />
      <span>{formattedDueDate.text}</span>
    </div>
  );
};

DueDateDisplay.displayName = 'DueDateDisplay';