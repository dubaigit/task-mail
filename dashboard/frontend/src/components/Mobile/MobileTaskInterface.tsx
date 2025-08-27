import React, { useState, useCallback } from 'react';
import { useTheme } from '../../App';
import { 
  Icons,
  ExclamationTriangleIcon,
  ArrowRightIcon
} from '../ui/icons';
import BottomNavigation from './BottomNavigation';
import MobileTaskList from './MobileTaskList';

import { Task, TaskStatus } from '../../types';

interface Email {
  id: number;
  subject: string;
  sender: string;
  date: string;
  classification: string;
  urgency: string;
}

interface MobileTaskInterfaceProps {
  tasks: Task[];
  emails: Email[];
  onTaskComplete: (taskId: string) => void;
  onTaskDelegate: (taskId: string, assignee: string) => void;
  onTaskEdit: (task: Task) => void;
  onTaskCreate: (emailId: number) => void;
  onRefresh: () => Promise<void>;
  isOffline?: boolean;
}

const MobileTaskInterface: React.FC<MobileTaskInterfaceProps> = ({
  tasks,
  emails,
  onTaskComplete,
  onTaskDelegate,
  onTaskEdit,
  onTaskCreate,
  onRefresh,
  isOffline = false
}) => {
  const { isDark } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Handle task operations with proper type conversion
  const handleTaskUpdate = useCallback((id: string, updates: Partial<Task>) => {
    if (updates.status === TaskStatus.COMPLETED) {
      onTaskComplete(id);
    }
    // Additional update logic could go here
  }, [onTaskComplete]);

  const handleTaskDelete = useCallback((id: string) => {
    // For now, we'll handle this as marking completed
    // In a full implementation, you'd want a proper delete callback
    onTaskComplete(id);
  }, [onTaskComplete]);

  const handleTaskAdd = useCallback((task: Partial<Task>) => {
    // For now, we'll use the existing onTaskCreate with a dummy email ID
    // In a full implementation, you'd want a proper task creation callback
    onTaskCreate(0);
  }, [onTaskCreate]);

  // Handle refresh with proper error handling
  const handleRefresh = useCallback(async () => {
    if (isOffline || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
      setLastRefresh(new Date());
    } catch (error) {
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isOffline, isRefreshing]);

  // Convert legacy task format to new format for compatibility
  const convertedTasks: Task[] = tasks.map(task => ({
    ...task,
    id: task.id.toString(), // Convert number id to string
    dueDate: task.dueDate,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    sender: task.sender || '',
    tags: task.category ? [task.category] : [],
    description: task.description || ''
  }));

  return (
    <div className="mobile-task-interface h-full flex flex-col bg-background">
      {/* Header with offline status */}
      <div className="flex-shrink-0 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Tasks</h1>
          <div className="flex items-center gap-2">
            {isOffline && (
              <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                <ExclamationTriangleIcon className="w-4 h-4" />
                <span className="text-sm">Offline</span>
              </div>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isOffline}
              className="touch-target p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
              aria-label="Refresh tasks"
            >
              <ArrowRightIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Task List - Delegating to the comprehensive component */}
      <div className="flex-1 overflow-hidden">
        <MobileTaskList
          tasks={convertedTasks}
          onTaskUpdate={handleTaskUpdate}
          onTaskDelete={handleTaskDelete}
          onTaskAdd={handleTaskAdd}
          isOffline={isOffline}
        />
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation 
        currentView="tasks"
        onViewChange={() => {}}
        taskCount={tasks.length}
        unreadCount={emails.filter(e => !e.classification.includes('READ')).length}
      />
    </div>
  );
};

export default MobileTaskInterface;
