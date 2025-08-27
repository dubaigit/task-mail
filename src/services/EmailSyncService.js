const AppleMailService = require('./AppleMailService');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

/**
 * Email Synchronization Service
 * Syncs emails from Apple Mail to Supabase
 * Handles email processing, classification, and task generation
 */
class EmailSyncService {
  constructor() {
    this.appleMailService = new AppleMailService();
    this.supabase = null;
    this.isInitialized = false;
    this.syncInProgress = false;
    this.lastFullSync = null;
    this.syncInterval = 60000; // 1 minute
    this.syncTimer = null;
    
    // Initialize Supabase client
    this.initializeSupabase();
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
      logger.info('Supabase client initialized');
    } catch (error) {
      logger.error('Failed to initialize Supabase client:', error);
    }
  }

  /**
   * Initialize the sync service
   */
  async initialize() {
    try {
      // Initialize Apple Mail service
      const appleMailInitialized = await this.appleMailService.initialize();
      if (!appleMailInitialized) {
        throw new Error('Failed to initialize Apple Mail service');
      }

      // Test Supabase connection
      const { data, error } = await this.supabase
        .from('emails')
        .select('count')
        .limit(1);

      if (error) {
        throw new Error(`Supabase connection test failed: ${error.message}`);
      }

      this.isInitialized = true;
      logger.info('Email sync service initialized successfully');
      
      // Start periodic sync
      this.startPeriodicSync();
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize email sync service:', error);
      return false;
    }
  }

  /**
   * Perform full synchronization
   */
  async performFullSync() {
    if (this.syncInProgress) {
      logger.warn('Sync already in progress, skipping');
      return;
    }

    this.syncInProgress = true;
    const startTime = Date.now();

    try {
      logger.info('Starting full email synchronization...');

      // Get all emails from Apple Mail
      const emails = await this.appleMailService.getAllEmails(5000, 0);
      logger.info(`Found ${emails.length} emails in Apple Mail`);

      // Process emails in batches
      const batchSize = 100;
      let processedCount = 0;
      let newEmailsCount = 0;
      let updatedEmailsCount = 0;

      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        const batchResults = await this.processEmailBatch(batch);
        
        processedCount += batch.length;
        newEmailsCount += batchResults.newEmails;
        updatedEmailsCount += batchResults.updatedEmails;

        logger.info(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(emails.length / batchSize)}`);
      }

      this.lastFullSync = new Date();
      
      const duration = Date.now() - startTime;
      logger.info(`Full sync completed in ${duration}ms. Processed: ${processedCount}, New: ${newEmailsCount}, Updated: ${updatedEmailsCount}`);

    } catch (error) {
      logger.error('Full sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Process a batch of emails
   */
  async processEmailBatch(emails) {
    let newEmails = 0;
    let updatedEmails = 0;

    for (const email of emails) {
      try {
        const result = await this.processSingleEmail(email);
        if (result.isNew) {
          newEmails++;
        } else if (result.isUpdated) {
          updatedEmails++;
        }
      } catch (error) {
        logger.error(`Failed to process email ${email.messageId}:`, error);
      }
    }

    return { newEmails, updatedEmails };
  }

  /**
   * Process a single email
   */
  async processSingleEmail(email) {
    try {
      // Check if email already exists in Supabase
      const { data: existingEmail, error: fetchError } = await this.supabase
        .from('emails')
        .select('*')
        .eq('message_id', email.messageId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      const emailData = {
        message_id: email.messageId,
        sender: email.sender,
        subject: email.subject,
        snippet: email.snippet,
        date_received: email.dateReceived,
        date_sent: email.dateSent,
        read_status: email.readStatus,
        flag_status: email.flagStatus,
        mailbox_id: email.mailboxId,
        conversation_id: email.conversationId,
        size: email.size,
        has_attachments: email.hasAttachments,
        source: email.source,
        last_synced: new Date().toISOString()
      };

      if (!existingEmail) {
        // Insert new email
        const { error: insertError } = await this.supabase
          .from('emails')
          .insert([emailData]);

        if (insertError) {
          throw insertError;
        }

        // Generate AI analysis for new emails
        await this.generateEmailAnalysis(emailData);
        
        // Generate tasks if applicable
        await this.generateTasksFromEmail(emailData);

        return { isNew: true, isUpdated: false };
      } else {
        // Check if email needs updating
        const needsUpdate = this.emailNeedsUpdate(existingEmail, emailData);
        
        if (needsUpdate) {
          const { error: updateError } = await this.supabase
            .from('emails')
            .update(emailData)
            .eq('message_id', email.messageId);

          if (updateError) {
            throw updateError;
          }

          return { isNew: false, isUpdated: true };
        }

        return { isNew: false, isUpdated: false };
      }
    } catch (error) {
      logger.error(`Failed to process email ${email.messageId}:`, error);
      throw error;
    }
  }

  /**
   * Check if email needs updating
   */
  emailNeedsUpdate(existingEmail, newEmailData) {
    const fieldsToCheck = [
      'read_status',
      'flag_status',
      'subject',
      'snippet',
      'has_attachments'
    ];

    return fieldsToCheck.some(field => 
      existingEmail[field] !== newEmailData[field]
    );
  }

  /**
   * Generate AI analysis for email
   */
  async generateEmailAnalysis(emailData) {
    try {
      // This would integrate with the AI service for email classification
      // For now, create basic analysis
      const analysis = {
        email_id: emailData.message_id,
        classification: this.classifyEmail(emailData),
        priority: this.assessPriority(emailData),
        sentiment: this.assessSentiment(emailData),
        action_required: this.determineActionRequired(emailData),
        created_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('email_analysis')
        .insert([analysis]);

      if (error) {
        logger.error('Failed to insert email analysis:', error);
      }
    } catch (error) {
      logger.error('Failed to generate email analysis:', error);
    }
  }

  /**
   * Basic email classification
   */
  classifyEmail(emailData) {
    const subject = emailData.subject?.toLowerCase() || '';
    const sender = emailData.sender?.toLowerCase() || '';

    if (subject.includes('urgent') || subject.includes('asap')) {
      return 'urgent';
    }
    
    if (subject.includes('meeting') || subject.includes('call')) {
      return 'meeting';
    }
    
    if (subject.includes('invoice') || subject.includes('payment')) {
      return 'financial';
    }
    
    if (sender.includes('noreply') || sender.includes('donotreply')) {
      return 'notification';
    }
    
    return 'general';
  }

  /**
   * Assess email priority
   */
  assessPriority(emailData) {
    const classification = this.classifyEmail(emailData);
    
    switch (classification) {
      case 'urgent':
        return 'high';
      case 'meeting':
      case 'financial':
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Assess email sentiment
   */
  assessSentiment(emailData) {
    const subject = emailData.subject?.toLowerCase() || '';
    const snippet = emailData.snippet?.toLowerCase() || '';
    
    const positiveWords = ['thank', 'great', 'excellent', 'good', 'happy', 'pleased'];
    const negativeWords = ['urgent', 'problem', 'issue', 'complaint', 'unhappy', 'disappointed'];
    
    const text = `${subject} ${snippet}`;
    
    const positiveCount = positiveWords.filter(word => text.includes(word)).length;
    const negativeCount = negativeWords.filter(word => text.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Determine if action is required
   */
  determineActionRequired(emailData) {
    const classification = this.classifyEmail(emailData);
    const subject = emailData.subject?.toLowerCase() || '';
    
    if (classification === 'urgent' || classification === 'meeting') {
      return true;
    }
    
    if (subject.includes('action') || subject.includes('required') || subject.includes('please')) {
      return true;
    }
    
    return false;
  }

  /**
   * Generate tasks from email
   */
  async generateTasksFromEmail(emailData) {
    try {
      const analysis = await this.supabase
        .from('email_analysis')
        .select('*')
        .eq('email_id', emailData.message_id)
        .single();

      if (!analysis.data || !analysis.data.action_required) {
        return;
      }

      const taskData = {
        title: `Follow up: ${emailData.subject}`,
        description: `Email from ${emailData.sender}: ${emailData.snippet}`,
        priority: analysis.data.priority,
        status: 'pending',
        email_id: emailData.message_id,
        due_date: this.calculateDueDate(analysis.data.priority),
        tags: [analysis.data.classification],
        created_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('tasks')
        .insert([taskData]);

      if (error) {
        logger.error('Failed to create task from email:', error);
      } else {
        logger.info(`Created task from email: ${emailData.messageId}`);
      }
    } catch (error) {
      logger.error('Failed to generate task from email:', error);
    }
  }

  /**
   * Calculate due date based on priority
   */
  calculateDueDate(priority) {
    const now = new Date();
    
    switch (priority) {
      case 'high':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 1 day
      case 'medium':
        return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days
      case 'low':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 1 week
      default:
        return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days
    }
  }

  /**
   * Start periodic synchronization
   */
  startPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(async () => {
      try {
        await this.performFullSync();
      } catch (error) {
        logger.error('Periodic sync failed:', error);
      }
    }, this.syncInterval);

    logger.info('Periodic email sync started');
  }

  /**
   * Stop periodic synchronization
   */
  stopPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      logger.info('Periodic email sync stopped');
    }
  }

  /**
   * Get sync service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      syncInProgress: this.syncInProgress,
      lastFullSync: this.lastFullSync,
      syncInterval: this.syncInterval,
      isPeriodicSyncActive: !!this.syncTimer,
      appleMailStatus: this.appleMailService.getStatus()
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.stopPeriodicSync();
    await this.appleMailService.cleanup();
    logger.info('Email sync service cleaned up');
  }
}

module.exports = EmailSyncService;
