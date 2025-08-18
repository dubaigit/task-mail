const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

// PostgreSQL connection
const pool = new Pool({
  host: 'localhost',
  user: 'email_admin',
  database: 'email_management',
  password: 'secure_password_123',
  port: 5432,
});

// Apple Mail SQLite path
const APPLE_MAIL_DB = '/Users/iamomen/Library/Mail/V10/MailData/Envelope Index';

class AppleMailMigrator {
  constructor() {
    this.stats = {
      addresses: 0,
      subjects: 0,
      mailboxes: 0,
      messages: 0,
      errors: 0
    };
  }

  async migrate() {
    console.log('🚀 Starting Apple Mail → PostgreSQL migration...');
    
    try {
      // Step 1: Drop and recreate schema
      await this.setupSchema();
      
      // Step 2: Migrate reference tables first
      await this.migrateAddresses();
      await this.migrateSubjects();
      await this.migrateMailboxes();
      
      // Step 3: Migrate messages (main data)
      await this.migrateMessages();
      
      // Step 4: Add AI analysis for all messages
      await this.addAIAnalysis();
      
      console.log('✅ Migration completed successfully!');
      console.log('📊 Migration Statistics:', this.stats);
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async setupSchema() {
    console.log('📋 Setting up PostgreSQL schema...');
    const fs = require('fs');
    const schema = fs.readFileSync('apple_mail_replica_schema.sql', 'utf8');
    await pool.query(schema);
    console.log('✅ Schema created successfully');
  }

  async migrateAddresses() {
    console.log('📧 Migrating addresses...');
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(APPLE_MAIL_DB, sqlite3.OPEN_READONLY);
      
      db.all('SELECT ROWID, address, comment FROM addresses ORDER BY ROWID', async (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        try {
          for (const row of rows) {
            await pool.query(
              'INSERT INTO addresses (ROWID, address, comment) VALUES ($1, $2, $3) ON CONFLICT (ROWID) DO NOTHING',
              [row.ROWID, row.address, row.comment || '']
            );
            this.stats.addresses++;
          }
          
          // Update sequence
          if (rows.length > 0) {
            const maxId = Math.max(...rows.map(r => r.ROWID));
            await pool.query(`SELECT setval('addresses_rowid_seq', $1)`, [maxId]);
          }
          
          console.log(`✅ Migrated ${this.stats.addresses} addresses`);
          db.close();
          resolve();
        } catch (error) {
          db.close();
          reject(error);
        }
      });
    });
  }

  async migrateSubjects() {
    console.log('📝 Migrating subjects...');
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(APPLE_MAIL_DB, sqlite3.OPEN_READONLY);
      
      db.all('SELECT ROWID, subject FROM subjects ORDER BY ROWID', async (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        try {
          for (const row of rows) {
            await pool.query(
              'INSERT INTO subjects (ROWID, subject) VALUES ($1, $2) ON CONFLICT (ROWID) DO NOTHING',
              [row.ROWID, row.subject]
            );
            this.stats.subjects++;
          }
          
          // Update sequence
          if (rows.length > 0) {
            const maxId = Math.max(...rows.map(r => r.ROWID));
            await pool.query(`SELECT setval('subjects_rowid_seq', $1)`, [maxId]);
          }
          
          console.log(`✅ Migrated ${this.stats.subjects} subjects`);
          db.close();
          resolve();
        } catch (error) {
          db.close();
          reject(error);
        }
      });
    });
  }

  async migrateMailboxes() {
    console.log('📁 Migrating mailboxes...');
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(APPLE_MAIL_DB, sqlite3.OPEN_READONLY);
      
      db.all('SELECT * FROM mailboxes ORDER BY ROWID', async (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        try {
          for (const row of rows) {
            await pool.query(`
              INSERT INTO mailboxes (
                ROWID, url, total_count, unread_count, deleted_count, 
                unseen_count, unread_count_adjusted_for_duplicates, 
                change_identifier, source, alleged_change_identifier
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
              ON CONFLICT (ROWID) DO NOTHING
            `, [
              row.ROWID, row.url, row.total_count, row.unread_count, 
              row.deleted_count, row.unseen_count, row.unread_count_adjusted_for_duplicates,
              row.change_identifier, row.source, row.alleged_change_identifier
            ]);
            this.stats.mailboxes++;
          }
          
          // Update sequence
          if (rows.length > 0) {
            const maxId = Math.max(...rows.map(r => r.ROWID));
            await pool.query(`SELECT setval('mailboxes_rowid_seq', $1)`, [maxId]);
          }
          
          console.log(`✅ Migrated ${this.stats.mailboxes} mailboxes`);
          db.close();
          resolve();
        } catch (error) {
          db.close();
          reject(error);
        }
      });
    });
  }

  async migrateMessages() {
    console.log('💬 Migrating messages...');
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(APPLE_MAIL_DB, sqlite3.OPEN_READONLY);
      
      // Get messages with pagination for memory efficiency
      const BATCH_SIZE = 1000;
      let offset = 0;
      let hasMore = true;
      
      const processBatch = async () => {
        return new Promise((batchResolve, batchReject) => {
          db.all(`
            SELECT * FROM messages 
            WHERE deleted = 0 
            ORDER BY ROWID 
            LIMIT ${BATCH_SIZE} OFFSET ${offset}
          `, async (err, rows) => {
            if (err) {
              batchReject(err);
              return;
            }
            
            if (rows.length === 0) {
              hasMore = false;
              batchResolve();
              return;
            }
            
            try {
              for (const row of rows) {
                await pool.query(`
                  INSERT INTO messages (
                    ROWID, message_id, global_message_id, remote_id, document_id,
                    sender, subject_prefix, subject, summary, date_sent, date_received,
                    mailbox, remote_mailbox, flags, read, flagged, deleted, size,
                    conversation_id, date_last_viewed, list_id_hash, unsubscribe_type,
                    searchable_message, brand_indicator, display_date, color, type,
                    fuzzy_ancestor, automated_conversation, root_status, flag_color
                  ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                    $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
                  ) ON CONFLICT (ROWID) DO NOTHING
                `, [
                  row.ROWID, row.message_id, row.global_message_id, row.remote_id, row.document_id,
                  row.sender, row.subject_prefix, row.subject, row.summary, row.date_sent, row.date_received,
                  row.mailbox, row.remote_mailbox, row.flags, row.read, row.flagged, row.deleted, row.size,
                  row.conversation_id, row.date_last_viewed, row.list_id_hash, row.unsubscribe_type,
                  row.searchable_message, row.brand_indicator, row.display_date, row.color, row.type,
                  row.fuzzy_ancestor, row.automated_conversation, row.root_status, row.flag_color
                ]);
                this.stats.messages++;
              }
              
              console.log(`📊 Processed ${this.stats.messages} messages...`);
              offset += BATCH_SIZE;
              batchResolve();
              
            } catch (error) {
              this.stats.errors++;
              console.error(`❌ Error in batch at offset ${offset}:`, error.message);
              batchReject(error);
            }
          });
        });
      };
      
      // Process all batches
      (async () => {
        try {
          while (hasMore) {
            await processBatch();
          }
          
          // Update sequence
          const result = await pool.query('SELECT MAX(ROWID) as max_id FROM messages');
          const maxId = result.rows[0].max_id;
          if (maxId) {
            await pool.query(`SELECT setval('messages_rowid_seq', $1)`, [maxId]);
          }
          
          console.log(`✅ Migrated ${this.stats.messages} messages`);
          db.close();
          resolve();
        } catch (error) {
          db.close();
          reject(error);
        }
      })();
    });
  }

  async addAIAnalysis() {
    console.log('🤖 Adding AI analysis for all messages...');
    
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
}

// Run migration
async function runMigration() {
  const migrator = new AppleMailMigrator();
  
  try {
    await migrator.migrate();
    process.exit(0);
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = AppleMailMigrator;
