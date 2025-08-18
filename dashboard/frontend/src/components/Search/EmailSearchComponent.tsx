/**
 * Enterprise Email Management - Comprehensive Search Component
 * React component providing advanced email search functionality
 * 
 * Features:
 * - Advanced search input with autocomplete
 * - Boolean query builder with visual assistance
 * - Real-time search suggestions
 * - Faceted search results
 * - Search history and saved searches
 * - Result highlighting and pagination
 * - Accessibility-compliant interface
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  EmailMessage, 
  SearchQuery, 
  SearchResult, 
  SearchOptions, 
  SearchSuggestion,
  SearchFacet,
  SearchField,
  SearchSortField 
} from '../../types/index';
import { searchEngine } from '../../lib/search-engine';
import { useDebounce } from '../../hooks/useDebounce';
import { useKeyboard } from '../../hooks/useKeyboard';
import './EmailSearchComponent.css';

interface EmailSearchProps {
  emails: EmailMessage[];
  onSearchResults: (results: SearchResult<EmailMessage>) => void;
  onEmailSelect: (email: EmailMessage) => void;
  className?: string;
  placeholder?: string;
  showAdvanced?: boolean;
  enableSavedSearches?: boolean;
}

interface SearchState {
  query: string;
  isAdvancedOpen: boolean;
  options: SearchOptions;
  suggestions: SearchSuggestion[];
  showSuggestions: boolean;
  selectedSuggestion: number;
  isSearching: boolean;
  searchHistory: string[];
  savedSearches: Map<string, SearchQuery>;
  showHistory: boolean;
  showSavedSearches: boolean;
}

const defaultSearchOptions: SearchOptions = {
  caseSensitive: false,
  wholeWord: false,
  useRegex: false,
  searchFields: ['all' as SearchField],
  maxResults: 100,
  includeArchived: false,
  includeSpam: false,
  sortBy: 'relevance',
  sortDirection: 'desc' as const
};

export const EmailSearchComponent: React.FC<EmailSearchProps> = ({
  emails,
  onSearchResults,
  onEmailSelect,
  className = '',
  placeholder = 'Search emails...',
  showAdvanced = true,
  enableSavedSearches = true
}) => {
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    isAdvancedOpen: false,
    options: defaultSearchOptions,
    suggestions: [],
    showSuggestions: false,
    selectedSuggestion: -1,
    isSearching: false,
    searchHistory: [],
    savedSearches: new Map(),
    showHistory: false,
    showSavedSearches: false
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(searchState.query, 300);

  // Initialize search engine and load data
  useEffect(() => {
    searchEngine.indexEmails(emails);
    setSearchState(prev => ({
      ...prev,
      searchHistory: searchEngine.getSearchHistory(),
      savedSearches: searchEngine.getSavedSearches()
    }));
  }, [emails]);

  // Perform search when query changes
  useEffect(() => {
    if (debouncedQuery.trim() || searchState.query === '') {
      performSearch();
    }
  }, [debouncedQuery, searchState.options]);

  // Get suggestions when typing
  useEffect(() => {
    if (searchState.query.trim() && searchState.showSuggestions) {
      getSuggestions();
    }
  }, [searchState.query]);

  const performSearch = useCallback(async () => {
    setSearchState(prev => ({ ...prev, isSearching: true }));

    try {
      const result = await searchEngine.search(
        emails,
        debouncedQuery,
        searchState.options
      );
      
      onSearchResults(result);
    } catch (error) {
      console.error('Search failed:', error);
      onSearchResults({
        items: [],
        totalCount: 0,
        took: 0,
        suggestions: [],
        facets: []
      });
    } finally {
      setSearchState(prev => ({ ...prev, isSearching: false }));
    }
  }, [debouncedQuery, searchState.options, emails, onSearchResults]);

  const getSuggestions = useCallback(async () => {
    try {
      const suggestions = await searchEngine.getSuggestions(searchState.query, emails, 8);
      setSearchState(prev => ({ ...prev, suggestions }));
    } catch (error) {
      console.error('Failed to get suggestions:', error);
    }
  }, [searchState.query, emails]);

  const handleQueryChange = useCallback((value: string) => {
    setSearchState(prev => ({
      ...prev,
      query: value,
      showSuggestions: true,
      selectedSuggestion: -1
    }));
  }, []);

  const handleQuerySubmit = useCallback(() => {
    setSearchState(prev => ({
      ...prev,
      showSuggestions: false,
      showHistory: false,
      showSavedSearches: false
    }));
    performSearch();
  }, [performSearch]);

  const handleSuggestionSelect = useCallback((suggestion: SearchSuggestion) => {
    setSearchState(prev => ({
      ...prev,
      query: suggestion.text,
      showSuggestions: false,
      selectedSuggestion: -1
    }));
    searchInputRef.current?.focus();
  }, []);

  const handleSavedSearchSelect = useCallback((name: string, searchQuery: SearchQuery) => {
    setSearchState(prev => ({
      ...prev,
      query: searchQuery.query,
      options: {
        ...prev.options,
        filters: searchQuery.filters,
        sortBy: searchQuery.sort.field as SearchSortField,
        sortDirection: searchQuery.sort.direction,
        limit: searchQuery.pagination.size
      },
      showSavedSearches: false
    }));
  }, []);

  const handleSaveCurrentSearch = useCallback(() => {
    const name = prompt('Enter name for saved search:');
    if (name) {
      const searchQuery: SearchQuery = {
        query: searchState.query,
        filters: searchState.options.filters || [],
        sort: {
          field: searchState.options.sortBy || 'date',
          direction: searchState.options.sortDirection || 'desc' as 'desc'
        },
        pagination: {
          page: 1,
          size: searchState.options.limit || 50
        }
      };
      
      searchEngine.saveSearch(name, searchQuery);
      setSearchState(prev => ({
        ...prev,
        savedSearches: searchEngine.getSavedSearches()
      }));
    }
  }, [searchState.query, searchState.options]);

  // Keyboard navigation
  useKeyboard({
    ArrowDown: () => {
      if (searchState.showSuggestions && searchState.suggestions.length > 0) {
        setSearchState(prev => ({
          ...prev,
          selectedSuggestion: Math.min(prev.selectedSuggestion + 1, prev.suggestions.length - 1)
        }));
      }
    },
    ArrowUp: () => {
      if (searchState.showSuggestions && searchState.suggestions.length > 0) {
        setSearchState(prev => ({
          ...prev,
          selectedSuggestion: Math.max(prev.selectedSuggestion - 1, -1)
        }));
      }
    },
    Enter: () => {
      if (searchState.showSuggestions && searchState.selectedSuggestion >= 0) {
        const selectedSuggestion = searchState.suggestions[searchState.selectedSuggestion];
        handleSuggestionSelect(selectedSuggestion);
      } else {
        handleQuerySubmit();
      }
    },
    Escape: () => {
      setSearchState(prev => ({
        ...prev,
        showSuggestions: false,
        showHistory: false,
        showSavedSearches: false,
        selectedSuggestion: -1
      }));
    }
  }, [searchState.showSuggestions, searchState.selectedSuggestion, searchState.suggestions]);

  // Boolean query helper buttons
  const queryHelpers = [
    { label: 'AND', value: ' AND ', tooltip: 'Both terms must be present' },
    { label: 'OR', value: ' OR ', tooltip: 'Either term must be present' },
    { label: 'NOT', value: ' NOT ', tooltip: 'Term must not be present' },
    { label: '( )', value: ' ()', tooltip: 'Group terms together' },
    { label: 'from:', value: 'from:', tooltip: 'Search sender field' },
    { label: 'to:', value: 'to:', tooltip: 'Search recipient field' },
    { label: 'subject:', value: 'subject:', tooltip: 'Search subject field' },
    { label: 'has:attachment', value: 'has:attachment', tooltip: 'Has attachments' }
  ];

  const insertQueryHelper = useCallback((value: string) => {
    const input = searchInputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const newQuery = searchState.query.slice(0, start) + value + searchState.query.slice(end);
    
    setSearchState(prev => ({ ...prev, query: newQuery }));
    
    // Move cursor to end of inserted text
    setTimeout(() => {
      const newPosition = start + value.length;
      input.setSelectionRange(newPosition, newPosition);
      input.focus();
    }, 0);
  }, [searchState.query]);

  const handleAdvancedToggle = useCallback(() => {
    setSearchState(prev => ({ ...prev, isAdvancedOpen: !prev.isAdvancedOpen }));
  }, []);

  const handleOptionChange = useCallback((key: keyof SearchOptions, value: any) => {
    setSearchState(prev => ({
      ...prev,
      options: { ...prev.options, [key]: value }
    }));
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setSearchState(prev => ({
          ...prev,
          showSuggestions: false,
          showHistory: false,
          showSavedSearches: false
        }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const renderSuggestions = () => {
    if (!searchState.showSuggestions || searchState.suggestions.length === 0) {
      return null;
    }

    return (
      <div className="search-suggestions" ref={suggestionsRef}>
        {searchState.suggestions.map((suggestion, index) => (
          <div
            key={`${suggestion.type}-${suggestion.text}`}
            className={`suggestion-item ${
              index === searchState.selectedSuggestion ? 'selected' : ''
            }`}
            onClick={() => handleSuggestionSelect(suggestion)}
            role="option"
            aria-selected={index === searchState.selectedSuggestion}
          >
            <div className="suggestion-content">
              <span className={`suggestion-type suggestion-type-${suggestion.type}`}>
                {suggestion.type}
              </span>
              <span className="suggestion-text">{suggestion.text}</span>
              {suggestion.count && suggestion.count > 0 && (
                <span className="suggestion-count">({suggestion.count})</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderSearchHistory = () => {
    if (!searchState.showHistory || searchState.searchHistory.length === 0) {
      return null;
    }

    return (
      <div className="search-history">
        <div className="search-history-header">
          <h4>Recent Searches</h4>
          <button
            onClick={() => {
              searchEngine.clearSearchHistory();
              setSearchState(prev => ({ 
                ...prev, 
                searchHistory: [],
                showHistory: false 
              }));
            }}
            className="clear-history-btn"
            aria-label="Clear search history"
          >
            Clear
          </button>
        </div>
        {searchState.searchHistory.slice(0, 10).map((historyQuery, index) => (
          <div
            key={index}
            className="history-item"
            onClick={() => {
              setSearchState(prev => ({
                ...prev,
                query: historyQuery,
                showHistory: false
              }));
            }}
          >
            {historyQuery}
          </div>
        ))}
      </div>
    );
  };

  const renderSavedSearches = () => {
    if (!searchState.showSavedSearches || searchState.savedSearches.size === 0) {
      return null;
    }

    return (
      <div className="saved-searches">
        <div className="saved-searches-header">
          <h4>Saved Searches</h4>
        </div>
        {Array.from(searchState.savedSearches.entries()).map(([name, searchQuery]) => (
          <div
            key={name}
            className="saved-search-item"
            onClick={() => handleSavedSearchSelect(name, searchQuery)}
          >
            <div className="saved-search-name">{name}</div>
            <div className="saved-search-query">{searchQuery.query}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete saved search "${name}"?`)) {
                  searchEngine.deleteSavedSearch(name);
                  setSearchState(prev => ({
                    ...prev,
                    savedSearches: searchEngine.getSavedSearches()
                  }));
                }
              }}
              className="delete-saved-search"
              aria-label={`Delete saved search ${name}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`email-search-component ${className}`}>
      <div className="search-input-container">
        <div className="search-input-wrapper">
          <input
            ref={searchInputRef}
            type="text"
            value={searchState.query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setSearchState(prev => ({ ...prev, showSuggestions: true }))}
            placeholder={placeholder}
            className="search-input"
            aria-label="Search emails"
            aria-describedby="search-help"
            aria-expanded={searchState.showSuggestions}
            aria-autocomplete="list"
            role="combobox"
          />
          
          <div className="search-input-actions">
            {searchState.isSearching && (
              <div className="search-spinner" aria-label="Searching...">
                <div className="spinner"></div>
              </div>
            )}
            
            <button
              onClick={() => setSearchState(prev => ({ 
                ...prev, 
                showHistory: !prev.showHistory,
                showSuggestions: false,
                showSavedSearches: false
              }))}
              className="search-history-btn"
              aria-label="Show search history"
              title="Search history"
            >
              🕐
            </button>
            
            {enableSavedSearches && (
              <>
                <button
                  onClick={() => setSearchState(prev => ({ 
                    ...prev, 
                    showSavedSearches: !prev.showSavedSearches,
                    showSuggestions: false,
                    showHistory: false
                  }))}
                  className="saved-searches-btn"
                  aria-label="Show saved searches"
                  title="Saved searches"
                >
                  ⭐
                </button>
                
                {searchState.query.trim() && (
                  <button
                    onClick={handleSaveCurrentSearch}
                    className="save-search-btn"
                    aria-label="Save current search"
                    title="Save this search"
                  >
                    💾
                  </button>
                )}
              </>
            )}
            
            {showAdvanced && (
              <button
                onClick={handleAdvancedToggle}
                className={`advanced-toggle ${searchState.isAdvancedOpen ? 'active' : ''}`}
                aria-label="Toggle advanced search"
                aria-expanded={searchState.isAdvancedOpen}
              >
                ⚙️
              </button>
            )}
          </div>
        </div>
        
        {renderSuggestions()}
        {renderSearchHistory()}
        {renderSavedSearches()}
      </div>

      {/* Query Helper Buttons */}
      <div className="query-helpers">
        {queryHelpers.map((helper) => (
          <button
            key={helper.label}
            onClick={() => insertQueryHelper(helper.value)}
            className="query-helper-btn"
            title={helper.tooltip}
            aria-label={`Insert ${helper.label}`}
          >
            {helper.label}
          </button>
        ))}
      </div>

      {/* Advanced Search Panel */}
      {searchState.isAdvancedOpen && (
        <div className="advanced-search-panel">
          <div className="advanced-section">
            <h4>Search Options</h4>
            <div className="search-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={searchState.options.caseSensitive}
                  onChange={(e) => handleOptionChange('caseSensitive', e.target.checked)}
                />
                Case sensitive
              </label>
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={searchState.options.wholeWord}
                  onChange={(e) => handleOptionChange('wholeWord', e.target.checked)}
                />
                Whole word only
              </label>
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={searchState.options.useRegex}
                  onChange={(e) => handleOptionChange('useRegex', e.target.checked)}
                />
                Use regular expressions
              </label>
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={searchState.options.includeArchived}
                  onChange={(e) => handleOptionChange('includeArchived', e.target.checked)}
                />
                Include archived emails
              </label>
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={searchState.options.includeSpam}
                  onChange={(e) => handleOptionChange('includeSpam', e.target.checked)}
                />
                Include spam emails
              </label>
            </div>
          </div>

          <div className="advanced-section">
            <h4>Sort Results</h4>
            <div className="sort-options">
              <select
                value={searchState.options.sortBy}
                onChange={(e) => handleOptionChange('sortBy', e.target.value as SearchSortField)}
                className="sort-field-select"
              >
                <option value="relevance">Relevance</option>
                <option value="date">Date</option>
                <option value="sender">Sender</option>
                <option value="subject">Subject</option>
                <option value="size">Size</option>
                <option value="importance">Importance</option>
              </select>
              
              <select
                value={searchState.options.sortDirection}
                onChange={(e) => handleOptionChange('sortDirection', e.target.value as 'asc' | 'desc')}
                className="sort-direction-select"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>

          <div className="advanced-section">
            <h4>Result Limits</h4>
            <label className="input-label">
              Max results:
              <input
                type="number"
                min="10"
                max="1000"
                step="10"
                value={searchState.options.maxResults}
                onChange={(e) => handleOptionChange('maxResults', parseInt(e.target.value))}
                className="max-results-input"
              />
            </label>
          </div>
        </div>
      )}

      <div id="search-help" className="search-help-text">
        Use boolean operators (AND, OR, NOT) and field prefixes (from:, to:, subject:) for advanced searches
      </div>
    </div>
  );
};

export default EmailSearchComponent;