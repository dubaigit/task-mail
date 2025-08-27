const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');
const path = require('path');

/**
 * Draft Synchronization Service
 * Syncs drafts from Supabase back to Apple Mail using AppleScript
 * Mac-only functionality
 */
class DraftSyncService {
  constructor() {
    this.supabase = null;
    this.isInitialized = false;
    this.syncInProgress = false;
    this.lastSyncTime = null;
    this.syncInterval = 30000; // 30 seconds
    this.syncTimer = null;
    this.isMac = process.platform === 'darwin';
    
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
      logger.info('Supabase client initialized for draft sync');
    } catch (error) {
      logger.error('Failed to initialize Supabase client for draft sync:', error);
    }
  }

  /**
   * Initialize the draft sync service
   */
  async initialize() {
    try {
      if (!this.isMac) {
        logger.warn('Draft sync service is Mac-only. Skipping initialization.');
        return false;
      }

      // Test Supabase connection
      const { data, error } = await this.supabase
        .from('drafts')
        .select('count')
        .limit(1);

      if (error) {
        throw new Error(`Supabase connection test failed: ${error.message}`);
      }

      this.isInitialized = true;
      logger.info('Draft sync service initialized successfully');
      
      // Start periodic sync
      this.startPeriodicSync();
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize draft sync service:', error);
      return false;
    }
  }

  /**
   * Create a draft in Apple Mail using AppleScript
   */
  async createDraftInAppleMail(draftData) {
    if (!this.isMac) {
      throw new Error('Draft creation is only supported on macOS');
    }

    return new Promise((resolve, reject) => {
      const { subject, content, recipients, cc, bcc, attachments } = draftData;
      
      // Sanitize content for AppleScript
      const sanitizedContent = this.sanitizeForAppleScript(content);
      const sanitizedSubject = this.sanitizeForAppleScript(subject);
      
      // Build AppleScript
      let script = `
        tell application "Mail"
          set newMessage to make new outgoing message with properties {subject:"${sanitizedSubject}", content:"${sanitizedContent}"}
          tell newMessage
      `;

      // Add recipients
      if (recipients && recipients.length > 0) {
        recipients.forEach(recipient => {
          const sanitizedRecipient = this.sanitizeForAppleScript(recipient);
          script += `
            make new to recipient at end of to recipients with properties {address:"${sanitizedRecipient}"}
          `;
        });
      }

      // Add CC recipients
      if (cc && cc.length > 0) {
        cc.forEach(ccRecipient => {
          const sanitizedCC = this.sanitizeForAppleScript(ccRecipient);
          script += `
            make new cc recipient at end of cc recipients with properties {address:"${sanitizedCC}"}
          `;
        });
      }

      // Add BCC recipients
      if (bcc && bcc.length > 0) {
        bcc.forEach(bccRecipient => {
          const sanitizedBCC = this.sanitizeForAppleScript(bccRecipient);
          script += `
            make new bcc recipient at end of bcc recipients with properties {address:"${sanitizedBCC}"}
          `;
        });
      }

      // Complete the script
      script += `
          end tell
          save newMessage
          return id of newMessage
        end tell
      `;

      // Execute AppleScript
      exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
        if (error) {
          logger.error('AppleScript execution failed:', error);
          reject(error);
          return;
        }

        if (stderr) {
          logger.warn('AppleScript warnings:', stderr);
        }

        const messageId = stdout.trim();
        logger.info(`Draft created in Apple Mail with ID: ${messageId}`);
        resolve(messageId);
      });
    });
  }

  /**
   * Sanitize text for AppleScript
   */
  sanitizeForAppleScript(text) {
    if (!text) return '';
    
    return text
      .replace(/"/g, '\\"')  // Escape quotes
      .replace(/\n/g, '\\n') // Handle newlines
      .replace(/\r/g, '\\r') // Handle carriage returns
      .replace(/\t/g, '\\t'); // Handle tabs
  }

  /**
   * Sync drafts from Supabase to Apple Mail
   */
  async syncDraftsToAppleMail() {
    if (this.syncInProgress) {
      logger.warn('Draft sync already in progress, skipping');
      return;
    }

    this.syncInProgress = true;
    const startTime = Date.now();

    try {
      logger.info('Starting draft synchronization to Apple Mail...');

      // Get unsynced drafts from Supabase
      const { data: drafts, error } = await this.supabase
        .from('drafts')
        .select('*')
        .eq('synced_to_apple_mail', false)
        .eq('status', 'ready')
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      if (!drafts || drafts.length === 0) {
        logger.info('No unsynced drafts found');
        return;
      }

      logger.info(`Found ${drafts.length} unsynced drafts to sync`);

      let successCount = 0;
      let failureCount = 0;

      for (const draft of drafts) {
        try {
          // Create draft in Apple Mail
          const appleMailId = await this.createDraftInAppleMail({
            subject: draft.subject,
            content: draft.content,
            recipients: draft.recipients || [],
            cc: draft.cc || [],
            bcc: draft.bcc || [],
            attachments: draft.attachments || []
          });

          // Update draft status in Supabase
          const { error: updateError } = await this.supabase
            .from('drafts')
            .update({
              synced_to_apple_mail: true,
              apple_mail_id: appleMailId,
              synced_at: new Date().toISOString(),
              status: 'synced'
            })
            .eq('id', draft.id);

          if (updateError) {
            logger.error(`Failed to update draft ${draft.id}:`, updateError);
            failureCount++;
          } else {
            successCount++;
            logger.info(`Successfully synced draft: ${draft.subject}`);
          }

        } catch (draftError) {
          logger.error(`Failed to sync draft ${draft.id}:`, draftError);
          failureCount++;

          // Mark draft as failed
          await this.supabase
            .from('drafts')
            .update({
              sync_error: draftError.message,
              last_sync_attempt: new Date().toISOString(),
              status: 'sync_failed'
            })
            .eq('id', draft.id);
        }
      }

      this.lastSyncTime = new Date();
      
      const duration = Date.now() - startTime;
      logger.info(`Draft sync completed in ${duration}ms. Success: ${successCount}, Failed: ${failureCount}`);

    } catch (error) {
      logger.error('Draft sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Create a new draft in Supabase
   */
  async createDraft(draftData) {
    try {
      const { subject, content, recipients, cc, bcc, attachments, priority, tags } = draftData;
      
      const draft = {
        subject,
        content,
        recipients: recipients || [],
        cc: cc || [],
        bcc: bcc || [],
        attachments: attachments || [],
        priority: priority || 'medium',
        tags: tags || [],
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

      logger.info(`Draft created: ${subject}`);
      return data;

    } catch (error) {
      logger.error('Failed to create draft:', error);
      throw error;
    }
  }

  /**
   * Update an existing draft
   */
  async updateDraft(draftId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('drafts')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
          synced_to_apple_mail: false, // Mark as needing resync
          status: 'draft'
        })
        .eq('id', draftId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info(`Draft updated: ${data.subject}`);
      return data;

    } catch (error) {
      logger.error('Failed to update draft:', error);
      throw error;
    }
  }

  /**
   * Delete a draft
   */
  async deleteDraft(draftId) {
    try {
      // If draft was synced to Apple Mail, we should also delete it there
      const { data: draft } = await this.supabase
        .from('drafts')
        .select('apple_mail_id, synced_to_apple_mail')
        .eq('id', draftId)
        .single();

      if (draft && draft.synced_to_apple_mail && draft.apple_mail_id) {
        await this.deleteDraftFromAppleMail(draft.apple_mail_id);
      }

      const { error } = await this.supabase
        .from('drafts')
        .delete()
        .eq('id', draftId);

      if (error) {
        throw error;
      }

      logger.info(`Draft deleted: ${draftId}`);
      return true;

    } catch (error) {
      logger.error('Failed to delete draft:', error);
      throw error;
    }
  }

  /**
   * Delete draft from Apple Mail
   */
  async deleteDraftFromAppleMail(appleMailId) {
    if (!this.isMac) {
      logger.warn('Cannot delete from Apple Mail on non-Mac platform');
      return;
    }

    return new Promise((resolve, reject) => {
      const script = `
        tell application "Mail"
          set messageToDelete to first message of drafts mailbox whose id is "${appleMailId}"
          delete messageToDelete
        end tell
      `;

      exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
        if (error) {
          logger.error('Failed to delete draft from Apple Mail:', error);
          reject(error);
          return;
        }

        logger.info(`Draft deleted from Apple Mail: ${appleMailId}`);
        resolve();
      });
    });
  }

  /**
   * Get all drafts from Supabase
   */
  async getDrafts(filters = {}) {
    try {
      let query = this.supabase
        .from('drafts')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }

      if (filters.synced) {
        query = query.eq('synced_to_apple_mail', filters.synced);
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];

    } catch (error) {
      logger.error('Failed to get drafts:', error);
      throw error;
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
        await this.syncDraftsToAppleMail();
      } catch (error) {
        logger.error('Periodic draft sync failed:', error);
      }
    }, this.syncInterval);

    logger.info('Periodic draft sync started');
  }

  /**
   * Stop periodic synchronization
   */
  stopPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      logger.info('Periodic draft sync stopped');
    }
  }

  /**
   * Get draft sync service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isMac: this.isMac,
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      syncInterval: this.syncInterval,
      isPeriodicSyncActive: !!this.syncTimer
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.stopPeriodicSync();
    logger.info('Draft sync service cleaned up');
  }
}

module.exports = DraftSyncService;
