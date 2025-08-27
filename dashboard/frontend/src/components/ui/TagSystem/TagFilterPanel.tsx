/**
 * Apple MCP Knowledge Base - Tag Filter Panel Component
 * 
 * Advanced filtering interface for the hierarchical tagging system
 * with category-based filters, quality controls, and advanced options.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { 
  TagFilterPanelProps, 
  TagSearchFilters, 
  TagTaxonomy,
  TagCategoryName 
} from '../../../types/TagTypes';

// Mock taxonomy data - in real app this would come from API
const TAG_TAXONOMY: Partial<TagTaxonomy> = {
  'source-type': {
    values: ['documentation', 'code', 'specs', 'guides', 'tutorials', 'blog', 'api-docs', 'examples'],
    description: 'Type of content source',
    weight: 1.0,
    mandatory: true
  },
  'technology': {
    values: [
      'react', 'typescript', 'javascript', 'node.js', 'express', 'postgresql', 
      'redis', 'openai', 'claude', 'tailwindcss', 'vite', 'jest', 'playwright',
      'docker', 'pm2', 'nginx', 'aws', 'git', 'github', 'mcp', 'archon'
    ],
    description: 'Technologies, frameworks, and tools',
    weight: 0.9,
    mandatory: false,
    allowMultiple: true
  },
  'domain': {
    values: [
      'frontend', 'backend', 'database', 'ai', 'testing', 'deployment', 
      'devops', 'security', 'performance', 'architecture', 'ui-ux'
    ],
    description: 'Primary domain or focus area',
    weight: 0.8,
    mandatory: true,
    allowMultiple: true
  },
  'complexity': {
    values: ['beginner', 'intermediate', 'advanced', 'expert'],
    description: 'Content complexity and required skill level',
    weight: 0.7,
    mandatory: true
  },
  'use-case': {
    values: [
      'development', 'debugging', 'optimization', 'security', 'deployment',
      'testing', 'monitoring', 'integration', 'maintenance', 'troubleshooting'
    ],
    description: 'Primary use case or application',
    weight: 0.6,
    mandatory: false,
    allowMultiple: true
  },
  'content-features': {
    values: [
      'code-examples', 'step-by-step', 'visual-diagrams', 'interactive',
      'video-content', 'downloadable', 'live-demo', 'case-study'
    ],
    description: 'Special content features and characteristics',
    weight: 0.5,
    mandatory: false,
    allowMultiple: true
  }
};

interface TagFilterItemProps {
  category: TagCategoryName;
  categoryConfig: TagTaxonomy[TagCategoryName];
  selectedValues: string[];
  onSelectionChange: (category: string, values: string[]) => void;
}

const TagFilterItem: React.FC<TagFilterItemProps> = ({
  category,
  categoryConfig,
  selectedValues,
  onSelectionChange
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredValues = useMemo(() => {
    if (!searchTerm) return categoryConfig.values;
    return categoryConfig.values.filter(value =>
      value.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categoryConfig.values, searchTerm]);

  const handleValueToggle = useCallback((value: string) => {
    const newSelection = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    
    onSelectionChange(category, newSelection);
  }, [category, selectedValues, onSelectionChange]);

  const handleSelectAll = useCallback(() => {
    onSelectionChange(category, filteredValues);
  }, [category, filteredValues, onSelectionChange]);

  const handleClearAll = useCallback(() => {
    onSelectionChange(category, []);
  }, [category, onSelectionChange]);

  const categoryDisplayName = category.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <h3 className="font-medium text-gray-900">{categoryDisplayName}</h3>
          {categoryConfig.mandatory && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Required
            </span>
          )}
          {selectedValues.length > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {selectedValues.length} selected
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            {filteredValues.length} options
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-3">{categoryConfig.description}</p>
          
          {/* Search and bulk actions */}
          <div className="flex items-center space-x-2 mb-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg
                className="absolute right-3 top-2.5 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              onClick={handleSelectAll}
              className="px-3 py-2 text-xs font-medium text-blue-600 hover:text-blue-500"
            >
              All
            </button>
            <button
              onClick={handleClearAll}
              className="px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-500"
              disabled={selectedValues.length === 0}
            >
              Clear
            </button>
          </div>

          {/* Tag options */}
          <div className="max-h-48 overflow-y-auto">
            <div className="grid grid-cols-1 gap-2">
              {filteredValues.map((value) => (
                <label
                  key={value}
                  className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(value)}
                    onChange={() => handleValueToggle(value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700 flex-1">{value}</span>
                  {/* Usage count could be added here if available */}
                </label>
              ))}
            </div>
          </div>

          {filteredValues.length === 0 && searchTerm && (
            <div className="text-center py-4 text-sm text-gray-500">
              No tags found matching "{searchTerm}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TagFilterPanel: React.FC<TagFilterPanelProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
  showQualityFilter = true,
  showAdvancedOptions = false
}) => {
  const [qualityThreshold, setQualityThreshold] = useState(30);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(showAdvancedOptions);

  const handleCategoryChange = useCallback((category: string, values: string[]) => {
    onFiltersChange({
      ...filters,
      [category]: values.length > 0 ? values : undefined
    });
  }, [filters, onFiltersChange]);

  const getTotalSelectedCount = useMemo(() => {
    return Object.values(filters).reduce((total, categoryValues) => {
      return total + (categoryValues?.length || 0);
    }, 0);
  }, [filters]);

  const hasActiveFilters = getTotalSelectedCount > 0;

  return (
    <div className="bg-gray-50 border-r border-gray-200 w-80 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Filter by Tags</h2>
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="text-sm text-red-600 hover:text-red-500 font-medium"
            >
              Clear All ({getTotalSelectedCount})
            </button>
          )}
        </div>
        
        {hasActiveFilters && (
          <div className="mt-2 text-sm text-gray-600">
            {getTotalSelectedCount} filter{getTotalSelectedCount !== 1 ? 's' : ''} applied
          </div>
        )}
      </div>

      {/* Filter Categories */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Object.entries(TAG_TAXONOMY).map(([category, config]) => {
          if (!config) return null;
          return (
            <TagFilterItem
              key={category}
              category={category as TagCategoryName}
              categoryConfig={config}
              selectedValues={(filters[category as keyof TagSearchFilters] as string[]) || []}
              onSelectionChange={handleCategoryChange}
            />
          );
        })}

        {/* Quality Filter */}
        {showQualityFilter && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h3 className="font-medium text-gray-900 mb-3">Quality Score</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-700">Minimum Quality</label>
                <span className="text-sm font-medium text-gray-900">{qualityThreshold}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={qualityThreshold}
                onChange={(e) => setQualityThreshold(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Options */}
        {showAdvancedOptions && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div 
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            >
              <h3 className="font-medium text-gray-900">Advanced Options</h3>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {isAdvancedOpen && (
              <div className="border-t border-gray-200 p-4 space-y-4">
                <div>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                    <span className="text-sm text-gray-700">Include AI-suggested tags</span>
                  </label>
                </div>
                <div>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                    <span className="text-sm text-gray-700">Show validation scores</span>
                  </label>
                </div>
                <div>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                    <span className="text-sm text-gray-700">Group by confidence level</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="text-xs text-gray-500 text-center">
          Use filters to narrow down your search results.<br />
          Higher quality scores indicate more reliable content.
        </div>
      </div>
    </div>
  );
};

export default TagFilterPanel;