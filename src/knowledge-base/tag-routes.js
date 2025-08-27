/**
 * Apple MCP Knowledge Base - Tag Management API Routes
 * 
 * Express routes for comprehensive tagging system operations
 * including tag suggestions, filtering, analytics, and management.
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const TaggedSearchEngine = require('./TaggedSearchEngine');
const TagManager = require('./TagManager');

const router = express.Router();

// Initialize tagged search engine
let taggedSearchEngine = null;
let tagManager = null;

// Initialize services
const initializeServices = async () => {
  if (!taggedSearchEngine || !tagManager) {
    const config = {
      redisUrl: process.env.REDIS_URL,
      openaiApiKey: process.env.OPENAI_API_KEY
    };

    taggedSearchEngine = new TaggedSearchEngine(config);
    tagManager = new TagManager(config);

    await Promise.all([
      taggedSearchEngine.initialize(),
      tagManager.initialize()
    ]);
  }
};

// Middleware to ensure services are initialized
const ensureInitialized = async (req, res, next) => {
  try {
    await initializeServices();
    next();
  } catch (error) {
    console.error('Failed to initialize tag services:', error);
    res.status(500).json({
      success: false,
      error: 'Tag services unavailable',
      message: error.message
    });
  }
};

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

/**
 * Enhanced search with tag filtering
 * GET /api/knowledge-base/search
 */
router.get('/search',
  ensureInitialized,
  [
    query('query').optional().isString().trim(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
    query('minQuality').optional().isFloat({ min: 0, max: 100 }).toFloat(),
    query('sortBy').optional().isIn(['relevance', 'quality', 'date']),
    query('searchType').optional().isIn(['semantic', 'keyword', 'hybrid']),
    query('includeTagInfo').optional().isBoolean().toBoolean()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const {
        query = '',
        limit = 10,
        offset = 0,
        minQuality = 0,
        sortBy = 'relevance',
        searchType = 'hybrid',
        includeTagInfo = true,
        ...tagFilters
      } = req.query;

      // Parse tag filters from query parameters
      const parsedTagFilters = {};
      const tagCategories = ['source-type', 'technology', 'domain', 'complexity', 'use-case', 'content-features'];
      
      tagCategories.forEach(category => {
        if (tagFilters[category]) {
          parsedTagFilters[category] = Array.isArray(tagFilters[category]) 
            ? tagFilters[category] 
            : [tagFilters[category]];
        }
      });

      const results = await taggedSearchEngine.searchWithTags(query, {
        tagFilters: parsedTagFilters,
        minQuality,
        sortBy,
        limit,
        offset,
        searchType,
        includeTagInfo
      });

      res.json({
        success: true,
        data: results,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({
        success: false,
        error: 'Search failed',
        message: error.message
      });
    }
  }
);

/**
 * Get tag suggestions for content
 * POST /api/knowledge-base/tags/suggest
 */
router.post('/tags/suggest',
  ensureInitialized,
  [
    body('content').isString().isLength({ min: 10 }),
    body('title').optional().isString(),
    body('options').optional().isObject()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { content, title = '', options = {} } = req.body;

      const suggestions = await taggedSearchEngine.suggestTags(content, title, options);

      res.json({
        success: true,
        data: suggestions,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Tag suggestion error:', error);
      res.status(500).json({
        success: false,
        error: 'Tag suggestion failed',
        message: error.message
      });
    }
  }
);

/**
 * Apply tags to a document
 * POST /api/knowledge-base/documents/:id/tags
 */
router.post('/documents/:id/tags',
  ensureInitialized,
  [
    param('id').isInt().toInt(),
    body('tags').isObject(),
    body('source').optional().isIn(['manual', 'auto', 'ai-suggested', 'validated'])
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const documentId = req.params.id;
      const { tags, source = 'manual' } = req.body;

      const result = await taggedSearchEngine.applyTags(documentId, tags, source);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Tag application error:', error);
      res.status(500).json({
        success: false,
        error: 'Tag application failed',
        message: error.message
      });
    }
  }
);

/**
 * Get document tags
 * GET /api/knowledge-base/documents/:id/tags
 */
router.get('/documents/:id/tags',
  ensureInitialized,
  [param('id').isInt().toInt()],
  handleValidationErrors,
  async (req, res) => {
    try {
      const documentId = req.params.id;

      const tags = await tagManager.getDocumentTags(documentId);

      res.json({
        success: true,
        data: { documentId, tags },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Get document tags error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get document tags',
        message: error.message
      });
    }
  }
);

/**
 * Remove tags from a document
 * DELETE /api/knowledge-base/documents/:id/tags
 */
router.delete('/documents/:id/tags',
  ensureInitialized,
  [
    param('id').isInt().toInt(),
    body('categories').optional().isArray(),
    body('specificTags').optional().isObject()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const documentId = req.params.id;
      const { categories, specificTags } = req.body;

      const result = await tagManager.removeTags(documentId, { categories, specificTags });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Tag removal error:', error);
      res.status(500).json({
        success: false,
        error: 'Tag removal failed',
        message: error.message
      });
    }
  }
);

/**
 * Get available tags for filtering
 * GET /api/knowledge-base/tags/available
 */
router.get('/tags/available',
  ensureInitialized,
  async (req, res) => {
    try {
      const availableTags = await taggedSearchEngine.getAvailableTags();

      res.json({
        success: true,
        data: availableTags,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Get available tags error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get available tags',
        message: error.message
      });
    }
  }
);

/**
 * Get tag taxonomy
 * GET /api/knowledge-base/tags/taxonomy
 */
router.get('/tags/taxonomy',
  ensureInitialized,
  async (req, res) => {
    try {
      const taxonomy = await tagManager.getTagTaxonomy();

      res.json({
        success: true,
        data: taxonomy,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Get taxonomy error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get tag taxonomy',
        message: error.message
      });
    }
  }
);

/**
 * Get tag analytics
 * GET /api/knowledge-base/tags/analytics
 */
router.get('/tags/analytics',
  ensureInitialized,
  [
    query('timeRange').optional().isString(),
    query('categories').optional().isArray(),
    query('includeCoOccurrence').optional().isBoolean().toBoolean()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { timeRange, categories, includeCoOccurrence = true } = req.query;

      const analytics = await taggedSearchEngine.getTagAnalytics({
        timeRange,
        categories,
        includeCoOccurrence
      });

      res.json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Tag analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get tag analytics',
        message: error.message
      });
    }
  }
);

/**
 * Bulk tag operations
 * POST /api/knowledge-base/tags/bulk
 */
router.post('/tags/bulk',
  ensureInitialized,
  [
    body('operation').isIn(['add', 'remove', 'replace']),
    body('documentIds').isArray().notEmpty(),
    body('tags').isObject(),
    body('options').optional().isObject()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { operation, documentIds, tags, options = {} } = req.body;

      const result = await taggedSearchEngine.bulkTagOperation(operation, documentIds, tags, options);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Bulk tag operation error:', error);
      res.status(500).json({
        success: false,
        error: 'Bulk tag operation failed',
        message: error.message
      });
    }
  }
);

/**
 * Auto-tag documents
 * POST /api/knowledge-base/tags/auto-tag
 */
router.post('/tags/auto-tag',
  ensureInitialized,
  [
    body('documentIds').isArray().notEmpty(),
    body('options').optional().isObject()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { documentIds, options = {} } = req.body;

      const result = await taggedSearchEngine.autoTagDocuments(documentIds, options);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Auto-tagging error:', error);
      res.status(500).json({
        success: false,
        error: 'Auto-tagging failed',
        message: error.message
      });
    }
  }
);

/**
 * Validate tag suggestions
 * POST /api/knowledge-base/tags/validate
 */
router.post('/tags/validate',
  ensureInitialized,
  [
    body('documentId').isInt().toInt(),
    body('suggestions').isObject(),
    body('action').isIn(['accept', 'reject', 'modify']),
    body('modifications').optional().isObject()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { documentId, suggestions, action, modifications } = req.body;

      const result = await tagManager.validateSuggestions(documentId, suggestions, action, modifications);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Tag validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Tag validation failed',
        message: error.message
      });
    }
  }
);

/**
 * Get quality scores for documents
 * GET /api/knowledge-base/documents/:id/quality
 */
router.get('/documents/:id/quality',
  ensureInitialized,
  [param('id').isInt().toInt()],
  handleValidationErrors,
  async (req, res) => {
    try {
      const documentId = req.params.id;

      const quality = await tagManager.getQualityScore(documentId);

      res.json({
        success: true,
        data: { documentId, quality },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Get quality score error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get quality score',
        message: error.message
      });
    }
  }
);

/**
 * Update quality score for a document
 * PUT /api/knowledge-base/documents/:id/quality
 */
router.put('/documents/:id/quality',
  ensureInitialized,
  [
    param('id').isInt().toInt(),
    body('scores').isObject(),
    body('evaluator').optional().isString(),
    body('notes').optional().isString()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const documentId = req.params.id;
      const { scores, evaluator = 'system', notes } = req.body;

      const result = await tagManager.updateQualityScore(documentId, scores, evaluator, notes);

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Update quality score error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update quality score',
        message: error.message
      });
    }
  }
);

/**
 * Health check endpoint
 * GET /api/knowledge-base/tags/health
 */
router.get('/tags/health',
  async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        services: {
          taggedSearchEngine: taggedSearchEngine ? 'initialized' : 'not_initialized',
          tagManager: tagManager ? 'initialized' : 'not_initialized'
        },
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: health
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        message: error.message
      });
    }
  }
);

module.exports = router;