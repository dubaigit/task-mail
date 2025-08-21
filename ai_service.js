require('dotenv').config(); // Load environment variables
const OpenAI = require('openai');
const crypto = require('crypto');
const Redis = require('redis');
const { z } = require('zod');

// Initialize Redis client for caching
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
};

// Only add password if it's set
if (process.env.REDIS_PASSWORD) {
  redisConfig.password = process.env.REDIS_PASSWORD;
}

const redis = Redis.createClient(redisConfig);

const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'ai-service' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

redis.on('error', (err) => logger.error('Redis Client Error', err));
redis.connect().catch(err => logger.error('Redis connection failed', err));

// Schema validation for AI responses
const classificationSchema = z.object({
  classification: z.enum([
    'CREATE_TASK', 'FYI_ONLY', 'URGENT_RESPONSE', 'CALENDAR_EVENT',
    'APPROVAL_REQUIRED', 'DOCUMENT_REVIEW', 'MEETING_REQUEST', 'NEEDS_REPLY', 
    'ESCALATION', 'INFORMATION_ONLY', 'ACTION_REQUIRED'
  ]),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  confidence: z.number().min(0).max(100),
  suggested_action: z.string().max(500),
  task_title: z.string().max(200).optional(),
  task_description: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional()
});

const draftSchema = z.object({
  subject: z.string().max(200),
  body: z.string().max(5000),
  tone: z.enum(['FORMAL', 'CASUAL', 'FRIENDLY', 'PROFESSIONAL']),
  confidence: z.number().min(0).max(100),
  suggestions: z.array(z.string().max(200)).max(5).optional()
});

// Budget tracking
class BudgetTracker {
  constructor() {
    this.dailySpent = 0;
    this.monthlySpent = 0;
    this.lastReset = new Date().toDateString();
    this.dailyLimit = parseFloat(process.env.OPENAI_DAILY_BUDGET) || 10.0;
    this.monthlyLimit = parseFloat(process.env.OPENAI_MONTHLY_BUDGET) || 100.0;
  }

  checkBudget() {
    const today = new Date().toDateString();
    if (this.lastReset !== today) {
      this.dailySpent = 0;
      this.lastReset = today;
    }

    if (this.dailySpent >= this.dailyLimit) {
      throw new Error(`Daily OpenAI budget limit exceeded: $${this.dailyLimit}`);
    }
    
    if (this.monthlySpent >= this.monthlyLimit) {
      throw new Error(`Monthly OpenAI budget limit exceeded: $${this.monthlyLimit}`);
    }
  }

  trackSpending(cost) {
    this.dailySpent += cost;
    this.monthlySpent += cost;
  }
}

const budgetTracker = new BudgetTracker();

// Multi-level caching system
class AIResponseCache {
  constructor() {
    this.localCache = new Map(); // In-memory for immediate responses
    this.maxLocalSize = 500; // Limit local cache size
    this.localTTL = 5 * 60 * 1000; // 5 minutes for local cache
    this.redisTTL = 60 * 60; // 1 hour for Redis cache
  }
  
  // Generate cache key with better hashing
  generateKey(type, data) {
    const content = JSON.stringify({ type, ...data });
    return `ai_cache:${type}:${crypto.createHash('md5').update(content).digest('hex')}`;
  }
  
  // Get from cache (local first, then Redis)
  async get(cacheKey) {
    try {
      // Check local cache first (fastest)
      const localEntry = this.localCache.get(cacheKey);
      if (localEntry && Date.now() - localEntry.timestamp < this.localTTL) {
        return localEntry.data;
      }
      
      // Remove expired local cache entry
      if (localEntry) {
        this.localCache.delete(cacheKey);
      }
      
      // Check Redis cache (fast)
      if (redis.isReady) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const data = JSON.parse(cached);
          // Store in local cache for next time
          this.setLocal(cacheKey, data);
          return data;
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Cache get error:', error.message);
      return null;
    }
  }
  
  // Set in both caches
  async set(cacheKey, data) {
    try {
      // Set in local cache
      this.setLocal(cacheKey, data);
      
      // Set in Redis cache with TTL
      if (redis.isReady) {
        await redis.setEx(cacheKey, this.redisTTL, JSON.stringify(data));
      }
    } catch (error) {
      console.warn('Cache set error:', error.message);
    }
  }
  
  // Set only in local cache
  setLocal(cacheKey, data) {
    // Implement LRU eviction if cache is full
    if (this.localCache.size >= this.maxLocalSize) {
      const firstKey = this.localCache.keys().next().value;
      if (firstKey) {
        this.localCache.delete(firstKey);
      }
    }
    
    this.localCache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });
  }
  
  // Clear all caches
  async clear() {
    this.localCache.clear();
    try {
      if (redis.isReady) {
        const keys = await redis.keys('ai_cache:*');
        if (keys.length > 0) {
          await redis.del(keys);
        }
      }
    } catch (error) {
      console.warn('Cache clear error:', error.message);
    }
  }
  
  // Get cache statistics
  getStats() {
    return {
      localCacheSize: this.localCache.size,
      localMaxSize: this.maxLocalSize,
      localTTL: this.localTTL,
      redisTTL: this.redisTTL,
      redisConnected: redis.isReady
    };
  }
}

// Create global cache instance
const aiCache = new AIResponseCache();

// Initialize OpenAI client with error handling
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✅ OpenAI client initialized successfully');
  } else {
    console.warn('⚠️ OPENAI_API_KEY not found - AI features will be disabled');
  }
} catch (error) {
  console.error('❌ Failed to initialize OpenAI client:', error.message);
}

// Email Classification Types (Expanded 15+ types)
const EmailClassification = {
  // Core Classifications
  NEEDS_REPLY: 'NEEDS_REPLY',
  CREATE_TASK: 'CREATE_TASK',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  DELEGATE: 'DELEGATE',
  FYI_ONLY: 'FYI_ONLY',
  FOLLOW_UP: 'FOLLOW_UP',
  
  // Meeting & Calendar
  MEETING_REQUEST: 'MEETING_REQUEST',
  MEETING_CANCELLED: 'MEETING_CANCELLED',
  CALENDAR_CONFLICT: 'CALENDAR_CONFLICT',
  
  // Action Types
  DOCUMENT_REVIEW: 'DOCUMENT_REVIEW',
  SIGNATURE_REQUIRED: 'SIGNATURE_REQUIRED',
  PAYMENT_PROCESSING: 'PAYMENT_PROCESSING',
  ESCALATION: 'ESCALATION',
  DEADLINE_REMINDER: 'DEADLINE_REMINDER',
  
  // Communication Types
  CUSTOMER_COMPLAINT: 'CUSTOMER_COMPLAINT',
  INTERNAL_ANNOUNCEMENT: 'INTERNAL_ANNOUNCEMENT',
  PROJECT_UPDATE: 'PROJECT_UPDATE',
  BLOCKED_WAITING: 'BLOCKED_WAITING'
};

// Cost tracking
const costTracker = {
  gpt5_nano: { tokens: 0, cost: 0 },
  gpt5_mini: { tokens: 0, cost: 0 },
  total_requests: 0,
  cache_hits: 0
};

// Model selection based on task complexity
function selectModel(taskType, urgency = 'normal', complexity = 'low') {
  // Use more stable models for now since GPT-5 models may not be available
  if (urgency === 'CRITICAL' || complexity === 'high') {
    return process.env.GPT5_MINI_MODEL || 'gpt-4o-mini';
  }
  
  if (taskType === 'classification' || taskType === 'quick_response') {
    return process.env.GPT5_NANO_MODEL || 'gpt-4o-mini';
  }
  
  if (taskType === 'draft_generation' || taskType === 'complex_analysis') {
    return process.env.GPT5_MINI_MODEL || 'gpt-4o';
  }
  
  return process.env.GPT5_NANO_MODEL || 'gpt-4o-mini';
}

// Generate cache key for AI responses
function getCacheKey(type, input) {
  const hash = crypto.createHash('sha256');
  hash.update(`${type}:${JSON.stringify(input)}`);
  return `ai_cache:${hash.digest('hex')}`;
}

// Track costs
function trackCost(model, tokens) {
  const costs = {
    'gpt-5-nano': 0.05 / 1000000,  // $0.05 per 1M tokens
    'gpt-5-mini': 0.25 / 1000000,  // $0.25 per 1M tokens
    'gpt-4o-mini': 0.15 / 1000000,
    'gpt-4o': 2.50 / 1000000
  };
  
  const cost = tokens * (costs[model] || 0);
  
  if (model.includes('nano')) {
    costTracker.gpt5_nano.tokens += tokens;
    costTracker.gpt5_nano.cost += cost;
  } else if (model.includes('mini')) {
    costTracker.gpt5_mini.tokens += tokens;
    costTracker.gpt5_mini.cost += cost;
  }
  
  costTracker.total_requests++;
  
  return cost;
}

// Classify email with GPT-5 nano
async function classifyEmail(emailContent, subject, sender) {
  // Check if OpenAI is available
  if (!openai) {
    console.warn('⚠️ OpenAI not available - using fallback classification');
    return {
      classification: 'FYI_ONLY',
      urgency: 'LOW',
      confidence: 30,
      taskTitle: subject,
      taskDescription: 'Email classification unavailable - OpenAI API key not configured',
      estimatedTime: '5 min',
      suggestedAction: 'Review manually'
    };
  }

  const cacheKey = aiCache.generateKey('classify', { subject, sender, emailContent: emailContent.substring(0, 100) });
  
  // Check multi-level cache first
  try {
    const cached = await aiCache.get(cacheKey);
    if (cached) {
      costTracker.cache_hits++;
      console.log(`📦 Cache hit for email classification: ${subject.substring(0, 50)}...`);
      return cached;
    }
  } catch (err) {
    console.error('Cache read error:', err);
  }
  
  // Check budget before making API call
  budgetTracker.checkBudget();
  
  const model = selectModel('classification');
  
  const systemPrompt = `You are an email classifier. Classify emails into these categories:
${Object.keys(EmailClassification).join(', ')}

Return a JSON object with:
- classification: primary classification
- secondary_classifications: array of other applicable classifications
- priority: urgent/high/medium/low
- confidence: 0-100
- suggested_action: brief action description`;

  const userPrompt = `Subject: ${subject}
From: ${sender}
Content: ${emailContent.substring(0, 1000)}`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 1,
      max_completion_tokens: 300,
      response_format: { type: 'json_object' }
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content || content.trim() === '') {
      throw new Error('Empty response from OpenAI');
    }
    
    // Parse and validate response
    let result;
    try {
      const parsedResult = JSON.parse(content);
      result = classificationSchema.parse(parsedResult);
    } catch (parseError) {
      console.error('AI response validation failed:', parseError);
      throw new Error('Invalid AI response format');
    }
    
    // Track costs and update budget
    const cost = trackCost(model, response.usage.total_tokens);
    budgetTracker.trackSpending(cost);
    
    // Cache result in multi-level cache
    await aiCache.set(cacheKey, result);
    console.log(`💾 Cached classification result for: ${subject.substring(0, 50)}...`);
    
    return result;
  } catch (error) {
    console.error('Classification error:', error);
    
    // Fallback to pattern-based classification
    return {
      classification: emailContent.toLowerCase().includes('reply') ? 
        EmailClassification.NEEDS_REPLY : EmailClassification.FYI_ONLY,
      secondary_classifications: [],
      priority: 'medium',
      confidence: 50,
      suggested_action: 'Manual review recommended'
    };
  }
}

// Generate draft reply with conversation context and writing style
async function generateDraftReply(emailContent, subject, sender, context = {}) {
  const model = selectModel('draft_generation');
  
  // Get conversation context if messageId is provided
  let conversationContext = '';
  if (context.messageId) {
    try {
      // Note: These are internal server calls, so we'll implement them differently
      console.log('Conversation context will be implemented via direct database queries');
    } catch (error) {
      console.log('Could not fetch conversation context:', error.message);
    }
  }
  
  // Get user's writing style via direct database query (internal server call)
  let writingStyle = '';
  try {
    // Note: This will be implemented via direct database access
    console.log('Writing style analysis will be implemented via database queries');
    // Placeholder for future implementation
    writingStyle = '\n\nUSER\'S WRITING STYLE: Professional, concise, friendly tone';
  } catch (error) {
    console.log('Could not fetch writing style:', error.message);
  }

  const systemPrompt = `You are an advanced email assistant that generates replies matching the user's writing style and considering full conversation context.

REPLY REQUIREMENTS:
- Match the user's established writing style and tone
- Consider the full email conversation thread
- Address all points raised in the original email
- Be contextually appropriate for the conversation flow
- Use professional but personalized language
- Include placeholders [SPECIFIC_DETAIL] only when absolutely necessary

${writingStyle}${conversationContext}`;

  const userPrompt = `ORIGINAL EMAIL TO REPLY TO:
From: ${sender}
Subject: ${subject}
Content: ${emailContent}

ADDITIONAL CONTEXT:
- Previous interactions: ${context.previousInteractions || 0}
- Relationship: ${context.relationship || 'professional'}
- Urgency: ${context.urgency || 'normal'}
- Task classification: ${context.classification || 'unknown'}

Generate a reply that matches my writing style and considers the conversation history.`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 1,
      max_completion_tokens: 500
    });
    
    const draft = response.choices[0].message.content;
    
    // Track costs
    trackCost(model, response.usage.total_tokens);
    
    return {
      draft,
      model_used: model,
      tokens_used: response.usage.total_tokens,
      cost: trackCost(model, 0)
    };
  } catch (error) {
    console.error('Draft generation error:', error);
    throw error;
  }
}

// Chat response with GPT-5 nano (fast responses)
async function generateChatResponse(userInput, context = {}) {
  const model = selectModel('quick_response');
  
  const cacheKey = getCacheKey('chat', userInput);
  
  // Check cache
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      costTracker.cache_hits++;
      return cached;
    }
  } catch (err) {
    console.error('Cache read error:', err);
  }
  
  const systemPrompt = `You are an advanced email management AI assistant with full database access. 

CAPABILITIES:
- Full access to PostgreSQL email database with 8000+ emails
- Real-time task analysis and classification
- Email content search and analysis
- Task completion tracking and statistics
- Draft generation and email automation

RESPONSE FORMATTING:
- Use markdown formatting for better readability
- Use bullet points and sections for clarity
- Include relevant metrics and numbers
- Be specific and actionable
- Use emojis sparingly but effectively

CONTEXT: ${JSON.stringify(context, null, 2)}

Provide helpful, detailed responses that leverage your database access to give specific insights about emails, tasks, and productivity.`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput }
      ],
      temperature: 1,
      max_completion_tokens: 500
    });
    
    const result = response.choices[0].message.content;
    
    // Track costs
    trackCost(model, response.usage.total_tokens);
    
    // Cache for chat responses in multi-level cache
    await aiCache.set(aiCache.generateKey('chat', { message: userInput.substring(0, 100) }), { response: result });
    
    return result;
  } catch (error) {
    console.error('Chat response error:', error);
    throw error;
  }
}

// Generate AI suggestions with GPT-5 nano
async function generateSuggestions(tasks, emails) {
  const model = selectModel('quick_response');
  
  const urgentTasks = tasks.filter(t => t.priority === 'urgent');
  const overdueTasks = tasks.filter(t => new Date(t.dueDate) < new Date());
  
  const prompt = `Based on these metrics:
- ${urgentTasks.length} urgent tasks
- ${overdueTasks.length} overdue tasks
- ${emails.length} unread emails

Generate 3 brief, actionable suggestions for productivity.`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a productivity assistant. Provide brief, actionable suggestions.' },
        { role: 'user', content: prompt }
      ],
      temperature: 1,
      max_completion_tokens: 200
    });
    
    const suggestions = response.choices[0].message.content.split('\n')
      .filter(s => s.trim())
      .map(s => ({
        title: s.split(':')[0] || s,
        description: s.split(':')[1] || ''
      }));
    
    trackCost(model, response.usage.total_tokens);
    
    return suggestions;
  } catch (error) {
    console.error('Suggestions error:', error);
    return [];
  }
}

// Streaming support for long responses
async function* streamDraftReply(emailContent, subject, sender) {
  const model = selectModel('draft_generation');
  
  const stream = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'Generate a professional email reply.' },
      { role: 'user', content: `Reply to: ${subject}\nFrom: ${sender}\n\n${emailContent}` }
    ],
    stream: true,
    temperature: 0.7,
    max_completion_tokens: 500
  });
  
  let totalTokens = 0;
  
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    totalTokens += 10; // Approximate
    yield content;
  }
  
  trackCost(model, totalTokens);
}

// Get usage statistics
function getUsageStats() {
  return {
    ...costTracker,
    monthly_budget: parseFloat(process.env.MONTHLY_BUDGET_USD || 100),
    budget_used_percentage: (costTracker.gpt5_nano.cost + costTracker.gpt5_mini.cost) / 
                            parseFloat(process.env.MONTHLY_BUDGET_USD || 100) * 100,
    cache_hit_rate: costTracker.cache_hits / (costTracker.total_requests || 1) * 100
  };
}

// Get cache performance statistics
function getCacheStats() {
  return {
    ...aiCache.getStats(),
    cache_hit_rate: costTracker.cache_hits / (costTracker.total_requests || 1) * 100,
    total_requests: costTracker.total_requests,
    cache_hits: costTracker.cache_hits
  };
}

module.exports = {
  EmailClassification,
  classifyEmail,
  generateDraftReply,
  generateChatResponse,
  generateSuggestions,
  streamDraftReply,
  getUsageStats,
  getCacheStats,
  selectModel
};