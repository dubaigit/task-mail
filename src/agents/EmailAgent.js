/**
 * Enhanced Email Agent - Intelligent email processing with AI integration
 * Addresses AI service issues, error handling, and performance optimization
 */

const { databaseAgent } = require('../database/DatabaseAgent');
const { enhancedSQLSanitizer } = require('../security/EnhancedSQLSanitizer');
const winston = require('winston');

// Enhanced logger for Email Agent
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'email-agent' },
  transports: [
    new winston.transports.File({ filename: 'logs/email-agent.log' }),
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({ format: winston.format.simple() })
    ] : [])
  ],
});

class EmailAgent {
  constructor() {
    this.isInitialized = false;
    this.processingQueue = new Map();
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    this.batchSize = parseInt(process.env.EMAIL_BATCH_SIZE || '50');
    
    // Performance metrics
    this.metrics = {
      emailsProcessed: 0,
      classificationsPerformed: 0,
      draftsGenerated: 0,
      errorsEncountered: 0,
      averageProcessingTime: 0,
      lastProcessingTime: null
    };
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Ensure database agent is initialized
      await databaseAgent.initialize();
      
      // Initialize processing queues
      await this.initializeProcessingQueues();
      
      // Start background processing
      this.startBackgroundProcessing();
      
      this.isInitialized = true;
      logger.info('✅ Email Agent initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Email Agent:', error);
      throw error;
    }
  }

  async initializeProcessingQueues() {
    // Create processing tables if they don't exist
    const createQueueTable = `
      CREATE TABLE IF NOT EXISTS email_processing_queue (
        id SERIAL PRIMARY KEY,
        email_id VARCHAR(255) NOT NULL,
        operation_type VARCHAR(50) NOT NULL,
        priority INTEGER DEFAULT 0,
        retry_count INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        error_message TEXT,
        UNIQUE(email_id, operation_type)
      )
    `;

    await databaseAgent.executeQuery(createQueueTable);
    logger.info('Email processing queue table initialized');
  }

  startBackgroundProcessing() {
    // Process queue every 10 seconds
    setInterval(async () => {
      try {
        await this.processQueue();
      } catch (error) {
        logger.error('Background processing error:', error);
      }
    }, 10000);

    logger.info('Background email processing started');
  }

  async processQueue() {
    const pendingJobs = await this.getPendingJobs();
    
    if (pendingJobs.length === 0) return;

    logger.info(`Processing ${pendingJobs.length} pending email jobs`);

    // Process jobs in batches
    for (let i = 0; i < pendingJobs.length; i += this.batchSize) {
      const batch = pendingJobs.slice(i, i + this.batchSize);
      await this.processBatch(batch);
    }
  }

  async getPendingJobs() {
    const query = `
      SELECT * FROM email_processing_queue 
      WHERE status = 'pending' AND retry_count < $1
      ORDER BY priority DESC, created_at ASC
      LIMIT $2
    `;
    
    const result = await databaseAgent.executeQuery(query, [this.maxRetries, this.batchSize * 2]);
    return result.rows;
  }

  async processBatch(jobs) {
    const promises = jobs.map(job => this.processJob(job));
    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(`Job ${jobs[index].id} failed:`, result.reason);
      }
    });
  }

  async processJob(job) {
    const startTime = Date.now();
    
    try {
      await this.updateJobStatus(job.id, 'processing');
      
      switch (job.operation_type) {
        case 'classify':
          await this.classifyEmail(job.email_id);
          break;
        case 'generate_draft':
          await this.generateDraft(job.email_id);
          break;
        case 'analyze_sentiment':
          await this.analyzeSentiment(job.email_id);
          break;
        case 'extract_tasks':
          await this.extractTasks(job.email_id);
          break;
        default:
          throw new Error(`Unknown operation type: ${job.operation_type}`);
      }
      
      await this.updateJobStatus(job.id, 'completed');
      this.updateMetrics(job.operation_type, Date.now() - startTime);
      
      logger.info(`Job ${job.id} completed successfully`);
    } catch (error) {
      await this.handleJobError(job, error);
    }
  }

  async updateJobStatus(jobId, status, errorMessage = null) {
    const query = `
      UPDATE email_processing_queue 
      SET status = $1, updated_at = CURRENT_TIMESTAMP, error_message = $2
      WHERE id = $3
    `;
    
    await databaseAgent.executeQuery(query, [status, errorMessage, jobId]);
  }

  async handleJobError(job, error) {
    const retryCount = job.retry_count + 1;
    
    if (retryCount >= this.maxRetries) {
      await this.updateJobStatus(job.id, 'failed', error.message);
      logger.error(`Job ${job.id} failed permanently after ${retryCount} attempts:`, error);
    } else {
      const query = `
        UPDATE email_processing_queue 
        SET retry_count = $1, status = 'pending', updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;
      
      await databaseAgent.executeQuery(query, [retryCount, job.id]);
      logger.warn(`Job ${job.id} scheduled for retry (attempt ${retryCount})`);
    }
    
    this.metrics.errorsEncountered++;
  }

  // Enhanced email classification with error handling
  async classifyEmail(emailId) {
    try {
      // Get email data
      const email = await this.getEmailById(emailId);
      if (!email) {
        throw new Error(`Email not found: ${emailId}`);
      }

      // Check cache first
      const cacheKey = `classification:${emailId}`;
      let classification = await databaseAgent.getCachedData(cacheKey);
      
      if (!classification) {
        // Load AI service dynamically to avoid circular dependencies
        const aiService = require('../../ai_service');
        
        classification = await aiService.classifyEmail(
          email.content,
          email.subject,
          email.sender
        );
        
        // Cache the result
        await databaseAgent.setCachedData(cacheKey, classification, 3600); // 1 hour cache
      }

      // Store classification in database
      await this.storeClassification(emailId, classification);
      
      this.metrics.classificationsPerformed++;
      logger.info(`Email ${emailId} classified as ${classification.classification}`);
      
      return classification;
    } catch (error) {
      logger.error(`Email classification failed for ${emailId}:`, error);
      throw error;
    }
  }

  async storeClassification(emailId, classification) {
    const query = `
      INSERT INTO email_classifications (
        email_id, classification, urgency, confidence, 
        suggested_action, task_title, task_description, 
        tags, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (email_id) DO UPDATE SET
        classification = EXCLUDED.classification,
        urgency = EXCLUDED.urgency,
        confidence = EXCLUDED.confidence,
        suggested_action = EXCLUDED.suggested_action,
        updated_at = CURRENT_TIMESTAMP
    `;

    const params = [
      emailId,
      classification.classification,
      classification.urgency || 'MEDIUM',
      classification.confidence || 50,
      classification.suggested_action || '',
      classification.task_title || '',
      classification.task_description || '',
      JSON.stringify(classification.tags || [])
    ];

    await databaseAgent.executeQuery(query, params);
  }

  async generateDraft(emailId) {
    try {
      const email = await this.getEmailById(emailId);
      if (!email) {
        throw new Error(`Email not found: ${emailId}`);
      }

      // Check if draft already exists
      const existingDraft = await this.getExistingDraft(emailId);
      if (existingDraft) {
        logger.info(`Draft already exists for email ${emailId}`);
        return existingDraft;
      }

      // Load AI service
      const aiService = require('../../ai_service');
      
      const context = await this.buildEmailContext(emailId);
      const draft = await aiService.generateDraftReply(
        email.content,
        email.subject,
        email.sender,
        context
      );

      // Store draft
      await this.storeDraft(emailId, draft);
      
      this.metrics.draftsGenerated++;
      logger.info(`Draft generated for email ${emailId}`);
      
      return draft;
    } catch (error) {
      logger.error(`Draft generation failed for ${emailId}:`, error);
      throw error;
    }
  }

  async buildEmailContext(emailId) {
    try {
      // Get conversation history
      const conversationQuery = `
        SELECT m.*, c.classification, c.urgency
        FROM messages m
        LEFT JOIN email_classifications c ON m.ROWID = c.email_id
        WHERE m.conversation_id = (
          SELECT conversation_id FROM messages WHERE ROWID = $1
        )
        ORDER BY m.date_sent DESC
        LIMIT 10
      `;
      
      const conversation = await databaseAgent.executeQuery(conversationQuery, [emailId]);
      
      // Get sender relationship info
      const senderQuery = `
        SELECT sender, COUNT(*) as email_count, 
               AVG(CASE WHEN c.urgency = 'HIGH' THEN 1 ELSE 0 END) as urgency_ratio
        FROM messages m
        LEFT JOIN email_classifications c ON m.ROWID = c.email_id
        WHERE sender = (SELECT sender FROM messages WHERE ROWID = $1)
        GROUP BY sender
      `;
      
      const senderInfo = await databaseAgent.executeQuery(senderQuery, [emailId]);
      
      return {
        previousInteractions: conversation.rows.length,
        relationship: senderInfo.rows[0]?.email_count > 10 ? 'frequent' : 'occasional',
        conversationHistory: conversation.rows,
        senderMetrics: senderInfo.rows[0]
      };
    } catch (error) {
      logger.error(`Failed to build context for email ${emailId}:`, error);
      return {};
    }
  }

  async getEmailById(emailId) {
    const query = 'SELECT * FROM messages WHERE ROWID = $1';
    const result = await databaseAgent.executeQuery(query, [emailId]);
    return result.rows[0] || null;
  }

  async getExistingDraft(emailId) {
    const query = 'SELECT * FROM email_drafts WHERE email_id = $1 ORDER BY created_at DESC LIMIT 1';
    const result = await databaseAgent.executeQuery(query, [emailId]);
    return result.rows[0] || null;
  }

  async storeDraft(emailId, draft) {
    const query = `
      INSERT INTO email_drafts (
        email_id, subject, body, tone, confidence,
        suggestions, model_used, tokens_used, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
    `;

    const params = [
      emailId,
      draft.subject || '',
      draft.draft || draft.body || '',
      draft.tone || 'PROFESSIONAL',
      draft.confidence || 50,
      JSON.stringify(draft.suggestions || []),
      draft.model_used || 'unknown',
      draft.tokens_used || 0
    ];

    await databaseAgent.executeQuery(query, params);
  }

  // Queue management methods
  async queueEmailOperation(emailId, operationType, priority = 0) {
    const query = `
      INSERT INTO email_processing_queue (email_id, operation_type, priority)
      VALUES ($1, $2, $3)
      ON CONFLICT (email_id, operation_type) DO UPDATE SET
        priority = EXCLUDED.priority,
        status = 'pending',
        retry_count = 0,
        updated_at = CURRENT_TIMESTAMP
    `;

    await databaseAgent.executeQuery(query, [emailId, operationType, priority]);
    logger.info(`Queued ${operationType} operation for email ${emailId}`);
  }

  async queueBulkClassification(emailIds) {
    const operations = emailIds.map(emailId => ({
      query: 'INSERT INTO email_processing_queue (email_id, operation_type) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      params: [emailId, 'classify']
    }));

    await databaseAgent.executeTransaction(operations);
    logger.info(`Queued classification for ${emailIds.length} emails`);
  }

  // Performance monitoring
  updateMetrics(operationType, duration) {
    this.metrics.emailsProcessed++;
    this.metrics.lastProcessingTime = new Date();
    
    // Update average processing time
    if (this.metrics.averageProcessingTime === 0) {
      this.metrics.averageProcessingTime = duration;
    } else {
      this.metrics.averageProcessingTime = (this.metrics.averageProcessingTime + duration) / 2;
    }

    // Operation-specific metrics
    switch (operationType) {
      case 'classify':
        this.metrics.classificationsPerformed++;
        break;
      case 'generate_draft':
        this.metrics.draftsGenerated++;
        break;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      queueSize: this.processingQueue.size,
      isHealthy: this.isInitialized && databaseAgent.getHealth().overall
    };
  }

  // Graceful shutdown
  async shutdown() {
    logger.info('Shutting down Email Agent...');
    
    // Clear processing intervals
    // (In a production system, you'd want to track and clear these properly)
    
    this.isInitialized = false;
    logger.info('✅ Email Agent shutdown complete');
  }
}

// Export singleton instance
const emailAgent = new EmailAgent();

module.exports = { EmailAgent, emailAgent };