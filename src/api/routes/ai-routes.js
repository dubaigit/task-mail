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
// Deduplication middleware temporarily disabled

// Import the enhanced GPT Service
const GPTService = require('../../services/GPTService');

// Initialize GPT service
let gptService = null;

async function initializeGPTService() {
  try {
    gptService = new GPTService();
    await gptService.initialize();
    console.log('✅ GPT Service initialized in AI routes');
  } catch (error) {
    console.error('❌ Failed to initialize GPT service:', error);
  }
}

// Initialize on module load
initializeGPTService();

/**
 * Get AI usage statistics
 * GET /api/ai/usage-stats
 */
router.get('/usage-stats', 
  authenticateToken,
  async (req, res) => {
    try {
      console.log('📊 GET /api/ai/usage-stats - Request received');
      
      const stats = gptService ? {
        budget: gptService.budget,
        models: gptService.models,
        is_initialized: gptService.isInitialized
      } : {
        error: 'GPT Service not initialized'
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
  async (req, res) => {
    try {
      const { command, context } = req.body;
      console.log('🤖 POST /api/ai/process-command - Processing command');
      
      const result = await gptService.processCommand(command, context);
      
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
  async (req, res) => {
    try {
      const { content, subject, sender, to_recipients, id } = req.body;
      console.log('🔍 POST /api/ai/classify-email - Classifying email');
      
      if (!gptService) {
        return res.status(503).json({ error: 'GPT Service not available' });
      }
      
      const classification = await gptService.classifyEmail({ 
        id,
        message_content: content, 
        subject, 
        sender,
        to_recipients 
      });
      
      res.json({
        success: true,
        classification,
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

/**
 * Generate draft reply
 * POST /api/ai/generate-draft
 */
router.post('/generate-draft',
  authenticateToken,
  aiLimiter,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, context } = req.body;
      console.log('✍️ POST /api/ai/generate-draft - Generating draft');
      
      if (!gptService) {
        return res.status(503).json({ error: 'GPT Service not available' });
      }
      
      const draft = await gptService.generateDraft(email, context);
      
      res.json({
        success: true,
        draft,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error generating draft:', error);
      res.status(500).json({ 
        error: 'Failed to generate draft',
        message: error.message
      });
    }
  }
);

/**
 * Search emails using RAG
 * POST /api/ai/search-emails
 */
router.post('/search-emails',
  authenticateToken,
  aiLimiter,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { query, filters } = req.body;
      console.log('🔎 POST /api/ai/search-emails - Searching with query:', query);
      
      if (!gptService) {
        return res.status(503).json({ error: 'GPT Service not available' });
      }
      
      const results = await gptService.searchEmails(query, filters);
      
      res.json({
        success: true,
        results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error searching emails:', error);
      res.status(500).json({ 
        error: 'Failed to search emails',
        message: error.message
      });
    }
  }
);

/**
 * Generate tasks from email
 * POST /api/ai/generate-tasks
 */
router.post('/generate-tasks',
  authenticateToken,
  aiLimiter,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email } = req.body;
      console.log('📋 POST /api/ai/generate-tasks - Generating tasks from email');
      
      if (!gptService) {
        return res.status(503).json({ error: 'GPT Service not available' });
      }
      
      const tasks = await gptService.generateTasks(email);
      
      res.json({
        success: true,
        tasks,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error generating tasks:', error);
      res.status(500).json({ 
        error: 'Failed to generate tasks',
        message: error.message
      });
    }
  }
);

/**
 * Process automation rule
 * POST /api/ai/process-automation
 */
router.post('/process-automation',
  authenticateToken,
  aiLimiter,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { rule, email } = req.body;
      console.log('⚙️ POST /api/ai/process-automation - Processing automation rule');
      
      if (!gptService) {
        return res.status(503).json({ error: 'GPT Service not available' });
      }
      
      const results = await gptService.processAutomationRule(rule, email);
      
      res.json({
        success: true,
        results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Error processing automation:', error);
      res.status(500).json({ 
        error: 'Failed to process automation',
        message: error.message
      });
    }
  }
);

module.exports = router;