const { Pool } = require('pg');
const fs = require('fs');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/email_tasks'
});

async function updateSchema() {
  try {
    console.log('🔄 Updating email_ai_analysis table schema...');
    
    // Remove existing constraint
    await pool.query(`ALTER TABLE email_ai_analysis DROP CONSTRAINT IF EXISTS email_ai_analysis_classification_check`);
    console.log('✅ Removed old classification constraint');
    
    // Increase VARCHAR length
    await pool.query(`ALTER TABLE email_ai_analysis ALTER COLUMN classification TYPE VARCHAR(30)`);
    console.log('✅ Increased classification column length to VARCHAR(30)');
    
    // Add new constraint with all classification types
    await pool.query(`
      ALTER TABLE email_ai_analysis ADD CONSTRAINT email_ai_analysis_classification_check 
      CHECK (classification IN (
        'NEEDS_REPLY',
        'CREATE_TASK', 
        'APPROVAL_REQUIRED',
        'DELEGATE',
        'FYI_ONLY',
        'FOLLOW_UP',
        'MEETING_REQUEST',
        'MEETING_CANCELLED',
        'CALENDAR_CONFLICT',
        'DOCUMENT_REVIEW',
        'SIGNATURE_REQUIRED',
        'PAYMENT_PROCESSING',
        'ESCALATION',
        'DEADLINE_REMINDER',
        'CUSTOMER_COMPLAINT',
        'INTERNAL_ANNOUNCEMENT',
        'PROJECT_UPDATE',
        'BLOCKED_WAITING'
      ))
    `);
    console.log('✅ Added new classification constraint with all EmailClassification types');
    
    console.log('🎉 Schema update completed successfully!');
    
  } catch (error) {
    console.error('❌ Schema update failed:', error);
  } finally {
    await pool.end();
  }
}

updateSchema();