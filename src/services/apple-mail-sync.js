/**
 * Apple Mail SQLite to Supabase Real-time Sync Service
 * 
 * Features smart sync detection that automatically chooses the optimal sync strategy:
 * 
 * - FULL SYNC: Used when Supabase emails table is empty or sync gap >= 100 emails
 *   Syncs all emails from Apple Mail database with pagination and progress tracking
 * 
 * - INCREMENTAL SYNC: Used for normal operation with small sync gaps
 *   Syncs only new emails since last sync position for optimal performance
 * 
 * The service polls Apple Mail SQLite database every 5 seconds and provides:
 * - Resilient error handling with batch-level recovery
 * - Progress tracking and detailed logging
 * - Administrative functions for manual full sync
 * - Sync position tracking for resumable operations
 */

const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const os = require('os');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');

class AppleMailSyncService {
  constructor() {
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
        new winston.transports.File({ filename: 'apple-mail-sync.log' })
      ]
    });

    this.appleMailDbPath = process.env.APPLE_MAIL_DB_PATH || path.join(
      process.cwd(),
      'database/fake-apple-mail/fake-envelope-index.sqlite'
    );

    this.pollInterval = 5000; // 5 seconds
    this.isRunning = false;
    this.lastSyncedRowId = null;
    this.db = null;
    this.supabase = null;
  }

  async initialize() {
    try {
      // Initialize Supabase client with service role for sync operations (bypasses RLS)
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials not configured in environment');
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

      // Get last synced ROWID from Supabase
      await this.getLastSyncedRowId();

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize sync service:', error);
      throw error;
    }
  }

  async getLastSyncedRowId() {
    try {
      const { data, error } = await this.supabase
        .from('sync_metadata')
        .select('last_rowid')
        .eq('sync_type', 'apple_mail')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error;
      }

      this.lastSyncedRowId = data?.last_rowid || 0;
      this.logger.info(`Last synced ROWID: ${this.lastSyncedRowId}`);
      
      return this.lastSyncedRowId;
    } catch (error) {
      this.logger.error('Failed to get last synced ROWID:', error);
      this.lastSyncedRowId = 0;
      return 0;
    }
  }

  async updateLastSyncedRowId(rowId) {
    try {
      const { error } = await this.supabase
        .from('sync_metadata')
        .upsert({
          sync_type: 'apple_mail',
          last_rowid: rowId,
          last_sync_at: new Date().toISOString()
        }, {
          onConflict: 'sync_type'
        });

      if (error) throw error;
      
      this.lastSyncedRowId = rowId;
    } catch (error) {
      this.logger.error('Failed to update last synced ROWID:', error);
    }
  }

  async checkForNewEmails() {
    try {
      // Query for new emails since last sync
      const query = `
        SELECT COUNT(*) as count, MAX(ROWID) as max_rowid
        FROM messages
        WHERE ROWID > ?
      `;

      const result = await this.db.get(query, [this.lastSyncedRowId]);
      
      return {
        hasNew: result.count > 0,
        count: result.count,
        maxRowId: result.max_rowid
      };
    } catch (error) {
      this.logger.error('Failed to check for new emails:', error);
      return { hasNew: false, count: 0, maxRowId: null };
    }
  }

  async checkSyncStrategy() {
    try {
      // First, check if Supabase emails table is empty
      const { count: supabaseCount, error: countError } = await this.supabase
        .from('emails')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        this.logger.error('Failed to check Supabase email count:', countError);
        return { strategy: 'incremental', reason: 'fallback_due_to_error' };
      }

      // If Supabase is empty, perform full sync
      if (supabaseCount === 0) {
        this.logger.info('📭 Supabase emails table is empty - performing full sync');
        return { strategy: 'full', reason: 'empty_database' };
      }

      // Get current max ROWID from Apple Mail
      const appleMailQuery = `SELECT MAX(ROWID) as max_rowid FROM messages`;
      const appleResult = await this.db.get(appleMailQuery);
      const currentMaxRowId = appleResult?.max_rowid || 0;

      // Calculate gap between last synced and current max
      const gap = currentMaxRowId - this.lastSyncedRowId;

      this.logger.info(`📊 Sync gap analysis: last_synced=${this.lastSyncedRowId}, current_max=${currentMaxRowId}, gap=${gap}`);

      // If gap is >= 100, perform full sync to catch up
      if (gap >= 100) {
        this.logger.info(`🔄 Large sync gap detected (${gap} emails) - performing full sync to catch up`);
        return { strategy: 'full', reason: 'large_gap', gap };
      }

      // Otherwise, perform incremental sync
      this.logger.debug(`⚡ Small sync gap (${gap} emails) - performing incremental sync`);
      return { strategy: 'incremental', reason: 'normal_operation', gap };

    } catch (error) {
      this.logger.error('Failed to determine sync strategy:', error);
      // Fallback to incremental sync on error
      return { strategy: 'incremental', reason: 'fallback_due_to_error' };
    }
  }

  async performFullSync(limit = 50) {
    try {
      this.logger.info('🔄 Starting full sync of all emails...');

      // Get total count for progress tracking
      const countQuery = `SELECT COUNT(*) as total FROM messages`;
      const countResult = await this.db.get(countQuery);
      const totalEmails = countResult?.total || 0;
      
      this.logger.info(`📊 Total emails to sync: ${totalEmails}`);

      // Store original lastSyncedRowId in case we need to rollback
      const originalLastSyncedRowId = this.lastSyncedRowId;

      const query = `
        SELECT 
          m.ROWID,
          m.message_id,
          m.date_sent,
          m.date_received,
          m.subject,
          m.sender,
          m.flags,
          m.size,
          m.mailbox,
          mb.url as mailbox_url,
          GROUP_CONCAT(r.address) as recipients
        FROM messages m
        LEFT JOIN mailboxes mb ON m.mailbox = mb.ROWID
        LEFT JOIN recipients r ON m.ROWID = r.message
        GROUP BY m.ROWID
        ORDER BY m.ROWID ASC
        LIMIT ? OFFSET ?
      `;

      let totalSynced = 0;
      let totalFailed = 0;
      let hasMore = true;
      let currentOffset = 0;
      let highestSyncedRowId = 0;

      while (hasMore) {
        try {
          const emails = await this.db.all(query, [limit, currentOffset]);

          if (emails.length === 0) {
            hasMore = false;
            break;
          }

          const result = await this.syncEmailsToSupabase(emails);
          totalSynced += result.success;
          totalFailed += result.failed;

          // Track highest successfully synced ROWID for resumability
          if (result.success > 0) {
            const lastEmail = emails[emails.length - 1];
            highestSyncedRowId = Math.max(highestSyncedRowId, lastEmail.ROWID);
          }

          const progressPercent = ((currentOffset + emails.length) / totalEmails * 100).toFixed(1);
          this.logger.info(`📧 Full sync batch: ${result.success} success, ${result.failed} failed (${progressPercent}% - ${currentOffset + emails.length}/${totalEmails})`);

          currentOffset += limit;

          // If we got less than limit, we're done
          if (emails.length < limit) {
            hasMore = false;
          }

          // Add a small delay to avoid overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (batchError) {
          this.logger.error(`Error processing batch at offset ${currentOffset}:`, batchError);
          totalFailed += limit; // Assume all failed in this batch
          currentOffset += limit;
          
          // Continue with next batch rather than failing entire sync
          if (currentOffset >= totalEmails) {
            hasMore = false;
          }
        }
      }

      // Update sync position to highest successfully synced ROWID
      if (highestSyncedRowId > 0) {
        await this.updateLastSyncedRowId(highestSyncedRowId);
      }

      this.logger.info(`✅ Full sync complete: ${totalSynced} emails synced, ${totalFailed} failed`);
      
      return { 
        synced: totalSynced > 0, 
        count: totalSynced,
        failed: totalFailed,
        type: 'full',
        totalProcessed: totalSynced + totalFailed
      };

    } catch (error) {
      this.logger.error('Full sync failed:', error);
      return { synced: false, count: 0, error: error.message, type: 'full' };
    }
  }

  async performIncrementalSync(limit = 10) {
    try {
      this.logger.debug('⚡ Starting incremental sync...');

      // Check for new emails
      const check = await this.checkForNewEmails();
      
      if (!check.hasNew) {
        this.logger.debug('No new emails to sync');
        return { synced: false, count: 0, type: 'incremental' };
      }

      this.logger.info(`📨 Found ${check.count} new emails for incremental sync`);

      // Fetch new emails in batches
      let totalSynced = 0;
      let totalFailed = 0;
      let hasMore = true;

      while (hasMore) {
        const emails = await this.fetchNewEmails(limit);
        
        if (emails.length === 0) {
          hasMore = false;
          break;
        }

        const result = await this.syncEmailsToSupabase(emails);
        totalSynced += result.success;
        totalFailed += result.failed;

        this.logger.debug(`📧 Incremental sync batch: ${result.success} success, ${result.failed} failed`);

        // If we got less than limit, we're done
        if (emails.length < limit) {
          hasMore = false;
        }
      }

      this.logger.info(`✅ Incremental sync complete: ${totalSynced} emails synced, ${totalFailed} failed`);
      
      return { 
        synced: true, 
        count: totalSynced,
        failed: totalFailed,
        type: 'incremental'
      };

    } catch (error) {
      this.logger.error('Incremental sync failed:', error);
      return { synced: false, count: 0, error: error.message, type: 'incremental' };
    }
  }

  async fetchNewEmails(limit = 10) {  // Reduced for testing
    try {
      const query = `
        SELECT 
          m.ROWID,
          m.message_id,
          m.date_sent,
          m.date_received,
          m.subject,
          m.sender,
          m.flags,
          m.size,
          m.mailbox,
          mb.url as mailbox_url,
          GROUP_CONCAT(r.address) as recipients
        FROM messages m
        LEFT JOIN mailboxes mb ON m.mailbox = mb.ROWID
        LEFT JOIN recipients r ON m.ROWID = r.message
        WHERE m.ROWID > ?
        GROUP BY m.ROWID
        ORDER BY m.ROWID ASC
        LIMIT ?
      `;

      const emails = await this.db.all(query, [this.lastSyncedRowId, limit]);
      return emails;
    } catch (error) {
      this.logger.error('Failed to fetch new emails:', error);
      return [];
    }
  }

  async syncEmailsToSupabase(emails) {
    if (!emails || emails.length === 0) return { success: 0, failed: 0 };

    let successCount = 0;
    let failedCount = 0;
    let lastSuccessfulRowId = this.lastSyncedRowId;

    for (const email of emails) {
      try {
        // Transform Apple Mail data to Supabase schema
        const supabaseEmail = {
          apple_mail_id: email.message_id,
          rowid: email.ROWID,
          subject: email.subject,
          sender: email.sender,
          recipients: email.recipients ? email.recipients.split(',') : [],
          date_sent: email.date_sent ? new Date(email.date_sent * 1000).toISOString() : null,
          date_received: email.date_received ? new Date(email.date_received * 1000).toISOString() : null,
          flags: email.flags,
          size: email.size,
          mailbox: email.mailbox_url || 'INBOX',
          raw_data: email,
          synced_at: new Date().toISOString()
        };

        const { error } = await this.supabase
          .from('emails')
          .upsert(supabaseEmail, {
            onConflict: 'apple_mail_id'
          });

        if (error) {
          throw error;
        }

        successCount++;
        lastSuccessfulRowId = email.ROWID;
      } catch (error) {
        this.logger.error(`Failed to sync email ROWID ${email.ROWID}:`, error);
        failedCount++;
      }
    }

    // Update last synced ROWID only if we had successes
    if (successCount > 0) {
      await this.updateLastSyncedRowId(lastSuccessfulRowId);
    }

    return { success: successCount, failed: failedCount };
  }

  async performSync() {
    try {
      // Use smart sync detection to determine strategy
      const syncDecision = await this.checkSyncStrategy();
      
      this.logger.info(`🎯 Sync strategy: ${syncDecision.strategy} (reason: ${syncDecision.reason})`);

      let result;

      if (syncDecision.strategy === 'full') {
        result = await this.performFullSync();
      } else {
        result = await this.performIncrementalSync();
      }

      // Log final result with strategy information
      if (result.synced) {
        this.logger.info(`✅ ${result.type} sync complete: ${result.count} emails synced, ${result.failed || 0} failed`);
      } else {
        this.logger.debug(`💤 No sync needed - ${result.type} check found no new emails`);
      }
      
      return result;

    } catch (error) {
      this.logger.error('Smart sync failed:', error);
      return { synced: false, count: 0, error: error.message };
    }
  }

  async start() {
    if (this.isRunning) {
      this.logger.warn('Sync service is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('🚀 Starting Apple Mail sync service with smart sync detection (5-second polling)');

    // Perform initial sync using smart detection
    await this.performSync();

    // Start polling interval
    this.pollTimer = setInterval(async () => {
      if (!this.isRunning) return;
      
      await this.performSync();
    }, this.pollInterval);
  }

  async stop() {
    this.isRunning = false;
    
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.db) {
      await this.db.close();
      this.db = null;
    }

    this.logger.info('🛑 Apple Mail sync service stopped');
  }

  // Manual full sync trigger for administrative purposes
  async forceFullSync() {
    this.logger.info('🔧 Manual full sync triggered...');
    const result = await this.performFullSync();
    
    if (result.synced) {
      this.logger.info(`✅ Manual full sync completed: ${result.count} emails processed`);
    } else {
      this.logger.error(`❌ Manual full sync failed: ${result.error || 'Unknown error'}`);
    }
    
    return result;
  }

  // Get current sync status and statistics
  async getSyncStatus() {
    try {
      // Get Supabase email count
      const { count: supabaseCount } = await this.supabase
        .from('emails')
        .select('*', { count: 'exact', head: true });

      // Get Apple Mail max ROWID
      const appleMailQuery = `SELECT MAX(ROWID) as max_rowid, COUNT(*) as total_count FROM messages`;
      const appleResult = await this.db.get(appleMailQuery);

      const gap = (appleResult?.max_rowid || 0) - this.lastSyncedRowId;

      return {
        isRunning: this.isRunning,
        lastSyncedRowId: this.lastSyncedRowId,
        supabaseEmailCount: supabaseCount || 0,
        appleMailMaxRowId: appleResult?.max_rowid || 0,
        appleMailTotalCount: appleResult?.total_count || 0,
        syncGap: gap,
        pollInterval: this.pollInterval
      };
    } catch (error) {
      this.logger.error('Failed to get sync status:', error);
      return {
        isRunning: this.isRunning,
        error: error.message
      };
    }
  }

  // Graceful shutdown handler
  async shutdown() {
    this.logger.info('Shutting down Apple Mail sync service...');
    await this.stop();
  }
}

// Export singleton instance
const syncService = new AppleMailSyncService();

// Handle process signals for graceful shutdown
process.on('SIGTERM', async () => {
  await syncService.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await syncService.shutdown();
  process.exit(0);
});

module.exports = syncService;

// Allow direct execution for testing
if (require.main === module) {
  require('dotenv').config();
  
  syncService.initialize()
    .then(() => syncService.start())
    .catch(error => {
      console.error('Failed to start sync service:', error);
      process.exit(1);
    });
}
