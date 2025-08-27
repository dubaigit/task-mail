/**
 * Apple MCP Knowledge Base - Tag System TypeScript Definitions
 * 
 * Comprehensive type definitions for the hierarchical tagging and
 * categorization system with validation and analytics support.
 */

// Base tag system types
export interface TagDefinition {
  id?: number;
  category: string;
  tag_value: string;
  description?: string;
  weight: number;
  is_mandatory: boolean;
  allow_multiple: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentTag {
  id?: number;
  document_id: number;
  category: string;
  tag_value: string;
  confidence_score: number;
  source: 'manual' | 'auto' | 'ai-suggested' | 'validated';
  applied_by?: string;
  created_at?: string;
}

// Tag taxonomy structure
export interface TagCategory {
  values: string[];
  description: string;
  weight: number;
  mandatory: boolean;
  allowMultiple?: boolean;
}

export interface TagTaxonomy {
  'source-type': TagCategory;
  'technology': TagCategory;
  'domain': TagCategory;
  'complexity': TagCategory;
  'use-case': TagCategory;
  'content-features': TagCategory;
}

// Tag suggestions and AI integration
export interface TagSuggestion {
  value: string;
  confidence: number;
  reasoning: string;
}

export interface CategorySuggestions {
  [category: string]: TagSuggestion[];
}

export interface TagSuggestionResult {
  id?: number;
  document_id: number;
  suggested_tags: CategorySuggestions;
  confidence_scores: number[];
  reasoning: string;
  suggestion_source: 'ai' | 'pattern' | 'similarity' | 'manual';
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
  created_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

export interface AITaggingResponse {
  tags: CategorySuggestions;
  overall_confidence: number;
  analysis_notes: string;
}

export interface ValidatedSuggestions {
  tags: CategorySuggestions;
  validationErrors: string[];
  overall_confidence: number;
  analysis_notes: string;
}

// Quality scoring system
export interface QualityCriteria {
  accuracy: { weight: number; description: string };
  completeness: { weight: number; description: string };
  clarity: { weight: number; description: string };
  recency: { weight: number; description: string };
  examples: { weight: number; description: string };
  authority: { weight: number; description: string };
}

export interface QualityScores {
  accuracy: number;
  completeness: number;
  clarity: number;
  recency: number;
  examples: number;
  authority: number;
}

export interface SourceQualityScore {
  id?: number;
  source_id: number;
  overall_score: number;
  accuracy_score: number;
  completeness_score: number;
  clarity_score: number;
  recency_score: number;
  examples_score: number;
  authority_score: number;
  evaluation_criteria?: Record<string, any>;
  last_evaluated?: string;
  evaluator?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// Search and filtering interfaces
export interface TagFilter {
  category: string;
  values: string[];
  operator?: 'AND' | 'OR';
}

export interface TagSearchFilters {
  'source-type'?: string[];
  'technology'?: string[];
  'domain'?: string[];
  'complexity'?: string[];
  'use-case'?: string[];
  'content-features'?: string[];
}

export interface TagSearchOptions {
  minQuality?: number;
  sortBy?: 'relevance' | 'quality' | 'date';
  limit?: number;
  offset?: number;
  includeScore?: boolean;
}

export interface TagSearchResult {
  id: number;
  title: string;
  content?: string;
  url: string;
  metadata?: Record<string, any>;
  source_name: string;
  source_type: string;
  tags: DocumentTag[];
  quality_score?: number;
  relevance_score?: number;
}

export interface TagSearchResponse {
  results: TagSearchResult[];
  metadata: {
    totalResults: number;
    appliedFilters: TagSearchFilters;
    searchOptions: TagSearchOptions;
  };
}

// Analytics and reporting
export interface TagAnalyticsEvent {
  id?: number;
  event_type: string;
  tag_category?: string;
  tag_value?: string;
  document_id?: number;
  source_id?: number;
  metadata?: Record<string, any>;
  session_id?: string;
  user_context?: string;
  created_at?: string;
}

export interface TagUsageStats {
  tag_category: string;
  tag_value: string;
  usage_count: number;
}

export interface QualityDistribution {
  quality_tier: 'High' | 'Medium' | 'Low' | 'Very Low';
  count: number;
}

export interface SuggestionStats {
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
  suggestion_source: 'ai' | 'pattern' | 'similarity' | 'manual';
  count: number;
  avg_suggestions_per_doc: number;
}

export interface TagAnalytics {
  tagUsage: TagUsageStats[];
  qualityDistribution: QualityDistribution[];
  coOccurrence: Array<{
    category1: string;
    value1: string;
    category2: string;
    value2: string;
    frequency: number;
  }>;
  suggestionStats: SuggestionStats[];
  performance: PerformanceMetrics;
}

export interface PerformanceMetrics {
  tagsApplied: number;
  suggestionsGenerated: number;
  qualityScoresCalculated: number;
  validationsPassed: number;
  validationsFailed: number;
  timeRange?: string;
  lastUpdated: string;
}

// Configuration and initialization
export interface TagManagerConfig {
  maxTagsPerDocument?: number;
  maxAutoSuggestions?: number;
  suggestionConfidenceThreshold?: number;
  qualityScoreThreshold?: number;
  analyticsRetentionDays?: number;
}

export interface TagManagerInitOptions extends TagManagerConfig {
  databaseUrl?: string;
  openaiApiKey?: string;
  redisUrl?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// UI Component interfaces
export interface TagSelectorProps {
  selectedTags: TagSearchFilters;
  onTagChange: (category: string, values: string[]) => void;
  availableTags: TagTaxonomy;
  disabled?: boolean;
  maxSelectionsPerCategory?: number;
  showDescriptions?: boolean;
}

export interface TagFilterPanelProps {
  filters: TagSearchFilters;
  onFiltersChange: (filters: TagSearchFilters) => void;
  onClearFilters: () => void;
  showQualityFilter?: boolean;
  showAdvancedOptions?: boolean;
}

export interface TagDisplayProps {
  tags: DocumentTag[];
  interactive?: boolean;
  onTagClick?: (tag: DocumentTag) => void;
  onTagRemove?: (tag: DocumentTag) => void;
  showConfidence?: boolean;
  groupByCategory?: boolean;
}

export interface QualityScoreDisplayProps {
  score: number;
  breakdown?: QualityScores;
  showDetails?: boolean;
  size?: 'small' | 'medium' | 'large';
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    requestId?: string;
    processingTime?: number;
  };
}

export interface TagSuggestionResponse extends ApiResponse<{
  suggestionId: number;
  suggestions: ValidatedSuggestions;
  metadata: {
    totalSuggestions: number;
    averageConfidence: number;
    categories: string[];
  };
}> {}

export interface QualityScoreResponse extends ApiResponse<{
  overall_score: number;
  criteria_scores: QualityScores;
  evaluation_date: string;
}> {}

export interface TagAnalyticsResponse extends ApiResponse<TagAnalytics> {}

// Enhanced document types with tagging support
export interface TaggedDocument {
  id: number;
  title: string;
  content: string;
  url: string;
  source_id: number;
  content_type: string;
  metadata: Record<string, any>;
  tags: DocumentTag[];
  quality_score?: number;
  difficulty_level?: number;
  authority_score?: number;
  word_count?: number;
  reading_time?: number;
  created_at: string;
  updated_at: string;
}

export interface TaggedSource {
  id: number;
  name: string;
  url: string;
  source_type: string;
  is_active: boolean;
  authority_weight: number;
  quality_score?: SourceQualityScore;
  tags: DocumentTag[];
  document_count?: number;
  avg_quality?: number;
  created_at: string;
  updated_at: string;
}

// Validation and error handling
export interface TagValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface TagValidationResult {
  isValid: boolean;
  errors: TagValidationError[];
  warnings: string[];
  suggestions?: string[];
}

// Bulk operations
export interface BulkTagOperation {
  operation: 'add' | 'remove' | 'replace';
  documentIds: number[];
  tags: TagSearchFilters;
  options?: {
    skipValidation?: boolean;
    applyQualityThreshold?: boolean;
    generateSuggestions?: boolean;
  };
}

export interface BulkTagResult {
  processed: number;
  successful: number;
  failed: number;
  errors: Array<{
    documentId: number;
    error: string;
  }>;
  warnings: string[];
}

// Export utility types
export type TagCategoryName = keyof TagTaxonomy;
export type TagValue = string;
export type ConfidenceScore = number; // 0.0 - 1.0
export type QualityScore = number; // 0.0 - 100.0

// Constants
export const TAG_SOURCES = ['manual', 'auto', 'ai-suggested', 'validated'] as const;
export const SUGGESTION_STATUSES = ['pending', 'accepted', 'rejected', 'modified'] as const;
export const QUALITY_TIERS = ['High', 'Medium', 'Low', 'Very Low'] as const;
export const SORT_OPTIONS = ['relevance', 'quality', 'date'] as const;

// Type guards
export function isValidTagCategory(category: string): category is TagCategoryName {
  return ['source-type', 'technology', 'domain', 'complexity', 'use-case', 'content-features'].includes(category);
}

export function isValidConfidenceScore(score: number): score is ConfidenceScore {
  return typeof score === 'number' && score >= 0 && score <= 1;
}

export function isValidQualityScore(score: number): score is QualityScore {
  return typeof score === 'number' && score >= 0 && score <= 100;
}