/**
 * Apple MCP Knowledge Base - Tag System React Hook
 * 
 * React hook for managing the comprehensive tagging system operations
 * including search with tags, tag suggestions, and tag management.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  TagSearchFilters,
  TagSearchResult,
  TagSearchResponse,
  TagSuggestionResult,
  DocumentTag,
  TagAnalytics,
  BulkTagResult,
  TagTaxonomy
} from '../types/TagTypes';

interface UseTagSystemOptions {
  autoLoadTaxonomy?: boolean;
  enableAnalytics?: boolean;
  cacheResults?: boolean;
}

interface TagSystemState {
  // Search state
  searchResults: TagSearchResult[];
  totalResults: number;
  searchLoading: boolean;
  searchError: string | null;
  
  // Tag suggestions state
  suggestions: TagSuggestionResult | null;
  suggestionsLoading: boolean;
  suggestionsError: string | null;
  
  // Available tags state
  availableTags: TagTaxonomy | null;
  tagsLoading: boolean;
  tagsError: string | null;
  
  // Analytics state
  analytics: TagAnalytics | null;
  analyticsLoading: boolean;
  analyticsError: string | null;
}

export const useTagSystem = (options: UseTagSystemOptions = {}) => {
  const {
    autoLoadTaxonomy = true,
    enableAnalytics = false,
    cacheResults = true
  } = options;

  // State management
  const [state, setState] = useState<TagSystemState>({
    searchResults: [],
    totalResults: 0,
    searchLoading: false,
    searchError: null,
    suggestions: null,
    suggestionsLoading: false,
    suggestionsError: null,
    availableTags: null,
    tagsLoading: false,
    tagsError: null,
    analytics: null,
    analyticsLoading: false,
    analyticsError: null
  });

  // Cache for search results
  const [searchCache] = useState(new Map<string, TagSearchResponse>());

  // API base URL
  const API_BASE = '/api/knowledge-base';

  /**
   * Enhanced search with tag filtering
   */
  const searchWithTags = useCallback(async (
    query: string,
    filters: TagSearchFilters = {},
    options: {
      limit?: number;
      offset?: number;
      minQuality?: number;
      sortBy?: 'relevance' | 'quality' | 'date';
      searchType?: 'semantic' | 'keyword' | 'hybrid';
    } = {}
  ) => {
    const {
      limit = 10,
      offset = 0,
      minQuality = 0,
      sortBy = 'relevance',
      searchType = 'hybrid'
    } = options;

    // Create cache key
    const cacheKey = JSON.stringify({ query, filters, options });
    
    // Check cache first
    if (cacheResults && searchCache.has(cacheKey)) {
      const cachedResult = searchCache.get(cacheKey)!;
      setState(prev => ({
        ...prev,
        searchResults: cachedResult.results,
        totalResults: cachedResult.metadata.totalResults,
        searchLoading: false,
        searchError: null
      }));
      return cachedResult;
    }

    setState(prev => ({ ...prev, searchLoading: true, searchError: null }));

    try {
      // Build query parameters
      const params = new URLSearchParams({
        query,
        limit: limit.toString(),
        offset: offset.toString(),
        minQuality: minQuality.toString(),
        sortBy,
        searchType,
        includeTagInfo: 'true'
      });

      // Add tag filters
      Object.entries(filters).forEach(([category, values]) => {
        if (values && values.length > 0) {
          values.forEach((value: string) => {
            params.append(category, value);
          });
        }
      });

      const response = await fetch(`${API_BASE}/search?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Search failed');
      }

      const searchResponse: TagSearchResponse = result.data;

      // Cache result
      if (cacheResults) {
        searchCache.set(cacheKey, searchResponse);
      }

      setState(prev => ({
        ...prev,
        searchResults: searchResponse.results,
        totalResults: searchResponse.metadata.totalResults,
        searchLoading: false,
        searchError: null
      }));

      return searchResponse;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Search failed';
      setState(prev => ({
        ...prev,
        searchLoading: false,
        searchError: errorMessage
      }));
      throw error;
    }
  }, [cacheResults, searchCache, API_BASE]);

  /**
   * Get tag suggestions for content
   */
  const getSuggestions = useCallback(async (
    content: string,
    title: string = '',
    options: { minConfidence?: number } = {}
  ) => {
    setState(prev => ({ ...prev, suggestionsLoading: true, suggestionsError: null }));

    try {
      const response = await fetch(`${API_BASE}/tags/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content,
          title,
          options
        })
      });

      if (!response.ok) {
        throw new Error(`Tag suggestion failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Tag suggestion failed');
      }

      setState(prev => ({
        ...prev,
        suggestions: result.data,
        suggestionsLoading: false,
        suggestionsError: null
      }));

      return result.data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Tag suggestion failed';
      setState(prev => ({
        ...prev,
        suggestionsLoading: false,
        suggestionsError: errorMessage
      }));
      throw error;
    }
  }, [API_BASE]);

  /**
   * Apply tags to a document
   */
  const applyTags = useCallback(async (
    documentId: number,
    tags: TagSearchFilters,
    source: 'manual' | 'auto' | 'ai-suggested' | 'validated' = 'manual'
  ) => {
    try {
      const response = await fetch(`${API_BASE}/documents/${documentId}/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tags,
          source
        })
      });

      if (!response.ok) {
        throw new Error(`Tag application failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Tag application failed');
      }

      // Clear search cache since tags have changed
      if (cacheResults) {
        searchCache.clear();
      }

      return result.data;

    } catch (error) {
      throw error;
    }
  }, [API_BASE, cacheResults, searchCache]);

  /**
   * Get document tags
   */
  const getDocumentTags = useCallback(async (documentId: number) => {
    try {
      const response = await fetch(`${API_BASE}/documents/${documentId}/tags`);
      
      if (!response.ok) {
        throw new Error(`Failed to get document tags: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get document tags');
      }

      return result.data.tags;

    } catch (error) {
      throw error;
    }
  }, [API_BASE]);

  /**
   * Remove tags from a document
   */
  const removeTags = useCallback(async (
    documentId: number,
    options: {
      categories?: string[];
      specificTags?: TagSearchFilters;
    } = {}
  ) => {
    try {
      const response = await fetch(`${API_BASE}/documents/${documentId}/tags`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      });

      if (!response.ok) {
        throw new Error(`Tag removal failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Tag removal failed');
      }

      // Clear search cache
      if (cacheResults) {
        searchCache.clear();
      }

      return result.data;

    } catch (error) {
      throw error;
    }
  }, [API_BASE, cacheResults, searchCache]);

  /**
   * Load available tags taxonomy
   */
  const loadAvailableTags = useCallback(async () => {
    setState(prev => ({ ...prev, tagsLoading: true, tagsError: null }));

    try {
      const response = await fetch(`${API_BASE}/tags/taxonomy`);
      
      if (!response.ok) {
        throw new Error(`Failed to load tags: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load tags');
      }

      setState(prev => ({
        ...prev,
        availableTags: result.data,
        tagsLoading: false,
        tagsError: null
      }));

      return result.data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load tags';
      setState(prev => ({
        ...prev,
        tagsLoading: false,
        tagsError: errorMessage
      }));
      throw error;
    }
  }, [API_BASE]);

  /**
   * Load tag analytics
   */
  const loadAnalytics = useCallback(async (options: {
    timeRange?: string;
    categories?: string[];
    includeCoOccurrence?: boolean;
  } = {}) => {
    if (!enableAnalytics) return null;

    setState(prev => ({ ...prev, analyticsLoading: true, analyticsError: null }));

    try {
      const params = new URLSearchParams();
      if (options.timeRange) params.set('timeRange', options.timeRange);
      if (options.categories) params.set('categories', JSON.stringify(options.categories));
      if (options.includeCoOccurrence !== undefined) params.set('includeCoOccurrence', options.includeCoOccurrence.toString());

      const response = await fetch(`${API_BASE}/tags/analytics?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load analytics: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load analytics');
      }

      setState(prev => ({
        ...prev,
        analytics: result.data,
        analyticsLoading: false,
        analyticsError: null
      }));

      return result.data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load analytics';
      setState(prev => ({
        ...prev,
        analyticsLoading: false,
        analyticsError: errorMessage
      }));
      throw error;
    }
  }, [enableAnalytics, API_BASE]);

  /**
   * Bulk tag operations
   */
  const bulkTagOperation = useCallback(async (
    operation: 'add' | 'remove' | 'replace',
    documentIds: number[],
    tags: TagSearchFilters,
    options: {
      skipValidation?: boolean;
      applyQualityThreshold?: boolean;
      generateSuggestions?: boolean;
    } = {}
  ): Promise<BulkTagResult> => {
    try {
      const response = await fetch(`${API_BASE}/tags/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operation,
          documentIds,
          tags,
          options
        })
      });

      if (!response.ok) {
        throw new Error(`Bulk tag operation failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Bulk tag operation failed');
      }

      // Clear search cache
      if (cacheResults) {
        searchCache.clear();
      }

      return result.data;

    } catch (error) {
      throw error;
    }
  }, [API_BASE, cacheResults, searchCache]);

  /**
   * Auto-tag documents
   */
  const autoTagDocuments = useCallback(async (
    documentIds: number[],
    options: {
      minConfidence?: number;
      maxSuggestions?: number;
    } = {}
  ) => {
    try {
      const response = await fetch(`${API_BASE}/tags/auto-tag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentIds,
          options
        })
      });

      if (!response.ok) {
        throw new Error(`Auto-tagging failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Auto-tagging failed');
      }

      // Clear search cache
      if (cacheResults) {
        searchCache.clear();
      }

      return result.data;

    } catch (error) {
      throw error;
    }
  }, [API_BASE, cacheResults, searchCache]);

  /**
   * Clear search cache
   */
  const clearCache = useCallback(() => {
    searchCache.clear();
  }, [searchCache]);

  // Auto-load taxonomy on mount
  useEffect(() => {
    if (autoLoadTaxonomy) {
      loadAvailableTags().catch(() => {
      });
    }
  }, [autoLoadTaxonomy, loadAvailableTags]);

  // Computed values
  const hasResults = state.searchResults.length > 0;
  const isLoading = state.searchLoading || state.suggestionsLoading || state.tagsLoading;
  const hasError = !!(state.searchError || state.suggestionsError || state.tagsError);

  // Return the hook interface
  return {
    // State
    ...state,
    hasResults,
    isLoading,
    hasError,

    // Actions
    searchWithTags,
    getSuggestions,
    applyTags,
    getDocumentTags,
    removeTags,
    loadAvailableTags,
    loadAnalytics,
    bulkTagOperation,
    autoTagDocuments,
    clearCache,

    // Utilities
    searchCache: searchCache.size,
    clearAllErrors: () => setState(prev => ({
      ...prev,
      searchError: null,
      suggestionsError: null,
      tagsError: null,
      analyticsError: null
    }))
  };
};

export default useTagSystem;
