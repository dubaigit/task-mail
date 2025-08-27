"use client";

import React, { useState, useEffect } from 'react';
import { FocusTrap } from '../ui/accessibility';
import { BGPattern } from '../ui/BGPattern';
import { EmailPopup } from '../ui/EmailPopup';
import { GlassCard, BentoGrid } from '../ui/DarkModeSystem';
import { Task as UnifiedTask, TaskStatus, TaskPriority, TaskCategory } from '../../types/core';

// Extracted components
import { TaskFilters } from './components/TaskFilters';
import { TaskColumns } from './components/TaskColumns';
import { TaskSidebar } from './components/TaskSidebar';

// Custom hooks
import { useTasks } from '../../hooks/useTasks';
import { useTaskFilters } from '../../hooks/useTaskFilters';
import { useAccessibility } from '../../hooks/useAccessibility';
import { usePerformanceTracking } from '../../hooks/usePerformanceTracking';

// Store integration
import { useTaskStore } from '../../stores/taskStore';

// Legacy Task interface for backward compatibility
interface LegacyTask {
  id: string;
  title?: string;
  taskTitle?: string;
  subject?: string;
  description?: string;
  taskDescription?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | TaskStatus.COMPLETED;
  aiConfidence?: number;
  confidence?: number;
  draftGenerated: boolean;
  emailSubject?: string;
  sender: string;
  senderEmail: string;
  estimatedTime: string;
  tags: string[];
  relatedEmails: number;
  createdAt?: Date;
  date?: string;
  isTask?: boolean;
  snippet?: string;
  suggestedAction?: string;
  classification?: string;
}

// Helper function to convert legacy task to unified task (REMOVED PERFORMANCE ISSUE)
const convertToUnifiedTask = (legacyTask: LegacyTask): UnifiedTask => {
  const displayTitle = legacyTask.taskTitle || legacyTask.title || legacyTask.subject || 'Untitled Task';
  const displayDescription = legacyTask.taskDescription || legacyTask.description || legacyTask.snippet || '';
  
  // Map legacy priority to unified priority
  const priorityMap: Record<string, TaskPriority> = {
    'low': TaskPriority.LOW,
    'medium': TaskPriority.MEDIUM,
    'high': TaskPriority.HIGH,
    'urgent': TaskPriority.URGENT
  };
  
  // Map legacy status to unified status
  const statusMap: Record<string, TaskStatus> = {
    'pending': TaskStatus.TODO,
    'in-progress': TaskStatus.IN_PROGRESS,
    'COMPLETED': TaskStatus.COMPLETED
  };
  
  return {
    id: legacyTask.id,
    title: displayTitle,
    description: displayDescription,
    status: statusMap[legacyTask.status] || TaskStatus.TODO,
    priority: priorityMap[legacyTask.priority] || TaskPriority.MEDIUM,
    category: TaskCategory.DO_MYSELF,
    urgency: priorityMap[legacyTask.priority] || TaskPriority.MEDIUM,
    createdAt: legacyTask.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: legacyTask.sender || 'system',
    sender: legacyTask.sender,
    senderEmail: legacyTask.senderEmail,
    progress: legacyTask.status === TaskStatus.COMPLETED ? 100 : legacyTask.status === 'in-progress' ? 50 : 0,
    tags: legacyTask.tags || [],
    emailId: legacyTask.id,
    emailSubject: legacyTask.emailSubject,
    snippet: legacyTask.snippet,
    aiConfidence: legacyTask.aiConfidence,
    confidence: legacyTask.confidence,
    classification: legacyTask.classification,
    suggestedAction: legacyTask.suggestedAction,
    draftGenerated: legacyTask.draftGenerated,
    relatedEmails: legacyTask.relatedEmails ? [legacyTask.relatedEmails.toString()] : [],
    estimatedTime: legacyTask.estimatedTime ? parseInt(legacyTask.estimatedTime) : undefined
  };
};

interface SyncStatus {
  emailsInPostgres: number;
  emailsInAppleMail: number;
  percentComplete: number;
  isSynced: boolean;
  emailBreakdown: {
    total: number;
    tasks: {
      count: number;
      percentage: number;
    };
    fyi: {
      count: number;
      percentage: number;
    };
  };
  syncState: {
    isInitialSyncComplete: boolean;
    isSyncing: boolean;
  };
}

interface RelatedItem {
  id: string;
  type: 'email' | 'task' | 'contact' | 'document';
  title: string;
  description: string;
  relevance: number;
}

const EmailTaskDashboard: React.FC = () => {
  // Custom hooks for business logic
  const {
    tasks,
    loading,
    hasMore,
    getFilteredTasks,
    getTaskStats,
    getCategoryCounts,
    resetTasks,
    loadMore
  } = useTasks({ initialFilter: 'tasks' });

  const {
    filter,
    setFilter,
    dateFilter,
    setDateFilter,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    debouncedSearchQuery,
    isFiltered,
    getActiveFilterCount,
    resetFilters
  } = useTaskFilters();

  // Accessibility and performance tracking
  const { announceToScreenReader } = useAccessibility();
  const { trackComponentMount, trackUserAction } = usePerformanceTracking();

  // Additional state
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{ title: string; description: string }>>([]);
  const [showAIPrompts, setShowAIPrompts] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<UnifiedTask | null>(null);
  const [isEmailPopupOpen, setIsEmailPopupOpen] = useState(false);

  // Zustand store integration
  const { setTasks: setStoreTasks, filters: storeFilters, setFilters } = useTaskStore();

  // Performance tracking
  useEffect(() => {
    trackComponentMount('EmailTaskDashboard');
  }, [trackComponentMount]);

  // Sync with Zustand store
  useEffect(() => {
    if (tasks.length > 0) {
      setStoreTasks(tasks);
    }
  }, [tasks, setStoreTasks]);

  // Get computed values using custom hooks
  const stats = getTaskStats();
  const categoryCounts = getCategoryCounts();
  const filteredTasks = getFilteredTasks(filter, dateFilter, debouncedSearchQuery, categoryFilter);

  // Handle task clicks
  const handleTaskClick = (task: LegacyTask) => {
    trackUserAction('task_click', { taskId: task.id });
    announceToScreenReader(`Selected task: ${task.title || task.taskTitle || task.subject}`);
    const unifiedTask = convertToUnifiedTask(task);
    setSelectedEmail(unifiedTask);
    setIsEmailPopupOpen(true);
  };

  const handleCloseEmailPopup = () => {
    setIsEmailPopupOpen(false);
    setSelectedEmail(null);
    announceToScreenReader('Task details closed');
  };

  // Filter change handlers with announcements
  const handleFilterChange = (newFilter: 'all' | 'tasks' | 'non-tasks') => {
    setFilter(newFilter);
    trackUserAction('filter_change', { filter: newFilter });
    announceToScreenReader(`Filter changed to ${newFilter}`);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      trackUserAction('search', { query });
    }
  };

  // Load sync status
  useEffect(() => {
    const fetchSyncStatus = async () => {
      try {
        const response = await fetch('/api/sync-status');
        const data = await response.json();
        setSyncStatus(data);
      } catch (error) {
        console.error('Error fetching sync status:', error);
      }
    };

    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      <BGPattern />
      
      <FocusTrap>
        <div className="relative z-10 w-full max-w-full mx-auto px-4 py-6">
          
          {/* Header with Stats */}
          <div className="mb-6">
            <GlassCard className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-2">Task Dashboard</h1>
                  <p className="text-gray-300">
                    {stats.total} total tasks • {stats.completed} completed • {stats.completionRate}% completion rate
                  </p>
                  {isFiltered && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm text-blue-400">
                        {getActiveFilterCount()} filter{getActiveFilterCount() !== 1 ? 's' : ''} active
                      </span>
                      <button
                        onClick={resetFilters}
                        className="text-xs text-gray-400 hover:text-white transition-colors underline"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Sync Status */}
                {syncStatus && (
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-gray-300">
                        {syncStatus.emailBreakdown.total} emails
                      </div>
                      <div className="text-xs text-gray-400">
                        {syncStatus.syncState.isSyncing ? 'Syncing...' : 'Up to date'}
                      </div>
                    </div>
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>

          {/* Main Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Main Content Area */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Filters */}
              <TaskFilters
                filter={filter}
                setFilter={handleFilterChange}
                dateFilter={dateFilter}
                setDateFilter={setDateFilter}
                searchQuery={searchQuery}
                setSearchQuery={handleSearchChange}
                categoryFilter={categoryFilter}
                setCategoryFilter={setCategoryFilter}
                categoryCounts={categoryCounts}
              />

              {/* Task Columns */}
              <TaskColumns
                filteredTasks={filteredTasks}
                convertToUnifiedTask={convertToUnifiedTask}
                onTaskClick={(task) => handleTaskClick(task as any)}
                loading={loading}
                hasMore={hasMore}
                className="pb-6"
              />

            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <TaskSidebar
                selectedEmail={selectedEmail}
                isEmailPopupOpen={isEmailPopupOpen}
                setIsEmailPopupOpen={setIsEmailPopupOpen}
                showAIPrompts={showAIPrompts}
                setShowAIPrompts={setShowAIPrompts}
                showAIChat={showAIChat}
                setShowAIChat={setShowAIChat}
                relatedItems={relatedItems}
                suggestions={suggestions}
                stats={stats}
                syncStatus={syncStatus}
              />
            </div>

          </div>

        </div>
      </FocusTrap>

      {/* Email Popup */}
      {isEmailPopupOpen && selectedEmail && (
        <EmailPopup
          task={selectedEmail as any}
          isOpen={isEmailPopupOpen}
          onClose={handleCloseEmailPopup}
        />
      )}
    </div>
  );
};

export default EmailTaskDashboard;