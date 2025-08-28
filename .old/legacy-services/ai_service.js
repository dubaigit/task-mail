require('dotenv').config();

const OpenAI = require('openai');
const Redis = require('redis');
const logger = require('./src/utils/logger');
const { createHash } = require('crypto');

/**
 * AI Service for Apple Mail Task Manager
 * Handles email classification, chat responses, and draft generation
 * with caching, budget tracking, and error resilience
 */
class AIService {
  constructor() {
    this.openai = null;
    this.redis = null;
    this.isRedisConnected = false;
    this.localCache = new Map();
    
    // Budget tracking
    this.usageStats = {
      gpt5_nano: { requests: 0, tokens: 0, cost: 0 },
      gpt5_mini: { requests: 0, tokens: 0, cost: 0 },
      total_requests: 0,
      cache_hits: 0,
      daily_budget: parseFloat(process.env.OPENAI_DAILY_BUDGET || '10.0'),
      monthly_budget: parseFloat(process.env.OPENAI_MONTHLY_BUDGET || '100.0'),
      current_daily_spending: 0,
      current_monthly_spending: 0
    };
    
    // Cache statistics
    this.cacheStats = {
      localCacheSize: 0,
      cache_hit_rate: 0,
      total_requests: 0,
      redisConnected: false
    };

    // Model pricing (per 1K tokens)
    this.modelPricing = {
      'gpt-5-nano': { input: 0.0001, output: 0.0002 },
      'gpt-5-mini': { input: 0.0005, output: 0.001 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 }
    };

    // Initialize services
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize OpenAI
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          timeout: 30000,
          maxRetries: 3
        });
        logger.info('OpenAI client initialized successfully');
      } else {
        logger.warn('OPENAI_API_KEY not found, AI services will use fallback responses');
      }

      // Initialize Redis
      if (process.env.REDIS_URL || process.env.REDIS_HOST) {
        try {
          const redisConfig = process.env.REDIS_URL 
            ? { url: process.env.REDIS_URL }
            : {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD || undefined
              };

          this.redis = Redis.createClient(redisConfig);
          
          this.redis.on('error', (err) => {
            logger.error('Redis connection error:', err);
            this.isRedisConnected = false;
          });

          this.redis.on('connect', () => {
            logger.info('Redis connected successfully');
            this.isRedisConnected = true;
          });

          await this.redis.connect();
        } catch (redisError) {
          logger.warn('Redis initialization failed:', redisError.message);
          this.redis = null;
        }
      } else {
        logger.info('Redis configuration not found, using local cache only');
      }

      // Update cache stats
      this.updateCacheStats();
      
    } catch (error) {
      logger.error('AI Service initialization error:', error);
      throw error;
    }
  }

  /**
   * Generate cache key for content
   */
  generateCacheKey(content, type = 'classify') {
    const hash = createHash('md5').update(content + type).digest('hex');
    return `ai_service:${type}:${hash}`;
  }

  /**
   * Get cached result
   */
  async getCachedResult(key) {
    // Check local cache first
    if (this.localCache.has(key)) {
      this.usageStats.cache_hits++;
      this.cacheStats.total_requests++;
      return this.localCache.get(key);
    }

    // Check Redis cache
    if (this.redis && this.isRedisConnected) {
      try {
        const cached = await this.redis.get(key);
        if (cached) {
          const result = JSON.parse(cached);
          // Update local cache
          this.localCache.set(key, result);
          this.usageStats.cache_hits++;
          this.cacheStats.total_requests++;
          return result;
        }
      } catch (error) {
        logger.error('Redis cache read error:', error);
      }
    }

    return null;
  }

  /**
   * Set cached result
   */
  async setCachedResult(key, result, ttl = 3600) {
    // Set local cache (limit size to 1000 entries)
    if (this.localCache.size >= 1000) {
      const firstKey = this.localCache.keys().next().value;
      this.localCache.delete(firstKey);
    }
    this.localCache.set(key, result);

    // Set Redis cache
    if (this.redis && this.isRedisConnected) {
      try {
        await this.redis.setEx(key, ttl, JSON.stringify(result));
      } catch (error) {
        logger.error('Redis cache write error:', error);
      }
    }
  }

  /**
   * Select appropriate model based on task complexity
   */
  selectModel(taskType, urgency = 'NORMAL') {
    switch (taskType) {
      case 'classification':
        return urgency === 'CRITICAL' ? 'gpt-5-mini' : 'gpt-5-nano';
      case 'chat':
        return 'gpt-5-mini';
      case 'draft_generation':
        return 'gpt-5-mini';
      default:
        return 'gpt-5-nano';
    }
  }

  /**
   * Calculate cost for OpenAI usage
   */
  calculateCost(model, inputTokens, outputTokens) {
    const pricing = this.modelPricing[model];
    if (!pricing) return 0;
    
    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;
    return inputCost + outputCost;
  }

  /**
   * Update usage statistics
   */
  updateUsageStats(model, tokens, cost) {
    const modelKey = model.replace('-', '_');
    if (this.usageStats[modelKey]) {
      this.usageStats[modelKey].requests++;
      this.usageStats[modelKey].tokens += tokens;
      this.usageStats[modelKey].cost += cost;
    }
    
    this.usageStats.total_requests++;
    this.usageStats.current_daily_spending += cost;
    this.usageStats.current_monthly_spending += cost;
  }

  /**
   * Update cache statistics
   */
  updateCacheStats() {
    this.cacheStats = {
      localCacheSize: this.localCache.size,
      cache_hit_rate: this.usageStats.cache_hits / Math.max(this.cacheStats.total_requests, 1),
      total_requests: this.cacheStats.total_requests,
      redisConnected: this.isRedisConnected
    };
  }

  /**
   * Validate AI response format
   */
  validateClassificationResponse(response) {
    const validTypes = ['CREATE_TASK', 'FYI_ONLY', 'URGENT_RESPONSE', 'NEEDS_REPLY'];
    
    if (!response.classification || !validTypes.includes(response.classification)) {
      throw new Error('Invalid classification type');
    }
    
    if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 100) {
      throw new Error('Invalid confidence value');
    }

    return true;
  }

  /**
   * Classify email content using AI
   */
  async classifyEmail(content, subject = '', sender = '') {
    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(`${content}|${subject}|${sender}`, 'classify');
      
      // Check cache first
      const cached = await this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      // Fallback response for when OpenAI is not available
      if (!this.openai) {
        const fallback = {
          classification: 'NEEDS_REPLY',
          urgency: 'NORMAL',
          confidence: 50,
          suggested_action: 'Manual review recommended',
          task_title: subject || 'Email Review Required',
          task_description: 'AI service unavailable - manual classification needed'
        };
        
        await this.setCachedResult(cacheKey, fallback, 300); // Short cache for fallbacks
        return fallback;
      }

      const model = this.selectModel('classification');
      
      const systemPrompt = `You are an email classification assistant for a task management system. 
      Classify emails into these categories:
      - CREATE_TASK: Requires action or follow-up
      - FYI_ONLY: Informational, no action needed
      - URGENT_RESPONSE: Needs immediate response
      - NEEDS_REPLY: Requires a response but not urgent

      Respond with valid JSON containing:
      - classification: one of the above categories
      - urgency: LOW, NORMAL, HIGH, or CRITICAL
      - confidence: number between 0-100
      - suggested_action: brief action description
      - task_title: short descriptive title
      - task_description: detailed description`;

      const userPrompt = `Email Content: ${content}
      Subject: ${subject}
      Sender: ${sender}
      
      Please classify this email.`;

      const response = await this.openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 1000
      });

      const aiResponse = JSON.parse(response.choices[0].message.content);
      
      // Normalize confidence to integer 0-100
      if (typeof aiResponse.confidence === 'number' && aiResponse.confidence <= 1) {
        aiResponse.confidence = Math.round(aiResponse.confidence * 100);
      }
      
      // Validate response
      this.validateClassificationResponse(aiResponse);

      // Calculate cost and update stats
      const totalTokens = response.usage?.total_tokens || 0;
      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;
      const cost = this.calculateCost(model, inputTokens, outputTokens);
      
      this.updateUsageStats(model, totalTokens, cost);

      // Cache the result
      await this.setCachedResult(cacheKey, aiResponse);

      return aiResponse;

    } catch (error) {
      logger.error('Email classification error:', error);
      
      // Return fallback classification
      return {
        classification: 'NEEDS_REPLY',
        urgency: 'NORMAL',
        confidence: 50,
        suggested_action: 'Manual review recommended',
        task_title: subject || 'Email Classification Failed',
        task_description: 'AI classification failed - manual review required'
      };
    }
  }

  /**
   * Generate chat response
   */
  async generateChatResponse(message, context = {}) {
    try {
      const cacheKey = this.generateCacheKey(`${message}|${JSON.stringify(context)}`, 'chat');
      
      // Check cache
      const cached = await this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      // Fallback response
      if (!this.openai) {
        const fallback = 'I apologize, but the AI service is currently unavailable. Please try again later.';
        await this.setCachedResult(cacheKey, fallback, 300);
        return fallback;
      }

      const model = this.selectModel('chat');
      
      const systemPrompt = `You are a helpful AI assistant for an email task management system.
      Help users manage their emails and tasks efficiently. Be concise and actionable.
      
      Current context: ${JSON.stringify(context)}`;

      const response = await this.openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_completion_tokens: 1000
      });

      const chatResponse = response.choices[0].message.content;

      // Update stats
      const totalTokens = response.usage?.total_tokens || 0;
      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;
      const cost = this.calculateCost(model, inputTokens, outputTokens);
      
      this.updateUsageStats(model, totalTokens, cost);

      // Cache the result
      await this.setCachedResult(cacheKey, chatResponse);

      return chatResponse;

    } catch (error) {
      logger.error('Chat response generation error:', error);
      return 'I encountered an error while processing your request. Please try again.';
    }
  }

  /**
   * Generate draft reply
   */
  async generateDraftReply(originalContent, subject, sender, context = {}) {
    try {
      const cacheKey = this.generateCacheKey(
        `${originalContent}|${subject}|${sender}|${JSON.stringify(context)}`, 
        'draft'
      );
      
      // Check cache
      const cached = await this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      // Fallback response
      if (!this.openai) {
        const fallback = {
          draft: 'Thank you for your email. I will review and respond shortly.',
          model_used: 'fallback',
          tokens_used: 0,
          confidence: 30
        };
        await this.setCachedResult(cacheKey, fallback, 300);
        return fallback;
      }

      const model = this.selectModel('draft_generation');
      
      const systemPrompt = `You are an email draft assistant. Generate professional, contextually appropriate email responses.
      Keep responses concise, polite, and actionable. Match the tone of the original email.`;

      const userPrompt = `Original Email:
      From: ${sender}
      Subject: ${subject}
      Content: ${originalContent}
      
      Context: ${JSON.stringify(context)}
      
      Please generate a professional reply draft.`;

      const response = await this.openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 1000
      });

      const draftContent = response.choices[0].message.content;
      const totalTokens = response.usage?.total_tokens || 0;
      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;
      const cost = this.calculateCost(model, inputTokens, outputTokens);

      const result = {
        draft: draftContent,
        model_used: model,
        tokens_used: totalTokens,
        confidence: 85
      };

      // Update stats
      this.updateUsageStats(model, totalTokens, cost);

      // Cache the result
      await this.setCachedResult(cacheKey, result);

      return result;

    } catch (error) {
      logger.error('Draft reply generation error:', error);
      return {
        draft: 'Thank you for your email. I will review your message and respond accordingly.',
        model_used: 'fallback',
        tokens_used: 0,
        confidence: 30
      };
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    this.updateCacheStats();
    return { ...this.usageStats };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    this.updateCacheStats();
    return { ...this.cacheStats };
  }

  /**
   * Reset daily usage stats (should be called daily)
   */
  resetDailyStats() {
    this.usageStats.current_daily_spending = 0;
    logger.info('Daily AI usage stats reset');
  }

  /**
   * Reset monthly usage stats (should be called monthly)
   */
  resetMonthlyStats() {
    this.usageStats.current_monthly_spending = 0;
    Object.keys(this.usageStats).forEach(key => {
      if (typeof this.usageStats[key] === 'object' && this.usageStats[key].requests !== undefined) {
        this.usageStats[key].requests = 0;
        this.usageStats[key].tokens = 0;
        this.usageStats[key].cost = 0;
      }
    });
    this.usageStats.total_requests = 0;
    this.usageStats.cache_hits = 0;
    logger.info('Monthly AI usage stats reset');
  }

  /**
   * Check if within budget limits
   */
  isWithinBudget() {
    return {
      dailyOk: this.usageStats.current_daily_spending < this.usageStats.daily_budget,
      monthlyOk: this.usageStats.current_monthly_spending < this.usageStats.monthly_budget,
      dailyRemaining: Math.max(0, this.usageStats.daily_budget - this.usageStats.current_daily_spending),
      monthlyRemaining: Math.max(0, this.usageStats.monthly_budget - this.usageStats.current_monthly_spending)
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      if (this.redis && this.isRedisConnected) {
        await this.redis.disconnect();
        logger.info('Redis connection closed');
      }
      this.localCache.clear();
      logger.info('AI Service cleanup completed');
    } catch (error) {
      logger.error('AI Service cleanup error:', error);
    }
  }
}

// Create and export singleton instance
const aiService = new AIService();

module.exports = aiService;