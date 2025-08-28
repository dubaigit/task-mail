import React from 'react';
import { UnifiedTaskCard } from '../ui/UnifiedTaskCard';
import { LegacyTaskCentricProps } from '../ui/TaskCard/types';
import { Task, TaskStatus, TaskPriority } from '../../types/core';

// Legacy wrapper for TaskCentric TaskCard
export const TaskCentricCard: React.FC<LegacyTaskCentricProps> = ({
  task,
  email,
  isSelected,
  onClick,
  onUpdate,
  onComplete,
  onDelete,
  config,
  className
}) => {
  // Convert legacy task format to unified Task interface
  const unifiedTask: Task = {
    id: task.id.toString(),
    title: task.title,
    description: task.description,
    priority: task.urgency === TaskPriority.CRITICAL ? TaskPriority.URGENT : 
              task.urgency === 'HIGH' ? TaskPriority.HIGH :
              task.urgency === 'MEDIUM' ? TaskPriority.MEDIUM : TaskPriority.LOW,
    status: task.status === 'PENDING' ? TaskStatus.TODO :
            task.status === 'IN_PROGRESS' ? TaskStatus.IN_PROGRESS :
            task.status === 'WAITING_FOR_REPLY' ? TaskStatus.WAITING_FOR_REPLY :
            task.status === TaskStatus.COMPLETED ? TaskStatus.COMPLETED : TaskStatus.CANCELLED,
    tags: task.tags || [],
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : undefined,
    createdAt: new Date(task.createdAt).toISOString(),
    updatedAt: new Date(task.updatedAt || task.createdAt).toISOString(),
    completedAt: task.completedAt ? new Date(task.completedAt).toISOString() : undefined,
    estimatedTime: task.estimatedTime,
    actualTime: task.actualTime,
    assignedTo: task.assignedTo,
    createdFromMessageId: task.createdFromMessageId,
    aiConfidence: task.aiConfidence,
    classification: task.classification,
    category: task.category || 'DO_MYSELF',
    urgency: task.urgency,
    createdBy: 'System',
    sender: email?.sender || 'Unknown',
    senderEmail: email?.senderEmail || 'unknown@example.com',
    progress: 0,
    draftGenerated: false
  };

  // Convert legacy handlers
  const handleUpdate = async (updatedTask: Task) => {
    const legacyTask = {
      ...task,
      title: updatedTask.title,
      description: updatedTask.description,
      status: updatedTask.status === TaskStatus.TODO ? 'PENDING' :
              updatedTask.status === TaskStatus.IN_PROGRESS ? 'IN_PROGRESS' :
              updatedTask.status === TaskStatus.COMPLETED ? TaskStatus.COMPLETED : 'CANCELLED',
      urgency: updatedTask.priority === TaskPriority.URGENT ? TaskPriority.CRITICAL :
               updatedTask.priority === TaskPriority.HIGH ? 'HIGH' :
               updatedTask.priority === TaskPriority.MEDIUM ? 'MEDIUM' : 'LOW',
      updatedAt: updatedTask.updatedAt
    };
    onUpdate(legacyTask);
  };

  return (
    <UnifiedTaskCard
      task={unifiedTask}
      variant="default"
      isSelected={isSelected}
      onSelect={onClick}
      onEdit={handleUpdate}
      onDelete={async (taskId) => onDelete(taskId)}
      className={className}
    />
  );
};

export default React.memo(TaskCentricCard);