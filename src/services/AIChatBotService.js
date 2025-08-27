const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

/**
 * AI Chat Bot Service
 * Provides RAG capabilities, email analysis, and draft generation
 * Integrates with GPT-5 for intelligent email management
 */
class AIChatBotService {
  constructor() {
    this.openai = null;
    this.supabase = null;
    this.isInitialized = false;
    
    // Initialize OpenAI client
    this.initializeOpenAI();
    
    // Initialize Supabase client
    this.initializeSupabase();
  }

  /**
   * Initialize OpenAI client
   */
  initializeOpenAI() {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      const model = process.env.OPENAI_MODEL || 'gpt-5-mini';

      if (!apiKey) {
        throw new Error('Missing OpenAI API key');
      }

      this.openai = new OpenAI({
        apiKey: apiKey,
        timeout: 30000,
        maxRetries: 3
      });

      this.model = model;
      logger.info(`OpenAI client initialized with model: ${model}`);
    } catch (error) {
      logger.error('Failed to initialize OpenAI client:', error);
    }
  }

  /**
   * Initialize Supabase client
   */
  initializeSupabase() {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase configuration');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      logger.info('Supabase client initialized for AI chat bot');
    } catch (error) {
      logger.error('Failed to initialize Supabase client for AI chat bot:', error);
    }
  }

  /**
   * Initialize the AI chat bot service
   */
  async initialize() {
    try {
      if (!this.openai || !this.supabase) {
        throw new Error('OpenAI or Supabase client not initialized');
      }

      // Test connections
      await this.testConnections();

      this.isInitialized = true;
      logger.info('AI chat bot service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize AI chat bot service:', error);
      return false;
    }
  }

  /**
   * Test service connections
   */
  async testConnections() {
    // Test OpenAI
    try {
      await this.openai.models.list();
      logger.info('OpenAI connection test passed');
    } catch (error) {
      throw new Error(`OpenAI connection test failed: ${error.message}`);
    }

    // Test Supabase
    try {
      const { error } = await this.supabase
        .from('emails')
        .select('count')
        .limit(1);

      if (error) {
        throw new Error(`Supabase connection test failed: ${error.message}`);
      }

      logger.info('Supabase connection test passed');
    } catch (error) {
      throw new Error(`Supabase connection test failed: ${error.message}`);
    }
  }

  /**
   * Process user query with RAG capabilities
   */
  async processQuery(userQuery, context = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('AI chat bot service not initialized');
      }

      logger.info(`Processing user query: ${userQuery}`);

      // Determine query type and route accordingly
      const queryType = this.classifyQuery(userQuery);
      
      switch (queryType) {
        case 'email_search':
          return await this.handleEmailSearch(userQuery, context);
        
        case 'task_creation':
          return await this.handleTaskCreation(userQuery, context);
        
        case 'draft_generation':
          return await this.handleDraftGeneration(userQuery, context);
        
        case 'email_analysis':
          return await this.handleEmailAnalysis(userQuery, context);
        
        case 'general_question':
        default:
          return await this.handleGeneralQuestion(userQuery, context);
      }
    } catch (error) {
      logger.error('Failed to process query:', error);
      throw error;
    }
  }

  /**
   * Classify user query type
   */
  classifyQuery(query) {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('find') || lowerQuery.includes('search') || lowerQuery.includes('show')) {
      return 'email_search';
    }
    
    if (lowerQuery.includes('create task') || lowerQuery.includes('add task') || lowerQuery.includes('remind me')) {
      return 'task_creation';
    }
    
    if (lowerQuery.includes('draft') || lowerQuery.includes('compose') || lowerQuery.includes('write email')) {
      return 'draft_generation';
    }
    
    if (lowerQuery.includes('analyze') || lowerQuery.includes('classify') || lowerQuery.includes('priority')) {
      return 'email_analysis';
    }
    
    return 'general_question';
  }

  /**
   * Handle email search queries with RAG
   */
  async handleEmailSearch(query, context) {
    try {
      // Extract search criteria from query
      const searchCriteria = this.extractSearchCriteria(query);
      
      // Search emails in Supabase
      const emails = await this.searchEmails(searchCriteria);
      
      // Generate AI response with context
      const response = await this.generateSearchResponse(query, emails, searchCriteria);
      
      return {
        type: 'email_search',
        query: query,
        results: emails,
        response: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Email search failed:', error);
      throw error;
    }
  }

  /**
   * Extract search criteria from natural language query
   */
  extractSearchCriteria(query) {
    const criteria = {};
    const lowerQuery = query.toLowerCase();
    
    // Extract sender
    const senderMatch = lowerQuery.match(/(?:from|by)\s+([a-zA-Z0-9@._-]+)/);
    if (senderMatch) {
      criteria.sender = senderMatch[1];
    }
    
    // Extract subject keywords
    const subjectMatch = lowerQuery.match(/(?:about|regarding|subject|topic)\s+(.+?)(?:\s|$)/);
    if (subjectMatch) {
      criteria.subject = subjectMatch[1];
    }
    
    // Extract date range
    if (lowerQuery.includes('today')) {
      criteria.dateFrom = new Date().toISOString().split('T')[0];
    } else if (lowerQuery.includes('yesterday')) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      criteria.dateFrom = yesterday.toISOString().split('T')[0];
    } else if (lowerQuery.includes('this week')) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      criteria.dateFrom = weekStart.toISOString().split('T')[0];
    }
    
    // Extract priority
    if (lowerQuery.includes('urgent') || lowerQuery.includes('high priority')) {
      criteria.priority = 'high';
    } else if (lowerQuery.includes('low priority')) {
      criteria.priority = 'low';
    }
    
    // Extract read status
    if (lowerQuery.includes('unread')) {
      criteria.readStatus = false;
    } else if (lowerQuery.includes('read')) {
      criteria.readStatus = true;
    }
    
    return criteria;
  }

  /**
   * Search emails based on criteria
   */
  async searchEmails(criteria) {
    try {
      let query = this.supabase
        .from('emails')
        .select(`
          *,
          email_analysis (
            classification,
            priority,
            sentiment,
            action_required
          )
        `)
        .order('date_received', { ascending: false });

      // Apply filters
      if (criteria.sender) {
        query = query.ilike('sender', `%${criteria.sender}%`);
      }

      if (criteria.subject) {
        query = query.ilike('subject', `%${criteria.subject}%`);
      }

      if (criteria.dateFrom) {
        query = query.gte('date_received', criteria.dateFrom);
      }

      if (criteria.priority) {
        query = query.eq('email_analysis.priority', criteria.priority);
      }

      if (criteria.readStatus !== undefined) {
        query = query.eq('read_status', criteria.readStatus);
      }

      // Limit results
      query = query.limit(50);

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Email search failed:', error);
      throw error;
    }
  }

  /**
   * Generate AI response for search results
   */
  async generateSearchResponse(query, emails, criteria) {
    try {
      const prompt = `
        User Query: "${query}"
        Search Criteria: ${JSON.stringify(criteria)}
        Found ${emails.length} emails.
        
        Please provide a helpful summary of the search results, including:
        1. Brief overview of what was found
        2. Key patterns or insights
        3. Suggestions for next steps
        4. Any notable emails that might need attention
        
        Keep the response conversational and helpful.
      `;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful email assistant that provides clear, actionable insights about email search results.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      return completion.choices[0].message.content;
    } catch (error) {
      logger.error('Failed to generate search response:', error);
      return `Found ${emails.length} emails matching your search. Here are the results:`;
    }
  }

  /**
   * Handle task creation requests
   */
  async handleTaskCreation(query, context) {
    try {
      // Extract task details from query
      const taskDetails = this.extractTaskDetails(query);
      
      // Create task in Supabase
      const task = await this.createTask(taskDetails);
      
      // Generate AI response
      const response = await this.generateTaskCreationResponse(query, task);
      
      return {
        type: 'task_creation',
        query: query,
        task: task,
        response: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Task creation failed:', error);
      throw error;
    }
  }

  /**
   * Extract task details from natural language
   */
  extractTaskDetails(query) {
    const details = {};
    const lowerQuery = query.toLowerCase();
    
    // Extract title
    if (lowerQuery.includes('remind me to')) {
      details.title = query.substring(query.toLowerCase().indexOf('remind me to') + 12).trim();
    } else if (lowerQuery.includes('create task')) {
      details.title = query.substring(query.toLowerCase().indexOf('create task') + 12).trim();
    }
    
    // Extract priority
    if (lowerQuery.includes('urgent') || lowerQuery.includes('high priority')) {
      details.priority = 'high';
    } else if (lowerQuery.includes('low priority')) {
      details.priority = 'low';
    } else {
      details.priority = 'medium';
    }
    
    // Extract due date
    if (lowerQuery.includes('today')) {
      details.dueDate = new Date().toISOString();
    } else if (lowerQuery.includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      details.dueDate = tomorrow.toISOString();
    } else if (lowerQuery.includes('this week')) {
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
      details.dueDate = weekEnd.toISOString();
    }
    
    // Extract tags
    const tags = [];
    if (lowerQuery.includes('meeting')) tags.push('meeting');
    if (lowerQuery.includes('email')) tags.push('email');
    if (lowerQuery.includes('follow up')) tags.push('follow-up');
    if (lowerQuery.includes('urgent')) tags.push('urgent');
    
    details.tags = tags;
    
    return details;
  }

  /**
   * Create task in Supabase
   */
  async createTask(taskDetails) {
    try {
      const task = {
        title: taskDetails.title || 'New Task',
        description: taskDetails.description || '',
        priority: taskDetails.priority || 'medium',
        status: 'pending',
        due_date: taskDetails.dueDate,
        tags: taskDetails.tags || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('tasks')
        .insert([task])
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info(`Task created: ${task.title}`);
      return data;
    } catch (error) {
      logger.error('Failed to create task:', error);
      throw error;
    }
  }

  /**
   * Handle draft generation requests
   */
  async handleDraftGeneration(query, context) {
    try {
      // Extract draft details from query
      const draftDetails = this.extractDraftDetails(query);
      
      // Generate draft content using AI
      const draftContent = await this.generateDraftContent(draftDetails);
      
      // Create draft in Supabase
      const draft = await this.createDraft({
        ...draftDetails,
        content: draftContent
      });
      
      // Generate AI response
      const response = await this.generateDraftResponse(query, draft);
      
      return {
        type: 'draft_generation',
        query: query,
        draft: draft,
        response: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Draft generation failed:', error);
      throw error;
    }
  }

  /**
   * Extract draft details from natural language
   */
  extractDraftDetails(query) {
    const details = {};
    const lowerQuery = query.toLowerCase();
    
    // Extract subject
    if (lowerQuery.includes('about')) {
      const aboutIndex = lowerQuery.indexOf('about');
      details.subject = query.substring(aboutIndex + 6).trim();
    }
    
    // Extract recipients
    if (lowerQuery.includes('to')) {
      const toIndex = lowerQuery.indexOf('to');
      const toEnd = lowerQuery.indexOf(' ', toIndex + 3);
      if (toEnd > -1) {
        details.recipients = [query.substring(toIndex + 3, toEnd).trim()];
      }
    }
    
    // Extract tone
    if (lowerQuery.includes('formal')) details.tone = 'formal';
    else if (lowerQuery.includes('casual')) details.tone = 'casual';
    else if (lowerQuery.includes('professional')) details.tone = 'professional';
    else details.tone = 'professional';
    
    return details;
  }

  /**
   * Generate draft content using AI
   */
  async generateDraftContent(draftDetails) {
    try {
      const prompt = `
        Please write a professional email draft with the following details:
        Subject: ${draftDetails.subject || 'Email Draft'}
        Recipients: ${draftDetails.recipients?.join(', ') || 'Recipient'}
        Tone: ${draftDetails.tone || 'professional'}
        
        The email should be:
        - Professional and well-written
        - Appropriate for the subject matter
        - Clear and concise
        - Ready to send (but can be edited)
        
        Please provide just the email content without any additional formatting.
      `;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional email writer. Write clear, concise, and professional email drafts.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.7
      });

      return completion.choices[0].message.content;
    } catch (error) {
      logger.error('Failed to generate draft content:', error);
      return `Subject: ${draftDetails.subject}\n\nDear ${draftDetails.recipients?.[0] || 'Recipient'},\n\n[Your email content here]\n\nBest regards,\n[Your name]`;
    }
  }

  /**
   * Create draft in Supabase
   */
  async createDraft(draftDetails) {
    try {
      const draft = {
        subject: draftDetails.subject || 'Email Draft',
        content: draftDetails.content || '',
        recipients: draftDetails.recipients || [],
        cc: draftDetails.cc || [],
        bcc: draftDetails.bcc || [],
        priority: draftDetails.priority || 'medium',
        tags: draftDetails.tags || [],
        status: 'draft',
        synced_to_apple_mail: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('drafts')
        .insert([draft])
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info(`Draft created: ${draft.subject}`);
      return data;
    } catch (error) {
      logger.error('Failed to create draft:', error);
      throw error;
    }
  }

  /**
   * Handle general questions
   */
  async handleGeneralQuestion(query, context) {
    try {
      // Generate AI response for general questions
      const response = await this.generateGeneralResponse(query, context);
      
      return {
        type: 'general_question',
        query: query,
        response: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('General question handling failed:', error);
      throw error;
    }
  }

  /**
   * Generate general AI response
   */
  async generateGeneralResponse(query, context) {
    try {
      const prompt = `
        User Question: "${query}"
        
        You are a helpful email management assistant. Please provide a helpful and informative response.
        If the question is about email management, tasks, or productivity, provide specific guidance.
        Keep responses conversational and actionable.
      `;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful email management assistant that provides clear, actionable advice.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 400,
        temperature: 0.7
      });

      return completion.choices[0].message.content;
    } catch (error) {
      logger.error('Failed to generate general response:', error);
      return "I'm here to help with your email management needs. How can I assist you today?";
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      openaiModel: this.model,
      supabaseConnected: !!this.supabase
    };
  }
}

module.exports = AIChatBotService;
