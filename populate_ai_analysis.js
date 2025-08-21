#!/usr/bin/env node

// Quick script to populate email_ai_analysis table with initial classifications
const { Pool } = require('pg');

const pool = new Pool({
  user: 'email_admin',
  host: 'localhost',
  database: 'email_management',
  password: 'secure_password_123',
  port: 5432,
});

async function populateAIAnalysis() {
  try {
    console.log('🤖 Populating AI analysis for messages...');
    
    // Get all messages that don't have AI analysis yet
    const messagesResult = await pool.query(`
      SELECT m.rowid, s.subject 
      FROM messages m
      LEFT JOIN subjects s ON m.subject = s.rowid
      LEFT JOIN email_ai_analysis ea ON m.rowid = ea.message_rowid
      WHERE ea.message_rowid IS NULL
      LIMIT 1000
    `);
    
    console.log(`📧 Found ${messagesResult.rows.length} messages without AI analysis`);
    
    let taskCount = 0;
    let fyiCount = 0;
    
    for (const msg of messagesResult.rows) {
      const subject = msg.subject || '';
      
      // Simple classification based on keywords
      let classification = 'FYI_ONLY';
      let urgency = 'low';
      let confidence = 70;
      
      // Task indicators
      const taskKeywords = [
        'action required', 'urgent', 'deadline', 'submit', 'review',
        'approve', 'complete', 'follow up', 'respond', 'meeting',
        'call', 'schedule', 'prepare', 'send', 'update', 'fix',
        'resolve', 'investigate', 'check', 'verify', 'confirm'
      ];
      
      const subjectLower = subject.toLowerCase();
      const isTask = taskKeywords.some(keyword => subjectLower.includes(keyword));
      
      if (isTask) {
        classification = 'CREATE_TASK';
        urgency = subjectLower.includes('urgent') || subjectLower.includes('asap') ? 'high' : 'medium';
        confidence = 85;
        taskCount++;
      } else {
        fyiCount++;
      }
      
      // Insert AI analysis
      await pool.query(`
        INSERT INTO email_ai_analysis (
          message_rowid, classification, urgency, confidence, 
          processed_at, processing_status
        ) VALUES ($1, $2, $3, $4, NOW(), 'completed')
        ON CONFLICT (message_rowid) DO NOTHING
      `, [msg.rowid, classification, urgency, confidence]);
    }
    
    console.log(`✅ Classified ${taskCount} as tasks and ${fyiCount} as FYI`);
    console.log('🎉 AI analysis population complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

populateAIAnalysis();

