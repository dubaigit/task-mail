#!/usr/bin/env node

/**
 * Apple MCP Knowledge Base - Semantic Search Service
 * 
 * Advanced search engine with vector embeddings, hybrid search,
 * result reranking, and Archon project context integration.
 */

const express = require('express');
const { Pool } = require('pg');
const Redis = require('redis');
const OpenAI = require('openai');
const winston = require('winston');
const crypto = require('crypto');

// Initialize services
const app = express();
const port = process.env.SEARCH_PORT || 8082;

// Database connection with vector support
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Redis for caching
const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// OpenAI for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'search-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/search-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/search-combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Performance monitoring middleware
app.use((req, res, next) => {
  req.startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Search cache for performance optimization
class SearchCache {
  constructor(redis) {
    this.redis = redis;
    this.ttl = 3600; // 1 hour default TTL
  }

  generateKey(query, filters, options) {
    const searchParams = { query, filters, options };
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(searchParams))
      .digest('hex');
  }

  async get(key) {
    try {
      const cached = await this.redis.get(`search:${key}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn('Cache get error:', error);
      return null;
    }
  }

  async set(key, data, ttl = this.ttl) {
    try {
      await this.redis.setex(`search:${key}`, ttl, JSON.stringify({
        data,
        timestamp: Date.now(),
        ttl
      }));
    } catch (error) {
      logger.warn('Cache set error:', error);
    }
  }

  async invalidatePattern(pattern) {
    try {
      const keys = await this.redis.keys(`search:*${pattern}*`);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } catch (error) {
      logger.warn('Cache invalidation error:', error);
    }
  }
}

// Vector Search Engine with hybrid capabilities
class VectorSearchEngine {
  constructor(pool, openai, cache) {
    this.pool = pool;
    this.openai = openai;
    this.cache = cache;
    this.embeddingModel = 'text-embedding-3-large';
    this.embeddingDimensions = 1536;
  }

  async search(query, options = {}) {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = this.cache.generateKey(query, options.filters, options);
      const cached = await this.cache.get(cacheKey);
      
      if (cached && !options.skipCache) {
        logger.info(`Cache hit for query: ${query.substring(0, 50)}...`);
        return {
          ...cached.data,
          metadata: {
            ...cached.data.metadata,
            fromCache: true,
            searchTime: Date.now() - startTime
          }
        };
      }

      // Determine search strategy
      const searchType = options.searchType || 'hybrid';
      let results;

      switch (searchType) {
        case 'semantic':
          results = await this.semanticSearch(query, options);
          break;
        case 'keyword':
          results = await this.keywordSearch(query, options);
          break;
        case 'hybrid':
        default:
          results = await this.hybridSearch(query, options);
          break;
      }

      // Apply post-processing
      if (options.rerank !== false) {
        results = await this.rerankResults(results, query, options);
      }

      const finalResults = {
        results: results.slice(0, options.maxResults || 20),
        metadata: {
          totalResults: results.length,
          searchTime: Date.now() - startTime,
          searchType,
          query,
          appliedFilters: options.filters || {}
        }
      };

      // Cache results
      if (!options.skipCache) {
        await this.cache.set(cacheKey, finalResults);
      }

      return finalResults;

    } catch (error) {
      logger.error('Search error:', error);
      throw error;
    }
  }

  async semanticSearch(query, options) {
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);
    
    // Build SQL query with vector similarity
    const { sql, params } = this.buildVectorQuery(queryEmbedding, options);
    
    const result = await this.pool.query(sql, params);
    
    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      snippet: this.generateSnippet(row.content, query),
      url: row.url,
      source: {
        name: row.source_name,
        type: row.source_type,
        authority: row.authority_weight
      },
      score: parseFloat(row.similarity_score),
      metadata: row.metadata,
      highlights: this.extractHighlights(row.content, query)
    }));
  }

  async keywordSearch(query, options) {
    const { sql, params } = this.buildFullTextQuery(query, options);
    
    const result = await this.pool.query(sql, params);
    
    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      snippet: this.generateSnippet(row.content, query),
      url: row.url,
      source: {
        name: row.source_name,
        type: row.source_type,
        authority: row.authority_weight
      },
      score: parseFloat(row.ts_rank_score),
      metadata: row.metadata,
      highlights: this.extractHighlights(row.content, query)
    }));
  }

  async hybridSearch(query, options) {
    // Run both searches in parallel
    const [semanticResults, keywordResults] = await Promise.all([
      this.semanticSearch(query, { ...options, maxResults: 50 }),
      this.keywordSearch(query, { ...options, maxResults: 50 })
    ]);

    // Combine and deduplicate results
    const combinedResults = this.combineResults(semanticResults, keywordResults);
    
    return combinedResults;
  }

  buildVectorQuery(embedding, options) {
    let sql = `
      SELECT 
        d.id,
        d.title,
        d.content,
        d.url,
        d.metadata,
        s.name as source_name,
        s.source_type,
        s.authority_weight,
        1 - (de.embedding <=> $1) as similarity_score
      FROM document_embeddings de
      JOIN documents d ON de.document_id = d.id
      JOIN sources s ON d.source_id = s.id
      WHERE 1 - (de.embedding <=> $1) > $2
    `;
    
    const params = [
      `[${embedding.join(',')}]`,
      options.minSimilarity || 0.7
    ];
    
    let paramIndex = 3;

    // Apply filters
    if (options.filters) {
      const { filterSql, filterParams } = this.buildFilters(options.filters, paramIndex);
      sql += filterSql;
      params.push(...filterParams);
      paramIndex += filterParams.length;
    }

    sql += ` ORDER BY de.embedding <=> $1 LIMIT $${paramIndex}`;
    params.push(options.maxResults || 50);

    return { sql, params };
  }

  buildFullTextQuery(query, options) {
    let sql = `
      SELECT 
        d.id,
        d.title,
        d.content,
        d.url,
        d.metadata,
        s.name as source_name,
        s.source_type,
        s.authority_weight,
        ts_rank(
          to_tsvector('english', d.title || ' ' || d.content),
          plainto_tsquery('english', $1)
        ) as ts_rank_score
      FROM documents d
      JOIN sources s ON d.source_id = s.id
      WHERE to_tsvector('english', d.title || ' ' || d.content) @@ plainto_tsquery('english', $1)
    `;
    
    const params = [query];
    let paramIndex = 2;

    // Apply filters
    if (options.filters) {
      const { filterSql, filterParams } = this.buildFilters(options.filters, paramIndex);
      sql += filterSql;
      params.push(...filterParams);
      paramIndex += filterParams.length;
    }

    sql += ` ORDER BY ts_rank_score DESC LIMIT $${paramIndex}`;
    params.push(options.maxResults || 50);

    return { sql, params };
  }

  buildFilters(filters, startIndex) {
    const conditions = [];
    const params = [];
    let paramIndex = startIndex;

    if (filters.technologies?.length > 0) {
      conditions.push(`d.metadata->>'technology' = ANY($${paramIndex})`);
      params.push(filters.technologies);
      paramIndex++;
    }

    if (filters.difficulty?.length > 0) {
      const difficultyMap = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
      const difficultyValues = filters.difficulty.map(d => difficultyMap[d]).filter(Boolean);
      if (difficultyValues.length > 0) {
        conditions.push(`d.difficulty_level = ANY($${paramIndex})`);
        params.push(difficultyValues);
        paramIndex++;
      }
    }

    if (filters.contentTypes?.length > 0) {
      conditions.push(`d.content_type = ANY($${paramIndex})`);
      params.push(filters.contentTypes);
      paramIndex++;
    }

    if (filters.sources?.length > 0) {
      conditions.push(`s.name = ANY($${paramIndex})`);
      params.push(filters.sources);
      paramIndex++;
    }

    if (filters.dateRange) {
      if (filters.dateRange.from) {
        conditions.push(`d.updated_at >= $${paramIndex}`);
        params.push(filters.dateRange.from);
        paramIndex++;
      }
      if (filters.dateRange.to) {
        conditions.push(`d.updated_at <= $${paramIndex}`);
        params.push(filters.dateRange.to);
        paramIndex++;
      }
    }

    const filterSql = conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '';
    return { filterSql, filterParams: params };
  }

  combineResults(semanticResults, keywordResults) {
    const resultMap = new Map();
    
    // Add semantic results
    semanticResults.forEach(result => {
      resultMap.set(result.id, {
        ...result,
        scores: {
          semantic: result.score,
          keyword: 0,
          combined: result.score * 0.7 // Weight semantic higher
        }
      });
    });

    // Add or update with keyword results
    keywordResults.forEach(result => {
      if (resultMap.has(result.id)) {
        const existing = resultMap.get(result.id);
        existing.scores.keyword = result.score;
        existing.scores.combined = (existing.scores.semantic * 0.7) + (result.score * 0.3);
      } else {
        resultMap.set(result.id, {
          ...result,
          scores: {
            semantic: 0,
            keyword: result.score,
            combined: result.score * 0.3 // Weight keyword lower
          }
        });
      }
    });

    // Convert back to array and sort by combined score
    return Array.from(resultMap.values())
      .map(result => ({ ...result, score: result.scores.combined }))
      .sort((a, b) => b.score - a.score);
  }

  async rerankResults(results, query, options) {
    // Simple reranking based on multiple factors
    return results.map(result => {
      let rerankScore = result.score;
      
      // Boost based on source authority
      rerankScore *= (1 + (result.source.authority || 1) * 0.1);
      
      // Boost recent content
      if (result.metadata?.lastModified) {
        const daysSinceUpdate = (Date.now() - new Date(result.metadata.lastModified)) / (1000 * 60 * 60 * 24);
        const recencyBoost = Math.max(0, 1 - (daysSinceUpdate / 365)); // Boost decreases over a year
        rerankScore *= (1 + recencyBoost * 0.2);
      }
      
      // Boost if title matches query terms
      const queryTerms = query.toLowerCase().split(' ');
      const titleMatches = queryTerms.filter(term => 
        result.title.toLowerCase().includes(term)
      ).length;
      rerankScore *= (1 + (titleMatches / queryTerms.length) * 0.3);

      return {
        ...result,
        score: rerankScore
      };
    }).sort((a, b) => b.score - a.score);
  }

  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text.substring(0, 8000), // Limit input length
        dimensions: this.embeddingDimensions
      });
      
      return response.data[0].embedding;
    } catch (error) {
      logger.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  generateSnippet(content, query, maxLength = 300) {
    const queryTerms = query.toLowerCase().split(' ');
    const sentences = content.split(/[.!?]+/);
    
    // Find sentences containing query terms
    const relevantSentences = sentences.filter(sentence => 
      queryTerms.some(term => sentence.toLowerCase().includes(term))
    );

    if (relevantSentences.length === 0) {
      return content.substring(0, maxLength) + '...';
    }

    let snippet = relevantSentences[0];
    for (let i = 1; i < relevantSentences.length && snippet.length < maxLength; i++) {
      snippet += ' ' + relevantSentences[i];
    }

    return snippet.length > maxLength 
      ? snippet.substring(0, maxLength) + '...'
      : snippet;
  }

  extractHighlights(content, query) {
    const queryTerms = query.toLowerCase().split(' ');
    const highlights = [];
    
    queryTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        highlights.push(...matches);
      }
    });

    return [...new Set(highlights)]; // Remove duplicates
  }
}

// Archon Integration for contextual search
class ArchonSearchAdapter {
  constructor(searchEngine) {
    this.searchEngine = searchEngine;
  }

  async contextualSearch(query, projectContext, options = {}) {
    // Enhance search options with project context
    const enhancedOptions = {
      ...options,
      filters: {
        ...options.filters,
        technologies: [
          ...(options.filters?.technologies || []),
          ...(projectContext.techStack || [])
        ],
        difficulty: this.inferDifficultyFromProject(projectContext)
      }
    };

    // Perform search
    const results = await this.searchEngine.search(query, enhancedOptions);

    // Enhance results with project relevance
    const enhancedResults = results.results.map(result => ({
      ...result,
      relevanceScore: this.calculateProjectRelevance(result, projectContext),
      applicability: this.assessApplicability(result, projectContext),
      implementationNotes: this.generateImplementationNotes(result, projectContext)
    }));

    return {
      ...results,
      results: enhancedResults.sort((a, b) => b.relevanceScore - a.relevanceScore)
    };
  }

  inferDifficultyFromProject(projectContext) {
    const complexityMap = {
      simple: ['beginner', 'intermediate'],
      moderate: ['intermediate', 'advanced'],
      complex: ['advanced', 'expert']
    };

    return complexityMap[projectContext.complexity] || ['intermediate'];
  }

  calculateProjectRelevance(result, projectContext) {
    let relevance = result.score;

    // Technology stack match
    const resultTech = result.metadata?.technology || [];
    const projectTech = projectContext.techStack || [];
    const techOverlap = resultTech.filter(tech => projectTech.includes(tech)).length;
    relevance += techOverlap * 0.2;

    // Domain match
    if (result.metadata?.domain === projectContext.domain) {
      relevance += 0.3;
    }

    return Math.min(relevance, 1.0);
  }

  assessApplicability(result, projectContext) {
    const techMatch = result.metadata?.technology?.some(tech => 
      projectContext.techStack?.includes(tech)
    );

    if (techMatch) return 'High';
    if (result.metadata?.contentType === 'best-practices') return 'Medium';
    return 'Low';
  }

  generateImplementationNotes(result, projectContext) {
    const notes = [];

    if (result.metadata?.technology) {
      const matchingTech = result.metadata.technology.filter(tech => 
        projectContext.techStack?.includes(tech)
      );
      if (matchingTech.length > 0) {
        notes.push(`Directly applicable to your ${matchingTech.join(', ')} stack`);
      }
    }

    if (result.metadata?.codeBlocks?.length > 0) {
      notes.push('Contains code examples for implementation');
    }

    return notes.join('. ');
  }
}

// Initialize services
const searchCache = new SearchCache(redis);
const searchEngine = new VectorSearchEngine(pool, openai, searchCache);
const archonAdapter = new ArchonSearchAdapter(searchEngine);

// API Routes

// Main search endpoint
app.post('/search', async (req, res) => {
  try {
    const { query, filters, options } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Query is required and must be a string'
      });
    }

    const searchOptions = {
      maxResults: options?.maxResults || 20,
      searchType: options?.searchType || 'hybrid',
      rerank: options?.rerank !== false,
      minSimilarity: options?.minSimilarity || 0.7,
      filters: filters || {}
    };

    const results = await searchEngine.search(query, searchOptions);

    res.json(results);

  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({
      error: 'SEARCH_ERROR',
      message: 'Failed to perform search'
    });
  }
});

// Contextual search for Archon integration
app.post('/search/contextual', async (req, res) => {
  try {
    const { query, projectContext, options } = req.body;

    if (!query || !projectContext) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Query and projectContext are required'
      });
    }

    const results = await archonAdapter.contextualSearch(query, projectContext, options);

    res.json(results);

  } catch (error) {
    logger.error('Contextual search error:', error);
    res.status(500).json({
      error: 'SEARCH_ERROR',
      message: 'Failed to perform contextual search'
    });
  }
});

// Search suggestions
app.get('/search/suggestions', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'Query parameter q is required'
      });
    }

    // Get popular search terms that start with the query
    const query = `
      SELECT DISTINCT metadata->>'title' as suggestion
      FROM documents 
      WHERE metadata->>'title' ILIKE $1
      ORDER BY authority_score DESC
      LIMIT 10
    `;

    const result = await pool.query(query, [`${q}%`]);
    const suggestions = result.rows.map(row => row.suggestion).filter(Boolean);

    res.json({ suggestions });

  } catch (error) {
    logger.error('Suggestions error:', error);
    res.status(500).json({
      error: 'SUGGESTIONS_ERROR',
      message: 'Failed to get suggestions'
    });
  }
});

// Search analytics
app.get('/analytics/search', async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    
    // This would typically pull from an analytics database
    // For now, return mock data structure
    const analytics = {
      metrics: {
        totalSearches: 1250,
        averageLatency: 180,
        successRate: 0.94,
        topQueries: [
          { query: 'react hooks', count: 45 },
          { query: 'node.js authentication', count: 32 },
          { query: 'typescript interfaces', count: 28 }
        ]
      },
      timeSeries: [] // Would contain actual time series data
    };

    res.json(analytics);

  } catch (error) {
    logger.error('Analytics error:', error);
    res.status(500).json({
      error: 'ANALYTICS_ERROR',
      message: 'Failed to get analytics'
    });
  }
});

// Clear search cache
app.delete('/cache', async (req, res) => {
  try {
    const { pattern } = req.query;

    if (pattern) {
      await searchCache.invalidatePattern(pattern);
    } else {
      const keys = await redis.keys('search:*');
      if (keys.length > 0) {
        await redis.del(keys);
      }
    }

    res.json({ message: 'Cache cleared successfully' });

  } catch (error) {
    logger.error('Cache clear error:', error);
    res.status(500).json({
      error: 'CACHE_ERROR',
      message: 'Failed to clear cache'
    });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    // Check database
    await pool.query('SELECT 1');
    
    // Check Redis
    await redis.ping();
    
    // Check OpenAI (optional, as it might affect response time)
    // await openai.models.list();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
        openai: 'available'
      }
    });

  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred'
  });
});

// Start server
app.listen(port, () => {
  logger.info(`Search service listening on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  
  await redis.quit();
  await pool.end();
  
  process.exit(0);
});

module.exports = app;