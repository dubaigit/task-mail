"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FocusTrap } from '../ui/accessibility';
import { 
  Mail, 
  CheckCircle,
  Brain,
  Link,
  FileText,
  Users,
  Search,
  Star,
  AlertCircle,
  X
} from 'lucide-react';
import { EnhancedAIStatus } from '../AI/EnhancedAIStatus';
import { AIPromptViewer } from '../AI/AIPromptViewer';
import AIUsageMetrics from '../AI/AIUsageMetrics';
import { BGPattern } from '../ui/BGPattern';
import { UnifiedTaskCard } from '../ui/UnifiedTaskCard';
import { EmailPopup } from '../ui/EmailPopup';
import { TaskDetailsStats } from '../TaskManagement/TaskDetailsStats';
import AnalyticsDashboard from '../Analytics/AnalyticsDashboard';
import { UnifiedChat } from '../ui/Chat/UnifiedChat';
import { GlassCard, BentoGrid, ModernButton, StatusBadge } from '../ui/DarkModeSystem';
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

// Removed EmailStatsHeader - replaced with minimal filters

// EmailPopup component extracted to separate file

// ChatInterface component extracted to separate file



const EmailTaskDashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<'all' | 'tasks' | 'non-tasks'>('tasks');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stats, setStats] = useState({
    efficiency: 0,
    totalTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    completedTasks: 0,
    averageResponseTime: 0
  });
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
        console.log('API returned fallback data, showing empty state');
        setTasks([]);
        setHasMore(false);
      }
    } catch (error) {
      // Network or other errors - graceful fallback
      console.log('Network error, using fallback state:', error);
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
        const data = await response.json();
        setStats(data);
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
      console.log('Network error fetching sync status, using fallback:', error);
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
        console.log('Category counts API error, using fallback data');
        setCategoryCounts({
          urgent: 0,
          today: 0,
          pending: 0,
          completed: 0
        });
      }
    } catch (error) {
      console.log('Category counts network error, using fallback data');
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
        console.log('User profile API error, using fallback data');
        setUserProfile({
          name: 'Guest User',
          email: 'user@example.com',
          displayName: 'Guest User'
        });
      }
    } catch (error) {
      console.log('User profile network error, using fallback data');
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



  // Load initial data with performance optimization
  useEffect(() => {
    // Preload tasks immediately
    fetchTasks(true);
    fetchSyncStatus();
    fetchCategoryCounts();
    fetchUserProfile();
    
    // PERFORMANCE: Set up auto-refresh every 10 minutes for new data (reduced frequency to prevent cascade)
    const autoRefresh = setInterval(() => {
      if (!loading) {
        fetchTasks(true);
        fetchSyncStatus();
        fetchCategoryCounts();
      }
    }, 600000); // 10 minutes to reduce cascade effects
    
    return () => clearInterval(autoRefresh);
  }, [filter, dateFilter, searchQuery, categoryFilter, fetchTasks, fetchSyncStatus]);

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
  }, [setFilter, fetchTasks, fetchSyncStatus]);


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
          task.id === String(taskId) ? { ...task, status: newStatus } : task
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
        console.log('Manual sync initiated');
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
        console.log('Resync initiated');
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
        console.log('Force reanalyze initiated');
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
  const handleRefreshData = useCallback(() => {
    fetchTasks(true);
    fetchSyncStatus();
  }, [fetchTasks, fetchSyncStatus]);


  const pendingTasks = tasks.filter(task => task.status === 'pending');
  const inProgressTasks = tasks.filter(task => task.status === 'in-progress');
  const completedTasks = tasks.filter(task => task.status === TaskStatus.COMPLETED);

  // DERIVE COUNTS FROM SYNC STATUS FOR CONSISTENCY - SIMPLIFIED TO 2 STATES
  const totalTaskCount = syncStatus?.emailBreakdown?.tasks?.count ?? tasks.length;
  const completedCount = completedTasks.length; // This is a UI state, keep as is
  // All non-completed tasks are "pending" - removed unused pendingCount


  return (
    <div className="email-task-dashboard task-dashboard-container">
      <BGPattern variant="grid" mask="fade-edges" size={32} fill="rgba(59, 130, 246, 0.1)" />

      {/* Content - Full Height */}
      <div className="flex h-full w-full">
        {/* Left Sidebar - Fixed width with proper overflow */}
        <div className="sidebar-left task-sidebar-left">
          <div className="p-4 overflow-y-auto flex-1 task-sidebar-content">
          {/* Header */}
          <div className="mb-4 task-header">
            <h1 className="text-lg font-bold text-white" style={{
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden'
            }}>TaskFlow</h1>
            <p className="text-xs text-slate-400">Task-first management</p>
          </div>

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
          <EnhancedAIStatus
            syncStatus={syncStatus}
            onSync={handleManualSync}
            onResync={handleResync}
            onForceReanalyze={handleForceReanalyze}
            showPrompts={showAIPrompts}
            onTogglePrompts={() => setShowAIPrompts(!showAIPrompts)}
          />

          {/* AI Usage Metrics */}
          <div className="mt-6">
            <AIUsageMetrics />
          </div>

          {/* Analytics Dashboard */}
          <div className="mt-6">
            <AnalyticsDashboard
              tasks={tasks}
              syncStatus={syncStatus}
              categoryCounts={categoryCounts}
            />
          </div>

          {/* AI Suggestions */}
          <div>
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">AI Suggestions</h3>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="p-2 bg-slate-700/20 rounded-lg hover:bg-slate-700/40 transition-colors cursor-pointer">
                  <div className="flex items-start gap-2">
                    <Brain className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-200">{suggestion.title}</p>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{suggestion.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex" style={{ overflow: 'hidden' }}>
          {/* Main Task Workflow Area - Main pane with default view */}
          <div className="flex-1 p-6 bg-slate-900/60 shadow-inner relative overflow-y-auto" style={{
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Default view when no specific content */}
            {tasks.length === 0 && !loading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 bg-slate-700/30 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <Mail className="w-12 h-12 text-slate-500" />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-300 mb-2">Welcome to TaskFlow</h2>
                  <p className="text-slate-400 max-w-sm">Your AI-powered email task management system. Tasks will appear here as emails are processed.</p>
                </div>
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
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
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
                  <button className="flex-shrink-0 p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
                    <Search className="w-4 h-4" />
                  </button>
                  <div className="text-xs text-slate-400">0/1000</div>
                </div>
              </div>
              
              {/* Filter Buttons */}
              <div className="flex items-center justify-center gap-6">
                {/* Task Type Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilter('tasks')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filter === 'tasks' 
                        ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300' 
                        : 'bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-600/40'
                    }`}
                  >
                    Tasks ({syncStatus?.emailBreakdown?.tasks?.count || tasks.filter(t => t.status !== TaskStatus.COMPLETED).length})
                  </button>
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filter === 'all' 
                        ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300' 
                        : 'bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-600/40'
                    }`}
                  >
                    All ({syncStatus?.emailBreakdown?.total || syncStatus?.emailsInPostgres || 0})
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
                
                {/* Time Filter Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDateFilter('today')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      dateFilter === 'today' 
                        ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300' 
                        : 'bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-600/40'
                    }`}
                  >
                    Today ({syncStatus?.emailBreakdown?.today || 0})
                  </button>
                  <button
                    onClick={() => setDateFilter('week')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      dateFilter === 'week' 
                        ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300' 
                        : 'bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-600/40'
                    }`}
                  >
                    Week ({syncStatus?.emailBreakdown?.week || 488})
                  </button>
                  <button
                    onClick={() => setDateFilter('month')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      dateFilter === 'month' 
                        ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300' 
                        : 'bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-600/40'
                    }`}
                  >
                    Month ({syncStatus?.emailBreakdown?.month || 1762})
                  </button>
                  <button
                    onClick={() => setDateFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      dateFilter === 'all' 
                        ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300' 
                        : 'bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 border border-slate-600/40'
                    }`}
                  >
                    All Time ({syncStatus?.emailBreakdown?.total || 8081})
                  </button>
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
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                      <AlertCircle className="w-16 h-16 text-amber-500/50 mb-4" />
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
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                      <CheckCircle className="w-16 h-16 text-emerald-500/50 mb-4" />
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
                <button 
                  onClick={loadMoreTasks}
                  className="text-slate-400 hover:text-slate-300 text-sm px-4 py-2 hover:bg-slate-800/50 rounded-lg transition-colors"
                >
                  Load more tasks ({tasks.length} of 393)
                </button>
              )}
            </div>
          </div>

          {/* Right Sidebar - Fixed width with improved layout */}
          <div className="sidebar-right" style={{
            width: '320px',
            minWidth: '320px',
            maxWidth: '320px',
            borderLeft: '1px solid rgba(71, 85, 105, 0.4)',
            backgroundColor: 'rgba(30, 41, 59, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            zIndex: 10,
            height: '100%',
            overflow: 'hidden'
          }}>
            {/* Top Section: Related Items - Flexible height */}
            <div className="flex-shrink-0 max-h-[40%] p-4 border-b border-slate-700/30 overflow-y-auto">
              <h3 className="text-sm font-medium text-slate-200 mb-3 flex items-center gap-2">
                <Link className="w-4 h-4" />
                Related Items
              </h3>
              <div className="space-y-2 h-full overflow-y-auto pr-2">
                {relatedItems.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-700/20 rounded-lg hover:bg-slate-700/40 transition-colors cursor-pointer">
                    <div className="flex items-start gap-2 mb-1">
                      <div className="mt-0.5 flex-shrink-0">
                        {item.type === 'email' && <Mail className="w-3.5 h-3.5 text-blue-400" />}
                        {item.type === 'task' && <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
                        {item.type === 'contact' && <Users className="w-3.5 h-3.5 text-purple-400" />}
                        {item.type === 'document' && <FileText className="w-3.5 h-3.5 text-orange-400" />}
                      </div>
                      <span className="text-xs font-medium text-slate-200 line-clamp-1 break-all">{item.title}</span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 pl-5">{item.description}</p>
                    <div className="flex items-center justify-between mt-2 pl-5">
                      <span className="text-xs text-slate-500 capitalize bg-slate-800/50 px-2 py-0.5 rounded">{item.type}</span>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400/20" />
                        <span className="text-xs font-medium text-slate-300">{item.relevance}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Section: Chat Interface - Takes remaining space */}
            <div className="flex-1 p-4 overflow-hidden">
              <div className="h-full">
                <UnifiedChat
                  variant="embedded"
                  features={{
                    ai: true,
                    database: true,
                    systemPrompt: true,
                    metadata: true,
                    accessibility: true
                  }}
                  theme={{ variant: 'light' }}
                  title="AI Email Assistant"
                  placeholder="Ask me about your emails, tasks, or request drafts..."
                  messages={[]}
                  onSendMessage={(message) => {
                    // Handle AI message processing here
                    console.log('AI message:', message);
                  }}
                  isConnected={true}
                  maxMessages={100}
                />
              </div>
            </div>
          </div>
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
                  <X className="w-4 h-4 text-slate-400" />
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
        <Brain className="w-6 h-6" />
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
          onSendMessage={(message) => {
            // Handle AI message processing here
            console.log('AI modal message:', message);
          }}
          onClose={() => setShowAIChat(false)}
          isConnected={true}
          maxMessages={100}
        />
      )}
    </div>
  );
};

export default EmailTaskDashboard;
