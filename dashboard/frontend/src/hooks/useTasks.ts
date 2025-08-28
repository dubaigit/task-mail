import { useState, useCallback, useRef } from 'react';

interface LegacyTask {
  id: string;
  title?: string;
  taskTitle?: string;
  subject?: string;
  description?: string;
  taskDescription?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | 'completed';
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

interface UseTasksOptions {
  initialFilter?: 'all' | 'tasks' | 'non-tasks';
  initialDateFilter?: 'today' | 'week' | 'month' | 'all';
}

export const useTasks = (options: UseTasksOptions = {}) => {
  const [tasks, setTasks] = useState<LegacyTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [filter, setFilter] = useState<'all' | 'tasks' | 'non-tasks'>(
    options.initialFilter || 'tasks'
  );
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>(
    options.initialDateFilter || 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Statistics state
  const [stats, setStats] = useState({
    efficiency: 0,
    totalTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    completedTasks: 0,
    averageResponseTime: 0
  });

  // Lazy loading ref
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Fetch tasks from API
  const fetchTasks = useCallback(async (reset = false) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const newOffset = reset ? 0 : offset;
      
      // Build query parameters
      const params = new URLSearchParams({
        limit: '50',
        offset: newOffset.toString(),
        filter,
        dateRange: dateFilter,
        ...(searchQuery && { search: searchQuery }),
        ...(categoryFilter !== 'all' && { category: categoryFilter }),
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tasks';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [loading, offset, filter, dateFilter, searchQuery, categoryFilter]);

  // Fetch statistics
  const fetchStatistics = useCallback(async () => {
    try {
      const response = await fetch('/api/stats');
      if (response.ok) {
        const statsData = await response.json();
        setStats(statsData);
      }
    } catch (err) {
      // Statistics fetch failed silently
    }
  }, []);

  // Load more tasks (for infinite scrolling)
  const loadMoreTasks = useCallback(() => {
    if (!loading && hasMore) {
      fetchTasks(false);
    }
  }, [fetchTasks, loading, hasMore]);

  // Refresh tasks
  const refreshTasks = useCallback(() => {
    setOffset(0);
    setHasMore(true);
    fetchTasks(true);
    fetchStatistics();
  }, [fetchTasks, fetchStatistics]);

  // Last task element ref for intersection observer
  const lastTaskElementRef = useCallback((node: HTMLElement | null) => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreTasks();
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [loading, hasMore, loadMoreTasks]);

  // Filter functions
  const updateFilter = useCallback((newFilter: 'all' | 'tasks' | 'non-tasks') => {
    setFilter(newFilter);
    refreshTasks();
  }, [refreshTasks]);

  const updateDateFilter = useCallback((newDateFilter: 'today' | 'week' | 'month' | 'all') => {
    setDateFilter(newDateFilter);
    refreshTasks();
  }, [refreshTasks]);

  const updateSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
    // Debounce search if needed
    refreshTasks();
  }, [refreshTasks]);

  const updateCategoryFilter = useCallback((category: string) => {
    setCategoryFilter(category);
    refreshTasks();
  }, [refreshTasks]);

  // Computed values
  const getFilteredTasks = useCallback((
    taskFilter: 'all' | 'tasks' | 'non-tasks',
    dateRange: 'today' | 'week' | 'month' | 'all',
    search: string,
    category: string
  ) => {
    let filtered = [...tasks];

    // Apply task type filter
    if (taskFilter === 'tasks') {
      filtered = filtered.filter(task => task.isTask !== false);
    } else if (taskFilter === 'non-tasks') {
      filtered = filtered.filter(task => task.isTask === false);
    }

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(task => 
        (task.title || task.taskTitle || task.subject || '').toLowerCase().includes(searchLower) ||
        (task.description || task.taskDescription || task.snippet || '').toLowerCase().includes(searchLower) ||
        task.sender.toLowerCase().includes(searchLower)
      );
    }

    // Apply category filter
    if (category !== 'all') {
      filtered = filtered.filter(task => task.classification === category);
    }

    // Apply date filter
    if (dateRange !== 'all') {
      const now = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
      }
      
      filtered = filtered.filter(task => {
        const taskDate = task.createdAt || new Date(task.date || 0);
        return taskDate >= startDate;
      });
    }

    return filtered;
  }, [tasks]);

  const getTaskStats = useCallback(() => {
    const total = tasks.length;
    const completed = tasks.filter(task => task.status === 'completed').length;
    const pending = tasks.filter(task => task.status === 'pending').length;
    const inProgress = tasks.filter(task => task.status === 'in-progress').length;
    
    return {
      total,
      completed,
      pending,
      inProgress,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }, [tasks]);

  const getCategoryCounts = useCallback(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(task => {
      const category = task.classification || 'OTHER';
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }, [tasks]);

  const resetTasks = useCallback(() => {
    setTasks([]);
    setOffset(0);
    setHasMore(true);
    fetchTasks(true);
  }, [fetchTasks]);

  const loadMore = useCallback(() => {
    loadMoreTasks();
  }, [loadMoreTasks]);

  return {
    // Data
    tasks,
    stats,
    loading,
    error,
    hasMore,
    
    // Filters
    filter,
    dateFilter,
    searchQuery,
    categoryFilter,
    
    // Actions
    fetchTasks,
    refreshTasks,
    loadMoreTasks,
    lastTaskElementRef,
    updateFilter,
    updateDateFilter,
    updateSearchQuery,
    updateCategoryFilter,
    
    // Computed values
    getFilteredTasks,
    getTaskStats,
    getCategoryCounts,
    resetTasks,
    loadMore,
    
    // Setters (for direct control if needed)
    setTasks,
    setFilter,
    setDateFilter,
    setSearchQuery,
    setCategoryFilter
  };
};
