/**
 * Tag System Types
 * Comprehensive type definitions for the advanced tag classification system
 */

// Tag suggestion from AI analysis
export interface TagSuggestion {
  value: string;
  confidence: number;
  reasoning?: string;
  source?: 'ai' | 'user' | 'system';
}

// Tag category configuration
export interface TagCategoryConfig {
  values: string[];
  description: string;
  weight: number;
  mandatory: boolean;
  allowCustom?: boolean;
  allowMultiple?: boolean;
  maxSelections?: number;
}

// Supported tag category names
export type TagCategoryName = 
  | 'source-type'
  | 'content-type'
  | 'complexity'
  | 'technology'
  | 'language'
  | 'framework'
  | 'domain'
  | 'audience'
  | 'format'
  | 'quality'
  | 'use-case'
  | 'content-features';

// Tag taxonomy configuration
export type TagTaxonomy = Record<TagCategoryName, TagCategoryConfig>;

// Search filters for tags
export interface TagSearchFilters {
  'source-type'?: string[];
  'content-type'?: string[];
  'complexity'?: string[];
  'technology'?: string[];
  'language'?: string[];
  'framework'?: string[];
  'domain'?: string[];
  'audience'?: string[];
  'format'?: string[];
  'quality'?: string[];
  'use-case'?: string[];
  'content-features'?: string[];
  search?: string;
  minConfidence?: number;
}

// Tag selector component props
export interface TagSelectorProps {
  selectedTags: Record<string, string[]>;
  onTagChange: (category: string, values: string[]) => void;
  availableTags?: TagTaxonomy;
  disabled?: boolean;
  maxSelectionsPerCategory?: number;
  showDescriptions?: boolean;
  enableAISuggestions?: boolean;
  className?: string;
  maxCategories?: number;
  contextContent?: string; // Content to analyze for AI suggestions
}

// Tag filter panel component props
export interface TagFilterPanelProps {
  filters: TagSearchFilters;
  onFiltersChange: (filters: TagSearchFilters) => void;
  onClearFilters?: () => void;
  enableAISuggestions?: boolean;
  disabled?: boolean;
  className?: string;
  showDescriptions?: boolean;
  contextContent?: string;
  showQualityFilter?: boolean;
  showAdvancedOptions?: boolean;
}

// Utility function to validate tag category
export const isValidTagCategory = (category: string): category is TagCategoryName => {
  const validCategories: TagCategoryName[] = [
    'source-type',
    'content-type', 
    'complexity',
    'technology',
    'language',
    'framework',
    'domain',
    'audience',
    'format',
    'quality',
    'use-case',
    'content-features'
  ];
  return validCategories.includes(category as TagCategoryName);
};

// Additional interfaces for tag system operations
export interface TagSearchResult {
  id: number;
  title: string;
  content: string;
  url?: string;
  relevanceScore: number;
  tags: TagSearchFilters;
  lastUpdated: string;
}

export interface TagSearchResponse {
  results: TagSearchResult[];
  metadata: {
    totalResults: number;
    searchTime: number;
    filters: TagSearchFilters;
  };
}

export interface TagSuggestionResult {
  suggestions: Record<string, TagSuggestion[]>;
  confidence: number;
  processingTime: number;
}

export interface DocumentTag {
  id: number;
  documentId: number;
  category: TagCategoryName;
  value: string;
  confidence?: number;
  source: 'manual' | 'auto' | 'ai-suggested' | 'validated';
  createdAt: string;
}

export interface TagAnalytics {
  popularTags: Record<string, number>;
  categoryDistribution: Record<TagCategoryName, number>;
  coOccurrence?: Record<string, string[]>;
  qualityMetrics: {
    averageConfidence: number;
    validationRate: number;
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
}

// Default taxonomy configuration
export const DEFAULT_TAG_TAXONOMY: TagTaxonomy = {
  'source-type': {
    values: ['documentation', 'code', 'specs', 'guides', 'tutorials', 'blog', 'api-docs', 'examples'],
    description: 'Type of content source',
    weight: 1.0,
    mandatory: true
  },
  'content-type': {
    values: ['tutorial', 'reference', 'guide', 'example', 'template', 'boilerplate', 'snippet'],
    description: 'Nature of the content',
    weight: 0.9,
    mandatory: false
  },
  'complexity': {
    values: ['beginner', 'intermediate', 'advanced', 'expert'],
    description: 'Complexity level',
    weight: 0.8,
    mandatory: false
  },
  'technology': {
    values: ['react', 'typescript', 'javascript', 'node', 'python', 'go', 'rust', 'java'],
    description: 'Primary technology',
    weight: 1.0,
    mandatory: false
  },
  'language': {
    values: ['typescript', 'javascript', 'python', 'go', 'rust', 'java', 'cpp', 'csharp'],
    description: 'Programming language',
    weight: 0.9,
    mandatory: false
  },
  'framework': {
    values: ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'express', 'fastapi'],
    description: 'Framework or library',
    weight: 0.9,
    mandatory: false
  },
  'domain': {
    values: ['web-dev', 'mobile', 'api', 'database', 'devops', 'ai-ml', 'security', 'testing'],
    description: 'Application domain',
    weight: 0.8,
    mandatory: false
  },
  'audience': {
    values: ['developers', 'designers', 'product-managers', 'devops', 'beginners', 'experts'],
    description: 'Target audience',
    weight: 0.7,
    mandatory: false
  },
  'format': {
    values: ['text', 'code', 'video', 'interactive', 'diagram', 'schema'],
    description: 'Content format',
    weight: 0.6,
    mandatory: false
  },
  'quality': {
    values: ['excellent', 'good', 'fair', 'poor'],
    description: 'Content quality assessment',
    weight: 0.5,
    mandatory: false
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