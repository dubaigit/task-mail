"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Mail, 
  Brain, 
  Search, 
  AlertCircle, 
  CheckCircle
} from 'lucide-react';
import { BGPattern } from '../ui/BGPattern';
import { UnifiedTaskCard } from '../ui/UnifiedTaskCard';
import { Task as UnifiedTask, TaskStatus, TaskPriority, TaskCategory } from '../../types/core';

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

// Helper function to convert legacy task to unified task
const convertToUnifiedTask = (legacyTask: LegacyTask): UnifiedTask => {
  const displayTitle = legacyTask.taskTitle || legacyTask.title || legacyTask.subject || 'Untitled Task';
  const displayDescription = legacyTask.taskDescription || legacyTask.description || legacyTask.snippet || '';
  
  const priorityMap: Record<string, TaskPriority> = {
    'low': TaskPriority.LOW,
    'medium': TaskPriority.MEDIUM,
    'high': TaskPriority.HIGH,
    'urgent': TaskPriority.URGENT
  };
  
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

const SimpleTaskDashboard: React.FC = () => {
  // State management
  const [tasks, setTasks] = useState<LegacyTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'tasks' | 'non-tasks'>('tasks');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  // Refs
  const lastTaskElementRef = useRef<HTMLDivElement>(null);

  // Fetch tasks from API
  const fetchTasks = useCallback(async (reset = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const newOffset = reset ? 0 : offset;
      const params = new URLSearchParams({
        limit: '50',
        offset: newOffset.toString(),
        filter,
        dateRange: dateFilter,
        ...(searchQuery && { search: searchQuery }),
        ...(reset && { _t: Date.now().toString() })
      });

      const response = await fetch(`/api/tasks?${params}`, {
        headers: {
          'Cache-Control': reset ? 'no-cache' : 'public, max-age=60'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.items) {
        const mappedTasks = data.items.map((item: any) => ({
          id: item.id,
          title: item.taskTitle || item.subject || 'No Title',
          description: item.taskDescription || item.snippet || 'No Description',
          priority: item.priority || 'medium',
          status: item.status || 'pending',
          aiConfidence: item.confidence || 50,
          draftGenerated: item.draftGenerated || false,
          emailSubject: item.subject || '',
          sender: item.sender || 'Unknown Sender',
          senderEmail: item.senderEmail || '',
          estimatedTime: item.estimatedTime || '10 min',
          tags: item.tags || [],
          relatedEmails: item.relatedEmails || 1,
          createdAt: new Date(item.date_received || item.date || Date.now()),
          date: item.date_received || item.date,
          snippet: item.snippet,
          suggestedAction: item.suggestedAction,
          classification: item.classification
        }));
        
        setTasks(prev => reset ? mappedTasks : [...prev, ...mappedTasks]);
        setHasMore(data.hasMore !== false);
        setOffset(newOffset + 50);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [loading, offset, filter, dateFilter, searchQuery]);

  // Load sync status
  const fetchSyncStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/sync-status');
      const data = await response.json();
      setSyncStatus(data);
    } catch (error) {
      console.error('Error fetching sync status:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTasks(true);
    fetchSyncStatus();
  }, []);

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    let matches = true;
    
    if (filter === 'tasks') {
      matches = matches && task.isTask !== false;
    } else if (filter === 'non-tasks') {
      matches = matches && task.isTask === false;
    }
    
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      matches = matches && (
        (task.title || task.taskTitle || task.subject || '').toLowerCase().includes(searchLower) ||
        (task.description || task.taskDescription || task.snippet || '').toLowerCase().includes(searchLower) ||
        task.sender?.toLowerCase().includes(searchLower)
      );
    }
    
    return matches;
  });

  const pendingTasks = filteredTasks.filter(task => task.status === 'pending');
  const inProgressTasks = filteredTasks.filter(task => task.status === 'in-progress');
  const completedTasks = filteredTasks.filter(task => task.status === TaskStatus.COMPLETED);

  const handleTaskClick = (task: LegacyTask) => {
    console.log('Task clicked:', task);
  };

  // Wrapper to handle unified task clicks
  const handleUnifiedTaskClick = (unifiedTask: UnifiedTask) => {
    // Convert back to legacy task format for compatibility
    const legacyTask: LegacyTask = {
      id: unifiedTask.id,
      title: unifiedTask.title,
      taskTitle: unifiedTask.title,
      subject: unifiedTask.emailSubject || unifiedTask.title,
      description: unifiedTask.description,
      taskDescription: unifiedTask.description,
      priority: unifiedTask.priority === TaskPriority.LOW ? 'low' :
                unifiedTask.priority === TaskPriority.MEDIUM ? 'medium' :
                unifiedTask.priority === TaskPriority.HIGH ? 'high' : 'urgent',
      status: unifiedTask.status === TaskStatus.TODO ? 'pending' :
              unifiedTask.status === TaskStatus.IN_PROGRESS ? 'in-progress' : TaskStatus.COMPLETED,
      aiConfidence: unifiedTask.aiConfidence,
      confidence: unifiedTask.confidence,
      draftGenerated: unifiedTask.draftGenerated || false,
      emailSubject: unifiedTask.emailSubject,
      sender: unifiedTask.sender || 'Unknown',
      senderEmail: unifiedTask.senderEmail || '',
      estimatedTime: unifiedTask.estimatedTime?.toString() || '0',
      tags: unifiedTask.tags,
      relatedEmails: unifiedTask.relatedEmails?.length || 0,
      createdAt: unifiedTask.createdAt ? new Date(unifiedTask.createdAt) : new Date(),
      snippet: unifiedTask.snippet,
      suggestedAction: unifiedTask.suggestedAction,
      classification: unifiedTask.classification
    };
    handleTaskClick(legacyTask);
  };

  const updateTaskStatus = (taskId: string, status: string) => {
    setTasks(prev => prev.map(task => 
      task.id === String(taskId) ? { ...task, status: status as any } : task
    ));
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      <BGPattern variant="grid" mask="fade-edges" size={32} fill="rgba(59, 130, 246, 0.1)" />

      {/* Full Width Content Container */}
      <div className="relative z-10 w-full max-w-none mx-auto px-6 py-6">
        
        {/* Header */}
        <div className="mb-8">
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">TaskFlow Dashboard</h1>
                <p className="text-slate-300">
                  {syncStatus?.emailBreakdown?.total || tasks.length} emails processed • {completedTasks.length} tasks completed
                </p>
              </div>
              
              {/* Sync Status */}
              {syncStatus && (
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-slate-300">
                      {syncStatus.emailBreakdown.total} emails
                    </div>
                    <div className="text-xs text-slate-400">
                      {syncStatus.syncState.isSyncing ? 'Syncing...' : 'Up to date'}
                    </div>
                  </div>
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-6">
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative max-w-md mx-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks, emails, or contacts..."
                  className="pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-600/40 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full"
                />
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              {/* Task Type Filters */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilter('tasks')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filter === 'tasks' 
                      ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300' 
                      : 'bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-600/40'
                  }`}
                >
                  Tasks ({syncStatus?.emailBreakdown?.tasks?.count || pendingTasks.length + inProgressTasks.length})
                </button>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filter === 'all' 
                      ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300' 
                      : 'bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-600/40'
                  }`}
                >
                  All ({syncStatus?.emailBreakdown?.total || tasks.length})
                </button>
                <button
                  onClick={() => setFilter('non-tasks')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filter === 'non-tasks' 
                      ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300' 
                      : 'bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-600/40'
                  }`}
                >
                  Info ({syncStatus?.emailBreakdown?.fyi?.count || 0})
                </button>
              </div>

              {/* Date Filters */}
              <div className="flex items-center gap-2">
                {['today', 'week', 'month', 'all'].map((period) => (
                  <button
                    key={period}
                    onClick={() => setDateFilter(period as any)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                      dateFilter === period 
                        ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300' 
                        : 'bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-600/40'
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Task Content - Full Width */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-6">
          
          {/* Empty State */}
          {filteredTasks.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-24 h-24 bg-slate-700/30 rounded-full flex items-center justify-center mb-6">
                <Mail className="w-12 h-12 text-slate-500" />
              </div>
              <h2 className="text-2xl font-semibold text-slate-300 mb-3">Welcome to TaskFlow</h2>
              <p className="text-slate-400 text-center max-w-md">Your AI-powered email task management system. Tasks will appear here as emails are processed.</p>
            </div>
          )}

          {/* Task Columns - Full Width Grid */}
          {filteredTasks.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Pending & In Progress Tasks */}
              <div className="space-y-6">
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className="w-4 h-4 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full shadow-lg"></div>
                  <h3 className="text-xl font-semibold text-amber-200">Pending Tasks</h3>
                  <span className="bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full text-sm font-medium border border-amber-400/30">
                    {pendingTasks.length + inProgressTasks.length}
                  </span>
                </div>
                
                <div className="space-y-4">
                  {(pendingTasks.length + inProgressTasks.length) === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <AlertCircle className="w-16 h-16 text-amber-500/50 mb-4" />
                      <p className="text-amber-200/80 text-lg font-medium">No pending tasks</p>
                      <p className="text-amber-300/60 text-sm mt-2 text-center">AI will create tasks from emails when enabled</p>
                    </div>
                  ) : (
                    <>
                      {pendingTasks.map((task) => (
                        <UnifiedTaskCard 
                          key={task.id}
                          task={convertToUnifiedTask(task)} 
                          onStatusChange={(taskId, status) => {
                            const legacyStatus = status === TaskStatus.TODO ? 'pending' : 
                                                status === TaskStatus.IN_PROGRESS ? 'in-progress' : 
                                                status === TaskStatus.COMPLETED ? TaskStatus.COMPLETED : 'pending';
                            updateTaskStatus(taskId, legacyStatus);
                          }}
                          onSelect={handleUnifiedTaskClick}
                        />
                      ))}
                      {inProgressTasks.map((task) => (
                        <UnifiedTaskCard 
                          key={task.id}
                          task={convertToUnifiedTask({...task, status: 'in-progress'})} 
                          onStatusChange={(taskId, status) => {
                            const legacyStatus = status === TaskStatus.TODO ? 'pending' : 
                                                status === TaskStatus.IN_PROGRESS ? 'in-progress' : 
                                                status === TaskStatus.COMPLETED ? TaskStatus.COMPLETED : 'in-progress';
                            updateTaskStatus(taskId, legacyStatus);
                          }}
                          onSelect={handleUnifiedTaskClick}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Completed Tasks */}
              <div className="space-y-6">
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className="w-4 h-4 bg-gradient-to-r from-emerald-400 to-green-400 rounded-full shadow-lg"></div>
                  <h3 className="text-xl font-semibold text-emerald-200">Completed Tasks</h3>
                  <span className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-sm font-medium border border-emerald-400/30">
                    {completedTasks.length}
                  </span>
                </div>
                
                <div className="space-y-4">
                  {completedTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <CheckCircle className="w-16 h-16 text-emerald-500/50 mb-4" />
                      <p className="text-emerald-200/80 text-lg font-medium">No completed tasks</p>
                      <p className="text-emerald-300/60 text-sm mt-2 text-center">Complete tasks will appear here</p>
                    </div>
                  ) : (
                    completedTasks.map(task => (
                      <UnifiedTaskCard 
                        key={task.id} 
                        task={convertToUnifiedTask(task)} 
                        onSelect={handleUnifiedTaskClick} 
                      />
                    ))
                  )}
                </div>
              </div>

            </div>
          )}
          
          {/* Loading & Load More */}
          <div 
            ref={lastTaskElementRef}
            className="mt-8 flex items-center justify-center"
          >
            {loading && (
              <div className="flex items-center gap-2 text-slate-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                Loading more tasks...
              </div>
            )}
            {!loading && hasMore && tasks.length > 0 && (
              <button 
                onClick={() => fetchTasks(false)}
                className="text-slate-400 hover:text-slate-300 text-sm px-6 py-3 hover:bg-slate-800/50 rounded-lg transition-colors"
              >
                Load more tasks ({tasks.length} loaded)
              </button>
            )}
          </div>

        </div>

      </div>

      {/* AI Chat Button */}
      <button
        className="fixed bottom-6 right-6 bg-purple-500 hover:bg-purple-600 text-white p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-105 z-40"
        aria-label="Open AI Chat"
      >
        <Brain className="w-6 h-6" />
      </button>

    </div>
  );
};

export default SimpleTaskDashboard;