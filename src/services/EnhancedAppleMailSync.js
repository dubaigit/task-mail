/**
 * Enhanced Apple Mail to Supabase Sync Service
 * 
 * Complete implementation matching CLAUDE.md requirements:
 * - Full email field support (to/cc/bcc/attachments)
 * - Read-only Apple Mail SQLite access
 * - Smart incremental sync with conflict resolution
 * - All state persisted to Supabase
 */

const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const os = require('os');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');
const EventEmitter = require('events');

class EnhancedAppleMailSync extends EventEmitter {
  constructor() {
    super();
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ 
          filename: 'logs/apple-mail-sync.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });

    // Apple Mail database path (configurable via environment, default to fake DB in repo for dev)
    this.appleMailDbPath = process.env.APPLE_MAIL_DB_PATH || path.join(
      process.cwd(),
      'database/fake-apple-mail/fake-envelope-index.sqlite'
    );

    // Sync configuration
    this.config = {
      pollInterval: 5000, // 5 seconds
      batchSize: 100,
      maxRetries: 3,
      retryDelay: 1000
    };

    this.isRunning = false;
    this.lastSyncedRowId = 0;
    this.db = null;
    this.supabase = null;
    this.syncStats = {
      totalSynced: 0,
      totalFailed: 0,
      lastSyncTime: null
    };
  }

  /**
   * Initialize the sync service
   */
  async initialize() {
    try {
      // Initialize Supabase client
      const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

      if (!supabaseKey) {
        throw new Error('Supabase credentials not configured');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.logger.info('✅ Supabase client initialized');

      // Open Apple Mail SQLite database (read-only)
      this.db = await open({
        filename: this.appleMailDbPath,
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READONLY
      });

      this.logger.info('✅ Connected to Apple Mail SQLite database');

      // Get last synced position from Supabase
      await this.loadSyncPosition();

      // Initialize database schema if needed
      await this.ensureSchema();

      this.emit('initialized');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize sync service:', error);
      throw error;
    }
  }

  /**
   * Load last sync position from Supabase
   */
  async loadSyncPosition() {
    try {
      const { data, error } = await this.supabase
        .from('sync_metadata')
        .select('last_rowid, last_sync_at')
        .eq('sync_type', 'apple_mail')
        .single();

      if (data) {
        this.lastSyncedRowId = data.last_rowid || 0;
        this.logger.info(`Resuming sync from ROWID: ${this.lastSyncedRowId}`);
      } else {
        // First sync
        await this.supabase
          .from('sync_metadata')
          .insert({
            sync_type: 'apple_mail',
            last_rowid: 0,
            sync_status: 'idle'
          });
      }
    } catch (error) {
      this.logger.warn('Could not load sync position, starting from beginning');
      this.lastSyncedRowId = 0;
    }
  }

  /**
   * Ensure required tables exist in Supabase
   */
  async ensureSchema() {
    // Schema is managed by migrations, just verify tables exist
    const tables = ['emails', 'sync_metadata', 'sync_logs'];
    for (const table of tables) {
      const { error } = await this.supabase.from(table).select('id').limit(1);
      if (error && error.code === '42P01') {
        throw new Error(`Required table '${table}' does not exist in Supabase`);
      }
    }
  }

  /**
   * Fetch complete email data with all fields
   */
  async fetchCompleteEmail(messageRowId) {
    try {
      // Get main message data
      const message = await this.db.get(`
        SELECT 
          m.ROWID,
          m.message_id,
          m.global_message_id,
          m.subject as subject_id,
          m.sender as sender_id,
          m.date_sent,
          m.date_received,
          m.date_last_viewed,
          m.mailbox as mailbox_id,
          m.remote_mailbox,
          m.flags,
          m.read,
          m.flagged,
          m.deleted,
          m.size,
          m.conversation_id,
          m.color,
          m.flag_color,
          s.subject as subject_text,
          sender_addr.address as sender_address,
          sender_addr.comment as sender_name,
          mb.url as mailbox_url,
          mb.name as mailbox_name
        FROM messages m
        LEFT JOIN subjects s ON m.subject = s.ROWID
        LEFT JOIN addresses sender_addr ON m.sender = sender_addr.ROWID
        LEFT JOIN mailboxes mb ON m.mailbox = mb.ROWID
        WHERE m.ROWID = ?
      `, messageRowId);

      if (!message) return null;

      // Get all recipients with types (0=to, 1=cc, 2=bcc)
      const recipients = await this.db.all(`
        SELECT 
          r.type,
          r.position,
          a.address,
          a.comment as name
        FROM recipients r
        JOIN addresses a ON r.address = a.ROWID
        WHERE r.message = ?
        ORDER BY r.type, r.position
      `, messageRowId);

      // Organize recipients by type
      const toRecipients = [];
      const ccRecipients = [];
      const bccRecipients = [];

      recipients.forEach(r => {
        const recipient = {
          address: r.address,
          name: r.name || ''
        };
        
        switch (r.type) {
          case 0: toRecipients.push(recipient); break;
          case 1: ccRecipients.push(recipient); break;
          case 2: bccRecipients.push(recipient); break;
        }
      });

      // Get attachments
      const attachments = await this.db.all(`
        SELECT 
          attachment_id,
          name as filename
        FROM attachments
        WHERE message = ?
      `, messageRowId);

      // Get message content if available
      let messageContent = null;
      try {
        const content = await this.db.get(`
          SELECT 
            data as content
          FROM message_data
          WHERE message_id = ?
          LIMIT 1
        `, message.message_id);
        
        if (content) {
          messageContent = content.content;
        }
      } catch (err) {
        // message_data table might not exist or be accessible
        this.logger.debug('Could not fetch message content:', err.message);
      }

      // Compile complete email object
      return {
        // Identifiers
        apple_mail_id: message.message_id?.toString(),
        rowid: message.ROWID,
        global_message_id: message.global_message_id,
        conversation_id: message.conversation_id,
        
        // Basic fields
        subject: message.subject_text || '',
        sender: message.sender_address || '',
        sender_name: message.sender_name || '',
        
        // Recipients
        to_recipients: toRecipients.map(r => r.address),
        cc_recipients: ccRecipients.map(r => r.address),
        bcc_recipients: bccRecipients.map(r => r.address),
        recipients: [...toRecipients, ...ccRecipients, ...bccRecipients].map(r => r.address),
        
        // Dates
        date_sent: message.date_sent ? new Date(message.date_sent * 1000).toISOString() : null,
        date_received: message.date_received ? new Date(message.date_received * 1000).toISOString() : null,
        date_last_viewed: message.date_last_viewed ? new Date(message.date_last_viewed * 1000).toISOString() : null,
        
        // Flags and status
        flags: message.flags,
        is_read: Boolean(message.read),
        is_flagged: Boolean(message.flagged),
        is_deleted: Boolean(message.deleted),
        flag_color: message.flag_color,
        
        // Mailbox
        mailbox: message.mailbox_url || message.mailbox_name || 'INBOX',
        folder_path: message.mailbox_name || 'INBOX',
        
        // Content and attachments
        message_content: messageContent,
        has_attachments: attachments.length > 0,
        attachment_count: attachments.length,
        attachments: attachments.length > 0 ? attachments : null,
        
        // Metadata
        size: message.size,
        color: message.color,
        
        // Raw data for debugging
        raw_data: {
          message,
          recipients,
          attachments
        },
        
        // Sync metadata
        synced_at: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Failed to fetch complete email ${messageRowId}:`, error);
      throw error;
    }
  }

  /**
   * Sync a batch of emails to Supabase
   */
  async syncBatch(emails) {
    const results = {
      success: 0,
      failed: 0,
      conflicts: 0
    };

    for (const email of emails) {
      try {
        // Check if email already exists
        const { data: existing } = await this.supabase
          .from('emails')
          .select('id, updated_at')
          .eq('apple_mail_id', email.apple_mail_id)
          .single();

        if (existing) {
          // Update if changed
          const { error } = await this.supabase
            .from('emails')
            .update(email)
            .eq('id', existing.id);

          if (error) throw error;
          results.conflicts++;
        } else {
          // Insert new email
          const { error } = await this.supabase
            .from('emails')
            .insert(email);

          if (error) throw error;
          results.success++;
        }

        // Update last synced ROWID
        if (email.rowid > this.lastSyncedRowId) {
          this.lastSyncedRowId = email.rowid;
        }
      } catch (error) {
        this.logger.error(`Failed to sync email ${email.apple_mail_id}:`, error);
        results.failed++;
      }
    }

    // Update sync position in Supabase
    if (results.success > 0 || results.conflicts > 0) {
      await this.updateSyncPosition();
    }

    return results;
  }

  /**
   * Update sync position in Supabase
   */
  async updateSyncPosition() {
    try {
      await this.supabase
        .from('sync_metadata')
        .update({
          last_rowid: this.lastSyncedRowId,
          last_sync_at: new Date().toISOString(),
          sync_status: 'active'
        })
        .eq('sync_type', 'apple_mail');
    } catch (error) {
      this.logger.error('Failed to update sync position:', error);
    }
  }

  /**
   * Perform incremental sync
   */
  async performIncrementalSync() {
    try {
      this.logger.info(`Starting incremental sync from ROWID ${this.lastSyncedRowId}`);

      // Get count of new messages
      const countResult = await this.db.get(
        'SELECT COUNT(*) as count FROM messages WHERE ROWID > ?',
        this.lastSyncedRowId
      );

      const totalNew = countResult.count;
      if (totalNew === 0) {
        this.logger.debug('No new messages to sync');
        return { synced: 0, failed: 0 };
      }

      this.logger.info(`Found ${totalNew} new messages to sync`);

      let synced = 0;
      let failed = 0;
      let offset = 0;

      // Process in batches
      while (offset < totalNew) {
        const messageRows = await this.db.all(`
          SELECT ROWID 
          FROM messages 
          WHERE ROWID > ? 
          ORDER BY ROWID 
          LIMIT ? OFFSET ?
        `, this.lastSyncedRowId, this.config.batchSize, offset);

        const emails = [];
        for (const row of messageRows) {
          try {
            const email = await this.fetchCompleteEmail(row.ROWID);
            if (email) {
              emails.push(email);
            }
          } catch (error) {
            this.logger.error(`Failed to fetch email ${row.ROWID}:`, error);
            failed++;
          }
        }

        if (emails.length > 0) {
          const results = await this.syncBatch(emails);
          synced += results.success + results.conflicts;
          failed += results.failed;

          this.emit('batch-synced', {
            synced: results.success,
            updated: results.conflicts,
            failed: results.failed,
            progress: Math.min(100, ((offset + emails.length) / totalNew) * 100)
          });
        }

        offset += this.config.batchSize;
      }

      // Log sync results
      await this.logSyncResult({
        type: 'incremental',
        emails_synced: synced,
        emails_failed: failed,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      });

      this.logger.info(`Incremental sync completed: ${synced} synced, ${failed} failed`);
      return { synced, failed };
    } catch (error) {
      this.logger.error('Incremental sync failed:', error);
      throw error;
    }
  }

  /**
   * Perform full sync (initial or recovery)
   */
  async performFullSync() {
    try {
      this.logger.info('Starting full sync of Apple Mail database');

      // Get total message count
      const countResult = await this.db.get('SELECT COUNT(*) as count FROM messages');
      const total = countResult.count;

      this.logger.info(`Found ${total} total messages to sync`);

      let synced = 0;
      let failed = 0;
      let offset = 0;

      // Reset to start
      this.lastSyncedRowId = 0;

      while (offset < total) {
        const messageRows = await this.db.all(`
          SELECT ROWID 
          FROM messages 
          ORDER BY ROWID 
          LIMIT ? OFFSET ?
        `, this.config.batchSize, offset);

        const emails = [];
        for (const row of messageRows) {
          try {
            const email = await this.fetchCompleteEmail(row.ROWID);
            if (email) {
              emails.push(email);
            }
          } catch (error) {
            this.logger.error(`Failed to fetch email ${row.ROWID}:`, error);
            failed++;
          }
        }

        if (emails.length > 0) {
          const results = await this.syncBatch(emails);
          synced += results.success + results.conflicts;
          failed += results.failed;

          const progress = Math.min(100, ((offset + emails.length) / total) * 100);
          this.emit('batch-synced', {
            synced: results.success,
            updated: results.conflicts,
            failed: results.failed,
            progress
          });

          this.logger.info(`Progress: ${progress.toFixed(1)}% (${synced}/${total})`);
        }

        offset += this.config.batchSize;
      }

      // Log sync results
      await this.logSyncResult({
        type: 'full',
        emails_synced: synced,
        emails_failed: failed,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      });

      this.logger.info(`Full sync completed: ${synced} synced, ${failed} failed`);
      return { synced, failed };
    } catch (error) {
      this.logger.error('Full sync failed:', error);
      throw error;
    }
  }

  /**
   * Log sync results to Supabase
   */
  async logSyncResult(result) {
    try {
      await this.supabase
        .from('sync_logs')
        .insert({
          sync_type: result.type,
          started_at: result.started_at,
          completed_at: result.completed_at,
          emails_synced: result.emails_synced,
          emails_failed: result.emails_failed
        });
    } catch (error) {
      this.logger.error('Failed to log sync result:', error);
    }
  }

  /**
   * Start the sync service
   */
  async start() {
    if (this.isRunning) {
      this.logger.warn('Sync service is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting Apple Mail sync service');

    // Perform initial sync
    await this.sync();

    // Set up polling interval
    this.syncInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.sync();
      }
    }, this.config.pollInterval);

    this.emit('started');
  }

  /**
   * Stop the sync service
   */
  async stop() {
    this.isRunning = false;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Update sync status
    await this.supabase
      .from('sync_metadata')
      .update({ sync_status: 'stopped' })
      .eq('sync_type', 'apple_mail');

    this.logger.info('Sync service stopped');
    this.emit('stopped');
  }

  /**
   * Main sync method
   */
  async sync() {
    try {
      // Check if we need full sync
      const { data: emailCount } = await this.supabase
        .from('emails')
        .select('id', { count: 'exact', head: true });

      const needsFullSync = !emailCount || emailCount.count === 0;

      if (needsFullSync) {
        this.logger.info('Performing full sync (empty database)');
        await this.performFullSync();
      } else {
        await this.performIncrementalSync();
      }

      this.syncStats.lastSyncTime = new Date();
      this.emit('sync-completed', this.syncStats);
    } catch (error) {
      this.logger.error('Sync failed:', error);
      this.emit('sync-error', error);
    }
  }

  /**
   * Get sync statistics
   */
  getStats() {
    return {
      ...this.syncStats,
      isRunning: this.isRunning,
      lastSyncedRowId: this.lastSyncedRowId
    };
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    await this.stop();
    
    if (this.db) {
      await this.db.close();
      this.db = null;
    }

    this.logger.info('Cleanup completed');
  }
}

module.exports = EnhancedAppleMailSync;
