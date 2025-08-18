import React from 'react';
import {
  MagnifyingGlassIcon,
  StarIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { TemplateFilters as FiltersType } from './types';

interface TemplateFiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
}

export const TemplateFilters: React.FC<TemplateFiltersProps> = ({
  filters,
  onFiltersChange
}) => {
  const updateFilter = (key: keyof FiltersType, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search templates..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Filter options */}
      <div className="flex items-center space-x-4 text-sm">
        <select
          value={filters.category}
          onChange={(e) => updateFilter('category', e.target.value)}
          className="px-3 py-1.5 border border-border rounded-md bg-background text-foreground"
        >
          <option value="all">All Categories</option>
          <option value="response">Response</option>
          <option value="follow-up">Follow-up</option>
          <option value="approval">Approval</option>
          <option value="delegation">Delegation</option>
          <option value="meeting">Meeting</option>
          <option value="custom">Custom</option>
        </select>

        <label className="flex items-center space-x-1">
          <input
            type="checkbox"
            checked={filters.starred}
            onChange={(e) => updateFilter('starred', e.target.checked)}
            className="rounded border-gray-300"
          />
          <StarIcon className="w-4 h-4" />
          <span>Starred</span>
        </label>

        <label className="flex items-center space-x-1">
          <input
            type="checkbox"
            checked={filters.recentlyUsed}
            onChange={(e) => updateFilter('recentlyUsed', e.target.checked)}
            className="rounded border-gray-300"
          />
          <ClockIcon className="w-4 h-4" />
          <span>Recently Used</span>
        </label>
      </div>
    </div>
  );
};