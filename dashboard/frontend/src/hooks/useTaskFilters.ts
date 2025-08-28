import { useState, useCallback, useMemo } from 'react';
import { useDebounce } from './useDebounce';

interface UseTaskFiltersOptions {
  initialFilter?: 'all' | 'tasks' | 'non-tasks';
  initialDateFilter?: 'today' | 'week' | 'month' | 'all';
  initialSearchQuery?: string;
  initialCategoryFilter?: string;
  debounceDelay?: number;
}

interface UseTaskFiltersReturn {
  // Current filter state
  filter: 'all' | 'tasks' | 'non-tasks';
  dateFilter: 'today' | 'week' | 'month' | 'all';
  searchQuery: string;
  categoryFilter: string;
  
  // Debounced values (for performance)
  debouncedSearchQuery: string;
  
  // Filter actions
  setFilter: (filter: 'all' | 'tasks' | 'non-tasks') => void;
  setDateFilter: (filter: 'today' | 'week' | 'month' | 'all') => void;
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category: string) => void;
  
  // Bulk actions
  resetFilters: () => void;
  setFilters: (filters: Partial<{
    filter: 'all' | 'tasks' | 'non-tasks';
    dateFilter: 'today' | 'week' | 'month' | 'all';
    searchQuery: string;
    categoryFilter: string;
  }>) => void;
  
  // Helper functions
  isFiltered: boolean;
  getActiveFilterCount: () => number;
  getFilterSummary: () => string;
}

export const useTaskFilters = (options: UseTaskFiltersOptions = {}): UseTaskFiltersReturn => {
  const {
    initialFilter = 'tasks',
    initialDateFilter = 'all',
    initialSearchQuery = '',
    initialCategoryFilter = 'all',
    debounceDelay = 300
  } = options;

  // Filter state
  const [filter, setFilter] = useState<'all' | 'tasks' | 'non-tasks'>(initialFilter);
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>(initialDateFilter);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [categoryFilter, setCategoryFilter] = useState(initialCategoryFilter);

  // Debounced search query for performance
  const debouncedSearchQuery = useDebounce(searchQuery, debounceDelay);

  // Reset all filters to defaults
  const resetFilters = useCallback(() => {
    setFilter(initialFilter);
    setDateFilter(initialDateFilter);
    setSearchQuery(initialSearchQuery);
    setCategoryFilter(initialCategoryFilter);
  }, [initialFilter, initialDateFilter, initialSearchQuery, initialCategoryFilter]);

  // Set multiple filters at once
  const setFilters = useCallback((filters: Partial<{
    filter: 'all' | 'tasks' | 'non-tasks';
    dateFilter: 'today' | 'week' | 'month' | 'all';
    searchQuery: string;
    categoryFilter: string;
  }>) => {
    if (filters.filter !== undefined) setFilter(filters.filter);
    if (filters.dateFilter !== undefined) setDateFilter(filters.dateFilter);
    if (filters.searchQuery !== undefined) setSearchQuery(filters.searchQuery);
    if (filters.categoryFilter !== undefined) setCategoryFilter(filters.categoryFilter);
  }, []);

  // Check if any filters are active (different from defaults)
  const isFiltered = useMemo(() => {
    return (
      filter !== initialFilter ||
      dateFilter !== initialDateFilter ||
      searchQuery.trim() !== initialSearchQuery ||
      categoryFilter !== initialCategoryFilter
    );
  }, [filter, dateFilter, searchQuery, categoryFilter, initialFilter, initialDateFilter, initialSearchQuery, initialCategoryFilter]);

  // Count active filters
  const getActiveFilterCount = useCallback(() => {
    let count = 0;
    
    if (filter !== 'all') count++;
    if (dateFilter !== 'all') count++;
    if (searchQuery.trim()) count++;
    if (categoryFilter !== 'all') count++;
    
    return count;
  }, [filter, dateFilter, searchQuery, categoryFilter]);

  // Get human-readable filter summary
  const getFilterSummary = useCallback(() => {
    const parts: string[] = [];
    
    if (filter !== 'all') {
      parts.push(filter === 'tasks' ? 'Tasks only' : 'Non-tasks only');
    }
    
    if (dateFilter !== 'all') {
      const dateLabels = {
        today: 'Today',
        week: 'This week',
        month: 'This month'
      };
      parts.push(dateLabels[dateFilter as keyof typeof dateLabels]);
    }
    
    if (searchQuery.trim()) {
      parts.push(`Search: "${searchQuery}"`);
    }
    
    if (categoryFilter !== 'all') {
      parts.push(`Category: ${categoryFilter}`);
    }
    
    return parts.length > 0 ? parts.join(' • ') : 'No filters active';
  }, [filter, dateFilter, searchQuery, categoryFilter]);

  return {
    // Current state
    filter,
    dateFilter,
    searchQuery,
    categoryFilter,
    debouncedSearchQuery,
    
    // Actions
    setFilter,
    setDateFilter,
    setSearchQuery,
    setCategoryFilter,
    resetFilters,
    setFilters,
    
    // Helpers
    isFiltered,
    getActiveFilterCount,
    getFilterSummary
  };
};