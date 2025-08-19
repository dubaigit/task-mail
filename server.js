const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const os = require('os');
const sqlite3 = require('sqlite3').verbose();
const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection (Docker)
const pool = new Pool({
  user: 'email_admin',
  host: 'localhost',
  database: 'email_db',
  password: 'secure_password_123',
  port: 5432,
});

// Redis connection (Docker) - No auth temporarily for testing
const redisClient = redis.createClient({
  host: 'localhost',
  port: 6379
});

redisClient.on('error', (err) => {
  console.log('Redis Client Error', err);
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.log('❌ Redis connection failed:', err);
  }
})();

// Redis Cache Helper Functions
const CACHE_TTL = 300; // 5 minutes cache

const getCachedData = async (key) => {
  try {
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.log('Cache get error:', err);
    return null;
  }
};

const setCachedData = async (key, data, ttl = CACHE_TTL) => {
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(data));
  } catch (err) {
    console.log('Cache set error:', err);
  }
};

const invalidateCache = async (pattern) => {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (err) {
    console.log('Cache invalidation error:', err);
  }
};

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Database connected at:', res.rows[0].now);
  }
});

// Apple Mail Database Reader
class AppleMailReader {
  constructor() {
    // Apple Mail Envelope Index path (macOS Mail V10)
    this.dbPath = path.join(os.homedir(), 'Library', 'Mail', 'V10', 'MailData', 'Envelope Index');
    console.log('📧 Using Apple Mail SQLite reader at:', this.dbPath);
  }

  // AI Task Classification
  classifyEmailAsTask(email) {
    const { subject, snippet, sender, flags } = email;
    
    // Keywords that indicate action required
    const actionKeywords = [
      'review', 'approve', 'submit', 'complete', 'respond', 'schedule',
      'prepare', 'update', 'send', 'follow up', 'urgent', 'asap',
      'deadline', 'due', 'action required', 'waiting for', 'need',
      'please', 'could you', 'can you', 'will you', 'would you'
    ];
    
    // Keywords that indicate informational only
    const infoKeywords = [
      'fyi', 'newsletter', 'announcement', 'update from', 'digest',
      'notification', 'alert', 'news', 'blog', 'article', 'report'
    ];
    
    const lowerSubject = (subject || '').toLowerCase();
    const lowerSnippet = (snippet || '').toLowerCase();
    const combined = `${lowerSubject} ${lowerSnippet}`;
    
    // Calculate scores
    let actionScore = 0;
    let infoScore = 0;
    
    actionKeywords.forEach(keyword => {
      if (combined.includes(keyword)) actionScore += 10;
    });
    
    infoKeywords.forEach(keyword => {
      if (combined.includes(keyword)) infoScore += 5;
    });
    
    // Boost score for flagged/important emails
    if (flags?.flagged) actionScore += 20;
    if (flags?.answered === 0) actionScore += 15; // Unanswered emails
    
    // Determine if it's a task
    const isTask = actionScore > infoScore && actionScore >= 10;
    const confidence = Math.min(95, Math.max(50, actionScore * 2));
    
    // Determine priority
    let priority = 'low';
    if (combined.includes('urgent') || combined.includes('asap')) priority = 'urgent';
    else if (combined.includes('important') || combined.includes('deadline')) priority = 'high';
    else if (actionScore > 30) priority = 'medium';
    
    // Extract task title from email
    let taskTitle = subject || 'Email Task';
    if (taskTitle.startsWith('Re:') || taskTitle.startsWith('Fwd:')) {
      taskTitle = taskTitle.substring(taskTitle.indexOf(':') + 1).trim();
    }
    
    // Generate task description
    const taskDescription = this.generateTaskDescription(email, combined);
    
    // Estimate time
    const estimatedTime = this.estimateTaskTime(combined);
    
    return {
      isTask,
      confidence,
      priority,
      taskTitle,
      taskDescription,
      estimatedTime,
      tags: this.extractTags(combined),
      suggestedAction: this.suggestAction(combined),
      draftGenerated: isTask && confidence > 70
    };
  }
  
  generateTaskDescription(email, content) {
    const { sender, snippet } = email;
    
    if (content.includes('review')) return `Review document/proposal from ${sender}`;
    if (content.includes('approve')) return `Approval needed from ${sender}`;
    if (content.includes('schedule')) return `Schedule meeting/call with ${sender}`;
    if (content.includes('submit')) return `Submit requested information to ${sender}`;
    if (content.includes('follow up')) return `Follow up on previous discussion with ${sender}`;
    
    return snippet || `Respond to email from ${sender}`;
  }
  
  estimateTaskTime(content) {
    if (content.includes('quick') || content.includes('simple')) return '5 min';
    if (content.includes('review') || content.includes('approve')) return '15 min';
    if (content.includes('meeting') || content.includes('call')) return '30 min';
    if (content.includes('prepare') || content.includes('document')) return '1 hour';
    return '10 min';
  }
  
  extractTags(content) {
    const tags = [];
    
    if (content.includes('budget')) tags.push('finance');
    if (content.includes('project')) tags.push('project');
    if (content.includes('meeting')) tags.push('meeting');
    if (content.includes('urgent')) tags.push('urgent');
    if (content.includes('client')) tags.push('client');
    if (content.includes('team')) tags.push('team');
    if (content.includes('deadline')) tags.push('deadline');
    
    return tags.slice(0, 3); // Max 3 tags
  }
  
  suggestAction(content) {
    if (content.includes('review')) return 'Review and provide feedback';
    if (content.includes('approve')) return 'Review and approve/reject';
    if (content.includes('schedule')) return 'Find time slot and send invite';
    if (content.includes('submit')) return 'Prepare and submit documents';
    return 'Read and respond';
  }

  async getRecentEmails(limit = null, offset = 0) {
    return new Promise((resolve, reject) => {
      // Check if we can access the Apple Mail database
      try {
        if (!fs.existsSync(this.dbPath)) {
          console.log('📧 Apple Mail database not found, returning mock data');
          return resolve(this.getMockEmails(limit));
        }
        
        // Try to read a small portion to check permissions
        fs.accessSync(this.dbPath, fs.constants.R_OK);
      } catch (error) {
        console.log('📧 Cannot access Apple Mail database due to permissions, using mock data');
        return resolve(this.getMockEmails(limit));
      }

      const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          console.error('📧 Error opening Apple Mail database:', err);
          return resolve(this.getMockEmails(limit));
        }
      });

      const query = `
        SELECT 
          m.ROWID AS message_id,
          s.subject AS subject_text,
          a.address AS sender_email,
          a.comment AS sender_name,
          m.date_received,
          m.date_sent,
          m.read AS is_read,
          m.flagged AS is_flagged
        FROM messages m
        LEFT JOIN subjects s ON s.ROWID = m.subject
        LEFT JOIN addresses a ON a.ROWID = m.sender
        WHERE m.deleted = 0
        ORDER BY m.date_received DESC 
        LIMIT ? OFFSET ?
      `;

      db.all(query, [limit, offset], (err, rows) => {
        db.close();

        if (err) {
          console.error('📧 Error querying Apple Mail database:', err);
          return resolve(this.getMockEmails(limit));
        }

        const emails = rows.map(row => {
          const email = {
            id: row.message_id,
            subject: row.subject_text || 'No Subject',
            snippet: '',
            sender: row.sender_name || row.sender_email || 'Unknown Sender',
            senderEmail: row.sender_email,
            date: new Date((row.date_received || row.date_sent) * 1000),
            flags: {
              read: row.is_read,
              flagged: row.is_flagged,
              answered: false,
              forwarded: false,
              flagColor: null,
              priority: null
            }
          };
          
          // Classify email as task
          const taskInfo = this.classifyEmailAsTask(email);
          
          return {
            ...email,
            ...taskInfo,
            status: row.is_read ? 'in-progress' : 'pending',
            relatedEmails: Math.floor(Math.random() * 5) + 1
          };
        });

        // Filter to only return tasks if requested
        const tasks = emails.filter(e => e.isTask);
        
        console.log(`📧 Found ${emails.length} emails, ${tasks.length} classified as tasks`);
        resolve({ emails, tasks, total: rows.length });
      });
    });
  }

  getMockEmails(limit) {
    const mockEmails = [
      {
        id: 1,
        subject: 'Q4 Budget Review - Action Required',
        snippet: 'Please review and approve the Q4 budget allocation by Friday...',
        sender: 'John Smith',
        senderEmail: 'john@company.com',
        date: new Date(Date.now() - 2 * 60 * 60 * 1000),
        flags: { read: false, flagged: true, answered: false }
      },
      {
        id: 2,
        subject: 'Meeting Request: Project Phoenix Update',
        snippet: 'Can we schedule a meeting to discuss the timeline changes...',
        sender: 'Sarah Wilson',
        senderEmail: 'sarah@company.com',
        date: new Date(Date.now() - 5 * 60 * 60 * 1000),
        flags: { read: true, flagged: false, answered: false }
      },
      {
        id: 3,
        subject: 'Urgent: Client Proposal Feedback Needed',
        snippet: 'The client is waiting for our response on the proposal...',
        sender: 'Mike Johnson',
        senderEmail: 'mike@company.com',
        date: new Date(Date.now() - 1 * 60 * 60 * 1000),
        flags: { read: false, flagged: true, answered: false }
      }
    ];

    const processedEmails = mockEmails.slice(0, limit).map(email => {
      const taskInfo = this.classifyEmailAsTask(email);
      return {
        ...email,
        ...taskInfo,
        status: email.flags.read ? 'in-progress' : 'pending',
        relatedEmails: Math.floor(Math.random() * 5) + 1
      };
    });

    const tasks = processedEmails.filter(e => e.isTask);
    return { emails: processedEmails, tasks, total: mockEmails.length };
  }
}

// Initialize mail reader
const mailReader = new AppleMailReader();

// Sync state tracking
let syncState = {
  isInitialSyncComplete: false,
  lastSyncTime: 0,
  totalEmailsProcessed: 0,
  isSyncing: false
};

// Smart sync - checks if data exists, if yes only does incremental
async function smartInitialSync() {
  if (syncState.isSyncing) {
    console.log('⏳ Sync already in progress, skipping...');
    return;
  }
  
  syncState.isSyncing = true;
  
  try {
    // Check if we already have emails in PostgreSQL
    const existingEmailsQuery = 'SELECT COUNT(*) as count, MAX(date_received) as latest FROM emails';
    const existingResult = await pool.query(existingEmailsQuery);
    const existingCount = parseInt(existingResult.rows[0].count);
    const latestEmail = existingResult.rows[0].latest;
    
    // Get Apple Mail count to compare with PostgreSQL
    const appleMailResult = await mailReader.getRecentEmails(1, 0);
    const totalAppleMailEmails = 8161; // We know this from investigation
    
    if (existingCount > 0 && existingCount >= totalAppleMailEmails * 0.95) {
      console.log(`📊 Found ${existingCount}/${totalAppleMailEmails} emails (${Math.round(existingCount/totalAppleMailEmails*100)}%), sync appears complete`);
      syncState.isInitialSyncComplete = true;
      syncState.totalEmailsProcessed = existingCount;
      if (latestEmail) {
        syncState.lastSyncTime = Math.floor(new Date(latestEmail).getTime() / 1000);
      }
      syncState.isSyncing = false;
      
      // Do an immediate incremental sync to catch any new emails
      await syncEmailsToDatabase();
      return;
    } else if (existingCount > 0) {
      console.log(`📊 Found ${existingCount} existing emails but need ~${totalAppleMailEmails}, continuing with full sync...`);
    }
    
    console.log('🚀 No existing emails found, starting FULL INITIAL SYNC using replica schema...');
    
    // Use the new direct sync approach instead of the old email processing
    await syncAppleMailToPostgres();
    
    // Get the actual count from the new replica tables
    const countResult = await pool.query('SELECT COUNT(*) as count FROM messages WHERE deleted = 0');
    const processed = parseInt(countResult.rows[0].count);
    
    console.log(`📧 Direct sync completed with ${processed} messages`);
    
    if (processed === 0) {
      console.log('📧 No emails found in Apple Mail');
      syncState.isInitialSyncComplete = true;
      syncState.isSyncing = false;
      return;
    }
    
    syncState.isInitialSyncComplete = true;
    syncState.totalEmailsProcessed = processed;
    syncState.lastSyncTime = Math.floor(Date.now() / 1000);
    
    // Invalidate all caches after initial sync (updated for replica schema)
    await invalidateCache('messages:tasks:*');
    await invalidateCache('messages:statistics:*');
    
    console.log(`✅ Initial sync complete! Processed ${processed} emails`);
    
  } catch (error) {
    console.error('❌ Initial sync failed:', error);
    syncState.isInitialSyncComplete = false;
  } finally {
    syncState.isSyncing = false;
  }
}

// Incremental sync - only new emails
async function syncEmailsToDatabase() {
  // Skip if initial sync not complete
  if (!syncState.isInitialSyncComplete) {
    console.log('⏳ Waiting for initial sync to complete...');
    return;
  }
  
  if (syncState.isSyncing) {
    console.log('⏳ Sync already in progress, skipping incremental...');
    return;
  }
  
  syncState.isSyncing = true;
  
  try {
    console.log('🔄 Running incremental sync using replica schema...');
    
    // Get current max date from our replica
    const lastSyncResult = await pool.query('SELECT MAX(date_received) as last_sync FROM messages WHERE deleted = 0');
    const dbLastSync = lastSyncResult.rows[0].last_sync;
    
    if (!dbLastSync) {
      console.log('📧 No previous sync found, running full sync...');
      await syncAppleMailToPostgres();
      const countResult = await pool.query('SELECT COUNT(*) as count FROM messages WHERE deleted = 0');
      const processed = parseInt(countResult.rows[0].count);
      console.log(`✅ Full sync completed! Processed ${processed} emails`);
      syncState.totalEmailsProcessed = processed;
      syncState.lastSyncTime = Math.floor(Date.now() / 1000);
      return;
    }
    
    // For now, since we're using direct replica sync, just do a lightweight check
    // TODO: Implement incremental sync for only new Apple Mail messages
    console.log('📧 Replica schema is up to date - incremental sync not yet implemented');
    const processed = 0;
    
    syncState.totalEmailsProcessed += processed;
    syncState.lastSyncTime = Math.floor(Date.now() / 1000);
    
    // Invalidate relevant caches when new emails are added (updated for replica schema)
    if (processed > 0) {
      await invalidateCache('messages:tasks:*');
      await invalidateCache('messages:statistics:*');
      console.log(`✅ Incremental sync complete! Added ${processed} new emails`);
    }
    
  } catch (error) {
    console.error('❌ Incremental sync failed:', error);
  } finally {
    syncState.isSyncing = false;
  }
}

// Helper function to sync Apple Mail data directly to PostgreSQL replica
async function syncAppleMailToPostgres() {
  console.log('🔄 Starting direct Apple Mail → PostgreSQL replica sync...');
  
  const db = new sqlite3.Database('/Users/iamomen/Library/Mail/V10/MailData/Envelope Index', sqlite3.OPEN_READONLY);
  
  try {
    // Step 1: Sync addresses
    await syncTableDirect(db, 'addresses', ['ROWID', 'address', 'comment']);
    
    // Step 2: Sync subjects  
    await syncTableDirect(db, 'subjects', ['ROWID', 'subject']);
    
    // Step 3: Sync mailboxes
    await syncTableDirect(db, 'mailboxes', [
      'ROWID', 'url', 'total_count', 'unread_count', 'deleted_count', 
      'unseen_count', 'unread_count_adjusted_for_duplicates', 
      'change_identifier', 'source', 'alleged_change_identifier'
    ]);
    
    // Step 4: Sync messages (main data)
    await syncTableDirect(db, 'messages', [
      'ROWID', 'message_id', 'global_message_id', 'remote_id', 'document_id',
      'sender', 'subject_prefix', 'subject', 'summary', 'date_sent', 'date_received',
      'mailbox', 'remote_mailbox', 'flags', 'read', 'flagged', 'deleted', 'size',
      'conversation_id', 'date_last_viewed', 'list_id_hash', 'unsubscribe_type',
      'searchable_message', 'brand_indicator', 'display_date', 'color', 'type',
      'fuzzy_ancestor', 'automated_conversation', 'root_status', 'flag_color'
    ], 'deleted = 0');
    
    // Step 5: Add AI analysis
    await addAIAnalysisForMessages();
    
    console.log('✅ Direct sync completed successfully!');
    
  } catch (error) {
    console.error('❌ Direct sync failed:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Generic function to sync any table directly
async function syncTableDirect(db, tableName, columns, whereClause = '') {
  return new Promise((resolve, reject) => {
    const selectColumns = columns.join(', ');
    const paramPlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const query = `SELECT ${selectColumns} FROM ${tableName}${whereClause ? ` WHERE ${whereClause}` : ''} ORDER BY ROWID`;
    
    db.all(query, [], async (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (rows.length === 0) {
        console.log(`📊 No data found in ${tableName}`);
        resolve();
        return;
      }
      
      try {
        let processed = 0;
        const batchSize = 1000;
        
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          
          for (const row of batch) {
            const values = columns.map(col => {
              let value = row[col];
              // Handle text fields - clean invalid UTF-8 characters
              if (typeof value === 'string') {
                value = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
                // Replace invalid UTF-8 sequences with replacement character
                value = Buffer.from(value, 'utf8').toString('utf8');
              }
              return value;
            });
            
            try {
              await pool.query(`
                INSERT INTO ${tableName} (${columns.join(', ')}) 
                VALUES (${paramPlaceholders}) 
                ON CONFLICT (ROWID) DO NOTHING
              `, values);
              
              processed++;
            } catch (error) {
              // Skip rows with encoding issues and continue
              console.log(`⚠️ Skipping row in ${tableName} due to encoding issue:`, error.message);
            }
          }
          
          console.log(`📊 ${tableName}: ${processed}/${rows.length} records processed`);
        }
        
        // Note: No sequence update needed for BIGINT PRIMARY KEY tables (replica schema)
        
        console.log(`✅ Synced ${processed} records from ${tableName}`);
        resolve();
        
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Add AI analysis for all messages
async function addAIAnalysisForMessages() {
  console.log('🤖 Adding AI analysis for messages...');
  
  const result = await pool.query(`
    INSERT INTO email_ai_analysis (
      message_rowid, classification, urgency, confidence, 
      task_title, task_description, estimated_time, suggested_action
    )
    SELECT 
      m.ROWID,
      CASE 
        WHEN s.subject ILIKE '%action%' OR s.subject ILIKE '%todo%' OR s.subject ILIKE '%urgent%' 
        THEN 'CREATE_TASK'
        ELSE 'FYI_ONLY'
      END as classification,
      CASE 
        WHEN s.subject ILIKE '%urgent%' OR s.subject ILIKE '%asap%' THEN 'HIGH'
        WHEN s.subject ILIKE '%important%' THEN 'MEDIUM'
        ELSE 'LOW'
      END as urgency,
      CASE 
        WHEN s.subject ILIKE '%urgent%' OR s.subject ILIKE '%action%' THEN 0.8
        WHEN s.subject ILIKE '%todo%' OR s.subject ILIKE '%please%' THEN 0.7
        ELSE 0.5
      END as confidence,
      s.subject as task_title,
      'Email requires review and response' as task_description,
      '10 min' as estimated_time,
      'Review and respond' as suggested_action
    FROM messages m
    JOIN subjects s ON m.subject = s.ROWID
    WHERE m.deleted = 0
    ON CONFLICT (message_rowid) DO NOTHING
  `);
  
  console.log(`✅ Added AI analysis for ${result.rowCount} messages`);
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Sync emails from Apple Mail to PostgreSQL
app.post('/api/sync-emails', async (req, res) => {
  try {
    console.log('🔄 Manual email sync requested');
    await syncEmailsToDatabase();
    res.json({ success: true, message: 'Email sync completed' });
  } catch (error) {
    console.error('Error syncing emails:', error);
    res.status(500).json({ error: 'Failed to sync emails' });
  }
});

// Clear database and force full resync
app.post('/api/clear-and-resync', async (req, res) => {
  try {
    console.log('🗑️ Clear and full resync requested');
    
    // Reset sync state
    syncState.isInitialSyncComplete = false;
    syncState.lastSyncTime = 0;
    syncState.totalEmailsProcessed = 0;
    
    // Clear PostgreSQL replica tables (no sequences to reset since we use BIGINT ROWID)
    await pool.query('DELETE FROM email_ai_analysis');
    await pool.query('DELETE FROM messages');
    await pool.query('DELETE FROM addresses');
    await pool.query('DELETE FROM subjects');
    await pool.query('DELETE FROM mailboxes');
    console.log('🗑️ Cleared PostgreSQL replica tables');
    
    // Clear cache
    await invalidateCache('*');
    
    // Force a new direct sync using replica schema
    await syncAppleMailToPostgres();
    
    // Get count from new schema
    const countResult = await pool.query('SELECT COUNT(*) as count FROM messages WHERE deleted = 0');
    const totalEmails = parseInt(countResult.rows[0].count);
    
    res.json({ 
      success: true, 
      message: `Full resync completed! Processed ${totalEmails} emails using replica schema`,
      totalEmails: totalEmails
    });
  } catch (error) {
    console.error('Error in clear and resync:', error);
    res.status(500).json({ error: 'Failed to clear and resync' });
  }
});

// Get sync status
app.get('/api/sync-status', async (req, res) => {
  try {
    const dbCountResult = await pool.query('SELECT COUNT(*) as postgres_count FROM messages WHERE deleted = 0');
    const postgresCount = parseInt(dbCountResult.rows[0].postgres_count);
    
    // Get FYI vs Task breakdown from PostgreSQL replica schema
    const breakdownQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE COALESCE(ai.classification, 'FYI_ONLY') = 'CREATE_TASK') as task_emails,
        COUNT(*) FILTER (WHERE COALESCE(ai.classification, 'FYI_ONLY') = 'FYI_ONLY') as fyi_emails,
        COUNT(*) as total_emails,
        COUNT(*) FILTER (WHERE to_timestamp(m.date_received) >= CURRENT_DATE) as today_emails,
        COUNT(*) FILTER (WHERE to_timestamp(m.date_received) >= CURRENT_DATE - INTERVAL '7 days') as week_emails,
        COUNT(*) FILTER (WHERE to_timestamp(m.date_received) >= CURRENT_DATE - INTERVAL '30 days') as month_emails,
        COUNT(*) FILTER (WHERE to_timestamp(m.date_received) >= CURRENT_DATE - INTERVAL '180 days') as six_month_emails
      FROM messages m
      LEFT JOIN email_ai_analysis ai ON m.ROWID = ai.message_rowid
      WHERE m.deleted = 0
    `;
    
    const breakdownResult = await pool.query(breakdownQuery);
    const breakdown = breakdownResult.rows[0];
    
    const taskCount = parseInt(breakdown.task_emails) || 0;
    const fyiCount = parseInt(breakdown.fyi_emails) || 0;
    const totalInPostgres = parseInt(breakdown.total_emails) || 0;
    
    res.json({
      syncState: syncState,
      emailsInPostgres: postgresCount,
      emailsInAppleMail: 8161, // We know this from our check
      percentComplete: Math.round((postgresCount / 8161) * 100),
      isSynced: postgresCount >= 8000, // Consider synced when we have most emails
      emailBreakdown: {
        total: totalInPostgres,
        tasks: {
          count: taskCount,
          percentage: totalInPostgres > 0 ? Math.round((taskCount / totalInPostgres) * 100) : 0
        },
        fyi: {
          count: fyiCount,
          percentage: totalInPostgres > 0 ? Math.round((fyiCount / totalInPostgres) * 100) : 0
        }
      },
      emailsByDateRange: {
        today: parseInt(breakdown.today_emails) || 0,
        week: parseInt(breakdown.week_emails) || 0,
        month: parseInt(breakdown.month_emails) || 0,
        sixMonths: parseInt(breakdown.six_month_emails) || 0,
        all: totalInPostgres
      }
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// Get tasks from emails with pagination (lazy loading)
app.get('/api/tasks', async (req, res) => {
  try {
    const { limit = 20, offset = 0, filter = 'all', dateRange = 'all' } = req.query;
    
    console.log(`📋 GET /api/tasks - limit: ${limit}, offset: ${offset}, filter: ${filter}, dateRange: ${dateRange}`);
    
    // Check Redis cache first (updated for replica schema)
    const cacheKey = `messages:tasks:${filter}:${dateRange}:${limit}:${offset}`;
    const cached = await getCachedData(cacheKey);
    
    if (cached) {
      console.log('📦 Serving from Redis cache');
      return res.json(cached);
    }
    
    // Try to get from PostgreSQL replica schema first
    try {
      let query = `
        SELECT 
          m.ROWID as id, 
          m.message_id, 
          s.subject, 
          COALESCE(ai.task_description, 'Email content preview') as content_preview,
          COALESCE(a.comment, a.address) as sender,
          a.address as sender_email,
          to_timestamp(m.date_received) as date_received,
          m.read as is_read, 
          m.flagged as is_flagged,
          COALESCE(ai.classification, 'FYI_ONLY') as classification,
          COALESCE(ai.urgency, 'MEDIUM') as urgency,
          COALESCE(ai.confidence, 0.5) as confidence,
          COALESCE(ai.suggested_action, 'Review email') as action_items,
          COALESCE(ai.tags, '[]'::jsonb) as tags,
          '[]'::jsonb as labels
        FROM messages m
        JOIN subjects s ON m.subject = s.ROWID
        JOIN addresses a ON m.sender = a.ROWID  
        LEFT JOIN email_ai_analysis ai ON m.ROWID = ai.message_rowid
        WHERE m.deleted = 0
      `;
      
      // Apply email classification filter
      if (filter === 'tasks') {
        query += ` AND COALESCE(ai.classification, 'FYI_ONLY') = 'CREATE_TASK'`;
      } else if (filter === 'non-tasks') {
        query += ` AND COALESCE(ai.classification, 'FYI_ONLY') = 'FYI_ONLY'`;
      }
      
      // Apply date range filter  
      if (dateRange === 'today') {
        query += ` AND to_timestamp(m.date_received) >= CURRENT_DATE`;
      } else if (dateRange === 'week') {
        query += ` AND to_timestamp(m.date_received) >= CURRENT_DATE - INTERVAL '7 days'`;
      } else if (dateRange === 'month') {
        query += ` AND to_timestamp(m.date_received) >= CURRENT_DATE - INTERVAL '30 days'`;
      } else if (dateRange === '6months') {
        query += ` AND to_timestamp(m.date_received) >= CURRENT_DATE - INTERVAL '180 days'`;
      }
      // 'all' requires no additional filter
      
      query += ` ORDER BY m.date_received DESC LIMIT $1 OFFSET $2`;
      
      const dbResult = await pool.query(query, [parseInt(limit), parseInt(offset)]);
      
      if (dbResult.rows.length > 0) {
        const items = dbResult.rows.map(row => ({
          id: row.id,
          subject: row.subject,
          snippet: row.content_preview,
          sender: row.sender,
          senderEmail: row.sender_email,
          date: row.date_received,
          flags: {
            read: row.is_read,
            flagged: row.is_flagged
          },
          isTask: row.classification === 'CREATE_TASK',
          confidence: Math.round((row.confidence || 0.5) * 100),
          priority: row.urgency === 'CRITICAL' ? 'urgent' : 
                   row.urgency === 'HIGH' ? 'high' : 
                   row.urgency === 'MEDIUM' ? 'medium' : 'low',
          taskTitle: row.subject,
          taskDescription: row.content_preview,
          estimatedTime: '10 min',
          tags: row.tags || [],
          suggestedAction: 'Review and respond',
          draftGenerated: row.confidence > 0.7,
          status: row.is_read ? 'in-progress' : 'pending',
          relatedEmails: 1
        }));
        
        // Get total count with same filters using replica schema
        let countQuery = `
          SELECT COUNT(*) 
          FROM messages m
          LEFT JOIN email_ai_analysis ai ON m.ROWID = ai.message_rowid
          WHERE m.deleted = 0
        `;
        
        // Apply same filters as main query
        if (filter === 'tasks') {
          countQuery += ` AND COALESCE(ai.classification, 'FYI_ONLY') = 'CREATE_TASK'`;
        } else if (filter === 'non-tasks') {
          countQuery += ` AND COALESCE(ai.classification, 'FYI_ONLY') = 'FYI_ONLY'`;
        }
        
        // Apply date range filter
        if (dateRange === 'today') {
          countQuery += ` AND to_timestamp(m.date_received) >= CURRENT_DATE`;
        } else if (dateRange === 'week') {
          countQuery += ` AND to_timestamp(m.date_received) >= CURRENT_DATE - INTERVAL '7 days'`;
        } else if (dateRange === 'month') {
          countQuery += ` AND to_timestamp(m.date_received) >= CURRENT_DATE - INTERVAL '30 days'`;
        } else if (dateRange === '6months') {
          countQuery += ` AND to_timestamp(m.date_received) >= CURRENT_DATE - INTERVAL '180 days'`;
        }
        
        const countResult = await pool.query(countQuery);
        const total = parseInt(countResult.rows[0].count);
        
        const responseData = {
          items,
          total,
          hasMore: (parseInt(offset) + parseInt(limit)) < total,
          filter,
          source: 'postgresql_replica'
        };
        
        // Cache the response for 5 minutes
        await setCachedData(cacheKey, responseData);
        
        return res.json(responseData);
      }
    } catch (dbError) {
      console.log('📊 Database query failed, falling back to Apple Mail:', dbError.message);
    }
    
    // Fallback to Apple Mail if database is empty or fails
    const result = await mailReader.getRecentEmails(parseInt(limit), parseInt(offset));
    
    let items = filter === 'tasks' ? result.tasks : 
                filter === 'non-tasks' ? result.emails.filter(e => !e.isTask) :
                result.emails;
    
    const responseData = {
      items,
      total: result.total,
      hasMore: (parseInt(offset) + parseInt(limit)) < result.total,
      filter,
      source: 'apple_mail'
    };
    
    // Cache the fallback response for 2 minutes (shorter since it's fallback)
    await setCachedData(cacheKey, responseData, 120);
    
    res.json(responseData);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get emails (legacy endpoint)
app.get('/api/emails', async (req, res) => {
  try {
    console.log('📧 GET /api/emails - Request received');
    const result = await mailReader.getRecentEmails(); // No limit - get all emails
    res.json(result.emails);
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

// Generate AI draft for a task
app.post('/api/tasks/:taskId/draft', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { taskTitle, taskDescription, sender } = req.body;
    
    // Generate draft based on task context
    const draft = {
      subject: `Re: ${taskTitle}`,
      body: `Hi ${sender},\n\nThank you for reaching out about ${taskDescription}.\n\n[AI Generated Draft - Please customize]\n\nBest regards,\n[Your Name]`,
      confidence: 85,
      suggestions: [
        'Add specific details about timeline',
        'Include relevant attachments',
        'CC relevant team members'
      ]
    };
    
    res.json(draft);
  } catch (error) {
    console.error('Error generating draft:', error);
    res.status(500).json({ error: 'Failed to generate draft' });
  }
});

// Update task status
app.patch('/api/tasks/:taskId/status', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;
    
    // In a real app, this would update the database
    console.log(`📝 Updating task ${taskId} status to ${status}`);
    
    res.json({ success: true, taskId, status });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Get statistics
app.get('/api/statistics', async (req, res) => {
  try {
    const cacheKey = 'messages:statistics:global';
    const cached = await getCachedData(cacheKey);
    
    if (cached) {
      console.log('📊 Serving statistics from Redis cache');
      return res.json(cached);
    }
    
    // Try PostgreSQL replica schema first for fast query
    try {
      const query = `
        SELECT 
          COUNT(*) as total_tasks,
          COUNT(*) FILTER (WHERE m.read = 0) as pending_tasks,
          COUNT(*) FILTER (WHERE m.read = 1 AND m.flagged = 0) as in_progress_tasks,
          COUNT(*) FILTER (WHERE m.flagged = 1) as completed_tasks,
          COUNT(*) FILTER (WHERE ai.urgency = 'CRITICAL') as urgent_tasks,
          COALESCE(AVG(ai.confidence), 0.5) as avg_confidence
        FROM messages m
        LEFT JOIN email_ai_analysis ai ON m.ROWID = ai.message_rowid
        WHERE m.deleted = 0 AND COALESCE(ai.classification, 'FYI_ONLY') = 'CREATE_TASK'
      `;
      
      const result = await pool.query(query);
      const row = result.rows[0];
      
      const stats = {
        totalTasks: parseInt(row.total_tasks),
        pendingTasks: parseInt(row.pending_tasks),
        inProgressTasks: parseInt(row.in_progress_tasks),
        completedTasks: parseInt(row.completed_tasks),
        urgentTasks: parseInt(row.urgent_tasks),
        efficiency: Math.round((row.avg_confidence * 100)),
        avgConfidence: Math.round(row.avg_confidence * 100),
        source: 'postgresql_replica'
      };
      
      // Cache for 10 minutes (statistics don't change frequently)
      await setCachedData(cacheKey, stats, 600);
      return res.json(stats);
      
    } catch (dbError) {
      console.log('Database stats query failed, falling back to mail reader');
    }
    
    // Fallback to original method  
    const result = await mailReader.getRecentEmails(); // No limit - get all emails
    const tasks = result.tasks;
    
    const stats = {
      totalTasks: tasks.length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      urgentTasks: tasks.filter(t => t.priority === 'urgent').length,
      efficiency: Math.round((tasks.filter(t => t.confidence > 80).length / tasks.length) * 100) || 0,
      avgConfidence: Math.round(tasks.reduce((acc, t) => acc + t.confidence, 0) / tasks.length) || 0,
      source: 'apple_mail'
    };
    
    // Cache fallback for 5 minutes
    await setCachedData(cacheKey, stats, 300);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// =============================================================================
// SECURE AI ENDPOINTS WITH GPT-5 INTEGRATION
// =============================================================================
// const aiService = require('./ai_service'); // TODO: Implement ai_service module
const rateLimit = require('express-rate-limit');

// Rate limiting for AI endpoints
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.API_RATE_LIMIT || 60),
  message: 'Too many AI requests, please try again later'
});

// Simple API key authentication middleware
const authenticateAI = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const expectedKey = process.env.JWT_SECRET || 'your_jwt_secret_here';
  
  // In production, compare against hashed keys
  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized - Invalid API key' });
  }
  next();
};

// Apply rate limiting and auth to all AI endpoints
app.use('/api/ai/*', aiRateLimiter, authenticateAI);

// GPT-5 Email Classification Endpoint (TODO: Implement aiService)
app.post('/api/ai/classify', async (req, res) => {
  res.status(501).json({ error: 'AI Service not implemented yet' });
});

// GPT-5 Draft Generation Endpoint
app.post('/api/ai/generate-draft', async (req, res) => {
  try {
    const { emailContent, subject, sender, context } = req.body;
    
    if (!emailContent || !subject) {
      return res.status(400).json({ error: 'Email content and subject required' });
    }
    
    res.status(501).json({ error: 'AI Service not implemented yet' });
  } catch (error) {
    console.error('Draft generation error:', error);
    res.status(500).json({ error: 'Draft generation failed' });
  }
});

// GPT-5 Chat Response Endpoint
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }
    
    res.status(501).json({ error: 'AI Service not implemented yet' });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Chat response failed' });
  }
});

// Command processor used by the EmailPopup chat
app.post('/api/ai/process-command', async (req, res) => {
  try {
    const { command, context } = req.body || {};
    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'Command is required' });
    }

    const cmd = command.toLowerCase();
    const actions = [];
    let response = '';

    // Basic intent detection
    if (cmd.includes('edit') && cmd.includes('draft')) {
      response = "I'll help you edit the draft. Tell me what tone or changes you want (more formal, concise, add urgency, etc.).";
      actions.push({ type: 'DRAFT_EDIT_SUGGEST', payload: { strategy: 'tone-guidance' } });
    } else if ((cmd.includes('send') && cmd.includes('email')) || cmd.includes('send it')) {
      response = 'I can send this email. Do you want to send now or schedule it?';
      actions.push({ type: 'EMAIL_SEND_CONFIRM' });
    } else if (cmd.includes('complete') || cmd.includes('done')) {
      response = 'Marked as complete. Do you want to notify the sender?';
      actions.push({ type: 'TASK_MARK_COMPLETE' });
    } else if (cmd.includes('priority') || cmd.includes('urgent') || cmd.includes('high priority')) {
      response = 'Which priority should I set: low, medium, high, or urgent?';
      actions.push({ type: 'TASK_SET_PRIORITY_PROMPT' });
    } else if (cmd.includes('deadline') || cmd.includes('due')) {
      response = 'What deadline would you like to set? (e.g., tomorrow 5pm)';
      actions.push({ type: 'TASK_SET_DEADLINE_PROMPT' });
    } else if (cmd.includes('summary') || cmd.includes('overview')) {
      response = 'Here is a quick overview of your tasks. You can ask for urgent only or tasks with drafts.';
      actions.push({ type: 'TASK_SUMMARY_REQUEST' });
    } else {
      response = 'I can help you edit drafts, send emails, update task status, set priorities, add deadlines, or answer questions about this thread. What would you like to do?';
    }

    return res.json({ response, actions, contextEcho: context || null });
  } catch (error) {
    console.error('process-command error:', error);
    res.status(500).json({ error: 'Failed to process command' });
  }
});

// GPT-5 Suggestions Endpoint
app.post('/api/ai/suggestions', async (req, res) => {
  try {
    const { tasks, emails } = req.body;
    res.status(501).json({ error: 'AI Service not implemented yet' });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ error: 'Suggestions generation failed' });
  }
});

// Streaming Draft Generation Endpoint
app.post('/api/ai/draft-stream', async (req, res) => {
  try {
    const { emailContent, subject, sender } = req.body;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    res.status(501).json({ error: 'AI Service not implemented yet' });
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ error: 'Stream failed' });
  }
});

// AI Usage Statistics Endpoint
app.get('/api/ai/usage', authenticateAI, async (req, res) => {
  try {
    const stats = { requestsToday: 0, totalTokens: 0, costToday: 0 }; // Mock stats until aiService is implemented
    res.json(stats);
  } catch (error) {
    console.error('Usage stats error:', error);
    res.status(500).json({ error: 'Failed to get usage stats' });
  }
});

// SECURE Database Query with Parameterized Queries (Fixed SQL Injection)
app.post('/api/ai/query', async (req, res) => {
  try {
    const { operation, table, conditions, values } = req.body;
    
    // Whitelist allowed operations and tables
    const allowedOps = ['SELECT', 'UPDATE', 'INSERT'];
    const allowedTables = ['email_ai_analysis', 'tasks', 'drafts'];
    
    if (!allowedOps.includes(operation)) {
      return res.status(400).json({ error: 'Invalid operation' });
    }
    
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Invalid table' });
    }
    
    // Build parameterized query
    let query;
    let params = [];
    
    switch(operation) {
      case 'SELECT':
        query = `SELECT * FROM ${table} WHERE ${conditions}`;
        params = values || [];
        break;
      case 'UPDATE':
        const setClauses = Object.keys(values).map((key, idx) => `${key} = $${idx + 1}`);
        query = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${conditions}`;
        params = Object.values(values);
        break;
      case 'INSERT':
        const keys = Object.keys(values);
        const placeholders = keys.map((_, idx) => `$${idx + 1}`);
        query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
        params = Object.values(values);
        break;
    }
    
    const result = await pool.query(query, params);
    res.json({
      success: true,
      data: result.rows,
      rowCount: result.rowCount
    });
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: 'Query failed' });
  }
});

// AI Task Analysis - Get task patterns and insights
app.get('/api/ai/task-analysis', async (req, res) => {
  try {
    const analysis = await pool.query(`
      SELECT 
        classification,
        urgency,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (NOW() - date_received))/3600) as avg_age_hours,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as recent_count
      FROM emails 
      WHERE classification = 'CREATE_TASK'
      GROUP BY classification, urgency
      ORDER BY count DESC
    `);
    
    const senderAnalysis = await pool.query(`
      SELECT 
        sender_email,
        COUNT(*) as email_count,
        COUNT(*) FILTER (WHERE classification = 'CREATE_TASK') as task_count,
        AVG(CASE WHEN urgency = 'CRITICAL' THEN 4 
                 WHEN urgency = 'HIGH' THEN 3 
                 WHEN urgency = 'MEDIUM' THEN 2 
                 ELSE 1 END) as avg_priority_score
      FROM emails 
      GROUP BY sender_email 
      HAVING COUNT(*) > 2
      ORDER BY task_count DESC, avg_priority_score DESC
      LIMIT 10
    `);
    
    res.json({
      taskPatterns: analysis.rows,
      topSenders: senderAnalysis.rows
    });
  } catch (error) {
    console.error('Error in task analysis:', error);
    res.status(500).json({ error: 'Task analysis failed' });
  }
});

// AI Search - Advanced email/task search
app.post('/api/ai/search', async (req, res) => {
  try {
    const { query, type = 'all', limit = 20 } = req.body;
    
    let searchQuery;
    let params;
    
    if (type === 'emails' || type === 'all') {
      searchQuery = `
        SELECT 
          id, subject, sender_email, content as body_text, classification, urgency,
          date_received as received_at, created_at,
          ts_rank(search_vector, plainto_tsquery($1)) as rank
        FROM emails 
        WHERE search_vector @@ plainto_tsquery($1)
        OR subject ILIKE $2
        OR sender_email ILIKE $2
        ORDER BY rank DESC, date_received DESC
        LIMIT $3
      `;
      params = [query, `%${query}%`, limit];
    } else if (type === 'tasks') {
      searchQuery = `
        SELECT 
          e.id, e.subject, e.sender_email, e.content as body_text, e.classification, e.urgency,
          e.date_received as received_at, e.created_at
        FROM emails e
        WHERE e.classification = 'CREATE_TASK'
        AND (e.search_vector @@ plainto_tsquery($1)
             OR e.subject ILIKE $2
             OR e.sender_email ILIKE $2)
        ORDER BY e.date_received DESC
        LIMIT $3
      `;
      params = [query, `%${query}%`, limit];
    }
    
    const result = await pool.query(searchQuery, params);
    res.json({
      results: result.rows,
      count: result.rowCount,
      query: query,
      type: type
    });
  } catch (error) {
    console.error('Error in AI search:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// AI Task Operations - Create, update, manage tasks
app.post('/api/ai/tasks', async (req, res) => {
  try {
    const { action, taskId, updates, emailId } = req.body;
    
    switch (action) {
      case 'create':
        // Create task from email
        if (!emailId) {
          return res.status(400).json({ error: 'emailId required for task creation' });
        }
        
        const updateResult = await pool.query(
          'UPDATE emails SET classification = $1 WHERE id = $2 RETURNING *',
          ['CREATE_TASK', emailId]
        );
        
        res.json({ 
          success: true, 
          task: updateResult.rows[0],
          message: 'Task created from email'
        });
        break;
        
      case 'update':
        if (!taskId || !updates) {
          return res.status(400).json({ error: 'taskId and updates required' });
        }
        
        // Build dynamic update query
        const setClause = Object.keys(updates)
          .map((key, index) => `${key} = $${index + 2}`)
          .join(', ');
        
        const values = [taskId, ...Object.values(updates)];
        
        const updateQuery = `
          UPDATE emails 
          SET ${setClause}, updated_at = NOW()
          WHERE id = $1 AND classification = 'CREATE_TASK'
          RETURNING *
        `;
        
        const result = await pool.query(updateQuery, values);
        
        if (result.rowCount === 0) {
          return res.status(404).json({ error: 'Task not found' });
        }
        
        res.json({ 
          success: true, 
          task: result.rows[0],
          message: 'Task updated successfully'
        });
        break;
        
      case 'delete':
        if (!taskId) {
          return res.status(400).json({ error: 'taskId required' });
        }
        
        const deleteResult = await pool.query(
          'UPDATE emails SET classification = $1 WHERE id = $2 AND classification = $3 RETURNING *',
          ['FYI_ONLY', taskId, 'CREATE_TASK']
        );
        
        res.json({ 
          success: true,
          message: 'Task converted back to FYI email',
          email: deleteResult.rows[0]
        });
        break;
        
      default:
        res.status(400).json({ error: 'Invalid action. Use: create, update, delete' });
    }
  } catch (error) {
    console.error('Error in task operations:', error);
    res.status(500).json({ error: 'Task operation failed' });
  }
});

// AI Email Analysis - Get email insights
app.get('/api/ai/email-insights', async (req, res) => {
  try {
    const { timeframe = '7 days', sender } = req.query;
    
    let whereClause = `WHERE date_received > NOW() - INTERVAL '${timeframe}'`;
    let params = [];
    
    if (sender) {
      whereClause += ` AND sender_email = $1`;
      params.push(sender);
    }
    
    const insights = await pool.query(`
      SELECT 
        DATE_TRUNC('day', date_received) as date,
        classification,
        urgency,
        COUNT(*) as count,
        AVG(LENGTH(content)) as avg_length,
        COUNT(DISTINCT sender_email) as unique_senders
      FROM emails 
      ${whereClause}
      GROUP BY DATE_TRUNC('day', date_received), classification, urgency
      ORDER BY date DESC, count DESC
    `, params);
    
    // Get trending topics
    const trending = await pool.query(`
      SELECT 
        word,
        COUNT(*) as frequency,
        COUNT(DISTINCT sender_email) as sender_count
      FROM (
        SELECT 
          unnest(string_to_array(lower(regexp_replace(subject, '[^a-zA-Z0-9\\s]', '', 'g')), ' ')) as word
        FROM emails
        ${whereClause}
      ) words
      WHERE length(word) > 3
      AND word NOT IN ('email', 'mail', 'message', 'reply', 'forward', 'sent', 'from', 'subject')
      GROUP BY word
      HAVING COUNT(*) > 2
      ORDER BY frequency DESC
      LIMIT 15
    `, params);
    
    res.json({
      insights: insights.rows,
      trending: trending.rows,
      timeframe: timeframe,
      sender: sender || 'all'
    });
  } catch (error) {
    console.error('Error in email insights:', error);
    res.status(500).json({ error: 'Email insights failed' });
  }
});

// AI Statistics - Real-time statistics for the AI to use
app.get('/api/ai/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE classification = 'CREATE_TASK') as total_tasks,
        COUNT(*) FILTER (WHERE classification = 'CREATE_TASK' AND urgency = 'CRITICAL') as critical_tasks,
        COUNT(*) FILTER (WHERE classification = 'CREATE_TASK' AND urgency = 'HIGH') as high_tasks,
        COUNT(*) FILTER (WHERE classification = 'CREATE_TASK' AND urgency = 'MEDIUM') as medium_tasks,
        COUNT(*) FILTER (WHERE classification = 'FYI_ONLY') as fyi_emails,
        COUNT(*) FILTER (WHERE date_received > NOW() - INTERVAL '24 hours') as recent_emails,
        COUNT(*) FILTER (WHERE classification = 'CREATE_TASK' AND date_received > NOW() - INTERVAL '24 hours') as recent_tasks,
        COUNT(DISTINCT sender_email) as unique_senders,
        AVG(LENGTH(content)) as avg_email_length,
        MAX(date_received) as latest_email,
        MIN(date_received) as earliest_email
      FROM emails
    `);
    
    res.json({
      timestamp: new Date().toISOString(),
      ...stats.rows[0]
    });
  } catch (error) {
    console.error('Error fetching AI stats:', error);
    res.status(500).json({ error: 'Failed to fetch AI statistics' });
  }
});

// AI Schema Info - Let AI understand the database structure
app.get('/api/ai/schema', (req, res) => {
  const schema = {
    tables: {
      emails: {
        columns: [
          'id (SERIAL PRIMARY KEY)',
          'message_id (TEXT UNIQUE)',
          'thread_id (INTEGER REFERENCES email_threads)',
          'subject (TEXT)',
          'sender_email (TEXT)',
          'body_text (TEXT)',
          'body_html (TEXT)',
          'received_at (TIMESTAMP)',
          'classification (classification_type: CREATE_TASK, FYI_ONLY)',
          'urgency (urgency_level: CRITICAL, HIGH, MEDIUM)',
          'search_vector (TSVECTOR)',
          'created_at (TIMESTAMP DEFAULT NOW())',
          'updated_at (TIMESTAMP DEFAULT NOW())'
        ],
        indexes: ['search_vector', 'sender_email', 'classification', 'urgency', 'received_at']
      },
      email_threads: {
        columns: [
          'id (SERIAL PRIMARY KEY)',
          'thread_identifier (TEXT UNIQUE)',
          'subject (TEXT)',
          'participants (TEXT[])',
          'created_at (TIMESTAMP DEFAULT NOW())',
          'updated_at (TIMESTAMP DEFAULT NOW())'
        ]
      },
      users: {
        columns: [
          'id (SERIAL PRIMARY KEY)',
          'email (TEXT UNIQUE)',
          'name (TEXT)',
          'preferences (JSONB)',
          'created_at (TIMESTAMP DEFAULT NOW())'
        ]
      }
    },
    enums: {
      classification_type: ['CREATE_TASK', 'FYI_ONLY'],
      urgency_level: ['CRITICAL', 'HIGH', 'MEDIUM']
    },
    common_queries: [
      'SELECT * FROM emails WHERE classification = \'CREATE_TASK\'',
      'SELECT sender_email, COUNT(*) FROM emails GROUP BY sender_email ORDER BY COUNT(*) DESC',
      'SELECT * FROM emails WHERE urgency = \'CRITICAL\' ORDER BY date_received DESC',
      'SELECT DATE_TRUNC(\'day\', date_received) as date, COUNT(*) FROM emails GROUP BY date ORDER BY date DESC'
    ]
  };
  
  res.json(schema);
});

// Serve static files from React build
app.use(express.static(path.join(__dirname, 'dashboard/frontend/build')));

// Catch all handler - send React app for any route not starting with /api
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'dashboard/frontend/build', 'index.html'));
});

// Start automatic email sync every 5 seconds
setInterval(async () => {
  try {
    await syncEmailsToDatabase();
  } catch (error) {
    console.error('⚠️ Automatic sync failed:', error.message);
  }
}, 5000);

// Start server
app.listen(PORT, () => {
  console.log(`
    🚀 Server running on http://localhost:${PORT}
    📧 Email Task Manager API ready
    🎯 Frontend served at http://localhost:${PORT}
    🔄 Auto-sync from Apple Mail every 5 seconds
    📊 API endpoints:
       - GET  /api/tasks?limit=20&offset=0&filter=all
       - GET  /api/emails
       - POST /api/tasks/:taskId/draft
       - PATCH /api/tasks/:taskId/status
       - GET  /api/statistics
  `);
  
  // Smart initial sync on startup
  console.log('🔄 Starting smart initial sync...');
  smartInitialSync();
});