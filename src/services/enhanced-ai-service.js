/**
 * Enhanced AI Service with Improved Error Handling and Performance
 * Features: Circuit breaker, retry logic, better caching, budget management
 */

const OpenAI = require('openai');
const Redis = require('redis');
const logger = require('../utils/logger');
const { createHash } = require('crypto');
const { EventEmitter } = require('events');

class CircuitBreaker {
  constructor(options = {}) {
    this.threshold = options.threshold || 5;
    this.timeout = options.timeout || 60000;
    this.resetTimeout = options.resetTimeout || 30000;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.threshold) {
        this.state = 'OPEN';
        logger.error(`Circuit breaker opened after ${this.failureCount} failures`);
      }
      
      throw error;
    }
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
  }
}

class EnhancedAIService extends EventEmitter {
  constructor() {
    super();
    
    // Core services
    this.openai = null;
    this.redis = null;
    this.isRedisConnected = false;
    this.localCache = new Map();
    this.circuitBreaker = new CircuitBreaker();
    
    // Configuration
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      cacheMaxSize: 1000,
      cacheTTL: 3600000, // 1 hour
      requestTimeout: 30000,
      maxConcurrentRequests: 10,
      fallbackEnabled: true
    };
    
    // Request queue for rate limiting
    this.requestQueue = [];
    this.activeRequests = 0;
    
    // Budget and usage tracking
    this.budgetManager = {
      daily: {
        limit: parseFloat(process.env.OPENAI_DAILY_BUDGET || '10.0'),
        spent: 0,
        resetTime: this.getNextResetTime('daily')
      },
      monthly: {
        limit: parseFloat(process.env.OPENAI_MONTHLY_BUDGET || '100.0'),
        spent: 0,
        resetTime: this.getNextResetTime('monthly')
      },
      warnings: {
        daily80: false,
        daily100: false,
        monthly80: false,
        monthly100: false
      }
    };
    
    // Model configuration with fallback strategies
    this.modelConfig = {
      primary: {
        name: 'gpt-5-nano',
        pricing: { input: 0.0001, output: 0.0002 },
        maxTokens: 2048,
        temperature: 0.7
      },
      fallback: {
        name: 'gpt-4o-mini',
        pricing: { input: 0.00015, output: 0.0006 },
        maxTokens: 1024,
        temperature: 0.6
      },
      emergency: {
        name: 'gpt-3.5-turbo',
        pricing: { input: 0.00005, output: 0.00015 },
        maxTokens: 512,
        temperature: 0.5
      }
    };
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      averageResponseTime: 0,
      modelUsage: {}
    };
    
    this.initialize();
  }
  
  async initialize() {
    try {
      // Initialize OpenAI with enhanced config
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          timeout: this.config.requestTimeout,
          maxRetries: this.config.maxRetries
        });
        logger.info('✅ Enhanced OpenAI client initialized');
      } else {
        logger.warn('⚠️ OPENAI_API_KEY not found, using fallback mode');
      }
      
      // Initialize Redis with reconnection logic
      await this.initializeRedis();
      
      // Start background tasks
      this.startBackgroundTasks();
      
      // Load cached budget data
      await this.loadBudgetData();
      
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize Enhanced AI Service:', error);
      this.emit('error', error);
    }
  }
  
  async initializeRedis() {
    if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
      logger.info('Redis not configured, using local cache only');
      return;
    }
    
    try {
      const redisConfig = process.env.REDIS_URL 
        ? { url: process.env.REDIS_URL }
        : {
            socket: {
              host: process.env.REDIS_HOST || 'localhost',
              port: parseInt(process.env.REDIS_PORT || '6379'),
              reconnectStrategy: (retries) => Math.min(retries * 50, 500)
            },
            password: process.env.REDIS_PASSWORD || undefined
          };
      
      this.redis = Redis.createClient(redisConfig);
      
      this.redis.on('error', (err) => {
        logger.error('Redis error:', err);
        this.isRedisConnected = false;
      });
      
      this.redis.on('ready', () => {
        logger.info('✅ Redis connected and ready');
        this.isRedisConnected = true;
      });
      
      this.redis.on('reconnecting', () => {
        logger.info('Redis reconnecting...');
      });
      
      await this.redis.connect();
    } catch (error) {
      logger.warn('Redis initialization failed, falling back to local cache:', error.message);
      this.redis = null;
      this.isRedisConnected = false;
    }
  }
  
  startBackgroundTasks() {
    // Clean up old cache entries every 5 minutes
    setInterval(() => this.cleanupCache(), 300000);
    
    // Reset daily budget at midnight
    setInterval(() => this.checkBudgetReset(), 60000);
    
    // Save metrics every minute
    setInterval(() => this.saveMetrics(), 60000);
    
    // Health check every 30 seconds
    setInterval(() => this.healthCheck(), 30000);
  }
  
  async processRequest(type, data, options = {}) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      // Check budget limits
      this.checkBudgetLimits();
      
      // Check cache first
      const cacheKey = this.generateCacheKey(type, data);
      const cachedResponse = await this.getCachedResponse(cacheKey);
      
      if (cachedResponse) {
        this.metrics.cacheHits++;
        this.emit('cache-hit', { requestId, type });
        return cachedResponse;
      }
      
      // Queue request if at capacity
      if (this.activeRequests >= this.config.maxConcurrentRequests) {
        await this.queueRequest(requestId);
      }
      
      this.activeRequests++;
      
      // Execute request with circuit breaker
      const response = await this.circuitBreaker.execute(
        () => this.executeAIRequest(type, data, options)
      );
      
      // Cache successful response
      await this.cacheResponse(cacheKey, response);
      
      // Update metrics
      this.updateMetrics(startTime, true, options.model);
      
      // Update budget
      this.updateBudget(response.usage);
      
      this.emit('request-complete', { requestId, type, duration: Date.now() - startTime });
      
      return response;
      
    } catch (error) {
      this.updateMetrics(startTime, false);
      
      // Try fallback if enabled
      if (this.config.fallbackEnabled && !options.noFallback) {
        logger.warn(`Request failed, trying fallback: ${error.message}`);
        return this.executeFallback(type, data);
      }
      
      this.emit('request-failed', { requestId, type, error });
      throw error;
      
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }
  
  async executeAIRequest(type, data, options = {}) {
    const model = this.selectModel(options);
    
    switch (type) {
      case 'classify-email':
        return this.classifyEmailInternal(data, model);
      case 'chat':
        return this.processChatInternal(data, model);
      case 'generate-draft':
        return this.generateDraftInternal(data, model);
      case 'process-command':
        return this.processCommandInternal(data, model);
      default:
        throw new Error(`Unknown request type: ${type}`);
    }
  }
  
  async classifyEmailInternal(emailData, model) {
    const systemPrompt = `You are an email classification expert. Classify emails into categories and extract key information.
    Categories: Work, Personal, Finance, Shopping, Travel, Health, Education, Entertainment, Spam, Other.
    Also determine priority (high/medium/low) and suggest action items.`;
    
    const userPrompt = `
    Classify this email and extract key information:
    From: ${emailData.from}
    Subject: ${emailData.subject}
    Date: ${emailData.date}
    Body: ${emailData.body?.substring(0, 1000)}
    
    Return JSON with: category, priority, summary (50 words), actionItems (array), tags (array), sentiment
    `;
    
    const completion = await this.openai.chat.completions.create({
      model: model.name,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: model.temperature,
      max_tokens: model.maxTokens,
      response_format: { type: 'json_object' }
    });
    
    return {
      result: JSON.parse(completion.choices[0].message.content),
      usage: completion.usage
    };
  }
  
  async processChatInternal(chatData, model) {
    const messages = [
      {
        role: 'system',
        content: `You are an intelligent email assistant. Help users manage their emails effectively.
        Provide concise, actionable responses. Use the email context when available.`
      },
      ...chatData.messages
    ];
    
    const completion = await this.openai.chat.completions.create({
      model: model.name,
      messages,
      temperature: model.temperature,
      max_tokens: model.maxTokens
    });
    
    return {
      result: completion.choices[0].message.content,
      usage: completion.usage
    };
  }
  
  async generateDraftInternal(draftData, model) {
    const systemPrompt = `You are an expert email writer. Generate professional, clear, and concise email drafts.
    Match the tone and style appropriate for the context.`;
    
    const userPrompt = `
    Generate an email draft:
    To: ${draftData.to}
    Subject: ${draftData.subject}
    Context: ${draftData.context}
    Key Points: ${draftData.keyPoints?.join(', ')}
    Tone: ${draftData.tone || 'professional'}
    `;
    
    const completion = await this.openai.chat.completions.create({
      model: model.name,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: model.temperature,
      max_tokens: model.maxTokens
    });
    
    return {
      result: completion.choices[0].message.content,
      usage: completion.usage
    };
  }
  
  async processCommandInternal(commandData, model) {
    const systemPrompt = `You are an AI command processor for email management.
    Process natural language commands and return structured actions.
    Available actions: search, filter, sort, archive, delete, flag, reply, forward, schedule.`;
    
    const completion = await this.openai.chat.completions.create({
      model: model.name,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: commandData.command }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });
    
    return {
      result: JSON.parse(completion.choices[0].message.content),
      usage: completion.usage
    };
  }
  
  async executeFallback(type, data) {
    // Implement simple fallback responses
    switch (type) {
      case 'classify-email':
        return {
          result: {
            category: 'Other',
            priority: 'medium',
            summary: 'Email classification unavailable',
            actionItems: [],
            tags: [],
            sentiment: 'neutral'
          },
          fallback: true
        };
      case 'chat':
        return {
          result: 'I apologize, but I am temporarily unable to process your request. Please try again later.',
          fallback: true
        };
      default:
        return { result: null, fallback: true };
    }
  }
  
  selectModel(options) {
    // Check budget constraints
    if (this.budgetManager.daily.spent >= this.budgetManager.daily.limit * 0.9) {
      return this.modelConfig.emergency;
    }
    
    // Check if specific model requested
    if (options.model) {
      return this.modelConfig[options.model] || this.modelConfig.primary;
    }
    
    // Default to primary model
    return this.modelConfig.primary;
  }
  
  checkBudgetLimits() {
    const daily = this.budgetManager.daily;
    const monthly = this.budgetManager.monthly;
    
    if (daily.spent >= daily.limit) {
      throw new Error('Daily budget limit exceeded');
    }
    
    if (monthly.spent >= monthly.limit) {
      throw new Error('Monthly budget limit exceeded');
    }
    
    // Emit warnings at 80% usage
    if (!daily.warnings.daily80 && daily.spent >= daily.limit * 0.8) {
      daily.warnings.daily80 = true;
      this.emit('budget-warning', { type: 'daily', percentage: 80 });
    }
    
    if (!monthly.warnings.monthly80 && monthly.spent >= monthly.limit * 0.8) {
      monthly.warnings.monthly80 = true;
      this.emit('budget-warning', { type: 'monthly', percentage: 80 });
    }
  }
  
  updateBudget(usage) {
    if (!usage) return;
    
    const model = this.modelConfig.primary; // Simplified for now
    const inputCost = (usage.prompt_tokens / 1000) * model.pricing.input;
    const outputCost = (usage.completion_tokens / 1000) * model.pricing.output;
    const totalCost = inputCost + outputCost;
    
    this.budgetManager.daily.spent += totalCost;
    this.budgetManager.monthly.spent += totalCost;
    
    // Save to cache
    this.saveBudgetData();
  }
  
  async getCachedResponse(key) {
    // Try Redis first
    if (this.isRedisConnected) {
      try {
        const cached = await this.redis.get(key);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (error) {
        logger.error('Redis get error:', error);
      }
    }
    
    // Fall back to local cache
    const local = this.localCache.get(key);
    if (local && local.expires > Date.now()) {
      return local.data;
    }
    
    return null;
  }
  
  async cacheResponse(key, data) {
    const expires = Date.now() + this.config.cacheTTL;
    
    // Save to Redis
    if (this.isRedisConnected) {
      try {
        await this.redis.setEx(
          key,
          Math.floor(this.config.cacheTTL / 1000),
          JSON.stringify(data)
        );
      } catch (error) {
        logger.error('Redis set error:', error);
      }
    }
    
    // Save to local cache
    this.localCache.set(key, { data, expires });
    
    // Enforce cache size limit
    if (this.localCache.size > this.config.cacheMaxSize) {
      const firstKey = this.localCache.keys().next().value;
      this.localCache.delete(firstKey);
    }
  }
  
  generateCacheKey(type, data) {
    const hash = createHash('sha256');
    hash.update(type);
    hash.update(JSON.stringify(data));
    return `ai:${hash.digest('hex')}`;
  }
  
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  async queueRequest(requestId) {
    return new Promise((resolve) => {
      this.requestQueue.push({ requestId, resolve });
    });
  }
  
  processQueue() {
    if (this.requestQueue.length > 0 && this.activeRequests < this.config.maxConcurrentRequests) {
      const { resolve } = this.requestQueue.shift();
      resolve();
    }
  }
  
  cleanupCache() {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, value] of this.localCache.entries()) {
      if (value.expires < now) {
        this.localCache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      logger.debug(`Cleaned up ${removed} expired cache entries`);
    }
  }
  
  checkBudgetReset() {
    const now = Date.now();
    
    if (now >= this.budgetManager.daily.resetTime) {
      this.budgetManager.daily.spent = 0;
      this.budgetManager.daily.resetTime = this.getNextResetTime('daily');
      this.budgetManager.daily.warnings = { daily80: false, daily100: false };
      logger.info('Daily budget reset');
    }
    
    if (now >= this.budgetManager.monthly.resetTime) {
      this.budgetManager.monthly.spent = 0;
      this.budgetManager.monthly.resetTime = this.getNextResetTime('monthly');
      this.budgetManager.monthly.warnings = { monthly80: false, monthly100: false };
      logger.info('Monthly budget reset');
    }
  }
  
  getNextResetTime(period) {
    const now = new Date();
    
    if (period === 'daily') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow.getTime();
    } else if (period === 'monthly') {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return nextMonth.getTime();
    }
    
    return now.getTime();
  }
  
  async saveBudgetData() {
    if (this.isRedisConnected) {
      try {
        await this.redis.set(
          'ai:budget',
          JSON.stringify(this.budgetManager),
          { EX: 86400 } // Expire after 24 hours
        );
      } catch (error) {
        logger.error('Failed to save budget data:', error);
      }
    }
  }
  
  async loadBudgetData() {
    if (this.isRedisConnected) {
      try {
        const data = await this.redis.get('ai:budget');
        if (data) {
          const saved = JSON.parse(data);
          // Merge with current config
          this.budgetManager.daily.spent = saved.daily.spent || 0;
          this.budgetManager.monthly.spent = saved.monthly.spent || 0;
          logger.info('Budget data loaded from cache');
        }
      } catch (error) {
        logger.error('Failed to load budget data:', error);
      }
    }
  }
  
  updateMetrics(startTime, success, modelName) {
    const responseTime = Date.now() - startTime;
    
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    // Update average response time
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
      this.metrics.totalRequests;
    
    // Track model usage
    if (modelName) {
      this.metrics.modelUsage[modelName] = (this.metrics.modelUsage[modelName] || 0) + 1;
    }
  }
  
  async saveMetrics() {
    if (this.isRedisConnected) {
      try {
        await this.redis.set(
          'ai:metrics',
          JSON.stringify(this.metrics),
          { EX: 3600 } // Expire after 1 hour
        );
      } catch (error) {
        logger.error('Failed to save metrics:', error);
      }
    }
  }
  
  async healthCheck() {
    const health = {
      status: 'healthy',
      openai: !!this.openai,
      redis: this.isRedisConnected,
      circuitBreaker: this.circuitBreaker.state,
      activeRequests: this.activeRequests,
      queueSize: this.requestQueue.length,
      cacheSize: this.localCache.size,
      budgetStatus: {
        dailyUsage: (this.budgetManager.daily.spent / this.budgetManager.daily.limit * 100).toFixed(2) + '%',
        monthlyUsage: (this.budgetManager.monthly.spent / this.budgetManager.monthly.limit * 100).toFixed(2) + '%'
      }
    };
    
    if (this.circuitBreaker.state === 'OPEN' || !this.openai) {
      health.status = 'degraded';
    }
    
    if (this.activeRequests >= this.config.maxConcurrentRequests) {
      health.status = 'overloaded';
    }
    
    this.emit('health-check', health);
    return health;
  }
  
  // Public API methods
  async classifyEmail(emailData) {
    return this.processRequest('classify-email', emailData);
  }
  
  async processChat(messages, context) {
    return this.processRequest('chat', { messages, context });
  }
  
  async generateDraft(draftData) {
    return this.processRequest('generate-draft', draftData);
  }
  
  async processCommand(command, context) {
    return this.processRequest('process-command', { command, context });
  }
  
  getStats() {
    return {
      metrics: this.metrics,
      budget: {
        daily: {
          spent: this.budgetManager.daily.spent,
          limit: this.budgetManager.daily.limit,
          remaining: this.budgetManager.daily.limit - this.budgetManager.daily.spent
        },
        monthly: {
          spent: this.budgetManager.monthly.spent,
          limit: this.budgetManager.monthly.limit,
          remaining: this.budgetManager.monthly.limit - this.budgetManager.monthly.spent
        }
      },
      cache: {
        localSize: this.localCache.size,
        hitRate: this.metrics.totalRequests > 0 
          ? (this.metrics.cacheHits / this.metrics.totalRequests * 100).toFixed(2) + '%'
          : '0%'
      },
      health: {
        circuitBreaker: this.circuitBreaker.state,
        activeRequests: this.activeRequests,
        queueSize: this.requestQueue.length
      }
    };
  }
  
  async shutdown() {
    logger.info('Shutting down Enhanced AI Service...');
    
    // Save final metrics and budget
    await this.saveMetrics();
    await this.saveBudgetData();
    
    // Close Redis connection
    if (this.redis) {
      await this.redis.quit();
    }
    
    // Clear timers
    this.removeAllListeners();
    
    logger.info('Enhanced AI Service shutdown complete');
  }
}

module.exports = EnhancedAIService;