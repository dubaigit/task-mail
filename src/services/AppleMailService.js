const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Apple Mail Service
 * Provides read-only access to Apple Mail's SQLite database
 * Handles email metadata extraction and synchronization
 */
class AppleMailService {
  constructor() {
    this.dbPath = process.env.APPLE_MAIL_DB_PATH || '/Users/iamomen/Library/Mail/V10/MailData/Envelope Index';
    this.db = null;
    this.isConnected = false;
    this.lastSyncTime = null;
    this.syncInterval = 30000; // 30 seconds
    this.syncTimer = null;
  }

  /**
   * Initialize the Apple Mail service
   */
  async initialize() {
    try {
      // Check if Apple Mail database exists
      if (!fs.existsSync(this.dbPath)) {
        throw new Error(`Apple Mail database not found at: ${this.dbPath}`);
      }

      // Connect to the database
      await this.connect();
      
      // Start periodic sync
      this.startPeriodicSync();
      
      logger.info('Apple Mail service initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Apple Mail service:', error);
      return false;
    }
  }

  /**
   * Connect to Apple Mail SQLite database
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          logger.error('Failed to connect to Apple Mail database:', err);
          reject(err);
          return;
        }
        
        this.isConnected = true;
        logger.info('Connected to Apple Mail database');
        resolve();
      });
    });
  }

  /**
   * Disconnect from the database
   */
  async disconnect() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) {
            logger.error('Error closing database connection:', err);
          }
          this.isConnected = false;
          this.db = null;
          resolve();
        });
      });
    }
  }

  /**
   * Get all emails from Apple Mail
   */
  async getAllEmails(limit = 1000, offset = 0) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          message_id,
          sender,
          subject,
          snippet,
          date_received,
          date_sent,
          read_status,
          flag_status,
          mailbox_id,
          conversation_id,
          size,
          has_attachments
        FROM messages 
        ORDER BY date_received DESC 
        LIMIT ? OFFSET ?
      `;

      this.db.all(query, [limit, offset], (err, rows) => {
        if (err) {
          logger.error('Error fetching emails:', err);
          reject(err);
          return;
        }

        const emails = rows.map(row => ({
          messageId: row.message_id,
          sender: row.sender,
          subject: row.subject,
          snippet: row.snippet,
          dateReceived: row.date_received,
          dateSent: row.date_sent,
          readStatus: row.read_status,
          flagStatus: row.flag_status,
          mailboxId: row.mailbox_id,
          conversationId: row.conversation_id,
          size: row.size,
          hasAttachments: Boolean(row.has_attachments),
          source: 'apple_mail'
        }));

        resolve(emails);
      });
    });
  }

  /**
   * Get emails by mailbox/folder
   */
  async getEmailsByMailbox(mailboxId, limit = 500, offset = 0) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          message_id,
          sender,
          subject,
          snippet,
          date_received,
          date_sent,
          read_status,
          flag_status,
          mailbox_id,
          conversation_id,
          size,
          has_attachments
        FROM messages 
        WHERE mailbox_id = ?
        ORDER BY date_received DESC 
        LIMIT ? OFFSET ?
      `;

      this.db.all(query, [mailboxId, limit, offset], (err, rows) => {
        if (err) {
          logger.error('Error fetching emails by mailbox:', err);
          reject(err);
          return;
        }

        const emails = rows.map(row => ({
          messageId: row.message_id,
          sender: row.sender,
          subject: row.subject,
          snippet: row.snippet,
          dateReceived: row.date_received,
          dateSent: row.date_sent,
          readStatus: row.read_status,
          flagStatus: row.flag_status,
          mailboxId: row.mailbox_id,
          conversationId: row.conversation_id,
          size: row.size,
          hasAttachments: Boolean(row.has_attachments),
          source: 'apple_mail'
        }));

        resolve(emails);
      });
    });
  }

  /**
   * Get email by message ID
   */
  async getEmailByMessageId(messageId) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          message_id,
          sender,
          subject,
          snippet,
          date_received,
          date_sent,
          read_status,
          flag_status,
          mailbox_id,
          conversation_id,
          size,
          has_attachments
        FROM messages 
        WHERE message_id = ?
      `;

      this.db.get(query, [messageId], (err, row) => {
        if (err) {
          logger.error('Error fetching email by message ID:', err);
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        const email = {
          messageId: row.message_id,
          sender: row.sender,
          subject: row.subject,
          snippet: row.snippet,
          dateReceived: row.date_received,
          dateSent: row.date_sent,
          readStatus: row.read_status,
          flagStatus: row.flag_status,
          mailboxId: row.mailbox_id,
          conversationId: row.conversation_id,
          size: row.size,
          hasAttachments: Boolean(row.has_attachments),
          source: 'apple_mail'
        };

        resolve(email);
      });
    });
  }

  /**
   * Get all mailboxes/folders
   */
  async getMailboxes() {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      const query = `
        SELECT DISTINCT 
          mailbox_id,
          name,
          type
        FROM mailboxes 
        ORDER BY name
      `;

      this.db.all(query, [], (err, rows) => {
        if (err) {
          logger.error('Error fetching mailboxes:', err);
          reject(err);
          return;
        }

        const mailboxes = rows.map(row => ({
          id: row.mailbox_id,
          name: row.name,
          type: row.type
        }));

        resolve(mailboxes);
      });
    });
  }

  /**
   * Search emails by criteria
   */
  async searchEmails(criteria, limit = 100) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const { query, sender, subject, dateFrom, dateTo, readStatus, hasAttachments } = criteria;
    
    let sqlQuery = `
      SELECT 
        message_id,
        sender,
        subject,
        snippet,
        date_received,
        date_sent,
        read_status,
        flag_status,
        mailbox_id,
        conversation_id,
        size,
        has_attachments
      FROM messages 
      WHERE 1=1
    `;
    
    const params = [];

    if (query) {
      sqlQuery += ` AND (subject LIKE ? OR snippet LIKE ? OR sender LIKE ?)`;
      params.push(`%${query}%`, `%${query}%`, `%${query}%`);
    }

    if (sender) {
      sqlQuery += ` AND sender LIKE ?`;
      params.push(`%${sender}%`);
    }

    if (subject) {
      sqlQuery += ` AND subject LIKE ?`;
      params.push(`%${subject}%`);
    }

    if (dateFrom) {
      sqlQuery += ` AND date_received >= ?`;
      params.push(dateFrom);
    }

    if (dateTo) {
      sqlQuery += ` AND date_received <= ?`;
      params.push(dateTo);
    }

    if (readStatus !== undefined) {
      sqlQuery += ` AND read_status = ?`;
      params.push(readStatus);
    }

    if (hasAttachments !== undefined) {
      sqlQuery += ` AND has_attachments = ?`;
      params.push(hasAttachments ? 1 : 0);
    }

    sqlQuery += ` ORDER BY date_received DESC LIMIT ?`;
    params.push(limit);

    return new Promise((resolve, reject) => {
      this.db.all(sqlQuery, params, (err, rows) => {
        if (err) {
          logger.error('Error searching emails:', err);
          reject(err);
          return;
        }

        const emails = rows.map(row => ({
          messageId: row.message_id,
          sender: row.sender,
          subject: row.subject,
          snippet: row.snippet,
          dateReceived: row.date_received,
          dateSent: row.date_sent,
          readStatus: row.read_status,
          flagStatus: row.flag_status,
          mailboxId: row.mailbox_id,
          conversationId: row.conversation_id,
          size: row.size,
          hasAttachments: Boolean(row.has_attachments),
          source: 'apple_mail'
        }));

        resolve(emails);
      });
    });
  }

  /**
   * Get email statistics
   */
  async getEmailStats() {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      const queries = [
        'SELECT COUNT(*) as total FROM messages',
        'SELECT COUNT(*) as unread FROM messages WHERE read_status = 0',
        'SELECT COUNT(*) as flagged FROM messages WHERE flag_status = 1',
        'SELECT COUNT(*) as withAttachments FROM messages WHERE has_attachments = 1',
        'SELECT COUNT(DISTINCT sender) as uniqueSenders FROM messages',
        'SELECT COUNT(DISTINCT mailbox_id) as totalMailboxes FROM mailboxes'
      ];

      const stats = {};
      let completedQueries = 0;

      queries.forEach((query, index) => {
        this.db.get(query, [], (err, row) => {
          if (err) {
            logger.error(`Error fetching stat ${index}:`, err);
          } else if (row) {
            const key = Object.keys(row)[0];
            stats[key] = row[key];
          }

          completedQueries++;
          if (completedQueries === queries.length) {
            resolve(stats);
          }
        });
      });
    });
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
        await this.performSync();
      } catch (error) {
        logger.error('Periodic sync failed:', error);
      }
    }, this.syncInterval);

    logger.info('Periodic sync started');
  }

  /**
   * Stop periodic synchronization
   */
  stopPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      logger.info('Periodic sync stopped');
    }
  }

  /**
   * Perform synchronization
   */
  async performSync() {
    try {
      // This would typically sync with Supabase
      // For now, just log the sync
      this.lastSyncTime = new Date();
      logger.debug('Apple Mail sync performed at:', this.lastSyncTime);
    } catch (error) {
      logger.error('Sync failed:', error);
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      dbPath: this.dbPath,
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
    await this.disconnect();
    logger.info('Apple Mail service cleaned up');
  }
}

module.exports = AppleMailService;
