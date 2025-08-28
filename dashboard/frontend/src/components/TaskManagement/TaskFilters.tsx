import React from 'react';
import { TaskStatus, TaskPriority, TaskFilters as TaskFiltersType } from '../../types/Task';

interface TaskFiltersProps {
  filters: TaskFiltersType;
  onFiltersChange: (filters: TaskFiltersType) => void;
  className?: string;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({
  filters,
  onFiltersChange,
  className = ''
}) => {
  const handleStatusChange = (status: TaskStatus | 'all' | undefined) => {
    onFiltersChange({ ...filters, status });
  };

  const handlePriorityChange = (priority: TaskPriority | 'all' | undefined) => {
    onFiltersChange({ ...filters, priority });
  };

  const handleSearchChange = (search: string) => {
    onFiltersChange({ ...filters, search });
  };

  return (
    <div className={`task-filters space-y-4 ${className}`}>
      {/* Search Input */}
      <div>
        <label htmlFor="task-search" className="block text-sm font-medium text-gray-700 mb-1">
          Search Tasks
        </label>
        <input
          id="task-search"
          type="text"
          value={filters.search || ''}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by title or description..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Status Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status
        </label>
        <select
          value={filters.status || 'all'}
          onChange={(e) => handleStatusChange(e.target.value as TaskStatus | 'all' || undefined)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="todo">To Do</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Priority Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Priority
        </label>
        <select
          value={filters.priority || 'all'}
          onChange={(e) => handlePriorityChange(e.target.value as TaskPriority | 'all' || undefined)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Clear Filters Button */}
      <button
        onClick={() => onFiltersChange({ status: 'all', priority: 'all', search: '' })}
        className="w-full px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
      >
        Clear Filters
      </button>
    </div>
  );
};

export default TaskFilters;