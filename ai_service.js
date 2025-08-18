const OpenAI = require('openai');
const crypto = require('crypto');
const Redis = require('redis');

// Initialize Redis client for caching
const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.on('error', (err) => console.error('Redis Client Error', err));
redis.connect().catch(console.error);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
  if (urgency === 'CRITICAL' || complexity === 'high') {
    return process.env.GPT5_MINI_MODEL || 'gpt-5-mini';
  }
  
  if (taskType === 'classification' || taskType === 'quick_response') {
    return process.env.GPT5_NANO_MODEL || 'gpt-5-nano';
  }
  
  if (taskType === 'draft_generation' || taskType === 'complex_analysis') {
    return process.env.GPT5_MINI_MODEL || 'gpt-5-mini';
  }
  
  return process.env.GPT5_NANO_MODEL || 'gpt-5-nano';
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
  const cacheKey = getCacheKey('classify', { subject, sender });
  
  // Check cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      costTracker.cache_hits++;
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error('Cache read error:', err);
  }
  
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
      temperature: 0.3,
      max_tokens: 150,
      response_format: { type: 'json_object' }
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    
    // Track costs
    trackCost(model, response.usage.total_tokens);
    
    // Cache result
    await redis.setex(cacheKey, 3600, JSON.stringify(result));
    
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

// Generate draft reply with GPT-5 mini
async function generateDraftReply(emailContent, subject, sender, context = {}) {
  const model = selectModel('draft_generation');
  
  const systemPrompt = `You are a professional email assistant. Generate a draft reply that:
- Maintains appropriate tone and formality
- Addresses all points raised
- Is concise and clear
- Includes placeholders [SPECIFIC_DETAIL] for information you don't have`;

  const userPrompt = `Original Email:
From: ${sender}
Subject: ${subject}
Content: ${emailContent}

Context:
- Previous interactions: ${context.previousInteractions || 0}
- Relationship: ${context.relationship || 'professional'}
- Urgency: ${context.urgency || 'normal'}

Generate a professional reply.`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500
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
  
  const systemPrompt = `You are a helpful email management assistant. Provide brief, actionable responses.
Context: ${JSON.stringify(context)}`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput }
      ],
      temperature: 0.5,
      max_tokens: 150
    });
    
    const result = response.choices[0].message.content;
    
    // Track costs
    trackCost(model, response.usage.total_tokens);
    
    // Cache for 10 minutes
    await redis.setex(cacheKey, 600, result);
    
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
      temperature: 0.6,
      max_tokens: 200
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
    max_tokens: 500
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

module.exports = {
  EmailClassification,
  classifyEmail,
  generateDraftReply,
  generateChatResponse,
  generateSuggestions,
  streamDraftReply,
  getUsageStats,
  selectModel
};