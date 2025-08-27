import React, { useState, useCallback } from 'react';
import { Task } from '../../../../types/Task';
import { TaskCardConfig } from '../types';
import { ProgressBar } from './ProgressBar';
import { EditableTitle } from './EditableTitle';
import { EditableDescription } from './EditableDescription';

interface TaskCardContentProps {
  task: Task;
  config: TaskCardConfig;
  displayTitle: string;
  displayDescription: string | null;
  progressPercentage: number;
  isEditing?: boolean;
  editingField?: string | null;
  onEdit?: (field: string, value: any) => void;
  onStartEditing?: (field: string) => void;
  onStopEditing?: () => void;
}

export const TaskCardContent: React.FC<TaskCardContentProps> = ({
  task,
  config,
  displayTitle,
  displayDescription,
  progressPercentage,
  isEditing = false,
  editingField,
  onEdit,
  onStartEditing,
  onStopEditing
}) => {
  const [editedValues, setEditedValues] = useState({
    title: displayTitle,
    description: displayDescription || ''
  });

  const handleSaveEdit = useCallback((field: string, value: string) => {
    onEdit?.(field, value);
    setEditedValues(prev => ({ ...prev, [field]: value }));
    onStopEditing?.();
  }, [onEdit, onStopEditing]);

  const handleCancelEdit = useCallback(() => {
    setEditedValues({
      title: displayTitle,
      description: displayDescription || ''
    });
    onStopEditing?.();
  }, [displayTitle, displayDescription, onStopEditing]);

  if (config.layout === 'business') {
    // Business layout content - centered and compact
    return (
      <div className="space-y-3 text-center">
        <h3 className="text-sm font-semibold text-slate-100 line-clamp-2 leading-relaxed overflow-hidden">
          {displayTitle}
        </h3>
        
        {/* Sender info for business layout */}
        {(task as any).sender && (
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
            <span className="truncate">{(task as any).sender}</span>
          </p>
        )}
        
        {/* Date info */}
        <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
          <span>
            {task.createdAt 
              ? new Date(task.createdAt).toLocaleDateString()
              : (task as any).date 
                ? new Date((task as any).date).toLocaleDateString()
                : 'Today'
            }
          </span>
        </p>
      </div>
    );
  }

  // Default/detailed layout content
  return (
    <div className="task-card-content">
      {/* Title */}
      {config.features.inlineEditing && editingField === 'title' ? (
        <EditableTitle
          value={editedValues.title}
          onChange={(value) => setEditedValues(prev => ({ ...prev, title: value }))}
          onSave={(value) => handleSaveEdit('title', value)}
          onCancel={handleCancelEdit}
        />
      ) : (
        <h3 
          className="task-title"
          onClick={() => config.features.inlineEditing && onStartEditing?.('title')}
        >
          {displayTitle}
        </h3>
      )}

      {/* Description */}
      {displayDescription && (
        <div className="task-description-container">
          {config.features.inlineEditing && editingField === 'description' ? (
            <EditableDescription
              value={editedValues.description}
              onChange={(value) => setEditedValues(prev => ({ ...prev, description: value }))}
              onSave={(value) => handleSaveEdit('description', value)}
              onCancel={handleCancelEdit}
              maxLength={config.limits.characterLimit}
            />
          ) : (
            <p 
              className="task-description"
              onClick={() => config.features.inlineEditing && onStartEditing?.('description')}
            >
              {displayDescription}
            </p>
          )}
        </div>
      )}

      {/* Progress Bar */}
      {config.features.progressBar && progressPercentage > 0 && (
        <ProgressBar
          progress={progressPercentage}
          priority={task.priority}
          config={config}
        />
      )}
    </div>
  );
};

TaskCardContent.displayName = 'TaskCardContent';