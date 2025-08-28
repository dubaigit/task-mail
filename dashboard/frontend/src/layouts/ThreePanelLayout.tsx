import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  TaskPanelConfig, 
  TaskItem, 
  TaskCentricEmail, 
  TaskCentricDraft, 
  TaskFilter, 
  TaskNavigationCategory,
  TaskCardConfig,
  TaskCentricMetrics,
  TaskCentricPerformance
} from '../components/TaskCentric/types';
import { TaskPriority, TaskStatus } from '../types';
import { TagSearchFilters } from '../types/TagTypes';
import TaskNavigationPanel from '../components/TaskCentric/TaskNavigationPanel';
import TaskListPanel from '../components/TaskCentric/TaskListPanel';
import TaskDetailPanel from '../components/TaskCentric/TaskDetailPanel';
import TagFilterPanel from '../components/ui/TagSystem/TagFilterPanel';
import useTagSystem from '../hooks/useTagSystem';
import '../styles/TaskCentric.css';

/**
 * ThreePanelLayout - Main container for task-centric interface
 * 
 * BRIEF_RATIONALE: Implements the whitepaper-specified three-panel layout architecture
 * for task-centric email workflow. Provides hierarchical navigation, task cards with
 * visual urgency indicators, and integrated draft composition interface.
 * 
 * ASSUMPTIONS:
 * - Tasks are derived from email classification and AI analysis
 * - Left panel navigation follows Eisenhower Matrix principles
 * - Center panel supports virtual scrolling for performance
 * - Right panel integrates email thread and draft composition
 * 
 * DECISION_LOG:
 * - Used CSS Grid for flexible three-panel layout with responsive breakpoints
 * - Implemented collapsible panels for focused workflow modes
 * - Added keyboard navigation support for accessibility compliance
 * - Integrated performance monitoring for large task datasets
 * 
 * EVIDENCE: Based on whitepaper specifications for three-panel task-centric design
 * with hierarchical navigation, card-based task display, and AI-powered draft composition.
 */

interface ThreePanelLayoutProps {
  emails: TaskCentricEmail[];
  tasks: TaskItem[];
  drafts: TaskCentricDraft[];
  onTaskUpdate: (task: TaskItem) => void;
  onTaskComplete: (taskId: string) => void;
  onTaskDelete: (taskId: string) => void;
  onDraftCreate: (task: TaskItem) => void;
  onDraftUpdate: (draft: TaskCentricDraft) => void;
  onDraftSend: (draft: TaskCentricDraft) => void;
  isGeneratingDraft: boolean;
  className?: string;
}

const ThreePanelLayout: React.FC<ThreePanelLayoutProps> = ({
  emails,
  tasks,
  drafts,
  onTaskUpdate,
  onTaskComplete,
  onTaskDelete,
  onDraftCreate,
  onDraftUpdate,
  onDraftSend,
  isGeneratingDraft,
  className = ''
}) => {
  // Panel configuration state
  const [panelConfig, setPanelConfig] = useState<TaskPanelConfig>({
    showLeftPanel: true,
    showCenterPanel: true,
    showRightPanel: true,
    leftPanelWidth: 280,
    centerPanelWidth: 400,
    collapsedLeftPanel: false,
    collapsedRightPanel: false,
    selectedView: 'list',
    compactMode: false,
    autoExpandDetails: true
  });

  // Task management state
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all-tasks');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>({
    categories: [],
    urgencyLevels: [],
    statuses: [],
    showCompleted: false,
    sortBy: 'dueDate',
    sortOrder: 'asc'
  });

  // Task card configuration
  const [taskCardConfig] = useState<TaskCardConfig>({
    showAvatar: true,
    showPreview: true,
    showTags: true,
    showProgress: true,
    showDueDate: true,
    showAssignee: true,
    showUrgencyIndicator: true,
    expandedByDefault: false,
    maxPreviewLength: 150,
    enableQuickActions: true,
    enableDragAndDrop: false
  });

  // Tag filtering state
  const [showTagFilters, setShowTagFilters] = useState(false);
  const [tagFilters, setTagFilters] = useState<TagSearchFilters>({});
  
  // Initialize tag system hook
  const {
    searchWithTags,
    availableTags,
    loadAvailableTags,
    tagsLoading,
    tagsError
  } = useTagSystem({
    autoLoadTaxonomy: true,
    enableAnalytics: false,
    cacheResults: true
  });

  // Performance monitoring
  const [performanceMetrics, setPerformanceMetrics] = useState<TaskCentricPerformance>({
    renderTime: 0,
    memoryUsage: 0,
    taskLoadTime: 0,
    searchResponseTime: 0,
    filterResponseTime: 0,
    virtualScrollPerformance: {
      visibleItems: 0,
      totalItems: 0,
      scrollFps: 60
    }
  });

  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Navigation categories based on whitepaper specifications
  const navigationCategories: TaskNavigationCategory[] = useMemo(() => {
    const taskCounts = tasks.reduce((acc, task) => {
      const category = task.category || 'uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const urgencyCounts = tasks.reduce((acc, task) => {
      const urgency = task.urgency || 'MEDIUM';
      acc[urgency] = (acc[urgency] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      {
        id: 'all-tasks',
        label: 'All Tasks',
        icon: 'ListBulletIcon',
        count: tasks.length,
        color: '#6B7280'
      },
      {
        id: 'needs-reply',
        label: 'Needs Reply',
        icon: 'ChatBubbleLeftRightIcon',
        count: taskCounts['NEEDS_REPLY'] || 0,
        color: '#3B82F6'
      },
      {
        id: 'approval-required',
        label: 'Approval Required',
        icon: 'CheckCircleIcon',
        count: taskCounts['APPROVAL_REQUIRED'] || 0,
        color: '#F59E0B'
      },
      {
        id: 'delegate',
        label: 'Delegate',
        icon: 'UserGroupIcon',
        count: taskCounts['DELEGATE'] || 0,
        color: '#8B5CF6'
      },
      {
        id: 'do-myself',
        label: 'Do Myself',
        icon: 'UserIcon',
        count: taskCounts['DO_MYSELF'] || 0,
        color: '#10B981'
      },
      {
        id: 'follow-up',
        label: 'Follow Up',
        icon: 'ClockIcon',
        count: taskCounts['FOLLOW_UP'] || 0,
        color: '#F97316'
      },
      {
        id: 'urgent',
        label: 'Urgent',
        icon: 'ExclamationTriangleIcon',
        count: urgencyCounts[TaskPriority.CRITICAL] + urgencyCounts['HIGH'] || 0,
        color: '#EF4444',
        customFilter: {
          urgencyLevels: [TaskPriority.CRITICAL, TaskPriority.HIGH],
          categories: [],
          statuses: [],
          showCompleted: false,
          sortBy: 'urgency',
          sortOrder: 'desc'
        }
      }
    ];
  }, [tasks]);

  // Filtered tasks based on current selection and filters
  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    // Apply category filter
    if (selectedCategory !== 'all-tasks') {
      const category = navigationCategories.find(cat => cat.id === selectedCategory);
      if (category?.customFilter) {
        const filter = category.customFilter;
        if (filter.urgencyLevels?.length) {
          filtered = filtered.filter(task => filter.urgencyLevels!.includes(task.urgency));
        }
        if (filter.categories?.length) {
          filtered = filtered.filter(task => task.category && filter.categories!.includes(task.category));
        }
      } else {
        // Map category ID to task category
        const categoryMap: Record<string, string> = {
          'needs-reply': 'NEEDS_REPLY',
          'approval-required': 'APPROVAL_REQUIRED',
          'delegate': 'DELEGATE',
          'do-myself': 'DO_MYSELF',
          'follow-up': 'FOLLOW_UP'
        };
        const taskCategory = categoryMap[selectedCategory];
        if (taskCategory) {
          filtered = filtered.filter(task => task.category === taskCategory);
        }
      }
    }

    // Apply additional filters
    if (taskFilter.categories.length > 0) {
      filtered = filtered.filter(task => task.category && taskFilter.categories.includes(task.category));
    }

    if (taskFilter.urgencyLevels.length > 0) {
      filtered = filtered.filter(task => taskFilter.urgencyLevels.includes(task.urgency));
    }

    if (taskFilter.statuses.length > 0) {
      filtered = filtered.filter(task => taskFilter.statuses.includes(task.status));
    }

    if (!taskFilter.showCompleted) {
              filtered = filtered.filter(task => task.status !== TaskStatus.COMPLETED);
    }

    if (taskFilter.searchQuery) {
      const query = taskFilter.searchQuery.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let compareValue = 0;
      switch (taskFilter.sortBy) {
        case 'dueDate':
          compareValue = new Date(a.dueDate || '9999-12-31').getTime() - 
                        new Date(b.dueDate || '9999-12-31').getTime();
          break;
        case 'urgency':
          const urgencyOrder: Record<string, number> = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'URGENT': 4 };
          compareValue = (urgencyOrder[b.urgency] || 0) - (urgencyOrder[a.urgency] || 0);
          break;
        case 'createdAt':
          compareValue = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          break;
        case 'title':
          compareValue = a.title.localeCompare(b.title);
          break;
        case 'assignee':
          compareValue = (a.assignedTo || '').localeCompare(b.assignedTo || '');
          break;
      }
      return taskFilter.sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return filtered;
  }, [tasks, selectedCategory, taskFilter, navigationCategories]);

  // Get email for selected task
  const selectedEmail = useMemo(() => {
    if (!selectedTask) return null;
    return emails.find(email => email.id.toString() === selectedTask.emailId) || null;
  }, [selectedTask, emails]);

  // Get drafts for selected task
  const taskDrafts = useMemo(() => {
    if (!selectedTask) return [];
    return drafts.filter(draft => draft.taskId?.toString() === selectedTask.id?.toString() || draft.emailId?.toString() === selectedTask.emailId);
  }, [selectedTask, drafts]);

  // Handle task selection
  const handleTaskSelect = useCallback((task: TaskItem) => {
    setSelectedTask(task);
    if (panelConfig.autoExpandDetails && panelConfig.collapsedRightPanel) {
      setPanelConfig(prev => ({ ...prev, collapsedRightPanel: false }));
    }
  }, [panelConfig.autoExpandDetails, panelConfig.collapsedRightPanel]);

  // Handle category selection
  const handleCategorySelect = useCallback((categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedTask(null); // Clear selection when changing category
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilter: TaskFilter) => {
    setTaskFilter(newFilter);
    setSelectedTask(null); // Clear selection when filtering
  }, []);

  // Handle panel configuration changes
  const handleConfigChange = useCallback((newConfig: TaskPanelConfig) => {
    setPanelConfig(newConfig);
  }, []);

  // Handle tag filter changes
  const handleTagFiltersChange = useCallback((newFilters: TagSearchFilters) => {
    setTagFilters(newFilters);
    // Could trigger knowledge base search here if needed
  }, []);

  // Handle clear tag filters
  const handleClearTagFilters = useCallback(() => {
    setTagFilters({});
  }, []);

  // Toggle tag filter panel
  const handleToggleTagFilters = useCallback(() => {
    setShowTagFilters(prev => !prev);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case '1':
            event.preventDefault();
            setPanelConfig(prev => ({ ...prev, collapsedLeftPanel: !prev.collapsedLeftPanel }));
            break;
          case '2':
            event.preventDefault();
            setPanelConfig(prev => ({ ...prev, collapsedRightPanel: !prev.collapsedRightPanel }));
            break;
          case '3':
            event.preventDefault();
            setShowTagFilters(prev => !prev);
            break;
          case 'k':
            event.preventDefault();
            // Focus search input if available
            const searchInput = document.querySelector<HTMLInputElement>('[data-task-search]');
            searchInput?.focus();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Performance monitoring
  useEffect(() => {
    const startTime = performance.now();
    
    const updatePerformance = () => {
      const renderTime = performance.now() - startTime;
      setPerformanceMetrics(prev => ({
        ...prev,
        renderTime,
        taskLoadTime: renderTime,
        virtualScrollPerformance: {
          ...prev.virtualScrollPerformance,
          totalItems: filteredTasks.length,
          visibleItems: Math.min(20, filteredTasks.length) // Estimate visible items
        }
      }));
    };

    // Use RAF to measure actual render time
    requestAnimationFrame(updatePerformance);
  }, [filteredTasks]);

  // Responsive layout classes
  const layoutClasses = useMemo(() => {
    const baseClasses = 'task-centric-layout';
    const responsiveClasses = panelConfig.compactMode ? 'compact-mode' : 'standard-mode';
    const panelClasses = [
      panelConfig.collapsedLeftPanel && 'left-collapsed',
      panelConfig.collapsedRightPanel && 'right-collapsed'
    ].filter(Boolean).join(' ');

    return [baseClasses, responsiveClasses, panelClasses, className].filter(Boolean).join(' ');
  }, [panelConfig, className]);

  // Grid template columns for CSS Grid layout
  const gridTemplateColumns = useMemo(() => {
    const leftWidth = panelConfig.collapsedLeftPanel ? '60px' : `${panelConfig.leftPanelWidth}px`;
    const centerWidth = `${panelConfig.centerPanelWidth}px`;
    const rightWidth = panelConfig.collapsedRightPanel ? '60px' : '1fr';
    const tagWidth = showTagFilters ? '320px' : '0px';
    
    return showTagFilters 
      ? `${leftWidth} ${centerWidth} ${rightWidth} ${tagWidth}`
      : `${leftWidth} ${centerWidth} ${rightWidth}`;
  }, [panelConfig, showTagFilters]);

  return (
    <div 
      className={layoutClasses}
      style={{ 
        display: 'grid',
        gridTemplateColumns,
        height: '100vh',
        overflow: 'hidden',
        position: 'relative'
      }}
      role="application"
      aria-label="Task-centric email interface"
    >
      {/* Left Panel - Navigation */}
      {panelConfig.showLeftPanel && (
        <TaskNavigationPanel
          categories={navigationCategories}
          selectedCategory={selectedCategory}
          onCategorySelect={handleCategorySelect}
          filter={taskFilter}
          onFilterChange={handleFilterChange}
          collapsed={panelConfig.collapsedLeftPanel}
          onToggleCollapse={() => 
            setPanelConfig(prev => ({ ...prev, collapsedLeftPanel: !prev.collapsedLeftPanel }))
          }
          className="task-navigation-panel"
        />
      )}

      {/* Center Panel - Task List */}
      {panelConfig.showCenterPanel && (
        <TaskListPanel
          tasks={filteredTasks}
          selectedTask={selectedTask}
          onTaskSelect={handleTaskSelect}
          filter={taskFilter}
          config={taskCardConfig}
          onTaskUpdate={onTaskUpdate}
          onTaskComplete={onTaskComplete}
          onTaskDelete={onTaskDelete}
          loading={loading}
          error={error}
          className="task-list-panel"
        />
      )}

      {/* Right Panel - Task Detail and Draft */}
      {panelConfig.showRightPanel && (
        <TaskDetailPanel
          task={selectedTask}
          email={selectedEmail}
          drafts={taskDrafts}
          onTaskUpdate={onTaskUpdate}
          onDraftCreate={onDraftCreate}
          onDraftUpdate={onDraftUpdate}
          onDraftSend={onDraftSend}
          isGeneratingDraft={isGeneratingDraft}
          className="task-detail-panel"
        />
      )}

      {/* Tag Filter Panel (conditionally rendered) */}
      {showTagFilters && (
        <TagFilterPanel
          filters={tagFilters}
          onFiltersChange={handleTagFiltersChange}
          onClearFilters={handleClearTagFilters}
          showQualityFilter={true}
          showAdvancedOptions={false}
          className="tag-filter-panel"
        />
      )}

      {/* Performance indicator (development mode) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="performance-indicator">
          <span title={`Render: ${performanceMetrics.renderTime.toFixed(1)}ms | Tasks: ${filteredTasks.length}`}>
            ⚡ {filteredTasks.length} tasks
          </span>
        </div>
      )}
    </div>
  );
};

export default React.memo(ThreePanelLayout);