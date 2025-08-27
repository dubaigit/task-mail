/**
 * AI-related API routes
 */

const express = require('express');
const router = express.Router();
const { 
  authenticateToken, 
  aiLimiter,
  aiCommandValidation,
  emailClassificationValidation,
  handleValidationErrors
} = require('../../middleware/auth');
const { createDeduplicationMiddleware } = require('../../middleware/RequestDeduplication');

// Import the AI service (to be extracted later)
const ai_service = require('../../../ai_service');

/**
 * Get AI usage statistics
 * GET /api/ai/usage-stats
 */
router.get('/usage-stats', 
  authenticateToken,
  async (req, res) => {
    try {
      console.log('📊 GET /api/ai/usage-stats - Request received');
      
      const stats = {
        total_requests: ai_service.getRequestCount(),
        successful_requests: ai_service.getSuccessCount(),
        failed_requests: ai_service.getErrorCount(),
        average_response_time: ai_service.getAverageResponseTime(),
        last_request: ai_service.getLastRequestTime(),
        cache_hits: ai_service.getCacheHits(),
        cache_misses: ai_service.getCacheMisses(),
        models_used: ai_service.getModelsUsed()
      };
      
      console.log('📊 AI Usage Stats retrieved:', stats);
      res.json(stats);
    } catch (error) {
      console.error('❌ Error fetching AI usage stats:', error);
      res.status(500).json({ 
        error: 'Failed to fetch usage statistics',
        message: error.message
      });
    }
  }
);

/**
 * Process AI command
 * POST /api/ai/process-command
 */
router.post('/process-command', 
  authenticateToken,
  aiLimiter,
  aiCommandValidation,
  handleValidationErrors,
  createDeduplicationMiddleware('ai-command', 5000),
  async (req, res) => {
    try {
      const { command, context } = req.body;
      console.log('🤖 POST /api/ai/process-command - Processing command');
      
      const result = await ai_service.processCommand(command, context);
      
      res.json({
        success: true,
        result: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error processing AI command:', error);
      res.status(500).json({ 
        error: 'Failed to process command',
        message: error.message
      });
    }
  }
);

/**
 * Classify email using AI
 * POST /api/ai/classify-email
 */
router.post('/classify-email', 
  authenticateToken,
  aiLimiter,
  emailClassificationValidation,
  handleValidationErrors,
  createDeduplicationMiddleware('email-classification', 3000),
  async (req, res) => {
    try {
      const { content, subject, sender } = req.body;
      console.log('🔍 POST /api/ai/classify-email - Classifying email');
      
      const classification = await ai_service.classifyEmail({ content, subject, sender });
      
      res.json({
        success: true,
        classification: classification,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error classifying email:', error);
      res.status(500).json({ 
        error: 'Failed to classify email',
        message: error.message
      });
    }
  }
);

module.exports = router;