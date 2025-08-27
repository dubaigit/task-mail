/**
 * Apple MCP Knowledge Base - Tagged Search Engine Integration
 * 
 * Enhanced search engine that integrates the comprehensive tagging system
 * with existing semantic and keyword search capabilities.
 */

const EnhancedSearchEngine = require('./enhanced-search-engine');
const TagManager = require('./TagManager');

class TaggedSearchEngine extends EnhancedSearchEngine {
  constructor(options = {}) {
    super(options);
    this.tagManager = new TagManager({
      ...options,
      redisClient: this.redisClient,
      pool: this.pool
    });
    this.initialized = false;
  }

  /**
   * Initialize the tagged search engine
   */
  async initialize() {
    try {
      await super.initialize();
      await this.tagManager.initialize();
      this.initialized = true;
      console.log('✅ TaggedSearchEngine initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize TaggedSearchEngine:', error);
      throw error;
    }
  }

  /**
   * Enhanced search with tag filtering support
   * @param {string} query - Search query
   * @param {object} options - Search options
   * @param {object} options.tagFilters - Tag-based filters
   * @param {string[]} options.tagFilters['source-type'] - Source type filters
   * @param {string[]} options.tagFilters['technology'] - Technology filters
   * @param {string[]} options.tagFilters['domain'] - Domain filters
   * @param {string[]} options.tagFilters['complexity'] - Complexity filters
   * @param {string[]} options.tagFilters['use-case'] - Use case filters
   * @param {string[]} options.tagFilters['content-features'] - Content feature filters
   * @param {number} options.minQuality - Minimum quality score (0-100)
   * @param {string} options.sortBy - Sort by relevance, quality, or date
   * @returns {Promise<object>} Enhanced search results with tag information
   */
  async searchWithTags(query, options = {}) {
    const {
      tagFilters = {},
      minQuality = 0,
      sortBy = 'relevance',
      limit = 10,
      offset = 0,
      searchType = 'hybrid',
      includeTagInfo = true
    } = options;

    try {
      // Build tag filter SQL conditions
      const tagConditions = this._buildTagFilterConditions(tagFilters);
      const qualityCondition = minQuality > 0 ? 
        `AND COALESCE((quality_scores->>'overall_score')::numeric, 0) >= ${minQuality}` : '';

      // Enhanced search query with tag filtering
      const searchQuery = `
        WITH tagged_results AS (
          SELECT 
            kbc.*,
            ts_rank(to_tsvector('english', kbc.content), plainto_tsquery('english', $1)) as text_score,
            COALESCE((kbc.quality_scores->>'overall_score')::numeric, 0) as quality_score,
            CASE 
              WHEN kbc.embedding IS NOT NULL THEN 1
              ELSE 0
            END as has_embedding
          FROM knowledge_base_content kbc
          WHERE ($1 = '' OR to_tsvector('english', kbc.content) @@ plainto_tsquery('english', $1))
            ${tagConditions}
            ${qualityCondition}
            AND kbc.is_active = true
        ),
        with_relevance AS (
          SELECT 
            *,
            CASE 
              WHEN $6 = 'quality' THEN quality_score
              WHEN $6 = 'date' THEN EXTRACT(EPOCH FROM created_at)
              ELSE (text_score * 0.7 + quality_score * 0.3)
            END as relevance_score
          FROM tagged_results
        )
        SELECT *
        FROM with_relevance
        ORDER BY relevance_score DESC
        LIMIT $2 OFFSET $3
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM knowledge_base_content kbc
        WHERE ($1 = '' OR to_tsvector('english', kbc.content) @@ plainto_tsquery('english', $1))
          ${tagConditions}
          ${qualityCondition}
          AND kbc.is_active = true
      `;

      // Execute searches
      const [searchResults, countResult] = await Promise.all([
        this.pool.query(searchQuery, [query, limit, offset, ...this._getTagFilterParams(tagFilters), sortBy]),
        this.pool.query(countQuery, [query, ...this._getTagFilterParams(tagFilters)])
      ]);

      let results = searchResults.rows;
      const totalResults = parseInt(countResult.rows[0].total);

      // Enhance results with semantic search if embeddings are available
      if (searchType === 'hybrid' || searchType === 'semantic') {
        const semanticResults = await this._enhanceWithSemanticSearch(query, results, options);
        results = semanticResults;
      }

      // Add tag information if requested
      if (includeTagInfo) {
        results = await this._addTagInformation(results);
      }

      // Apply tag-based result enhancement
      results = await this._enhanceResultsWithTags(results, tagFilters);

      return {
        results,
        metadata: {
          totalResults,
          appliedFilters: tagFilters,
          searchOptions: {
            minQuality,
            sortBy,
            searchType,
            limit,
            offset
          },
          tagSummary: await this._getTagSummary(results),
          qualityDistribution: await this._getQualityDistribution(results)
        }
      };

    } catch (error) {
      console.error('Error in tagged search:', error);
      throw new Error(`Tagged search failed: ${error.message}`);
    }
  }

  /**
   * Get tag suggestions for a document
   * @param {string} content - Document content
   * @param {string} title - Document title
   * @param {object} options - Suggestion options
   * @returns {Promise<object>} Tag suggestions with confidence scores
   */
  async suggestTags(content, title = '', options = {}) {
    return await this.tagManager.suggestTags(content, title, options);
  }

  /**
   * Apply tags to a document
   * @param {number} documentId - Document ID
   * @param {object} tags - Tags to apply by category
   * @param {string} source - Tag source (manual, auto, ai-suggested)
   * @returns {Promise<object>} Application result
   */
  async applyTags(documentId, tags, source = 'manual') {
    return await this.tagManager.applyTags(documentId, tags, source);
  }

  /**
   * Get available tags for filtering
   * @returns {Promise<object>} Available tags by category
   */
  async getAvailableTags() {
    return await this.tagManager.getAvailableTags();
  }

  /**
   * Get tag analytics
   * @param {object} options - Analytics options
   * @returns {Promise<object>} Tag usage analytics
   */
  async getTagAnalytics(options = {}) {
    return await this.tagManager.getTagAnalytics(options);
  }

  /**
   * Build SQL conditions for tag filtering
   * @private
   */
  _buildTagFilterConditions(tagFilters) {
    const conditions = [];
    let paramIndex = 4; // Starting after base params

    Object.entries(tagFilters).forEach(([category, values]) => {
      if (values && values.length > 0) {
        // Check if any of the specified tag values exist in the document's tags
        conditions.push(`
          EXISTS (
            SELECT 1 FROM document_tags dt 
            WHERE dt.document_id = kbc.id 
            AND dt.category = '${category}'
            AND dt.tag_value = ANY($${paramIndex})
          )
        `);
        paramIndex++;
      }
    });

    return conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  }

  /**
   * Get tag filter parameters for SQL query
   * @private
   */
  _getTagFilterParams(tagFilters) {
    const params = [];
    Object.entries(tagFilters).forEach(([category, values]) => {
      if (values && values.length > 0) {
        params.push(values);
      }
    });
    return params;
  }

  /**
   * Enhance results with semantic search
   * @private
   */
  async _enhanceWithSemanticSearch(query, results, options) {
    if (!query || results.length === 0) return results;

    try {
      // Get semantic embeddings for query
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) return results;

      // Calculate semantic similarity for results with embeddings
      const enhancedResults = await Promise.all(results.map(async (result) => {
        if (result.embedding && result.has_embedding) {
          try {
            const similarity = await this._calculateCosineSimilarity(
              queryEmbedding, 
              result.embedding
            );
            return {
              ...result,
              semantic_score: similarity,
              combined_score: (result.relevance_score * 0.6) + (similarity * 0.4)
            };
          } catch (error) {
            console.warn('Error calculating semantic similarity:', error);
            return { ...result, semantic_score: 0, combined_score: result.relevance_score };
          }
        }
        return { ...result, semantic_score: 0, combined_score: result.relevance_score };
      }));

      // Re-sort by combined score
      return enhancedResults.sort((a, b) => b.combined_score - a.combined_score);

    } catch (error) {
      console.warn('Error enhancing with semantic search:', error);
      return results;
    }
  }

  /**
   * Add tag information to results
   * @private
   */
  async _addTagInformation(results) {
    if (results.length === 0) return results;

    const documentIds = results.map(r => r.id);
    
    const tagsQuery = `
      SELECT 
        document_id,
        category,
        tag_value,
        confidence_score,
        source
      FROM document_tags
      WHERE document_id = ANY($1)
      ORDER BY document_id, category, confidence_score DESC
    `;

    const tagsResult = await this.pool.query(tagsQuery, [documentIds]);
    const tagsByDocument = {};

    tagsResult.rows.forEach(tag => {
      if (!tagsByDocument[tag.document_id]) {
        tagsByDocument[tag.document_id] = {};
      }
      if (!tagsByDocument[tag.document_id][tag.category]) {
        tagsByDocument[tag.document_id][tag.category] = [];
      }
      tagsByDocument[tag.document_id][tag.category].push({
        value: tag.tag_value,
        confidence: tag.confidence_score,
        source: tag.source
      });
    });

    return results.map(result => ({
      ...result,
      tags: tagsByDocument[result.id] || {}
    }));
  }

  /**
   * Enhance results with tag-based scoring
   * @private
   */
  async _enhanceResultsWithTags(results, tagFilters) {
    // Boost results that match more tag filters
    return results.map(result => {
      let tagBoost = 1.0;
      let matchedFilters = 0;
      const totalFilters = Object.keys(tagFilters).length;

      if (result.tags && totalFilters > 0) {
        Object.entries(tagFilters).forEach(([category, filterValues]) => {
          if (filterValues && filterValues.length > 0 && result.tags[category]) {
            const hasMatch = result.tags[category].some(tag => 
              filterValues.includes(tag.value)
            );
            if (hasMatch) {
              matchedFilters++;
            }
          }
        });

        // Apply boost based on filter match ratio
        if (matchedFilters > 0) {
          tagBoost = 1.0 + (matchedFilters / totalFilters) * 0.3;
        }
      }

      return {
        ...result,
        tag_boost: tagBoost,
        final_score: (result.combined_score || result.relevance_score) * tagBoost,
        matched_filters: matchedFilters,
        total_filters: totalFilters
      };
    }).sort((a, b) => b.final_score - a.final_score);
  }

  /**
   * Get tag summary for search results
   * @private
   */
  async _getTagSummary(results) {
    const tagCounts = {};
    
    results.forEach(result => {
      if (result.tags) {
        Object.entries(result.tags).forEach(([category, tags]) => {
          if (!tagCounts[category]) tagCounts[category] = {};
          
          tags.forEach(tag => {
            if (!tagCounts[category][tag.value]) {
              tagCounts[category][tag.value] = 0;
            }
            tagCounts[category][tag.value]++;
          });
        });
      }
    });

    return tagCounts;
  }

  /**
   * Get quality score distribution
   * @private
   */
  async _getQualityDistribution(results) {
    const distribution = { 'High': 0, 'Medium': 0, 'Low': 0, 'Very Low': 0 };
    
    results.forEach(result => {
      const score = result.quality_score || 0;
      if (score >= 80) distribution['High']++;
      else if (score >= 60) distribution['Medium']++;
      else if (score >= 40) distribution['Low']++;
      else distribution['Very Low']++;
    });

    return distribution;
  }

  /**
   * Calculate cosine similarity between embeddings
   * @private
   */
  async _calculateCosineSimilarity(embedding1, embedding2) {
    try {
      // Convert pgvector format to arrays if needed
      const arr1 = Array.isArray(embedding1) ? embedding1 : JSON.parse(embedding1);
      const arr2 = Array.isArray(embedding2) ? embedding2 : JSON.parse(embedding2);

      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = 0; i < arr1.length; i++) {
        dotProduct += arr1[i] * arr2[i];
        norm1 += arr1[i] * arr1[i];
        norm2 += arr2[i] * arr2[i];
      }

      norm1 = Math.sqrt(norm1);
      norm2 = Math.sqrt(norm2);

      if (norm1 === 0 || norm2 === 0) return 0;
      return dotProduct / (norm1 * norm2);

    } catch (error) {
      console.warn('Error calculating cosine similarity:', error);
      return 0;
    }
  }

  /**
   * Bulk tag operation on multiple documents
   * @param {string} operation - add, remove, or replace
   * @param {number[]} documentIds - Document IDs
   * @param {object} tags - Tags to apply
   * @param {object} options - Operation options
   * @returns {Promise<object>} Bulk operation result
   */
  async bulkTagOperation(operation, documentIds, tags, options = {}) {
    return await this.tagManager.bulkTagOperation(operation, documentIds, tags, options);
  }

  /**
   * Auto-tag documents based on content analysis
   * @param {number[]} documentIds - Document IDs to auto-tag
   * @param {object} options - Auto-tagging options
   * @returns {Promise<object>} Auto-tagging results
   */
  async autoTagDocuments(documentIds, options = {}) {
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const documentId of documentIds) {
      try {
        // Get document content
        const docQuery = 'SELECT title, content FROM knowledge_base_content WHERE id = $1';
        const docResult = await this.pool.query(docQuery, [documentId]);
        
        if (docResult.rows.length === 0) {
          results.errors.push({ documentId, error: 'Document not found' });
          results.failed++;
          continue;
        }

        const { title, content } = docResult.rows[0];
        
        // Generate tag suggestions
        const suggestions = await this.suggestTags(content, title, options);
        
        // Apply suggested tags with high confidence
        const tagsToApply = {};
        Object.entries(suggestions.tags).forEach(([category, tagSuggestions]) => {
          const highConfidenceTags = tagSuggestions
            .filter(tag => tag.confidence >= (options.minConfidence || 0.7))
            .map(tag => tag.value);
          
          if (highConfidenceTags.length > 0) {
            tagsToApply[category] = highConfidenceTags;
          }
        });

        if (Object.keys(tagsToApply).length > 0) {
          await this.applyTags(documentId, tagsToApply, 'auto');
          results.successful++;
        }

        results.processed++;

      } catch (error) {
        console.error(`Error auto-tagging document ${documentId}:`, error);
        results.errors.push({ documentId, error: error.message });
        results.failed++;
      }
    }

    return results;
  }
}

module.exports = TaggedSearchEngine;