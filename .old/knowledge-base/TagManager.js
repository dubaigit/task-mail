#!/usr/bin/env node

/**
 * Apple MCP Knowledge Base - Advanced Tag Management System
 * 
 * Hierarchical tagging and categorization system with AI-powered suggestions,
 * validation, quality scoring, and analytics tracking.
 */

const { Pool } = require('pg');
const OpenAI = require('openai');
const winston = require('winston');
const crypto = require('crypto');

/**
 * Hierarchical Tag Taxonomy Structure
 */
const TAG_TAXONOMY = {
  // Source identification and type
  'source-type': {
    values: ['documentation', 'code', 'specs', 'guides', 'tutorials', 'blog', 'api-docs', 'examples'],
    description: 'Type of content source',
    weight: 1.0,
    mandatory: true
  },
  
  // Technology stack and tools
  'technology': {
    values: [
      'react', 'typescript', 'javascript', 'node.js', 'express', 'postgresql', 
      'redis', 'openai', 'claude', 'tailwindcss', 'vite', 'jest', 'playwright',
      'docker', 'pm2', 'nginx', 'aws', 'git', 'github', 'mcp', 'archon',
      'claude-flow', 'zen-mcp', 'winston', 'bull', 'cheerio', 'anthropic'
    ],
    description: 'Technologies, frameworks, and tools',
    weight: 0.9,
    mandatory: false,
    allowMultiple: true
  },
  
  // Domain and focus area
  'domain': {
    values: [
      'frontend', 'backend', 'database', 'ai', 'testing', 'deployment', 
      'devops', 'security', 'performance', 'architecture', 'ui-ux', 
      'mobile', 'analytics', 'monitoring', 'integration', 'documentation'
    ],
    description: 'Primary domain or focus area',
    weight: 0.8,
    mandatory: true,
    allowMultiple: true
  },
  
  // Complexity and skill level
  'complexity': {
    values: ['beginner', 'intermediate', 'advanced', 'expert'],
    description: 'Content complexity and required skill level',
    weight: 0.7,
    mandatory: true
  },
  
  // Use case and application
  'use-case': {
    values: [
      'development', 'debugging', 'optimization', 'security', 'deployment',
      'testing', 'monitoring', 'integration', 'maintenance', 'troubleshooting',
      'learning', 'reference', 'best-practices', 'patterns', 'examples'
    ],
    description: 'Primary use case or application',
    weight: 0.6,
    mandatory: false,
    allowMultiple: true
  },
  
  // Content characteristics
  'content-features': {
    values: [
      'code-examples', 'step-by-step', 'visual-diagrams', 'interactive',
      'video-content', 'downloadable', 'live-demo', 'case-study',
      'comparison', 'troubleshooting-guide', 'quick-reference'
    ],
    description: 'Special content features and characteristics',
    weight: 0.5,
    mandatory: false,
    allowMultiple: true
  }
};

/**
 * Quality scoring criteria for sources and content
 */
const QUALITY_CRITERIA = {
  accuracy: { weight: 0.25, description: 'Technical accuracy and correctness' },
  completeness: { weight: 0.20, description: 'Coverage and thoroughness' },
  clarity: { weight: 0.20, description: 'Writing quality and clarity' },
  recency: { weight: 0.15, description: 'Content freshness and relevance' },
  examples: { weight: 0.10, description: 'Practical examples and demos' },
  authority: { weight: 0.10, description: 'Source authority and credibility' }
};

class TagManager {
  constructor(options = {}) {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.logger = this.setupLogger();
    
    // Tag configuration
    this.config = {
      maxTagsPerDocument: 15,
      maxAutoSuggestions: 10,
      suggestionConfidenceThreshold: 0.7,
      qualityScoreThreshold: 30,
      analyticsRetentionDays: 90,
      ...options
    };

    // Analytics tracking
    this.analytics = {
      tagsApplied: 0,
      suggestionsGenerated: 0,
      qualityScoresCalculated: 0,
      validationsPassed: 0,
      validationsFailed: 0
    };

    this.init();
  }

  setupLogger() {
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'tag-manager' },
      transports: [
        new winston.transports.File({ 
          filename: 'logs/tag-manager-error.log', 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: 'logs/tag-manager-combined.log' 
        }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  async init() {
    try {
      await this.pool.query('SELECT 1'); // Test DB connection
      await this.initializeTagTables();
      this.logger.info('TagManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize TagManager:', error);
      throw error;
    }
  }

  // Alias for external API compatibility
  async initialize() {
    return await this.init();
  }

  /**
   * Initialize tag management database tables
   */
  async initializeTagTables() {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create tag definitions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS tag_definitions (
          id SERIAL PRIMARY KEY,
          category VARCHAR(50) NOT NULL,
          tag_value VARCHAR(100) NOT NULL,
          description TEXT,
          weight NUMERIC(3,2) DEFAULT 1.0,
          is_mandatory BOOLEAN DEFAULT FALSE,
          allow_multiple BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(category, tag_value)
        )
      `);

      // Create document tags table (enhanced)
      await client.query(`
        CREATE TABLE IF NOT EXISTS document_tags (
          id SERIAL PRIMARY KEY,
          document_id INTEGER NOT NULL,
          category VARCHAR(50) NOT NULL,
          tag_value VARCHAR(100) NOT NULL,
          confidence_score NUMERIC(4,3) DEFAULT 1.0,
          source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'auto', 'ai-suggested', 'validated')),
          applied_by VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(document_id, category, tag_value)
        )
      `);

      // Create source quality scores table
      await client.query(`
        CREATE TABLE IF NOT EXISTS source_quality_scores (
          id SERIAL PRIMARY KEY,
          source_id INTEGER NOT NULL,
          overall_score NUMERIC(5,2) NOT NULL,
          accuracy_score NUMERIC(5,2) DEFAULT 0,
          completeness_score NUMERIC(5,2) DEFAULT 0,
          clarity_score NUMERIC(5,2) DEFAULT 0,
          recency_score NUMERIC(5,2) DEFAULT 0,
          examples_score NUMERIC(5,2) DEFAULT 0,
          authority_score NUMERIC(5,2) DEFAULT 0,
          evaluation_criteria JSONB DEFAULT '{}',
          last_evaluated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          evaluator VARCHAR(50),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create tag suggestions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS tag_suggestions (
          id SERIAL PRIMARY KEY,
          document_id INTEGER NOT NULL,
          suggested_tags JSONB NOT NULL,
          confidence_scores JSONB NOT NULL,
          reasoning TEXT,
          suggestion_source VARCHAR(20) DEFAULT 'ai' CHECK (suggestion_source IN ('ai', 'pattern', 'similarity', 'manual')),
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'modified')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          reviewed_at TIMESTAMP,
          reviewed_by VARCHAR(50)
        )
      `);

      // Create tag analytics table
      await client.query(`
        CREATE TABLE IF NOT EXISTS tag_analytics (
          id SERIAL PRIMARY KEY,
          event_type VARCHAR(50) NOT NULL,
          tag_category VARCHAR(50),
          tag_value VARCHAR(100),
          document_id INTEGER,
          source_id INTEGER,
          metadata JSONB DEFAULT '{}',
          session_id VARCHAR(100),
          user_context VARCHAR(500),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create performance indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_document_tags_document_id ON document_tags(document_id);
        CREATE INDEX IF NOT EXISTS idx_document_tags_category ON document_tags(category);
        CREATE INDEX IF NOT EXISTS idx_document_tags_confidence ON document_tags(confidence_score DESC);
        CREATE INDEX IF NOT EXISTS idx_source_quality_overall ON source_quality_scores(overall_score DESC);
        CREATE INDEX IF NOT EXISTS idx_tag_suggestions_status ON tag_suggestions(status);
        CREATE INDEX IF NOT EXISTS idx_tag_analytics_event_type ON tag_analytics(event_type);
        CREATE INDEX IF NOT EXISTS idx_tag_analytics_created_at ON tag_analytics(created_at DESC);
      `);

      // Populate tag definitions from taxonomy
      await this.populateTagDefinitions(client);

      await client.query('COMMIT');
      this.logger.info('Tag management tables initialized successfully');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Populate tag definitions from the hierarchical taxonomy
   */
  async populateTagDefinitions(client) {
    for (const [category, config] of Object.entries(TAG_TAXONOMY)) {
      for (const value of config.values) {
        await client.query(`
          INSERT INTO tag_definitions (category, tag_value, description, weight, is_mandatory, allow_multiple)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (category, tag_value) DO UPDATE SET
            description = EXCLUDED.description,
            weight = EXCLUDED.weight,
            is_mandatory = EXCLUDED.is_mandatory,
            allow_multiple = EXCLUDED.allow_multiple,
            updated_at = CURRENT_TIMESTAMP
        `, [
          category,
          value,
          config.description,
          config.weight || 1.0,
          config.mandatory || false,
          config.allowMultiple !== false
        ]);
      }
    }
  }

  /**
   * Generate AI-powered tag suggestions for content
   */
  async generateTagSuggestions(documentId, content, metadata = {}) {
    try {
      // Prepare content for AI analysis
      const analysisContent = this.prepareContentForAnalysis(content, metadata);
      
      // Generate AI suggestions
      const aiSuggestions = await this.callAIForTagging(analysisContent);
      
      // Validate and score suggestions
      const validatedSuggestions = await this.validateSuggestions(aiSuggestions);
      
      // Store suggestions
      const suggestionId = await this.storeSuggestions(documentId, validatedSuggestions, 'ai');
      
      // Track analytics
      await this.trackAnalytics('suggestions_generated', null, null, documentId, {
        suggestionCount: validatedSuggestions.tags.length,
        avgConfidence: this.calculateAverageConfidence(validatedSuggestions)
      });

      this.analytics.suggestionsGenerated++;
      
      return {
        suggestionId,
        suggestions: validatedSuggestions,
        metadata: {
          totalSuggestions: validatedSuggestions.tags.length,
          averageConfidence: this.calculateAverageConfidence(validatedSuggestions),
          categories: Object.keys(validatedSuggestions.tags)
        }
      };

    } catch (error) {
      this.logger.error('Error generating tag suggestions:', error);
      throw new Error(`Failed to generate tag suggestions: ${error.message}`);
    }
  }

  /**
   * Prepare content for AI analysis
   */
  prepareContentForAnalysis(content, metadata) {
    const maxLength = 4000; // Stay within AI context limits
    
    let analysisText = '';
    
    // Add title if available
    if (metadata.title) {
      analysisText += `Title: ${metadata.title}\n\n`;
    }
    
    // Add URL for context
    if (metadata.url) {
      analysisText += `URL: ${metadata.url}\n\n`;
    }
    
    // Add content (truncated if necessary)
    const contentToAnalyze = content.length > maxLength 
      ? content.substring(0, maxLength) + '...'
      : content;
      
    analysisText += `Content:\n${contentToAnalyze}`;
    
    return analysisText;
  }

  /**
   * Call AI service for intelligent tagging
   */
  async callAIForTagging(content) {
    const taxonomyDesc = Object.entries(TAG_TAXONOMY)
      .map(([category, config]) => 
        `${category}: ${config.values.join(', ')} (${config.description})`
      ).join('\n');

    const prompt = `
Analyze the following technical content and suggest appropriate tags based on the hierarchical taxonomy below.

TAXONOMY:
${taxonomyDesc}

RULES:
1. Only use tags from the predefined taxonomy
2. Be specific and accurate - don't guess
3. Assign 1-3 tags per category maximum
4. Provide confidence scores (0.0-1.0) for each suggestion
5. Focus on the most relevant and specific tags

CONTENT TO ANALYZE:
${content}

Please respond in JSON format:
{
  "tags": {
    "category-name": [
      {"value": "tag-value", "confidence": 0.95, "reasoning": "why this tag applies"}
    ]
  },
  "overall_confidence": 0.85,
  "analysis_notes": "brief explanation of content analysis"
}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert technical content tagger. Analyze content and suggest precise, relevant tags from a predefined taxonomy.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistency
        max_tokens: 1000
      });

      const aiResponse = JSON.parse(response.choices[0].message.content);
      return aiResponse;

    } catch (error) {
      this.logger.error('AI tagging error:', error);
      
      // Fallback to pattern-based suggestions
      return this.generatePatternBasedSuggestions(content);
    }
  }

  /**
   * Fallback pattern-based tag suggestions
   */
  generatePatternBasedSuggestions(content) {
    const suggestions = { tags: {}, overall_confidence: 0.6, analysis_notes: 'Pattern-based analysis' };
    const lowerContent = content.toLowerCase();

    // Technology detection patterns
    const techPatterns = {
      'react': ['react', 'jsx', 'usestate', 'useeffect', 'component'],
      'typescript': ['typescript', 'interface', 'type ', '.ts', '.tsx'],
      'node.js': ['node', 'express', 'npm', 'require(', 'module.exports'],
      'postgresql': ['postgresql', 'postgres', 'pg', 'sql'],
      'javascript': ['javascript', 'function', 'const ', 'let ', 'var ']
    };

    suggestions.tags.technology = [];
    for (const [tech, patterns] of Object.entries(techPatterns)) {
      const matches = patterns.filter(pattern => lowerContent.includes(pattern)).length;
      if (matches >= 2) {
        suggestions.tags.technology.push({
          value: tech,
          confidence: Math.min(0.8, 0.4 + (matches * 0.1)),
          reasoning: `Pattern matching: found ${matches} relevant keywords`
        });
      }
    }

    // Domain detection
    if (lowerContent.includes('component') || lowerContent.includes('ui') || lowerContent.includes('css')) {
      suggestions.tags.domain = [{ value: 'frontend', confidence: 0.7, reasoning: 'Frontend-related keywords detected' }];
    } else if (lowerContent.includes('api') || lowerContent.includes('server') || lowerContent.includes('database')) {
      suggestions.tags.domain = [{ value: 'backend', confidence: 0.7, reasoning: 'Backend-related keywords detected' }];
    }

    return suggestions;
  }

  /**
   * Validate AI suggestions against taxonomy
   */
  async validateSuggestions(aiSuggestions) {
    const validatedTags = {};
    const validationErrors = [];

    for (const [category, suggestions] of Object.entries(aiSuggestions.tags || {})) {
      if (!TAG_TAXONOMY[category]) {
        validationErrors.push(`Invalid category: ${category}`);
        continue;
      }

      const categoryConfig = TAG_TAXONOMY[category];
      const validSuggestions = [];

      for (const suggestion of suggestions) {
        // Check if tag value exists in taxonomy
        if (!categoryConfig.values.includes(suggestion.value)) {
          validationErrors.push(`Invalid tag value: ${suggestion.value} in category ${category}`);
          continue;
        }

        // Check confidence threshold
        if (suggestion.confidence < this.config.suggestionConfidenceThreshold) {
          validationErrors.push(`Low confidence tag: ${suggestion.value} (${suggestion.confidence})`);
          continue;
        }

        validSuggestions.push(suggestion);
      }

      // Respect multiple tag limits
      if (!categoryConfig.allowMultiple && validSuggestions.length > 1) {
        validSuggestions.splice(1); // Keep only the first (highest confidence)
      }

      if (validSuggestions.length > 0) {
        validatedTags[category] = validSuggestions;
      }
    }

    return {
      tags: validatedTags,
      validationErrors,
      overall_confidence: aiSuggestions.overall_confidence || 0.5,
      analysis_notes: aiSuggestions.analysis_notes || 'AI-generated suggestions'
    };
  }

  /**
   * Apply tags to a document
   */
  async applyTags(documentId, tags, appliedBy = 'system', source = 'manual') {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Clear existing tags if this is a full re-tagging
      if (source === 'manual') {
        await client.query('DELETE FROM document_tags WHERE document_id = $1', [documentId]);
      }

      // Apply new tags
      for (const [category, tagList] of Object.entries(tags)) {
        const categoryTags = Array.isArray(tagList) ? tagList : [tagList];
        
        for (const tag of categoryTags) {
          const tagValue = typeof tag === 'string' ? tag : tag.value;
          const confidence = typeof tag === 'object' ? tag.confidence : 1.0;

          await client.query(`
            INSERT INTO document_tags (document_id, category, tag_value, confidence_score, source, applied_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (document_id, category, tag_value) DO UPDATE SET
              confidence_score = EXCLUDED.confidence_score,
              source = EXCLUDED.source,
              applied_by = EXCLUDED.applied_by
          `, [documentId, category, tagValue, confidence, source, appliedBy]);

          // Track analytics
          await this.trackAnalytics('tag_applied', category, tagValue, documentId, {
            confidence,
            source,
            appliedBy
          });
        }
      }

      await client.query('COMMIT');
      this.analytics.tagsApplied++;

      this.logger.info(`Applied tags to document ${documentId}`, { tags, source });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Calculate source quality score
   */
  async calculateSourceQualityScore(sourceId, content, metadata = {}) {
    try {
      const qualityScores = {};
      
      // Accuracy score (based on technical correctness indicators)
      qualityScores.accuracy = this.assessAccuracy(content, metadata);
      
      // Completeness score (based on content depth and coverage)
      qualityScores.completeness = this.assessCompleteness(content, metadata);
      
      // Clarity score (based on writing quality and structure)
      qualityScores.clarity = this.assessClarity(content, metadata);
      
      // Recency score (based on last modified date)
      qualityScores.recency = this.assessRecency(metadata.lastModified);
      
      // Examples score (based on presence of code examples)
      qualityScores.examples = this.assessExamples(content);
      
      // Authority score (based on source reputation)
      qualityScores.authority = await this.assessAuthority(sourceId, metadata.url);

      // Calculate overall score
      const overallScore = Object.entries(qualityScores).reduce((total, [criterion, score]) => {
        const weight = QUALITY_CRITERIA[criterion]?.weight || 0;
        return total + (score * weight);
      }, 0) * 100; // Convert to 0-100 scale

      // Store quality scores
      await this.storeQualityScores(sourceId, overallScore, qualityScores);

      this.analytics.qualityScoresCalculated++;

      return {
        overall_score: Math.round(overallScore * 100) / 100,
        criteria_scores: qualityScores,
        evaluation_date: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Error calculating quality score:', error);
      throw error;
    }
  }

  /**
   * Search content by tags with advanced filtering
   */
  async searchByTags(tagFilters, options = {}) {
    try {
      const { sql, params } = this.buildTagSearchQuery(tagFilters, options);
      const result = await this.pool.query(sql, params);

      // Process and enhance results
      const enhancedResults = await this.enhanceSearchResults(result.rows, options);

      return {
        results: enhancedResults,
        metadata: {
          totalResults: result.rows.length,
          appliedFilters: tagFilters,
          searchOptions: options
        }
      };

    } catch (error) {
      this.logger.error('Tag search error:', error);
      throw error;
    }
  }

  /**
   * Get tag analytics and usage statistics
   */
  async getTagAnalytics(timeRange = '30d', filters = {}) {
    try {
      const analytics = {};

      // Tag usage frequency
      analytics.tagUsage = await this.getTagUsageStats(timeRange, filters);
      
      // Quality score distribution
      analytics.qualityDistribution = await this.getQualityDistribution(filters);
      
      // Tag co-occurrence patterns
      analytics.coOccurrence = await this.getTagCoOccurrence(timeRange);
      
      // Suggestion acceptance rates
      analytics.suggestionStats = await this.getSuggestionStats(timeRange);
      
      // Performance metrics
      analytics.performance = {
        ...this.analytics,
        timeRange,
        lastUpdated: new Date().toISOString()
      };

      return analytics;

    } catch (error) {
      this.logger.error('Analytics error:', error);
      throw error;
    }
  }

  // Helper methods

  buildTagSearchQuery(tagFilters, options) {
    let sql = `
      SELECT DISTINCT d.id, d.title, d.content, d.url, d.metadata,
             s.name as source_name, s.source_type,
             json_agg(
               json_build_object(
                 'category', dt.category,
                 'value', dt.tag_value,
                 'confidence', dt.confidence_score
               )
             ) as tags
      FROM documents d
      JOIN sources s ON d.source_id = s.id
      JOIN document_tags dt ON d.id = dt.document_id
    `;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Build tag filter conditions
    for (const [category, values] of Object.entries(tagFilters)) {
      if (values && values.length > 0) {
        conditions.push(`
          d.id IN (
            SELECT document_id FROM document_tags 
            WHERE category = $${paramIndex} AND tag_value = ANY($${paramIndex + 1})
          )
        `);
        params.push(category, values);
        paramIndex += 2;
      }
    }

    // Apply quality threshold filter
    if (options.minQuality) {
      sql += ` JOIN source_quality_scores sqs ON s.id = sqs.source_id`;
      conditions.push(`sqs.overall_score >= $${paramIndex}`);
      params.push(options.minQuality);
      paramIndex++;
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` GROUP BY d.id, d.title, d.content, d.url, d.metadata, s.name, s.source_type`;
    
    // Apply sorting
    const sortBy = options.sortBy || 'relevance';
    if (sortBy === 'quality') {
      sql += ` ORDER BY sqs.overall_score DESC`;
    } else if (sortBy === 'date') {
      sql += ` ORDER BY d.updated_at DESC`;
    }

    // Apply limit
    if (options.limit) {
      sql += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
    }

    return { sql, params };
  }

  calculateAverageConfidence(suggestions) {
    const allSuggestions = Object.values(suggestions.tags).flat();
    if (allSuggestions.length === 0) return 0;
    
    const total = allSuggestions.reduce((sum, tag) => sum + tag.confidence, 0);
    return total / allSuggestions.length;
  }

  async storeSuggestions(documentId, suggestions, source) {
    const result = await this.pool.query(`
      INSERT INTO tag_suggestions (document_id, suggested_tags, confidence_scores, reasoning, suggestion_source)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [
      documentId,
      JSON.stringify(suggestions.tags),
      JSON.stringify(Object.values(suggestions.tags).flat().map(t => t.confidence)),
      suggestions.analysis_notes,
      source
    ]);

    return result.rows[0].id;
  }

  async trackAnalytics(eventType, category, tagValue, documentId, metadata = {}) {
    await this.pool.query(`
      INSERT INTO tag_analytics (event_type, tag_category, tag_value, document_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `, [eventType, category, tagValue, documentId, JSON.stringify(metadata)]);
  }

  // Quality assessment methods
  assessAccuracy(content, metadata) {
    let score = 0.5; // Base score
    
    // Look for technical accuracy indicators
    if (content.includes('```') || content.includes('<code>')) score += 0.2; // Has code examples
    if (content.match(/https?:\/\/[^\s]+/g)) score += 0.1; // Has references
    if (content.length > 1000) score += 0.1; // Substantial content
    if (metadata.title && metadata.title.includes('official')) score += 0.1; // Official documentation
    
    return Math.min(score, 1.0);
  }

  assessCompleteness(content, metadata) {
    let score = 0.3; // Base score
    
    const wordCount = content.split(/\s+/).length;
    if (wordCount > 2000) score += 0.3;
    else if (wordCount > 1000) score += 0.2;
    else if (wordCount > 500) score += 0.1;
    
    // Check for sections/structure
    const sections = content.match(/#{1,6}\s+/g) || [];
    score += Math.min(sections.length * 0.05, 0.2);
    
    // Check for examples
    if (content.includes('example') || content.includes('Example')) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  assessClarity(content, metadata) {
    let score = 0.5; // Base score
    
    // Simple readability checks
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = content.length / sentences.length;
    
    if (avgSentenceLength < 100) score += 0.2; // Not too verbose
    if (avgSentenceLength > 20) score += 0.1; // Not too terse
    
    // Check for clear structure
    if (content.includes('\n\n')) score += 0.1; // Has paragraphs
    if (content.match(/^\s*[-*]\s+/gm)) score += 0.1; // Has lists
    
    return Math.min(score, 1.0);
  }

  assessRecency(lastModified) {
    if (!lastModified) return 0.3; // Default for unknown dates
    
    const daysSinceUpdate = (Date.now() - new Date(lastModified)) / (1000 * 60 * 60 * 24);
    
    if (daysSinceUpdate < 30) return 1.0;
    if (daysSinceUpdate < 90) return 0.8;
    if (daysSinceUpdate < 180) return 0.6;
    if (daysSinceUpdate < 365) return 0.4;
    return 0.2;
  }

  assessExamples(content) {
    let score = 0.0;
    
    const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length;
    const inlineCode = (content.match(/`[^`]+`/g) || []).length;
    
    score += Math.min(codeBlocks * 0.3, 0.6);
    score += Math.min(inlineCode * 0.02, 0.2);
    
    if (content.toLowerCase().includes('demo')) score += 0.1;
    if (content.toLowerCase().includes('tutorial')) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  async assessAuthority(sourceId, url) {
    // This could be enhanced with external authority scoring services
    let score = 0.5; // Base score
    
    if (!url) return score;
    
    const authorityDomains = [
      'developer.mozilla.org', 'docs.microsoft.com', 'docs.google.com',
      'reactjs.org', 'nodejs.org', 'postgresql.org', 'github.com',
      'stackoverflow.com', 'medium.com'
    ];
    
    const domain = new URL(url).hostname;
    if (authorityDomains.some(auth => domain.includes(auth))) {
      score += 0.4;
    }
    
    return Math.min(score, 1.0);
  }

  async storeQualityScores(sourceId, overallScore, criteriaScores) {
    await this.pool.query(`
      INSERT INTO source_quality_scores (
        source_id, overall_score, accuracy_score, completeness_score,
        clarity_score, recency_score, examples_score, authority_score,
        evaluator
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (source_id) DO UPDATE SET
        overall_score = EXCLUDED.overall_score,
        accuracy_score = EXCLUDED.accuracy_score,
        completeness_score = EXCLUDED.completeness_score,
        clarity_score = EXCLUDED.clarity_score,
        recency_score = EXCLUDED.recency_score,
        examples_score = EXCLUDED.examples_score,
        authority_score = EXCLUDED.authority_score,
        last_evaluated = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `, [
      sourceId,
      overallScore,
      criteriaScores.accuracy || 0,
      criteriaScores.completeness || 0,
      criteriaScores.clarity || 0,
      criteriaScores.recency || 0,
      criteriaScores.examples || 0,
      criteriaScores.authority || 0,
      'tag-manager'
    ]);
  }

  async enhanceSearchResults(results, options) {
    // Add quality scores and tag details to results
    return Promise.all(results.map(async (result) => {
      try {
        // Get quality score
        const qualityResult = await this.pool.query(
          'SELECT overall_score FROM source_quality_scores WHERE source_id = (SELECT id FROM sources WHERE name = $1) LIMIT 1',
          [result.source_name]
        );
        
        result.quality_score = qualityResult.rows[0]?.overall_score || null;
        
        return result;
      } catch (error) {
        this.logger.warn('Failed to enhance search result:', error);
        return result;
      }
    }));
  }

  async getTagUsageStats(timeRange, filters) {
    // Implementation for tag usage statistics
    const result = await this.pool.query(`
      SELECT tag_category, tag_value, COUNT(*) as usage_count
      FROM tag_analytics
      WHERE created_at >= NOW() - INTERVAL '${timeRange}'
        AND event_type = 'tag_applied'
      GROUP BY tag_category, tag_value
      ORDER BY usage_count DESC
      LIMIT 50
    `);
    
    return result.rows;
  }

  async getQualityDistribution(filters) {
    const result = await this.pool.query(`
      SELECT 
        CASE 
          WHEN overall_score >= 80 THEN 'High'
          WHEN overall_score >= 60 THEN 'Medium'
          WHEN overall_score >= 40 THEN 'Low'
          ELSE 'Very Low'
        END as quality_tier,
        COUNT(*) as count
      FROM source_quality_scores
      GROUP BY quality_tier
      ORDER BY quality_tier
    `);
    
    return result.rows;
  }

  async getTagCoOccurrence(timeRange) {
    // Implementation for tag co-occurrence analysis
    return []; // Placeholder
  }

  async getSuggestionStats(timeRange) {
    const result = await this.pool.query(`
      SELECT 
        status,
        suggestion_source,
        COUNT(*) as count,
        AVG(array_length(string_to_array(confidence_scores::text, ','), 1)) as avg_suggestions_per_doc
      FROM tag_suggestions
      WHERE created_at >= NOW() - INTERVAL '${timeRange}'
      GROUP BY status, suggestion_source
      ORDER BY count DESC
    `);
    
    return result.rows;
  }

  /**
   * Get taxonomy information
   */
  getTaxonomy() {
    return TAG_TAXONOMY;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.analytics,
      timestamp: new Date().toISOString(),
      config: this.config
    };
  }
}

module.exports = TagManager;