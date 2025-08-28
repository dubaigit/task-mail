/**
 * Apple MCP Knowledge Base - Tag Selector Component
 * 
 * Interactive tag selection component for applying tags to documents
 * with AI suggestions, validation, and bulk operations support.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  TagSelectorProps, 
  TagSearchFilters, 
  TagSuggestion,
  TagCategoryName,
  isValidTagCategory 
} from '../../../types/TagTypes';

interface TagSuggestionItemProps {
  suggestion: TagSuggestion;
  category: string;
  isSelected: boolean;
  onToggle: (category: string, value: string) => void;
  showConfidence?: boolean;
}

const TagSuggestionItem: React.FC<TagSuggestionItemProps> = ({
  suggestion,
  category,
  isSelected,
  onToggle,
  showConfidence = true
}) => {
  const confidenceColor = useMemo(() => {
    if (suggestion.confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (suggestion.confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  }, [suggestion.confidence]);

  const confidenceText = useMemo(() => {
    if (suggestion.confidence >= 0.8) return 'High';
    if (suggestion.confidence >= 0.6) return 'Medium';
    return 'Low';
  }, [suggestion.confidence]);

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all ${
        isSelected 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
      onClick={() => onToggle(category, suggestion.value)}
    >
      <div className="flex items-center space-x-3 flex-1">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}} // Handled by parent onClick
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <div className="flex-1">
          <div className="font-medium text-gray-900">{suggestion.value}</div>
          {suggestion.reasoning && (
            <div className="text-sm text-gray-600 mt-1">{suggestion.reasoning}</div>
          )}
        </div>
      </div>
      
      {showConfidence && (
        <div className="flex items-center space-x-2 ml-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${confidenceColor}`}>
            {confidenceText}
          </span>
          <span className="text-xs text-gray-500">
            {Math.round(suggestion.confidence * 100)}%
          </span>
        </div>
      )}
    </div>
  );
};

interface CategorySectionProps {
  category: TagCategoryName;
  categoryConfig: any;
  selectedTags: string[];
  suggestions?: TagSuggestion[];
  onTagChange: (category: string, values: string[]) => void;
  disabled?: boolean;
  maxSelections?: number;
  showDescriptions?: boolean;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  categoryConfig,
  selectedTags,
  suggestions = [],
  onTagChange,
  disabled = false,
  maxSelections,
  showDescriptions = true
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [customTagInput, setCustomTagInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleTagToggle = useCallback((tagValue: string) => {
    if (disabled) return;

    const newSelection = selectedTags.includes(tagValue)
      ? selectedTags.filter(t => t !== tagValue)
      : [...selectedTags, tagValue];

    // Respect single selection limitation
    if (!categoryConfig.allowMultiple && newSelection.length > 1) {
      onTagChange(category, [tagValue]);
      return;
    }

    // Respect max selections
    if (maxSelections && newSelection.length > maxSelections) {
      return;
    }

    onTagChange(category, newSelection);
  }, [category, selectedTags, onTagChange, disabled, categoryConfig.allowMultiple, maxSelections]);

  const handleCustomTagAdd = useCallback(() => {
    if (!customTagInput.trim() || selectedTags.includes(customTagInput.trim())) {
      return;
    }

    const newTag = customTagInput.trim().toLowerCase();
    handleTagToggle(newTag);
    setCustomTagInput('');
    setShowCustomInput(false);
  }, [customTagInput, selectedTags, handleTagToggle]);

  const categoryDisplayName = category.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');

  const availableTags = useMemo(() => {
    // Combine predefined tags with suggestions
    const predefinedTags = categoryConfig.values.map((value: string) => ({
      value,
      confidence: 1.0,
      reasoning: 'Predefined tag'
    }));

    const suggestionValues = suggestions.map(s => s.value);
    const uniquePredefined = predefinedTags.filter((t: any) => !suggestionValues.includes(t.value));

    return [...suggestions, ...uniquePredefined];
  }, [categoryConfig.values, suggestions]);

  const hasSelectionLimit = !categoryConfig.allowMultiple || (maxSelections && maxSelections > 0);
  const selectionLimitReached = hasSelectionLimit && selectedTags.length >= (maxSelections || 1);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => !disabled && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <h3 className="font-medium text-gray-900">{categoryDisplayName}</h3>
          {categoryConfig.mandatory && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              Required
            </span>
          )}
          {selectedTags.length > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {selectedTags.length} selected
            </span>
          )}
          {suggestions.length > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {suggestions.length} AI suggestions
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {hasSelectionLimit && (
            <span className="text-xs text-gray-500">
              {selectedTags.length}/{maxSelections || 1}
            </span>
          )}
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
          {showDescriptions && (
            <p className="text-sm text-gray-600 mb-4">{categoryConfig.description}</p>
          )}

          {/* AI Suggestions Section */}
          {suggestions.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                AI Suggestions
              </h4>
              <div className="space-y-2">
                {suggestions.map((suggestion) => (
                  <TagSuggestionItem
                    key={suggestion.value}
                    suggestion={suggestion}
                    category={category}
                    isSelected={selectedTags.includes(suggestion.value)}
                    onToggle={handleTagToggle}
                    showConfidence={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Predefined Tags Section */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Available Tags</h4>
            <div className="max-h-48 overflow-y-auto">
              <div className="grid grid-cols-1 gap-2">
                {categoryConfig.values
                  .filter((value: string) => !suggestions.some(s => s.value === value))
                  .map((value: string) => {
                    const isSelected = selectedTags.includes(value);
                    const isDisabled = Boolean(disabled || (selectionLimitReached && !isSelected));
                    
                    return (
                      <label
                        key={value}
                        className={`flex items-center space-x-3 p-2 rounded-md cursor-pointer transition-colors ${
                          isDisabled 
                            ? 'opacity-50 cursor-not-allowed' 
                            : 'hover:bg-gray-50'
                        } ${isSelected ? 'bg-blue-50 border border-blue-200' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => handleTagToggle(value)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700 flex-1">{value}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Custom Tag Input */}
          <div className="border-t border-gray-200 pt-4">
            {!showCustomInput ? (
              <button
                onClick={() => setShowCustomInput(true)}
                disabled={Boolean(disabled || selectionLimitReached)}
                className="text-sm text-blue-600 hover:text-blue-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + Add custom tag
              </button>
            ) : (
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCustomTagAdd()}
                  placeholder="Enter custom tag..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleCustomTagAdd}
                  disabled={!customTagInput.trim()}
                  className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomTagInput('');
                  }}
                  className="px-3 py-2 text-gray-600 text-sm font-medium rounded-md hover:text-gray-500"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const TagSelector: React.FC<TagSelectorProps> = ({
  selectedTags,
  onTagChange,
  availableTags,
  disabled = false,
  maxSelectionsPerCategory,
  showDescriptions = true
}) => {
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, TagSuggestion[]>>({});
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Mock function to simulate AI suggestions API call
  const generateAISuggestions = useCallback(async () => {
    setIsLoadingSuggestions(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock AI suggestions
    const mockSuggestions = {
      'technology': [
        { value: 'react', confidence: 0.95, reasoning: 'React components detected in content' },
        { value: 'typescript', confidence: 0.88, reasoning: 'TypeScript interfaces found' }
      ],
      'domain': [
        { value: 'frontend', confidence: 0.92, reasoning: 'UI/UX related content identified' }
      ],
      'complexity': [
        { value: 'intermediate', confidence: 0.85, reasoning: 'Content complexity analysis suggests intermediate level' }
      ]
    };
    
    setAiSuggestions(mockSuggestions);
    setIsLoadingSuggestions(false);
  }, []);

  useEffect(() => {
    // Auto-generate suggestions when component mounts
    generateAISuggestions();
  }, [generateAISuggestions]);

  const handleAcceptAllSuggestions = useCallback(() => {
    Object.entries(aiSuggestions).forEach(([category, suggestions]) => {
      if (isValidTagCategory(category)) {
        const currentSelection = selectedTags[category] || [];
        const newSuggestions = suggestions
          .filter(s => s.confidence >= 0.7 && !currentSelection.includes(s.value))
          .map(s => s.value);
        
        if (newSuggestions.length > 0) {
          onTagChange(category, [...currentSelection, ...newSuggestions]);
        }
      }
    });
  }, [aiSuggestions, selectedTags, onTagChange]);

  const handleRejectAllSuggestions = useCallback(() => {
    setAiSuggestions({});
  }, []);

  const totalSuggestions = Object.values(aiSuggestions).reduce((total, suggestions) => total + suggestions.length, 0);
  const highConfidenceSuggestions = Object.values(aiSuggestions).reduce((total, suggestions) => 
    total + suggestions.filter(s => s.confidence >= 0.8).length, 0
  );

  return (
    <div className="space-y-6">
      {/* AI Suggestions Header */}
      {totalSuggestions > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">AI Tag Suggestions</h3>
              <p className="text-sm text-gray-600 mt-1">
                Found {totalSuggestions} suggestions ({highConfidenceSuggestions} high confidence)
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleAcceptAllSuggestions}
                disabled={disabled}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Accept All
              </button>
              <button
                onClick={handleRejectAllSuggestions}
                className="px-4 py-2 text-gray-600 text-sm font-medium rounded-md hover:text-gray-500"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoadingSuggestions && (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <div className="inline-flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-gray-700">Generating AI suggestions...</span>
          </div>
        </div>
      )}

      {/* Category Sections */}
      <div className="space-y-4">
        {availableTags && Object.entries(availableTags).map(([category, categoryConfig]) => {
          if (!isValidTagCategory(category)) return null;
          
          return (
            <CategorySection
              key={category}
              category={category}
              categoryConfig={categoryConfig}
              selectedTags={selectedTags[category] || []}
              suggestions={aiSuggestions[category] || []}
              onTagChange={onTagChange}
              disabled={disabled}
              maxSelections={maxSelectionsPerCategory}
              showDescriptions={showDescriptions}
            />
          );
        })}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Selection Summary</h4>
        <div className="space-y-2">
          {Object.entries(selectedTags).map(([category, tags]) => {
            if (!tags || tags.length === 0) return null;
            
            const categoryDisplayName = category.split('-').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            
            return (
              <div key={category} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{categoryDisplayName}:</span>
                <div className="flex flex-wrap gap-1">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {tag}
                      <button
                        onClick={() => onTagChange(category, tags.filter(t => t !== tag))}
                        disabled={disabled}
                        className="ml-1 text-blue-600 hover:text-blue-500 disabled:opacity-50"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        
        {Object.keys(selectedTags).length === 0 && (
          <p className="text-sm text-gray-500">No tags selected</p>
        )}
      </div>
    </div>
  );
};

export default TagSelector;