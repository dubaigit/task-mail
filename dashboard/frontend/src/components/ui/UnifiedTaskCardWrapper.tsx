import React from 'react';
import { UnifiedTaskCard } from './TaskCard';
import { LegacyUITaskCardProps } from './TaskCard/types';
import { Task } from '../../types/Task';
import { TaskStatus, TaskPriority, TaskCategory } from '../../types/core';

// Legacy wrapper for UI TaskCard (business layout)
export const UITaskCard: React.FC<LegacyUITaskCardProps> = React.memo(({
  task,
  onStatusChange,
  onPriorityChange,
  onClick
}) => {
  // Convert legacy task format to unified format
  const unifiedTask: Task = {
    id: task.id,
    title: task.taskTitle || task.title || task.subject || 'Untitled Task',
    description: task.taskDescription || task.description || task.snippet,
    priority: task.priority as TaskPriority,
    status: task.status === 'pending' ? TaskStatus.TODO :
            task.status === 'in-progress' ? TaskStatus.IN_PROGRESS :
            task.status === TaskStatus.COMPLETED ? TaskStatus.COMPLETED : TaskStatus.TODO,
    tags: task.tags || [],
    dueDate: undefined, // Business layout doesn't typically show due dates
    createdAt: task.createdAt || new Date(task.date || Date.now()),
    updatedAt: task.createdAt || new Date(task.date || Date.now()),
    estimatedTime: typeof task.estimatedTime === 'string' ? 
                   parseInt(task.estimatedTime.replace(/\D/g, '')) : undefined,
    assignedTo: undefined,
    aiConfidence: task.aiConfidence || task.confidence,
    classification: task.classification,
    // Required fields from core Task interface
    category: TaskCategory.NEEDS_REPLY,
    urgency: task.priority as TaskPriority,
    createdBy: 'System',
    sender: task.sender || 'Unknown',
    senderEmail: task.senderEmail || 'unknown@example.com',
    progress: 0,
    draftGenerated: task.draftGenerated || false
  };

  // Extend task with business-specific fields
  const businessTask = {
    ...unifiedTask,
    // Business-specific fields from original
    sender: task.sender,
    senderEmail: task.senderEmail,
    relatedEmails: task.relatedEmails,
    draftGenerated: task.draftGenerated,
    emailSubject: task.emailSubject,
    isTask: task.isTask,
    suggestedAction: task.suggestedAction
  };

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    const legacyStatus = status === TaskStatus.TODO ? 'pending' :
                        status === TaskStatus.IN_PROGRESS ? 'in-progress' :
                        status === TaskStatus.COMPLETED ? TaskStatus.COMPLETED : 'pending';
    onStatusChange?.(taskId, legacyStatus as any);
  };

  const handlePriorityChange = (taskId: string, priority: TaskPriority) => {
    onPriorityChange?.(taskId, priority as any);
  };

  return (
    <UnifiedTaskCard
      task={businessTask}
      variant="default"
      onSelect={onClick ? () => onClick(businessTask) : undefined}
      onStatusChange={handleStatusChange}
      onPriorityChange={handlePriorityChange}
    />
  );
});

UITaskCard.displayName = 'UITaskCard';

export type { LegacyUITaskCardProps as TaskCardProps, Task };
export default UITaskCard;