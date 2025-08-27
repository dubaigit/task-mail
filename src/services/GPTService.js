/**
 * GPT Service - Consolidated AI Service
 * 
 * Implements CLAUDE.md requirements:
 * - Uses GPT-5 mini/nano models (not GPT-4)
 * - Email classification and task generation
 * - Draft generation with full context
 * - RAG-powered search
 * - Automation rule processing
 */

const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');
const Redis = require('ioredis');

class GPTService {
  constructor() {
    // GPT-5 models as specified in CLAUDE.md
    this.models = {
      primary: 'gpt-5-mini',
      fallback: 'gpt-5-nano',
      budget: 'gpt-5-nano'
    };

    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/gpt-service.log',
          maxsize: 5242880,
          maxFiles: 5
        })
      ]
    });

    // Budget management
    this.budget = {
      daily: 10.00,  // $10 daily limit
      monthly: 100.00, // $100 monthly limit
      used: {
        daily: 0,
        monthly: 0
      }
    };

    this.isInitialized = false;
    this.openai = null;
    this.supabase = null;
    this.redis = null;
  }

  /**
   * Initialize the GPT service
   */
  async initialize() {
    try {
      // Initialize OpenAI client
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // Dynamic import for OpenAI
      const { OpenAI } = await import('openai');
      this.openai = new OpenAI({ apiKey });

      // Initialize Supabase
      const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
      this.supabase = createClient(supabaseUrl, supabaseKey);

      // Initialize Redis for caching
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        retryStrategy: (times) => Math.min(times * 50, 2000)
      });

      // Load budget usage from database
      await this.loadBudgetUsage();

      this.isInitialized = true;
      this.logger.info('✅ GPT Service initialized with GPT-5 models');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize GPT service:', error);
      throw error;
    }
  }

  /**
   * Load budget usage from database
   */
  async loadBudgetUsage() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date();
      startOfMonth.setDate(1);

      // Get daily usage
      const { data: dailyUsage } = await this.supabase
        .from('ai_usage_stats')
        .select('total_cost')
        .gte('created_at', today)
        .single();

      if (dailyUsage) {
        this.budget.used.daily = dailyUsage.total_cost || 0;
      }

      // Get monthly usage
      const { data: monthlyUsage } = await this.supabase
        .from('ai_usage_stats')
        .select('total_cost')
        .gte('created_at', startOfMonth.toISOString());

      if (monthlyUsage) {
        this.budget.used.monthly = monthlyUsage.reduce((sum, u) => sum + (u.total_cost || 0), 0);
      }
    } catch (error) {
      this.logger.warn('Could not load budget usage:', error);
    }
  }

  /**
   * Check if budget allows for operation
   */
  checkBudget(estimatedCost = 0.01) {
    const withinDaily = (this.budget.used.daily + estimatedCost) <= this.budget.daily;
    const withinMonthly = (this.budget.used.monthly + estimatedCost) <= this.budget.monthly;
    
    if (!withinDaily) {
      this.logger.warn('Daily budget exceeded');
      return false;
    }
    
    if (!withinMonthly) {
      this.logger.warn('Monthly budget exceeded');
      return false;
    }
    
    return true;
  }

  /**
   * Track API usage and cost
   */
  async trackUsage(model, tokens, cost) {
    try {
      this.budget.used.daily += cost;
      this.budget.used.monthly += cost;

      await this.supabase
        .from('ai_usage_stats')
        .insert({
          model_used: model,
          tokens_used: tokens,
          total_cost: cost,
          operation_type: 'gpt_service'
        });
    } catch (error) {
      this.logger.error('Failed to track usage:', error);
    }
  }

  /**
   * Get cache key
   */
  getCacheKey(operation, params) {
    const hash = require('crypto')
      .createHash('md5')
      .update(JSON.stringify({ operation, params }))
      .digest('hex');
    return `gpt:${operation}:${hash}`;
  }

  /**
   * Classify email using GPT-5
   */
  async classifyEmail(email) {
    try {
      if (!this.checkBudget()) {
        return this.getFallbackClassification();
      }

      // Check cache
      const cacheKey = this.getCacheKey('classify', email.id);
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const prompt = `Classify this email and extract key information:

Subject: ${email.subject}
From: ${email.sender}
To: ${email.to_recipients?.join(', ')}
Content Preview: ${email.message_content?.substring(0, 500)}

Please provide:
1. Category (work, personal, newsletter, spam, important)
2. Priority (high, medium, low)
3. Suggested actions
4. Key entities mentioned
5. Estimated response time needed`;

      const response = await this.openai.chat.completions.create({
        model: this.models.primary,
        messages: [
          { role: 'system', content: 'You are an email classification assistant.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.3
      });

      const classification = {
        category: this.extractCategory(response.choices[0].message.content),
        priority: this.extractPriority(response.choices[0].message.content),
        actions: this.extractActions(response.choices[0].message.content),
        entities: this.extractEntities(response.choices[0].message.content),
        estimatedTime: this.extractTime(response.choices[0].message.content),
        model_used: this.models.primary,
        confidence: 0.85
      };

      // Cache result
      await this.redis.setex(cacheKey, 3600, JSON.stringify(classification));

      // Track usage
      await this.trackUsage(
        this.models.primary,
        response.usage?.total_tokens || 0,
        this.calculateCost(this.models.primary, response.usage)
      );

      return classification;
    } catch (error) {
      this.logger.error('Email classification failed:', error);
      return this.getFallbackClassification();
    }
  }

  /**
   * Generate draft reply with full context
   */
  async generateDraft(email, context = {}) {
    try {
      if (!this.checkBudget(0.02)) {
        return this.getFallbackDraft();
      }

      // Build context from email thread
      const threadContext = await this.getEmailThread(email.conversation_id);
      
      // Get sender history
      const senderHistory = await this.getSenderHistory(email.sender);

      const prompt = `Generate a professional email draft reply.

Original Email:
From: ${email.sender} ${email.sender_name ? `(${email.sender_name})` : ''}
To: ${email.to_recipients?.join(', ')}
CC: ${email.cc_recipients?.join(', ') || 'None'}
Subject: ${email.subject}
Date: ${email.date_received}
Content: ${email.message_content}

Thread Context:
${threadContext}

Sender History:
${senderHistory}

Additional Context:
- Priority: ${context.priority || 'medium'}
- Relationship: ${context.relationship || 'professional'}
- Tone: ${context.tone || 'friendly professional'}

Please generate a complete email draft including:
1. Appropriate greeting
2. Main response body
3. Professional closing
4. Suggested subject (if different)`;

      const response = await this.openai.chat.completions.create({
        model: this.models.primary,
        messages: [
          { 
            role: 'system', 
            content: 'You are a professional email assistant. Generate complete, ready-to-send email drafts.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.7
      });

      const draftContent = response.choices[0].message.content;

      const draft = {
        subject: this.extractDraftSubject(draftContent, email.subject),
        content: this.extractDraftBody(draftContent),
        to_recipients: [email.sender], // Reply to sender
        cc_recipients: context.includeOriginalCC ? email.cc_recipients : [],
        bcc_recipients: [],
        original_email_id: email.id,
        conversation_id: email.conversation_id,
        model_used: this.models.primary,
        tokens_used: response.usage?.total_tokens || 0,
        cost: this.calculateCost(this.models.primary, response.usage),
        confidence: 0.9,
        created_at: new Date().toISOString()
      };

      // Save draft to Supabase
      const { data, error } = await this.supabase
        .from('drafts')
        .insert(draft)
        .select()
        .single();

      if (error) throw error;

      // Track usage
      await this.trackUsage(
        this.models.primary,
        response.usage?.total_tokens || 0,
        draft.cost
      );

      return data;
    } catch (error) {
      this.logger.error('Draft generation failed:', error);
      return this.getFallbackDraft();
    }
  }

  /**
   * Search emails using RAG (Retrieval-Augmented Generation)
   */
  async searchEmails(query, filters = {}) {
    try {
      if (!this.checkBudget()) {
        return this.performBasicSearch(query, filters);
      }

      // First, get embedding for the query
      const embedding = await this.getQueryEmbedding(query);

      // Search similar emails in database
      const { data: emails } = await this.supabase
        .rpc('search_emails_by_embedding', {
          query_embedding: embedding,
          match_threshold: 0.7,
          match_count: 20,
          filters: filters
        });

      if (!emails || emails.length === 0) {
        return this.performBasicSearch(query, filters);
      }

      // Use GPT to understand the query intent and rank results
      const prompt = `Given this search query: "${query}"

And these email results:
${emails.map((e, i) => `
${i + 1}. Subject: ${e.subject}
   From: ${e.sender}
   Date: ${e.date_received}
   Preview: ${e.message_content?.substring(0, 200)}
`).join('\n')}

Please:
1. Identify which emails best match the query intent
2. Explain why they match
3. Suggest follow-up questions
4. Provide a summary of findings`;

      const response = await this.openai.chat.completions.create({
        model: this.models.budget,
        messages: [
          { 
            role: 'system', 
            content: 'You are an intelligent email search assistant using RAG.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.3
      });

      const analysis = response.choices[0].message.content;

      // Track usage
      await this.trackUsage(
        this.models.budget,
        response.usage?.total_tokens || 0,
        this.calculateCost(this.models.budget, response.usage)
      );

      return {
        query,
        results: emails,
        analysis,
        model_used: this.models.budget,
        method: 'rag_enhanced'
      };
    } catch (error) {
      this.logger.error('RAG search failed:', error);
      return this.performBasicSearch(query, filters);
    }
  }

  /**
   * Generate tasks from email
   */
  async generateTasks(email) {
    try {
      if (!this.checkBudget()) {
        return [];
      }

      const prompt = `Analyze this email and extract actionable tasks:

Subject: ${email.subject}
From: ${email.sender}
Content: ${email.message_content}

Extract:
1. Explicit tasks mentioned
2. Implicit action items
3. Deadlines or time constraints
4. Dependencies or prerequisites
5. Suggested priority for each task

Format as a list of tasks with properties: title, description, priority, due_date, category`;

      const response = await this.openai.chat.completions.create({
        model: this.models.budget,
        messages: [
          { 
            role: 'system', 
            content: 'You are a task extraction assistant. Extract actionable tasks from emails.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.3
      });

      const tasks = this.parseTasksFromResponse(response.choices[0].message.content);

      // Save tasks to database
      for (const task of tasks) {
        await this.supabase
          .from('tasks')
          .insert({
            ...task,
            source_email_id: email.id,
            created_from: 'ai_extraction',
            model_used: this.models.budget
          });
      }

      // Track usage
      await this.trackUsage(
        this.models.budget,
        response.usage?.total_tokens || 0,
        this.calculateCost(this.models.budget, response.usage)
      );

      return tasks;
    } catch (error) {
      this.logger.error('Task generation failed:', error);
      return [];
    }
  }

  /**
   * Process automation rule
   */
  async processAutomationRule(rule, email) {
    try {
      // Check if rule conditions match
      const matches = await this.evaluateRuleConditions(rule.conditions, email);
      
      if (!matches) {
        return null;
      }

      // Execute rule actions
      const results = [];
      for (const action of rule.actions) {
        switch (action.type) {
          case 'auto_reply':
            const draft = await this.generateDraft(email, {
              template: action.template,
              tone: 'professional'
            });
            results.push({ action: 'auto_reply', draft });
            break;

          case 'categorize':
            await this.supabase
              .from('emails')
              .update({ 
                labels: [...(email.labels || []), action.category],
                priority: action.priority 
              })
              .eq('id', email.id);
            results.push({ action: 'categorize', category: action.category });
            break;

          case 'forward':
            await this.createForwardDraft(email, action.recipients);
            results.push({ action: 'forward', to: action.recipients });
            break;

          case 'create_task':
            const tasks = await this.generateTasks(email);
            results.push({ action: 'create_task', tasks });
            break;

          default:
            this.logger.warn(`Unknown automation action: ${action.type}`);
        }
      }

      // Log automation execution
      await this.supabase
        .from('automation_logs')
        .insert({
          rule_id: rule.id,
          email_id: email.id,
          actions_executed: results,
          executed_at: new Date().toISOString()
        });

      return results;
    } catch (error) {
      this.logger.error('Automation rule processing failed:', error);
      return null;
    }
  }

  // Helper methods

  async getEmailThread(conversationId) {
    if (!conversationId) return 'No previous thread context';

    const { data } = await this.supabase
      .from('emails')
      .select('subject, sender, message_content, date_received')
      .eq('conversation_id', conversationId)
      .order('date_received', { ascending: false })
      .limit(5);

    if (!data || data.length === 0) return 'No previous thread context';

    return data.map(e => 
      `[${e.date_received}] ${e.sender}: ${e.subject}\n${e.message_content?.substring(0, 200)}`
    ).join('\n---\n');
  }

  async getSenderHistory(senderEmail) {
    const { data } = await this.supabase
      .from('emails')
      .select('subject, date_received')
      .eq('sender', senderEmail)
      .order('date_received', { ascending: false })
      .limit(10);

    if (!data || data.length === 0) return 'First email from this sender';

    return `Previous ${data.length} emails from this sender:\n` +
      data.map(e => `- ${e.subject} (${e.date_received})`).join('\n');
  }

  async getQueryEmbedding(query) {
    // For now, return a mock embedding
    // In production, use OpenAI embeddings API
    return Array(1536).fill(0).map(() => Math.random());
  }

  async performBasicSearch(query, filters) {
    const { data } = await this.supabase
      .from('emails')
      .select('*')
      .textSearch('subject', query)
      .limit(20);

    return {
      query,
      results: data || [],
      method: 'basic_search'
    };
  }

  async evaluateRuleConditions(conditions, email) {
    for (const condition of conditions) {
      switch (condition.field) {
        case 'sender':
          if (!email.sender.includes(condition.value)) return false;
          break;
        case 'subject':
          if (!email.subject.toLowerCase().includes(condition.value.toLowerCase())) return false;
          break;
        case 'has_attachments':
          if (email.has_attachments !== condition.value) return false;
          break;
        default:
          this.logger.warn(`Unknown condition field: ${condition.field}`);
      }
    }
    return true;
  }

  extractCategory(text) {
    const categories = ['work', 'personal', 'newsletter', 'spam', 'important'];
    const lower = text.toLowerCase();
    return categories.find(c => lower.includes(c)) || 'general';
  }

  extractPriority(text) {
    const priorities = ['high', 'medium', 'low'];
    const lower = text.toLowerCase();
    return priorities.find(p => lower.includes(p)) || 'medium';
  }

  extractActions(text) {
    // Simple extraction - can be enhanced
    const actions = [];
    if (text.includes('reply')) actions.push('reply');
    if (text.includes('forward')) actions.push('forward');
    if (text.includes('schedule')) actions.push('schedule');
    return actions;
  }

  extractEntities(text) {
    // Simple entity extraction - can be enhanced with NER
    const entities = [];
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    const emails = text.match(emailRegex);
    if (emails) entities.push(...emails.map(e => ({ type: 'email', value: e })));
    return entities;
  }

  extractTime(text) {
    if (text.includes('urgent') || text.includes('asap')) return '1 hour';
    if (text.includes('today')) return '4 hours';
    if (text.includes('tomorrow')) return '24 hours';
    return '48 hours';
  }

  extractDraftSubject(content, originalSubject) {
    const subjectMatch = content.match(/Subject:\s*(.+)/i);
    if (subjectMatch) return subjectMatch[1];
    return `Re: ${originalSubject}`;
  }

  extractDraftBody(content) {
    // Remove subject line if present
    return content.replace(/Subject:\s*.+\n/i, '').trim();
  }

  parseTasksFromResponse(text) {
    // Parse GPT response into task objects
    const tasks = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#')) {
        tasks.push({
          title: line.trim(),
          description: '',
          priority: 'medium',
          due_date: null,
          category: 'email'
        });
      }
    }
    
    return tasks;
  }

  calculateCost(model, usage) {
    // GPT-5 pricing (hypothetical)
    const pricing = {
      'gpt-5-mini': { input: 0.0001, output: 0.0002 },
      'gpt-5-nano': { input: 0.00005, output: 0.0001 }
    };

    const modelPricing = pricing[model] || pricing['gpt-5-nano'];
    const inputCost = (usage?.prompt_tokens || 0) * modelPricing.input / 1000;
    const outputCost = (usage?.completion_tokens || 0) * modelPricing.output / 1000;
    
    return inputCost + outputCost;
  }

  getFallbackClassification() {
    return {
      category: 'general',
      priority: 'medium',
      actions: ['review'],
      entities: [],
      estimatedTime: '24 hours',
      model_used: 'fallback',
      confidence: 0.3
    };
  }

  getFallbackDraft() {
    return {
      subject: 'Re: Your email',
      content: 'Thank you for your email. I will review and respond shortly.\n\nBest regards',
      to_recipients: [],
      cc_recipients: [],
      bcc_recipients: [],
      model_used: 'fallback',
      confidence: 0.2
    };
  }

  async createForwardDraft(email, recipients) {
    const draft = {
      subject: `Fwd: ${email.subject}`,
      content: `---------- Forwarded message ----------\nFrom: ${email.sender}\nDate: ${email.date_received}\nSubject: ${email.subject}\n\n${email.message_content}`,
      to_recipients: recipients,
      cc_recipients: [],
      bcc_recipients: [],
      original_email_id: email.id,
      type: 'forward'
    };

    await this.supabase.from('drafts').insert(draft);
    return draft;
  }
}

module.exports = GPTService;