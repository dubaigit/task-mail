import React from 'react';
import { UnifiedTaskCard } from '../ui/TaskCard';
import { LegacyTaskManagementProps } from '../ui/TaskCard/types';
import { Task, TaskStatus, TaskPriority } from '../../types/Task';

// Legacy wrapper for TaskManagement TaskCard
export const TaskManagementCard: React.FC<LegacyTaskManagementProps> = ({
  task,
  onUpdate,
  onDelete,
  index,
  isSelected,
  onSelect
}) => {
  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    const updatedTask = { ...task, status, updatedAt: new Date().toISOString() };
    onUpdate(updatedTask);
  };

  const handlePriorityChange = (taskId: string, priority: TaskPriority) => {
    const updatedTask = { ...task, priority, updatedAt: new Date().toISOString() };
    onUpdate(updatedTask);
  };

  const handleUpdate = async (task: Task) => {
    onUpdate(task);
  };

  const handleDelete = async (taskId: string) => {
    onDelete(taskId);
  };

  const handleClick = (task: Task) => {
    onSelect?.(task.id);
  };

  return (
    <UnifiedTaskCard
      task={task}
      variant="default"
      isSelected={isSelected}
      onSelect={handleClick}
      onEdit={handleUpdate}
      onDelete={handleDelete}
      onStatusChange={handleStatusChange}
      onPriorityChange={handlePriorityChange}
    />
  );
};

export default TaskManagementCard;