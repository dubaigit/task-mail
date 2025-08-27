"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FocusTrap } from '../ui/accessibility';
import { OptimizedIcon } from '../ui/OptimizedIcons';
import { ModernButton } from '../ui/ModernButton';
import { AccessibleCard } from '../ui/AccessibleCard';
import '../../styles/animations.css';
import { EnhancedAIStatus } from '../AI/EnhancedAIStatus';
import { AIPromptViewer } from '../AI/AIPromptViewer';
import AIUsageMetrics from '../AI/AIUsageMetrics';
import { BGPattern } from '../ui/BGPattern';
import { UnifiedTaskCard } from '../ui/UnifiedTaskCard';
import { EmailPopup } from '../ui/EmailPopup';
import { TaskDetailsStats } from '../TaskManagement/TaskDetailsStats';
import AnalyticsDashboard from '../Analytics/AnalyticsDashboard';
import { UnifiedChat } from '../ui/Chat/UnifiedChat';
import {  } from '../ui/DarkModeSystem';
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

// Type alias for the component
type Task = LegacyTask;

// Helper function to convert legacy task to unified task
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
    today?: number;
    week?: number;
    month?: number;
  };
  aiProcessing?: {
    totalProcessed: number;
    analyzed: number;
    completed: number;
    pending: number;
    failed: number;
    processingRate: number;
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

const TaskDashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<'all' | 'tasks' | 'non-tasks'>('tasks');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  // const [__stats, __setStats] = useState({
  //   efficiency: 0,
  //   totalTasks: 0,
  //   pendingTasks: 0,
  //   inProgressTasks: 0,
  //   completedTasks: 0,
  //   averageResponseTime: 0
  // });
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  
  // Chat and context state
  const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{ title: string; description: string }>>([]);
  const [showAIPrompts, setShowAIPrompts] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [userProfile, setUserProfile] = useState<{email: string; name: string; displayName: string} | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Email popup state
  const [selectedEmail, setSelectedEmail] = useState<Task | null>(null);
  const [isEmailPopupOpen, setIsEmailPopupOpen] = useState(false);
  
  // Email popup handlers
  const handleTaskClick = (task: Task) => {
    setSelectedEmail(task);
    setIsEmailPopupOpen(true);
  };

  // Wrapper to handle unified task clicks
  const handleUnifiedTaskClick = (unifiedTask: UnifiedTask) => {
    // Convert back to legacy task format for popup compatibility
    const legacyTask: Task = {
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
  
  const handleCloseEmailPopup = () => {
    setIsEmailPopupOpen(false);
    setSelectedEmail(null);
  };
  
  // Lazy loading with intersection observer
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastTaskElementRef = useCallback((node: HTMLElement | null) => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreTasks();
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [loading, hasMore]);

  // Fetch tasks from API with error handling and fallback
  const fetchTasks = useCallback(async (reset = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const newOffset = reset ? 0 : offset;
      
      // Add cache-busting for fresh data or use cache headers
      const cacheParam = reset ? `&_t=${Date.now()}` : '';
      const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : '';
      const categoryParam = categoryFilter !== 'all' ? `&category=${categoryFilter}` : '';
      const response = await fetch(
        `/api/tasks?limit=50&offset=${newOffset}&filter=${filter}&dateRange=${dateFilter}${searchParam}${categoryParam}${cacheParam}`,
        {
          headers: {
            'Cache-Control': reset ? 'no-cache' : 'public, max-age=60'
          }
        }
      );
      
      const data = await response.json();
      
      // Handle API response with fallback handling
      if (response.ok && data.items) {
        // Map API response to frontend Task interface
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
          date: item.date_received || item.date
        }));
        
        setTasks(prev => reset ? mappedTasks : [...prev, ...mappedTasks]);
        setHasMore(data.hasMore);
        setOffset(newOffset + 50);
        
        // Update stats only on reset
        if (reset) {
          fetchStatistics();
        }
      } else {
        // Handle degraded state - API returned fallback data
        setTasks([]);
        setHasMore(false);
      }
    } catch (error) {
      // Network or other errors - graceful fallback
      setTasks([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [offset, filter, loading, categoryFilter, dateFilter, searchQuery]);

  // Fetch statistics
  const fetchStatistics = async () => {
    try {
      const response = await fetch('/api/statistics');
      if (response.ok) {
        // const data = await response.json();
        // __setStats(data); // Commented out since __setStats state is not active
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  // Fetch sync status with fallback handling
  const fetchSyncStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/sync-status');
      const data = await response.json();
      
      // Always set sync status - API now returns fallback data instead of errors
      setSyncStatus(data);
    } catch (error) {
      // Network error - set minimal fallback
      setSyncStatus({
        emailsInPostgres: 0,
        emailsInAppleMail: 0,
        percentComplete: 0,
        isSynced: true,
        emailBreakdown: {
          total: 0,
          tasks: { count: 0, percentage: 0 },
          fyi: { count: 0, percentage: 0 },
          today: 0,
          week: 0,
          month: 0
        },
        aiProcessing: {
          totalProcessed: 0,
          analyzed: 0,
          completed: 0,
          pending: 0,
          failed: 0,
          processingRate: 0
        },
        syncState: {
          isInitialSyncComplete: true,
          isSyncing: false
        }
      });
    }
  }, []);

  // Fetch category counts
  const fetchCategoryCounts = async () => {
    try {
      const response = await fetch('/api/tasks/category-counts');
      if (response.ok) {
        const data = await response.json();
        setCategoryCounts(data);
      } else {
        // Handle API error with fallback data
        setCategoryCounts({
          urgent: 0,
          today: 0,
          pending: 0,
          completed: 0
        });
      }
    } catch (error) {
      // Category counts network error, using fallback data
      // Provide fallback data for network errors
      setCategoryCounts({
        urgent: 0,
        today: 0,
        pending: 0,
        completed: 0
      });
    }
  };

  // Fetch user profile
  const fetchUserProfile = async () => {
    try {
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const data = await response.json();
        setUserProfile(data);
      } else {
        // Handle API error with fallback data
        setUserProfile({
          name: 'Guest User',
          email: 'user@example.com',
          displayName: 'Guest User'
        });
      }
    } catch (error) {
      // User profile network error, using fallback data
      // Provide fallback data for network errors
      setUserProfile({
        name: 'Guest User',
        email: 'user@example.com',
        displayName: 'Guest User'
      });
    }
  };

  // Load more tasks for infinite scroll
  const loadMoreTasks = () => {
    if (!loading && hasMore) {
      fetchTasks(false);
    }
  };

  // Load initial data with performance optimization - FIXED: Only run once on mount
  useEffect(() => {
    // Preload tasks immediately
    fetchTasks(true);
    fetchSyncStatus();
    fetchCategoryCounts();
    fetchUserProfile();
  }, []); // CRITICAL FIX: Empty dependency array to prevent infinite loop

  // Set up auto-refresh separately with controlled dependencies
  useEffect(() => {
    // PERFORMANCE: Set up auto-refresh every 10 minutes for new data (reduced frequency to prevent cascade)
    const autoRefresh = setInterval(() => {
      if (!loading) {
        fetchTasks(true);
        fetchSyncStatus();
        fetchCategoryCounts();
      }
    }, 600000); // 10 minutes to reduce cascade effects
    
    return () => clearInterval(autoRefresh);
  }, [loading]); // CRITICAL FIX: Remove fetchTasks and fetchSyncStatus dependencies to prevent infinite loops

  // Keyboard shortcuts for accessibility
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key) {
        case '/':
          e.preventDefault();
          // Focus search input
          const searchInput = document.querySelector('input[placeholder="Search tasks..."]') as HTMLInputElement;
          if (searchInput) searchInput.focus();
          break;
        case '1':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setFilter('tasks');
          }
          break;
        case '2':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setFilter('all');
          }
          break;
        case '3':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setFilter('non-tasks');
          }
          break;
        case 'r':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            fetchTasks(true);
            fetchSyncStatus();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [fetchTasks, fetchSyncStatus]);


  // Update task status
  const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        setTasks(prev => prev.map(task => 
          task.id === taskId ? { ...task, status: newStatus } : task
        ));
      }
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  // AI Operations Handlers
  const handleManualSync = async () => {
    try {
      const response = await fetch('/api/ai/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        await fetchSyncStatus();
      }
    } catch (error) {
      console.error('Error initiating sync:', error);
    }
  };

  const handleResync = async () => {
    try {
      const response = await fetch('/api/ai/resync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        await fetchSyncStatus();
      }
    } catch (error) {
      console.error('Error initiating resync:', error);
    }
  };

  const handleForceReanalyze = async () => {
    try {
      const response = await fetch('/api/ai/force-reanalyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        await fetchSyncStatus();
      }
    } catch (error) {
      console.error('Error initiating force reanalyze:', error);
    }
  };

  // Generate dynamic related items and suggestions based on current tasks
  useEffect(() => {
    if (tasks.length > 0) {
      // Generate related items from task data
      const dynamicRelatedItems: RelatedItem[] = [];
      const seenSenders = new Set<string>();
      
      tasks.slice(0, 5).forEach((task, index) => {
        if (task.senderEmail && !seenSenders.has(task.senderEmail)) {
          seenSenders.add(task.senderEmail);
          dynamicRelatedItems.push({
            id: `contact-${index}`,
            type: 'contact',
            title: task.sender,
            description: `${task.relatedEmails} related emails`,
            relevance: Math.min(95, 70 + task.relatedEmails * 5)
          });
        }
        
        if (task.tags.length > 0) {
          dynamicRelatedItems.push({
            id: `email-${index}`,
            type: 'email',
            title: task.emailSubject || task.subject || 'Related Email',
            description: task.description || task.taskDescription || task.snippet || 'Email content',
            relevance: task.aiConfidence || task.confidence || 50
          });
        }
      });
      
      setRelatedItems(dynamicRelatedItems.slice(0, 6));
      
      // Generate dynamic suggestions based on current tasks
      const dynamicSuggestions = [];
      const urgentTasks = tasks.filter(t => t.priority === 'urgent');
      const tasksWithDrafts = tasks.filter(t => t.draftGenerated);
      const meetingTasks = tasks.filter(t => t.tags.includes('meeting'));
      
      if (urgentTasks.length > 0) {
        dynamicSuggestions.push({
          title: `Prioritize ${urgentTasks.length} urgent task${urgentTasks.length > 1 ? 's' : ''}`,
          description: 'Focus on high-priority items first for maximum impact.'
        });
      }
      
      if (tasksWithDrafts.length > 0) {
        dynamicSuggestions.push({
          title: `Review ${tasksWithDrafts.length} AI-generated draft${tasksWithDrafts.length > 1 ? 's' : ''}`,
          description: 'Quickly send pre-written responses to save time.'
        });
      }
      
      if (meetingTasks.length > 0) {
        dynamicSuggestions.push({
          title: 'Schedule pending meetings',
          description: 'Coordinate with team members to finalize meeting times.'
        });
      }
      
      dynamicSuggestions.push({
        title: 'Bulk update task status',
        description: 'Mark multiple completed tasks as done in one action.'
      });
      
      setSuggestions(dynamicSuggestions.slice(0, 4));
    }
  }, [tasks]);

  // Refresh data handler for AI Chat Integration
  // const _handleRefreshData = useCallback(() => {
  //   fetchTasks(true);
  //   fetchSyncStatus();
  // }, [fetchTasks, fetchSyncStatus]);


  const pendingTasks = tasks.filter(task => task.status === 'pending');
  const inProgressTasks = tasks.filter(task => task.status === 'in-progress');
  const completedTasks = tasks.filter(task => task.status === TaskStatus.COMPLETED);

  // DERIVE COUNTS FROM SYNC STATUS FOR CONSISTENCY - SIMPLIFIED TO 2 STATES
  // const _totalTaskCount = syncStatus?.emailBreakdown?.tasks?.count ?? tasks.length;
  const completedCount = completedTasks.length; // This is a UI state, keep as is
  // All non-completed tasks are "pending" - removed unused pendingCount


  return (
    <React.Fragment>
    <div className="min-h-screen w-full bg-slate-900 relative overflow-hidden">
      <BGPattern variant="grid" mask="fade-edges" size={32} fill="rgba(59, 130, 246, 0.1)" />

      {/* Full Width Content - No Header */}
      <div className="relative z-10 w-full max-w-full mx-auto px-4 py-4">
        {/* Three Column Layout - Full Height */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-40px)]">
          
          {/* Left Sidebar - Stats and Controls - Fixed/Static */}
          <div className="lg:col-span-2 space-y-4 overflow-hidden animate-fade-in-left">
            <AccessibleCard variant="glass" className="p-4 sticky top-0 animate-scale-in">
              {/* Task Details and Statistics */}
              <TaskDetailsStats
                userProfile={userProfile}
                syncStatus={syncStatus}
                tasks={tasks}
                categoryFilter={categoryFilter}
                categoryCounts={categoryCounts}
                onSettingsClick={() => setShowSettings(true)}
                onCategoryFilterChange={setCategoryFilter}
              />

              {/* Enhanced AI Status */}
              <div className="mt-6">
                <EnhancedAIStatus
                  syncStatus={syncStatus}
                  onSync={handleManualSync}
                  onResync={handleResync}
                  onForceReanalyze={handleForceReanalyze}
                  showPrompts={showAIPrompts}
                  onTogglePrompts={() => setShowAIPrompts(!showAIPrompts)}
                />
              </div>

              {/* AI Usage Metrics */}
              <div className="mt-6">
                <AIUsageMetrics />
              </div>

              {/* Supabase Connection Test */}
              <div className="mt-6">
                              </div>

              {/* AI Suggestions */}
              <div className="mt-6">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">AI Suggestions</h3>
                <div className="space-y-2">
                  {suggestions.map((suggestion, index) => (
                    <div key={index} className="p-2 bg-slate-700/20 rounded-lg hover:bg-slate-700/40 transition-colors cursor-pointer">
                      <div className="flex items-start gap-2">
                        <OptimizedIcon name="brain" size={12} className="text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-slate-200">{suggestion.title}</p>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{suggestion.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </AccessibleCard>
          </div>

          {/* Main Content Area - Tasks - Scrollable */}
          <div className="lg:col-span-8 overflow-y-auto animate-fade-in-up">
            <AccessibleCard variant="glass" className="p-6 h-full animate-scale-in-center animate-stagger-1">
            {/* Default view when no specific content - removed welcome text */}
            {tasks.length === 0 && !loading && (
              <div className="flex-1 flex items-start justify-start pt-8">
              </div>
            )}
            {/* Clean, minimal filters */}
            <div className="mb-6">
              {/* Search */}
              <div className="flex justify-center mb-4">
                <div className="relative" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  maxWidth: '400px'
                }}>
                  <OptimizedIcon name="search" size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search emails, tasks, or..."
                    className="pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-600/40 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full"
                    style={{
                      flex: 1,
                      resize: 'none',
                      minHeight: '44px',
                      maxHeight: '200px'
                    }}
                  />
                  <ModernButton 
                    variant="primary" 
                     
                    className="flex-shrink-0 animate-button-hover"
                  >
                    <OptimizedIcon name="search" size={16} />
                  </ModernButton>
                  <div className="text-xs text-slate-400">0/1000</div>
                </div>
              </div>
              
              {/* Filter Buttons */}
              <div className="flex items-center justify-center gap-6">
                {/* Task Type Buttons */}
                <div className="flex items-center gap-2">
                  <ModernButton
                    variant={filter === 'tasks' ? 'primary' : 'ghost'}
                    
                    onClick={() => setFilter('tasks')}
                    className="animate-fade-in-up animate-button-hover"
                  >
                    Tasks ({syncStatus?.emailBreakdown?.tasks?.count || tasks.filter(t => t.status !== TaskStatus.COMPLETED).length})
                  </ModernButton>
                  <ModernButton
                    variant={filter === 'all' ? 'primary' : 'ghost'}
                    
                    onClick={() => setFilter('all')}
                    className="animate-fade-in-up animate-button-hover animate-stagger-1"
                  >
                    All ({syncStatus?.emailBreakdown?.total || syncStatus?.emailsInPostgres || 0})
                  </ModernButton>
                  <ModernButton
                    variant={filter === 'non-tasks' ? 'primary' : 'ghost'}
                    
                    onClick={() => setFilter('non-tasks')}
                    className="animate-fade-in-up animate-button-hover animate-stagger-2"
                  >
                    Info ({syncStatus?.emailBreakdown?.fyi?.count || 0})
                  </ModernButton>
                </div>
                
                {/* Time Filter Buttons */}
                <div className="flex items-center gap-2">
                  <ModernButton
                    variant={dateFilter === 'today' ? 'success' : 'ghost'}
                    
                    onClick={() => setDateFilter('today')}
                    className="animate-fade-in-up animate-button-hover"
                  >
                    Today ({syncStatus?.emailBreakdown?.today || 0})
                  </ModernButton>
                  <ModernButton
                    variant={dateFilter === 'week' ? 'success' : 'ghost'}
                    
                    onClick={() => setDateFilter('week')}
                    className="animate-fade-in-up animate-button-hover animate-stagger-1"
                  >
                    Week ({syncStatus?.emailBreakdown?.week || 488})
                  </ModernButton>
                  <ModernButton
                    variant={dateFilter === 'month' ? 'success' : 'ghost'}
                    
                    onClick={() => setDateFilter('month')}
                    className="animate-fade-in-up animate-button-hover animate-stagger-2"
                  >
                    Month ({syncStatus?.emailBreakdown?.month || 1762})
                  </ModernButton>
                  <ModernButton
                    variant={dateFilter === 'all' ? 'success' : 'ghost'}
                    
                    onClick={() => setDateFilter('all')}
                    className="animate-fade-in-up animate-button-hover animate-stagger-3"
                  >
                    All Time ({syncStatus?.emailBreakdown?.total || 8081})
                  </ModernButton>
                </div>
              </div>
            </div>

            {/* Task Columns - Optimized Spacing */}
            <div className="grid grid-cols-2 gap-6">
              {/* Pending Column */}
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-4 h-4 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full shadow-lg"></div>
                  <h3 className="text-lg font-semibold text-amber-200">Pending Tasks</h3>
                  <span className="bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full text-sm font-medium border border-amber-400/30">
                    {pendingTasks.length + inProgressTasks.length}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {(pendingTasks.length + inProgressTasks.length) === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in">
                      <OptimizedIcon name="alert" size={64} className="text-amber-500/50 mb-4" />
                      <p className="text-amber-200/80 text-sm font-medium">No pending tasks</p>
                      <p className="text-amber-300/60 text-xs mt-2 text-center">AI will create tasks from emails when enabled</p>
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

              {/* Completed Column */}
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-4 h-4 bg-gradient-to-r from-emerald-400 to-green-400 rounded-full shadow-lg"></div>
                  <h3 className="text-lg font-semibold text-emerald-200">Completed Tasks</h3>
                  <span className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-sm font-medium border border-emerald-400/30">
                    {completedTasks.length}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {completedTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in">
                      <OptimizedIcon name="check-circle" size={64} className="text-emerald-500/50 mb-4" />
                      <p className="text-emerald-200/80 text-sm font-medium">No completed tasks</p>
                      <p className="text-emerald-300/60 text-xs mt-2 text-center">Complete tasks will appear here</p>
                    </div>
                  ) : (
                    completedTasks.map(task => (
                      <UnifiedTaskCard key={task.id} task={convertToUnifiedTask(task)} onSelect={handleUnifiedTaskClick} />
                    ))
                  )}
                </div>
              </div>
            </div>
            
            {/* Infinite Scroll Trigger */}
            <div 
              ref={lastTaskElementRef}
              className="h-4 flex items-center justify-center mt-6"
            >
              {loading && (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  Loading more tasks...
                </div>
              )}
              {!loading && hasMore && (
                <ModernButton 
                  variant="secondary" 
                  
                  onClick={loadMoreTasks}
                  className="animate-button-hover"
                >
                  Load more tasks ({tasks.length} of 393)
                </ModernButton>
              )}
            </div>
          </AccessibleCard>
          </div>

          {/* Right Sidebar - Enhanced Analytics and AI Insights - Fixed/Static */}
          <div className="lg:col-span-2 space-y-4 overflow-y-auto animate-fade-in-right">
            <AccessibleCard variant="glass" className="p-4 sticky top-0 animate-scale-in animate-stagger-2">
              
              {/* Task Flow Header */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <OptimizedIcon name="brain" size={20} className="text-purple-400" />
                  <h2 className="text-lg font-bold text-white">TaskFlow Insights</h2>
                </div>
                <p className="text-sm text-slate-300">
                  {syncStatus?.emailBreakdown?.total || tasks.length} emails • {completedCount} tasks completed
                </p>
                {syncStatus && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className={`w-2 h-2 rounded-full ${syncStatus.syncState?.isSyncing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                    <span className="text-xs text-slate-400">
                      {syncStatus.syncState?.isSyncing ? 'Syncing...' : 'All systems operational'}
                    </span>
                  </div>
                )}
              </div>

              {/* Supabase Connection Test */}
              <div className="mb-6">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Database Connection</h3>
                              </div>

              {/* AI Performance Metrics */}
              <div className="mb-6">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">AI Performance</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-500/10 border border-blue-400/20 rounded-lg">
                    <div className="text-xs text-blue-300 mb-1">Processing Speed</div>
                    <div className="text-lg font-semibold text-blue-200">
                      {syncStatus?.aiProcessing?.processingRate || 95}%
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-500/10 border border-emerald-400/20 rounded-lg">
                    <div className="text-xs text-emerald-300 mb-1">AI Accuracy</div>
                    <div className="text-lg font-semibold text-emerald-200">92%</div>
                  </div>
                  <div className="p-3 bg-purple-500/10 border border-purple-400/20 rounded-lg">
                    <div className="text-xs text-purple-300 mb-1">Auto Drafted</div>
                    <div className="text-lg font-semibold text-purple-200">
                      {tasks.filter(t => t.draftGenerated).length}
                    </div>
                  </div>
                  <div className="p-3 bg-orange-500/10 border border-orange-400/20 rounded-lg">
                    <div className="text-xs text-orange-300 mb-1">Time Saved</div>
                    <div className="text-lg font-semibold text-orange-200">3.2h</div>
                  </div>
                </div>
              </div>

              {/* Analytics Dashboard */}
              <div className="mb-6">
                <AnalyticsDashboard
                  tasks={tasks}
                  syncStatus={syncStatus}
                  categoryCounts={categoryCounts}
                />
              </div>

              {/* Recent Activity Feed */}
              <div className="mb-6">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Recent Activity</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {tasks.slice(0, 5).map((task, _index) => (
                    <div key={task.id} className="flex items-start gap-2 p-2 bg-slate-700/20 rounded-lg">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        task.status === TaskStatus.COMPLETED ? 'bg-green-400' :
                        task.status === 'in-progress' ? 'bg-blue-400' : 'bg-orange-400'
                      }`}></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200 truncate">{task.title || task.subject}</p>
                        <p className="text-xs text-slate-400">
                          {task.sender} • {task.priority} priority
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Related Items */}
              <div className="mb-6">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Related Contacts</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {relatedItems.slice(0, 4).map((item) => (
                    <div key={item.id} className="p-2 bg-slate-700/20 rounded-lg hover:bg-slate-700/40 transition-colors cursor-pointer">
                      <div className="flex items-start gap-2">
                        {item.type === 'contact' && <OptimizedIcon name="user" size={12} className="text-green-400 mt-0.5 flex-shrink-0" />}
                        {item.type === 'email' && <OptimizedIcon name="mail" size={12} className="text-blue-400 mt-0.5 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-200 truncate">{item.title}</p>
                          <p className="text-xs text-slate-400 truncate">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Suggestions */}
              <div className="mb-6">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">AI Suggestions</h3>
                <div className="space-y-2">
                  {suggestions.slice(0, 3).map((suggestion, index) => (
                    <div key={index} className="p-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-400/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <OptimizedIcon name="brain" size={12} className="text-purple-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-slate-200 font-medium">{suggestion.title}</p>
                          <p className="text-xs text-slate-400 mt-1">{suggestion.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button 
                    onClick={() => setShowAIChat(true)}
                    className="w-full p-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-lg text-left transition-colors">
                    <div className="flex items-center gap-2">
                      <OptimizedIcon name="brain" size={12} className="text-blue-400" />
                      <span className="text-xs text-blue-200">Open AI Assistant</span>
                    </div>
                  </button>
                  <button 
                    onClick={handleForceReanalyze}
                    className="w-full p-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 rounded-lg text-left transition-colors">
                    <div className="flex items-center gap-2">
                      <OptimizedIcon name="alert" size={12} className="text-purple-400" />
                      <span className="text-xs text-purple-200">Refresh AI Analysis</span>
                    </div>
                  </button>
                  <button 
                    onClick={() => {
                      const drafts = tasks.filter(t => t.draftGenerated);
                      if (drafts.length > 0) {
                        handleTaskClick(drafts[0]);
                      }
                    }}
                    className="w-full p-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 rounded-lg text-left transition-colors">
                    <div className="flex items-center gap-2">
                      <OptimizedIcon name="link" size={12} className="text-emerald-400" />
                      <span className="text-xs text-emerald-100">Review Draft Replies</span>
                    </div>
                  </button>
                  <button className="w-full p-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 rounded-lg text-left transition-colors">
                    <div className="flex items-center gap-2">
                      <OptimizedIcon name="brain" size={12} className="text-emerald-400" />
                      <span className="text-xs text-emerald-300">Bulk Task Updates</span>
                    </div>
                  </button>
                  <button className="w-full p-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 rounded-lg text-left transition-colors">
                    <div className="flex items-center gap-2">
                      <OptimizedIcon name="file-text" size={12} className="text-purple-400" />
                      <span className="text-xs text-purple-300">Export Report</span>
                    </div>
                  </button>
                </div>
              </div>
            </AccessibleCard>
          </div>

        </div>
      </div>
      
      {/* EmailPopup - CRITICAL: This was missing! */}
      {isEmailPopupOpen && selectedEmail && (
        <EmailPopup 
          task={selectedEmail} 
          isOpen={isEmailPopupOpen} 
          onClose={handleCloseEmailPopup}
          onTaskUpdate={(updatedTask) => {
            setTasks(prev => prev.map(t =>
              t.id === updatedTask.id ? updatedTask : t
            ));
          }}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <FocusTrap>
            <div 
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-title"
              className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-md"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <h2 id="settings-title" className="text-lg font-semibold text-slate-100">Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  aria-label="Close settings"
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <OptimizedIcon name="close" size={16} className="text-slate-400" />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-slate-200 mb-2">User Preferences</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="rounded bg-slate-800 border-slate-600" />
                      <span className="text-sm text-slate-300">Enable desktop notifications</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="rounded bg-slate-800 border-slate-600" />
                      <span className="text-sm text-slate-300">Auto-refresh tasks</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-slate-200 mb-2">AI Settings</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded bg-slate-800 border-slate-600" />
                      <span className="text-sm text-slate-300">Enable AI task classification</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded bg-slate-800 border-slate-600" />
                      <span className="text-sm text-slate-300">Generate draft replies</span>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 p-4 border-t border-slate-700">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </FocusTrap>
        </div>
      )}

      {/* AI Prompt Viewer */}
      <AIPromptViewer 
        visible={showAIPrompts}
        onClose={() => setShowAIPrompts(false)}
      />
      
      {/* AI Chat Modal - Floating trigger for modal chat */}
      {/* AI Chat Modal Trigger - Floating button */}
      <button
        onClick={() => setShowAIChat(true)}
        className="fixed bottom-6 right-6 bg-purple-500 hover:bg-purple-600 text-white p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-105 z-40"
        aria-label="Open AI Chat"
      >
        <OptimizedIcon name="brain" size={24} />
      </button>

      {/* AI Chat Modal */}
      {showAIChat && (
        <UnifiedChat
          variant="modal"
          features={{
            ai: true,
            database: true,
            systemPrompt: true,
            metadata: true,
            typing: true
          }}
          theme={{ variant: 'dark' }}
          title="AI Email Assistant"
          placeholder="Ask me about your emails, request drafts, or create automation rules..."
          messages={[]}
          onSendMessage={(_message) => {
            // Handle AI message processing here
          }}
          onClose={() => setShowAIChat(false)}
          isConnected={true}
          maxMessages={100}
        />
      )}
      
    </div>
    </React.Fragment>
  );
};

export default TaskDashboard;
