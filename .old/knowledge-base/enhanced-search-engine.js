#!/usr/bin/env node

/**
 * Apple MCP Enhanced Semantic Search Engine
 * 
 * Advanced search system optimized for AI-powered development workflows
 * with contextual embeddings, hybrid search, and intelligent reranking.
 */

const { Pool } = require('pg');
const Redis = require('redis');
const OpenAI = require('openai');
const winston = require('winston');
const crypto = require('crypto');
const natural = require('natural');

class EnhancedSearchEngine {
  constructor(options = {}) {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 25,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });

    this.redis = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.logger = this.setupLogger();
    this.embeddingModel = 'text-embedding-3-large';
    this.embeddingDimensions = 1536;
    
    // Search configuration
    this.config = {
      defaultMaxResults: 20,
      semanticWeight: 0.7,
      keywordWeight: 0.3,
      minSimilarityThreshold: 0.7,
      cacheTimeout: 3600, // 1 hour
      maxQueryLength: 8000,
      snippetLength: 300,
      maxHighlights: 5,
      ...options
    };

    // Performance metrics
    this.metrics = {
      totalSearches: 0,
      cacheHits: 0,
      averageLatency: 0,
      errorCount: 0
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
      defaultMeta: { service: 'enhanced-search' },
      transports: [
        new winston.transports.File({ 
          filename: 'logs/search-error.log', 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: 'logs/search-combined.log' 
        }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  async init() {
    try {
      await this.redis.connect();
      await this.pool.query('SELECT 1'); // Test DB connection
      this.logger.info('Enhanced Search Engine initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Enhanced Search Engine:', error);
      throw error;
    }
  }

  /**
   * Main search interface with advanced capabilities
   */
  async search(query, options = {}) {
    const startTime = Date.now();
    this.metrics.totalSearches++;

    try {
      // Validate and sanitize input
      const sanitizedQuery = this.sanitizeQuery(query);
      if (!sanitizedQuery) {
        throw new Error('Invalid or empty query');
      }

      // Generate cache key
      const cacheKey = this.generateCacheKey(sanitizedQuery, options);
      
      // Check cache first
      if (!options.skipCache) {
        const cached = await this.getCachedResult(cacheKey);
        if (cached) {
          this.metrics.cacheHits++;
          return this.enhanceResult(cached, { fromCache: true, searchTime: Date.now() - startTime });
        }
      }

      // Determine search strategy
      const searchType = options.searchType || 'hybrid';
      let results;

      switch (searchType) {
        case 'semantic':
          results = await this.semanticSearch(sanitizedQuery, options);
          break;
        case 'keyword':
          results = await this.keywordSearch(sanitizedQuery, options);
          break;
        case 'faceted':
          results = await this.facetedSearch(sanitizedQuery, options);
          break;
        case 'contextual':
          results = await this.contextualSearch(sanitizedQuery, options);
          break;
        case 'hybrid':
        default:
          results = await this.hybridSearch(sanitizedQuery, options);
          break;
      }

      // Apply post-processing enhancements
      const enhancedResults = await this.enhanceResults(results, sanitizedQuery, options);

      // Apply reranking if not disabled
      const finalResults = options.skipReranking 
        ? enhancedResults 
        : await this.rerankResults(enhancedResults, sanitizedQuery, options);

      // Prepare response
      const response = {
        results: finalResults.slice(0, options.maxResults || this.config.defaultMaxResults),
        metadata: {
          totalResults: finalResults.length,
          searchTime: Date.now() - startTime,
          searchType,
          query: sanitizedQuery,
          appliedFilters: options.filters || {},
          cacheKey,
          suggestions: await this.generateSuggestions(sanitizedQuery)
        }
      };

      // Cache results
      if (!options.skipCache) {
        await this.cacheResult(cacheKey, response);
      }

      // Log analytics
      await this.logSearchAnalytics(sanitizedQuery, response, startTime, options);

      this.metrics.averageLatency = 
        (this.metrics.averageLatency + (Date.now() - startTime)) / 2;

      return response;

    } catch (error) {
      this.metrics.errorCount++;
      this.logger.error('Search error:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Advanced semantic search with contextual embeddings
   */
  async semanticSearch(query, options = {}) {
    const queryEmbedding = await this.generateEmbedding(query);
    
    const sql = `
      SELECT 
        d.id,
        d.title,
        d.content,
        d.url,
        d.metadata,
        d.difficulty_level,
        d.authority_score,
        d.word_count,
        d.reading_time,
        s.name as source_name,
        s.source_type,
        s.authority_weight,
        de.chunk_index,
        de.content_text as chunk_content,
        1 - (de.embedding <=> $1::vector) as similarity_score,
        ts_rank(
          to_tsvector('english', d.title),
          plainto_tsquery('english', $2)
        ) as title_rank
      FROM document_embeddings de
      JOIN documents d ON de.document_id = d.id
      JOIN sources s ON d.source_id = s.id
      WHERE 
        1 - (de.embedding <=> $1::vector) > $3
        AND s.is_active = true
        ${this.buildFilterClause(options.filters, 4)}
      ORDER BY similarity_score DESC, title_rank DESC
      LIMIT $${this.getNextParamIndex(options.filters, 4)}
    `;

    const params = [
      `[${queryEmbedding.join(',')}]`,
      query,
      options.minSimilarity || this.config.minSimilarityThreshold,
      ...this.buildFilterParams(options.filters),
      options.maxResults || 50
    ];

    const result = await this.pool.query(sql, params);
    return this.processSearchResults(result.rows, query);
  }

  /**
   * Advanced keyword search with full-text capabilities
   */
  async keywordSearch(query, options = {}) {
    const sql = `
      WITH ranked_docs AS (
        SELECT 
          d.id,
          d.title,
          d.content,
          d.url,
          d.metadata,
          d.difficulty_level,
          d.authority_score,
          d.word_count,
          d.reading_time,
          s.name as source_name,
          s.source_type,
          s.authority_weight,
          ts_rank_cd(
            to_tsvector('english', d.title || ' ' || COALESCE(d.content, '')),
            plainto_tsquery('english', $1)
          ) as relevance_score,
          ts_headline(
            'english',
            COALESCE(d.content, d.title),
            plainto_tsquery('english', $1),
            'MaxWords=50, MinWords=20'
          ) as highlighted_snippet
        FROM documents d
        JOIN sources s ON d.source_id = s.id
        WHERE 
          to_tsvector('english', d.title || ' ' || COALESCE(d.content, '')) 
          @@ plainto_tsquery('english', $1)
          AND s.is_active = true
          ${this.buildFilterClause(options.filters, 2)}
      )
      SELECT *
      FROM ranked_docs
      ORDER BY relevance_score DESC, authority_score DESC
      LIMIT $${this.getNextParamIndex(options.filters, 2)}
    `;

    const params = [
      query,
      ...this.buildFilterParams(options.filters),
      options.maxResults || 50
    ];

    const result = await this.pool.query(sql, params);
    return this.processSearchResults(result.rows, query, 'keyword');
  }

  /**
   * Hybrid search combining semantic and keyword approaches
   */
  async hybridSearch(query, options = {}) {
    const [semanticResults, keywordResults] = await Promise.all([
      this.semanticSearch(query, { ...options, maxResults: 30 }),
      this.keywordSearch(query, { ...options, maxResults: 30 })
    ]);

    return this.combineSearchResults(semanticResults, keywordResults, query);
  }

  /**
   * Faceted search with dynamic filtering
   */
  async facetedSearch(query, options = {}) {
    const baseResults = await this.hybridSearch(query, options);
    
    // Generate facets from results
    const facets = await this.generateFacets(baseResults, options);
    
    // Apply facet filters
    const filteredResults = this.applyFacetFilters(baseResults, options.facetFilters);

    return {
      results: filteredResults,
      facets,
      appliedFacets: options.facetFilters || {}
    };
  }

  /**
   * Contextual search with project awareness
   */
  async contextualSearch(query, options = {}) {
    const projectContext = options.projectContext || {};
    
    // Enhance query with project context
    const contextualQuery = await this.enhanceQueryWithContext(query, projectContext);
    
    // Perform hybrid search with enhanced query
    const results = await this.hybridSearch(contextualQuery, {
      ...options,
      filters: {
        ...options.filters,
        technologies: [
          ...(options.filters?.technologies || []),
          ...(projectContext.techStack || [])
        ]
      }
    });

    // Enhance results with project relevance
    return this.enhanceResultsWithContext(results, projectContext);
  }

  /**
   * Advanced result reranking with multiple signals
   */
  async rerankResults(results, query, options = {}) {
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    return results.map(result => {
      let score = result.score || 0;
      
      // Title relevance boost
      const titleMatches = this.countMatches(result.title, queryTerms);
      score += titleMatches * 0.3;
      
      // Authority boost
      score *= (1 + (result.authority_score || 0) / 100 * 0.2);
      
      // Source authority boost
      score *= (1 + (result.source_authority || 1) * 0.1);
      
      // Recency boost
      const recencyBoost = this.calculateRecencyBoost(result.updated_at);
      score *= (1 + recencyBoost * 0.15);
      
      // Content quality boost
      const qualityBoost = this.calculateQualityBoost(result);
      score *= (1 + qualityBoost * 0.1);
      
      // Difficulty alignment boost (if specified)
      if (options.preferredDifficulty) {
        const difficultyAlignment = this.calculateDifficultyAlignment(
          result.difficulty_level, 
          options.preferredDifficulty
        );
        score *= (1 + difficultyAlignment * 0.1);
      }

      return {
        ...result,
        score,
        rerankingFactors: {
          titleMatches,
          authorityBoost: (result.authority_score || 0) / 100 * 0.2,
          recencyBoost,
          qualityBoost,
          originalScore: result.score || 0
        }
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Enhanced result clustering and categorization
   */
  async clusterResults(results, options = {}) {
    const clusters = new Map();
    
    for (const result of results) {
      const category = this.categorizeResult(result);
      
      if (!clusters.has(category)) {
        clusters.set(category, {
          category,
          results: [],
          avgScore: 0,
          totalResults: 0
        });
      }
      
      const cluster = clusters.get(category);
      cluster.results.push(result);
      cluster.totalResults++;
      cluster.avgScore = (cluster.avgScore + result.score) / cluster.totalResults;
    }

    // Sort clusters by average score
    return Array.from(clusters.values())
      .sort((a, b) => b.avgScore - a.avgScore)
      .map(cluster => ({
        ...cluster,
        results: cluster.results.sort((a, b) => b.score - a.score)
      }));
  }

  /**
   * Cross-reference validation between documents
   */
  async validateCrossReferences(results, query) {
    const validatedResults = [];
    
    for (const result of results) {
      const crossRefs = await this.findCrossReferences(result, results);
      const validationScore = this.calculateValidationScore(crossRefs);
      
      validatedResults.push({
        ...result,
        crossReferences: crossRefs,
        validationScore,
        trustScore: (result.score + validationScore) / 2
      });
    }

    return validatedResults.sort((a, b) => b.trustScore - a.trustScore);
  }

  /**
   * Generate intelligent search suggestions
   */
  async generateSuggestions(query) {
    try {
      // Get query history suggestions
      const historySuggestions = await this.getHistorySuggestions(query);
      
      // Get content-based suggestions
      const contentSuggestions = await this.getContentSuggestions(query);
      
      // Get AI-powered suggestions
      const aiSuggestions = await this.getAISuggestions(query);

      return {
        history: historySuggestions.slice(0, 3),
        content: contentSuggestions.slice(0, 3),
        ai: aiSuggestions.slice(0, 3),
        combined: [...historySuggestions, ...contentSuggestions, ...aiSuggestions]
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 5)
      };
    } catch (error) {
      this.logger.warn('Failed to generate suggestions:', error);
      return { history: [], content: [], ai: [], combined: [] };
    }
  }

  /**
   * Real-time indexing for new content
   */
  async indexContent(content, metadata = {}) {
    try {
      // Insert document
      const documentResult = await this.pool.query(`
        INSERT INTO documents (title, content, url, content_type, metadata, source_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        metadata.title || 'Untitled',
        content,
        metadata.url,
        metadata.contentType || 'documentation',
        JSON.stringify(metadata),
        metadata.sourceId || 1
      ]);

      const documentId = documentResult.rows[0].id;

      // Generate and store embeddings
      await this.generateAndStoreEmbeddings(documentId, content, metadata.title);

      // Auto-tag content
      await this.autoTagContent(documentId, content, metadata);

      // Invalidate relevant caches
      await this.invalidateRelatedCaches(content);

      this.logger.info(`Successfully indexed new content with ID: ${documentId}`);
      return documentId;

    } catch (error) {
      this.logger.error('Failed to index content:', error);
      throw error;
    }
  }

  /**
   * Performance monitoring and analytics
   */
  getPerformanceMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.cacheHits / this.metrics.totalSearches,
      errorRate: this.metrics.errorCount / this.metrics.totalSearches,
      timestamp: new Date().toISOString()
    };
  }

  // Helper methods

  sanitizeQuery(query) {
    if (!query || typeof query !== 'string') return null;
    return query.trim().substring(0, this.config.maxQueryLength);
  }

  generateCacheKey(query, options) {
    const cacheData = { query, filters: options.filters, searchType: options.searchType };
    return crypto.createHash('sha256').update(JSON.stringify(cacheData)).digest('hex');
  }

  async getCachedResult(key) {
    try {
      const cached = await this.redis.get(`search:${key}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.warn('Cache retrieval error:', error);
      return null;
    }
  }

  async cacheResult(key, result) {
    try {
      await this.redis.setex(
        `search:${key}`, 
        this.config.cacheTimeout, 
        JSON.stringify(result)
      );
    } catch (error) {
      this.logger.warn('Cache storage error:', error);
    }
  }

  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text.substring(0, this.config.maxQueryLength),
        dimensions: this.embeddingDimensions
      });
      
      return response.data[0].embedding;
    } catch (error) {
      this.logger.error('Embedding generation error:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  buildFilterClause(filters, startIndex) {
    if (!filters) return '';
    
    const conditions = [];
    let paramIndex = startIndex;

    if (filters.technologies?.length > 0) {
      conditions.push(`d.metadata->>'technology' = ANY($${paramIndex})`);
      paramIndex++;
    }

    if (filters.difficulty?.length > 0) {
      conditions.push(`d.difficulty_level = ANY($${paramIndex})`);
      paramIndex++;
    }

    if (filters.contentTypes?.length > 0) {
      conditions.push(`d.content_type = ANY($${paramIndex})`);
      paramIndex++;
    }

    if (filters.sources?.length > 0) {
      conditions.push(`s.name = ANY($${paramIndex})`);
      paramIndex++;
    }

    return conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '';
  }

  buildFilterParams(filters) {
    if (!filters) return [];
    
    const params = [];
    
    if (filters.technologies?.length > 0) params.push(filters.technologies);
    if (filters.difficulty?.length > 0) params.push(filters.difficulty);
    if (filters.contentTypes?.length > 0) params.push(filters.contentTypes);
    if (filters.sources?.length > 0) params.push(filters.sources);

    return params;
  }

  getNextParamIndex(filters, baseIndex) {
    return baseIndex + this.buildFilterParams(filters).length;
  }

  processSearchResults(rows, query, type = 'semantic') {
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      snippet: this.generateSnippet(row.content || row.chunk_content, query),
      url: row.url,
      source: {
        name: row.source_name,
        type: row.source_type,
        authority: row.authority_weight
      },
      score: parseFloat(row.similarity_score || row.relevance_score || 0),
      metadata: row.metadata,
      difficulty_level: row.difficulty_level,
      authority_score: row.authority_score,
      word_count: row.word_count,
      reading_time: row.reading_time,
      highlights: this.extractHighlights(row.content || row.chunk_content, query),
      searchType: type,
      chunk_index: row.chunk_index
    }));
  }

  combineSearchResults(semanticResults, keywordResults, query) {
    const resultMap = new Map();
    
    // Add semantic results
    semanticResults.forEach(result => {
      resultMap.set(result.id, {
        ...result,
        scores: {
          semantic: result.score,
          keyword: 0,
          combined: result.score * this.config.semanticWeight
        }
      });
    });

    // Add or update with keyword results
    keywordResults.forEach(result => {
      if (resultMap.has(result.id)) {
        const existing = resultMap.get(result.id);
        existing.scores.keyword = result.score;
        existing.scores.combined = 
          (existing.scores.semantic * this.config.semanticWeight) + 
          (result.score * this.config.keywordWeight);
        // Use the better snippet
        if (result.score > existing.scores.semantic) {
          existing.snippet = result.snippet;
          existing.highlights = result.highlights;
        }
      } else {
        resultMap.set(result.id, {
          ...result,
          scores: {
            semantic: 0,
            keyword: result.score,
            combined: result.score * this.config.keywordWeight
          }
        });
      }
    });

    return Array.from(resultMap.values())
      .map(result => ({ ...result, score: result.scores.combined }))
      .sort((a, b) => b.score - a.score);
  }

  generateSnippet(content, query, maxLength = this.config.snippetLength) {
    if (!content) return '';
    
    const queryTerms = query.toLowerCase().split(/\s+/);
    const sentences = content.split(/[.!?]+/);
    
    // Find sentences containing query terms
    const relevantSentences = sentences.filter(sentence => 
      queryTerms.some(term => sentence.toLowerCase().includes(term))
    );

    if (relevantSentences.length === 0) {
      return content.substring(0, maxLength) + '...';
    }

    let snippet = relevantSentences[0].trim();
    for (let i = 1; i < relevantSentences.length && snippet.length < maxLength; i++) {
      const nextSentence = relevantSentences[i].trim();
      if (snippet.length + nextSentence.length < maxLength) {
        snippet += '. ' + nextSentence;
      }
    }

    return snippet.length > maxLength 
      ? snippet.substring(0, maxLength) + '...'
      : snippet;
  }

  extractHighlights(content, query) {
    if (!content) return [];
    
    const queryTerms = query.toLowerCase().split(/\s+/);
    const highlights = new Set();
    
    queryTerms.forEach(term => {
      if (term.length > 2) { // Skip very short terms
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        const matches = content.match(regex);
        if (matches) {
          matches.forEach(match => highlights.add(match));
        }
      }
    });

    return Array.from(highlights).slice(0, this.config.maxHighlights);
  }

  countMatches(text, terms) {
    if (!text) return 0;
    const lowerText = text.toLowerCase();
    return terms.reduce((count, term) => {
      const matches = (lowerText.match(new RegExp(`\\b${term}\\b`, 'g')) || []).length;
      return count + matches;
    }, 0);
  }

  calculateRecencyBoost(updatedAt) {
    if (!updatedAt) return 0;
    const daysSinceUpdate = (Date.now() - new Date(updatedAt)) / (1000 * 60 * 60 * 24);
    return Math.max(0, 1 - (daysSinceUpdate / 365)); // Boost decreases over a year
  }

  calculateQualityBoost(result) {
    let boost = 0;
    
    // Word count factor (longer content often more comprehensive)
    if (result.word_count > 1000) boost += 0.2;
    else if (result.word_count > 500) boost += 0.1;
    
    // Authority score factor
    if (result.authority_score > 80) boost += 0.3;
    else if (result.authority_score > 60) boost += 0.2;
    else if (result.authority_score > 40) boost += 0.1;
    
    return Math.min(boost, 0.5); // Cap at 50% boost
  }

  calculateDifficultyAlignment(contentDifficulty, preferredDifficulty) {
    const diff = Math.abs(contentDifficulty - preferredDifficulty);
    return Math.max(0, 1 - (diff / 4)); // 4 is max difficulty difference
  }

  async logSearchAnalytics(query, response, startTime, options) {
    try {
      await this.pool.query(`
        INSERT INTO search_analytics (
          query_text, query_hash, results_count, response_time_ms, 
          success, filters, session_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        query,
        crypto.createHash('sha256').update(query).digest('hex'),
        response.results.length,
        Date.now() - startTime,
        true,
        JSON.stringify(options.filters || {}),
        options.sessionId || null
      ]);
    } catch (error) {
      this.logger.warn('Failed to log search analytics:', error);
    }
  }

  // Additional helper methods for advanced features...
  
  async enhanceQueryWithContext(query, projectContext) {
    if (!projectContext.techStack?.length) return query;
    
    const contextTerms = projectContext.techStack.join(' ');
    return `${query} ${contextTerms}`;
  }

  async enhanceResultsWithContext(results, projectContext) {
    return results.map(result => ({
      ...result,
      contextRelevance: this.calculateContextRelevance(result, projectContext),
      applicability: this.assessApplicability(result, projectContext)
    }));
  }

  calculateContextRelevance(result, projectContext) {
    let relevance = 0;
    
    if (result.metadata?.technology) {
      const techOverlap = result.metadata.technology.filter(tech => 
        projectContext.techStack?.includes(tech)
      ).length;
      relevance = techOverlap / (projectContext.techStack?.length || 1);
    }
    
    return relevance;
  }

  assessApplicability(result, projectContext) {
    const techMatch = result.metadata?.technology?.some(tech => 
      projectContext.techStack?.includes(tech)
    );
    
    if (techMatch) return 'High';
    if (result.metadata?.contentType === 'best-practices') return 'Medium';
    return 'Low';
  }
}

module.exports = EnhancedSearchEngine;