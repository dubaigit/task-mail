import { useState, useCallback, useMemo } from 'react';
import { Task } from '../../../../types/Task';
import { TaskCardConfig } from '../types';

export const useTaskCardState = (task: Task, config: TaskCardConfig) => {
  const [isExpanded, setIsExpanded] = useState(config.behavior.expandedByDefault || false);
  const [showActions, setShowActions] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    return Math.min(100, Math.max(0, task.estimatedTime ? 
      (task.actualTime || 0) / task.estimatedTime * 100 : 0));
  }, [task.estimatedTime, task.actualTime]);

  // Generate sender avatar initials
  const senderAvatar = useMemo(() => {
    const sender = (task as any).sender;
    if (!sender) return null;
    
    return sender
      .split(' ')
      .map((name: string) => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, [(task as any).sender]);

  // Display title logic
  const displayTitle = useMemo(() => {
    const t = task as any;
    return t.taskTitle || t.title || t.subject || 'Untitled Task';
  }, [task]);

  // Display description logic
  const displayDescription = useMemo(() => {
    const t = task as any;
    const description = t.taskDescription || t.description || t.snippet;
    const maxLength = config.limits.maxPreviewLength || 150;
    
    if (!description) return null;
    
    return description.length > maxLength
      ? `${description.slice(0, maxLength)}...`
      : description;
  }, [task, config.limits.maxPreviewLength]);

  // Toggle functions
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const toggleActions = useCallback(() => {
    setShowActions(prev => !prev);
  }, []);

  const startEditing = useCallback((field: string) => {
    setEditingField(field);
  }, []);

  const stopEditing = useCallback(() => {
    setEditingField(null);
  }, []);

  const setUpdating = useCallback((updating: boolean) => {
    setIsUpdating(updating);
  }, []);

  return {
    isExpanded,
    showActions,
    isUpdating,
    editingField,
    progressPercentage,
    senderAvatar,
    displayTitle,
    displayDescription,
    toggleExpanded,
    toggleActions,
    startEditing,
    stopEditing,
    setUpdating,
    setShowActions
  };
};