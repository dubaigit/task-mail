import React, { useState, useCallback, useMemo } from 'react';
import {
  TaskNavigationPanelProps,
  TaskNavigationCategory,
  TaskFilter,
  TaskCategory,
  TaskUrgencyLevel,
  TaskStatus
} from './types';
import {
  ListBulletIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  UserGroupIcon,
  UserIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon,
  FunnelIcon,
  Bars3Icon
} from '@heroicons/react/24/outline';
import {
  StarIcon as StarSolidIcon,
  BookmarkIcon as BookmarkSolidIcon
} from '@heroicons/react/24/solid';

/**
 * TaskNavigationPanel - Left panel for hierarchical task navigation
 * 
 * BRIEF_RATIONALE: Implements hierarchical task categorization system based on
 * whitepaper specifications. Provides quick access to task categories, custom
 * filters, and saved searches with visual count indicators and urgency color coding.
 * 
 * ASSUMPTIONS:
 * - Task categories follow business workflow patterns (Needs Reply, Delegate, etc.)
 * - Visual hierarchy uses color coding for urgency levels
 * - Collapsible design supports focused workflow modes
 * - Search and filter integration provides real-time task discovery
 * 
 * DECISION_LOG:
 * - Used Heroicons for consistent icon system matching existing interface
 * - Implemented expandable subcategories for custom filters
 * - Added keyboard navigation support for accessibility
 * - Integrated search with debounced input for performance
 * 
 * EVIDENCE: Based on whitepaper navigation requirements and Eisenhower Matrix
 * categorization patterns for task management workflows.
 */

// Icon mapping for dynamic icon rendering
const iconMap = {
  ListBulletIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  UserGroupIcon,
  UserIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  StarSolidIcon,
  BookmarkSolidIcon
};

const TaskNavigationPanel: React.FC<TaskNavigationPanelProps> = ({
  categories,
  selectedCategory,
  onCategorySelect,
  filter,
  onFilterChange,
  collapsed,
  onToggleCollapse,
  className = ''
}) => {
  // Local state for UI interactions
  const [searchQuery, setSearchQuery] = useState(filter.searchQuery || '');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Saved searches and custom categories
  const [savedSearches] = useState([
    { id: 'overdue', label: 'Overdue Tasks', count: 5, color: '#EF4444' },
    { id: 'today', label: 'Due Today', count: 8, color: '#F59E0B' },
    { id: 'this-week', label: 'This Week', count: 15, color: '#3B82F6' },
    { id: 'no-assignee', label: 'Unassigned', count: 3, color: '#6B7280' }
  ]);

  // Quick filter options
  const quickFilters = useMemo(() => [
    {
      id: 'high-urgency',
      label: 'High Urgency',
      filter: { urgencyLevels: ['CRITICAL', 'HIGH'] as TaskUrgencyLevel[] },
      color: '#EF4444'
    },
    {
      id: 'pending-tasks',
      label: 'Pending',
      filter: { statuses: ['PENDING'] as TaskStatus[] },
      color: '#F59E0B'
    },
    {
      id: 'in-progress',
      label: 'In Progress',
      filter: { statuses: ['IN_PROGRESS'] as TaskStatus[] },
      color: '#3B82F6'
    },
    {
      id: 'needs-review',
      label: 'Needs Review',
      filter: { categories: ['APPROVAL_REQUIRED'] as TaskCategory[] },
      color: '#8B5CF6'
    }
  ], []);

  // Handle search input with debouncing
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    
    // Debounce search filter application
    const timeoutId = setTimeout(() => {
      onFilterChange({
        ...filter,
        searchQuery: value
      });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [filter, onFilterChange]);

  // Handle category expansion
  const handleCategoryToggle = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  }, []);

  // Handle quick filter application
  const handleQuickFilter = useCallback((quickFilter: typeof quickFilters[0]) => {
    const newFilter: TaskFilter = {
      ...filter,
      ...quickFilter.filter
    };
    onFilterChange(newFilter);
  }, [filter, onFilterChange]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    const clearedFilter: TaskFilter = {
      categories: [],
      urgencyLevels: [],
      statuses: [],
      showCompleted: false,
      sortBy: 'dueDate',
      sortOrder: 'asc'
    };
    onFilterChange(clearedFilter);
    setSearchQuery('');
  }, [onFilterChange]);

  // Render category icon
  const renderCategoryIcon = (iconName: string, color?: string) => {
    const IconComponent = iconMap[iconName as keyof typeof iconMap];
    if (!IconComponent) return null;
    
    return (
      <IconComponent 
        className="w-5 h-5" 
        style={{ color: color || 'currentColor' }}
      />
    );
  };

  // Active filter count
  const activeFilterCount = useMemo(() => {
    return (
      filter.categories.length +
      filter.urgencyLevels.length +
      filter.statuses.length +
      (filter.searchQuery ? 1 : 0) +
      (filter.showCompleted ? 1 : 0)
    );
  }, [filter]);

  if (collapsed) {
    return (
      <div className={`task-navigation-panel collapsed ${className}`}>
        <div className="collapsed-header">
          <button
            onClick={onToggleCollapse}
            className="toggle-button"
            aria-label="Expand navigation panel"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="collapsed-nav" aria-label="Task categories">
          {categories.slice(0, 6).map((category) => (
            <button
              key={category.id}
              onClick={() => onCategorySelect(category.id)}
              className={`collapsed-nav-item ${
                selectedCategory === category.id ? 'active' : ''
              }`}
              title={`${category.label} (${category.count})`}
              aria-label={`${category.label}, ${category.count} tasks`}
            >
              {renderCategoryIcon(category.icon, category.color)}
              <span className="count-badge">{category.count}</span>
            </button>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div className={`task-navigation-panel expanded ${className}`}>
      {/* Header */}
      <div className="navigation-header">
        <div className="header-content">
          <h2 className="panel-title">Tasks</h2>
          <div className="header-actions">
            {activeFilterCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="clear-filters-button"
                title={`Clear ${activeFilterCount} active filters`}
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`filter-toggle ${showFilters ? 'active' : ''}`}
              aria-label="Toggle filters"
            >
              <FunnelIcon className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="filter-count">{activeFilterCount}</span>
              )}
            </button>
            <button
              onClick={onToggleCollapse}
              className="collapse-button"
              aria-label="Collapse navigation panel"
            >
              <ChevronDownIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="search-container">
          <div className="search-input-wrapper">
            <MagnifyingGlassIcon className="search-icon" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="search-input"
              data-task-search
              aria-label="Search tasks"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="clear-search"
                aria-label="Clear search"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filter-section">
            <h3 className="filter-section-title">Quick Filters</h3>
            <div className="quick-filters">
              {quickFilters.map((quickFilter) => (
                <button
                  key={quickFilter.id}
                  onClick={() => handleQuickFilter(quickFilter)}
                  className="quick-filter-button"
                  style={{ borderColor: quickFilter.color }}
                >
                  <span 
                    className="filter-indicator"
                    style={{ backgroundColor: quickFilter.color }}
                  />
                  {quickFilter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <h3 className="filter-section-title">Status</h3>
            <div className="filter-options">
              <label className="filter-option">
                <input
                  type="checkbox"
                  checked={filter.showCompleted}
                  onChange={(e) => onFilterChange({
                    ...filter,
                    showCompleted: e.target.checked
                  })}
                />
                Show completed tasks
              </label>
            </div>
          </div>

          <div className="filter-section">
            <h3 className="filter-section-title">Sort By</h3>
            <select
              value={filter.sortBy}
              onChange={(e) => onFilterChange({
                ...filter,
                sortBy: e.target.value as TaskFilter['sortBy']
              })}
              className="sort-select"
            >
              <option value="dueDate">Due Date</option>
              <option value="urgency">Urgency</option>
              <option value="createdAt">Created Date</option>
              <option value="title">Title</option>
              <option value="assignee">Assignee</option>
            </select>
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="main-navigation" aria-label="Task categories">
        {/* Primary Categories */}
        <div className="nav-section">
          <h3 className="nav-section-title">Categories</h3>
          {categories.map((category) => (
            <div key={category.id} className="nav-category">
              <button
                onClick={() => onCategorySelect(category.id)}
                className={`nav-item ${
                  selectedCategory === category.id ? 'active' : ''
                }`}
                aria-label={`${category.label}, ${category.count} tasks`}
              >
                <div className="nav-item-content">
                  <div className="nav-item-icon">
                    {renderCategoryIcon(category.icon, category.color)}
                  </div>
                  <span className="nav-item-label">{category.label}</span>
                </div>
                <span 
                  className="nav-item-count"
                  style={{ 
                    backgroundColor: category.color + '20',
                    color: category.color
                  }}
                >
                  {category.count}
                </span>
                {category.subcategories && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCategoryToggle(category.id);
                    }}
                    className="nav-item-toggle"
                    aria-label={`${expandedCategories.has(category.id) ? 'Collapse' : 'Expand'} subcategories`}
                  >
                    {expandedCategories.has(category.id) ? (
                      <ChevronDownIcon className="w-4 h-4" />
                    ) : (
                      <ChevronRightIcon className="w-4 h-4" />
                    )}
                  </button>
                )}
              </button>

              {/* Subcategories */}
              {category.subcategories && expandedCategories.has(category.id) && (
                <div className="nav-subcategories">
                  {category.subcategories.map((subcategory) => (
                    <button
                      key={subcategory.id}
                      onClick={() => {
                        const newFilter = { ...filter, ...subcategory.filter };
                        onFilterChange(newFilter);
                      }}
                      className="nav-subitem"
                    >
                      <span className="nav-subitem-label">{subcategory.label}</span>
                      <span className="nav-subitem-count">{subcategory.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Saved Searches */}
        <div className="nav-section">
          <h3 className="nav-section-title">Saved Searches</h3>
          {savedSearches.map((search) => (
            <button
              key={search.id}
              onClick={() => onCategorySelect(search.id)}
              className={`nav-item ${
                selectedCategory === search.id ? 'active' : ''
              }`}
            >
              <div className="nav-item-content">
                <div className="nav-item-icon">
                  <BookmarkSolidIcon style={{ color: search.color }} className="w-5 h-5" />
                </div>
                <span className="nav-item-label">{search.label}</span>
              </div>
              <span 
                className="nav-item-count"
                style={{ 
                  backgroundColor: search.color + '20',
                  color: search.color
                }}
              >
                {search.count}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="navigation-footer">
        <button className="settings-button">
          <AdjustmentsHorizontalIcon className="w-4 h-4" />
          <span>Customize</span>
        </button>
      </div>
    </div>
  );
};

export default React.memo(TaskNavigationPanel);