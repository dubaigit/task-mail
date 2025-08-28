#!/usr/bin/env node
/**
 * Generate additional fake email data for testing
 * This script adds more emails to the existing fake database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class FakeDataGenerator {
  constructor() {
    this.dbPath = path.join(__dirname, 'fake-envelope-index.sqlite');
    this.db = null;
  }

  async generate(count = 50) {
    console.log(`🔄 Generating ${count} additional fake emails...`);
    
    try {
      this.db = new sqlite3.Database(this.dbPath);
      
      // Get current max values
      const maxIds = await this.getMaxIds();
      
      // Generate fake email scenarios
      const emails = this.generateEmailScenarios(count, maxIds);
      
      for (const email of emails) {
        await this.insertEmail(email);
      }
      
      console.log(`✅ Generated ${count} additional emails successfully!`);
      await this.showStats();
      
    } catch (error) {
      console.error('❌ Failed to generate data:', error);
    } finally {
      if (this.db) {
        await this.closeDatabase();
      }
    }
  }

  async getMaxIds() {
    const queries = [
      'SELECT MAX(ROWID) as max FROM messages',
      'SELECT MAX(ROWID) as max FROM subjects', 
      'SELECT MAX(ROWID) as max FROM addresses'
    ];
    
    const results = await Promise.all(
      queries.map(query => this.query(query))
    );
    
    return {
      messageId: results[0].max || 0,
      subjectId: results[1].max || 0,
      addressId: results[2].max || 0
    };
  }

  generateEmailScenarios(count, maxIds) {
    const scenarios = [
      // Work emails
      { type: 'meeting', urgent: false, hasAttachment: false },
      { type: 'code_review', urgent: true, hasAttachment: true },
      { type: 'project_update', urgent: false, hasAttachment: false },
      { type: 'client_communication', urgent: false, hasAttachment: true },
      { type: 'system_notification', urgent: true, hasAttachment: false },
      // Personal emails
      { type: 'newsletter', urgent: false, hasAttachment: false },
      { type: 'social', urgent: false, hasAttachment: false },
      { type: 'shopping', urgent: false, hasAttachment: false },
      { type: 'banking', urgent: true, hasAttachment: true },
      { type: 'travel', urgent: false, hasAttachment: true }
    ];

    const subjects = {
      meeting: [
        'Weekly Standup - Sprint Review',
        'Q1 Planning Session Agenda',
        'Client Call Rescheduled',
        'All-Hands Meeting Notes',
        'Team Retrospective Feedback'
      ],
      code_review: [
        'PR Ready: User Authentication Fix',
        'Code Review: Database Migration',
        'Urgent: Security Vulnerability Fix',
        'Review Requested: API Endpoints',
        'Hotfix: Production Bug #789'
      ],
      project_update: [
        'Project Alpha - Status Update',
        'Development Progress Report',
        'Milestone 2.1 Completed',
        'Budget Review - Q4 Results',
        'Timeline Adjustment Proposal'
      ],
      client_communication: [
        'Re: Feature Request Discussion',
        'Proposal: Enhanced API Integration', 
        'Client Feedback - Dashboard UX',
        'Implementation Timeline Update',
        'Support Ticket Resolution'
      ],
      system_notification: [
        'Server Alert: High CPU Usage',
        'Backup Completed Successfully',
        'SSL Certificate Expiring Soon',
        'Database Maintenance Complete',
        'Security Scan Results'
      ],
      newsletter: [
        'Tech Weekly - AI Developments',
        'Industry News Digest',
        'Product Updates - December 2024',
        'Best Practices Newsletter',
        'Community Highlights'
      ],
      social: [
        'Weekend Plans Discussion',
        'Holiday Party Planning',
        'Book Club Meeting',
        'Lunch Plans Tomorrow?',
        'Coffee Chat Invitation'
      ],
      shopping: [
        'Your Order Has Shipped',
        'Holiday Sale - 50% Off',
        'Wishlist Item Back in Stock',
        'Payment Receipt #12345',
        'Return Policy Reminder'
      ],
      banking: [
        'Monthly Statement Available',
        'Security Alert: Password Changed',
        'Transaction Notification',
        'Credit Score Update',
        'Account Review Required'
      ],
      travel: [
        'Flight Confirmation #ABC123',
        'Hotel Booking Confirmed',
        'Travel Insurance Reminder',
        'Check-in Now Available',
        'Trip Itinerary Updated'
      ]
    };

    const senders = {
      meeting: ['team-lead@company.com', 'hr@company.com', 'manager@company.com'],
      code_review: ['dev1@company.com', 'dev2@company.com', 'lead-dev@company.com'],
      project_update: ['pm@company.com', 'stakeholder@company.com', 'cto@company.com'],
      client_communication: ['client@external.com', 'support@company.com', 'sales@company.com'],
      system_notification: ['alerts@company.com', 'monitoring@company.com', 'ops@company.com'],
      newsletter: ['newsletter@techblog.com', 'updates@service.com', 'news@platform.com'],
      social: ['friend@personal.com', 'colleague@work.com', 'family@home.com'],
      shopping: ['orders@store.com', 'sales@retailer.com', 'shipping@logistics.com'],
      banking: ['alerts@bank.com', 'support@financial.com', 'security@banking.com'],
      travel: ['booking@travel.com', 'airline@flights.com', 'hotel@stays.com']
    };

    const emails = [];
    const now = Math.floor(Date.now() / 1000);
    
    for (let i = 0; i < count; i++) {
      const scenario = scenarios[i % scenarios.length];
      const subjectList = subjects[scenario.type];
      const senderList = senders[scenario.type];
      
      const subject = subjectList[Math.floor(Math.random() * subjectList.length)];
      const sender = senderList[Math.floor(Math.random() * senderList.length)];
      
      // Random timestamp in the last 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      const timestamp = now - (daysAgo * 24 * 60 * 60);
      
      emails.push({
        messageId: `generated-msg-${maxIds.messageId + i + 1}`,
        globalMessageId: `generated-global-${maxIds.messageId + i + 1}`,
        subject,
        sender,
        timestamp,
        scenario,
        read: Math.random() > 0.3, // 70% read
        flagged: Math.random() > 0.9, // 10% flagged
        size: Math.floor(Math.random() * 8192) + 512
      });
    }
    
    return emails;
  }

  async insertEmail(email) {
    // Insert subject if new
    const subjectId = await this.insertOrGetSubject(email.subject);
    
    // Insert sender if new  
    const senderId = await this.insertOrGetAddress(email.sender, this.extractName(email.sender));
    
    // Insert message
    const messageResult = await this.run(`
      INSERT INTO messages (
        message_id, global_message_id, subject, sender, 
        date_sent, date_received, mailbox, flags, read, flagged, 
        size, conversation_id
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?)
    `, [
      email.messageId,
      email.globalMessageId, 
      subjectId,
      senderId,
      email.timestamp,
      email.timestamp,
      email.read ? 1 : 0,
      email.flagged ? 1 : 0,
      email.size,
      Math.floor(Math.random() * 1000) + 1
    ]);
    
    const messageRowId = messageResult.lastID;
    
    // Add recipient (self)
    const selfAddressId = await this.insertOrGetAddress('test-user@taskmail.com', 'Test User');
    await this.run(`
      INSERT INTO recipients (message, type, address, position)
      VALUES (?, 0, ?, 0)
    `, [messageRowId, selfAddressId]);
    
    // Maybe add attachment
    if (email.scenario.hasAttachment && Math.random() > 0.7) {
      const attachments = [
        'document.pdf',
        'spreadsheet.xlsx', 
        'presentation.pptx',
        'image.png',
        'report.docx'
      ];
      const filename = attachments[Math.floor(Math.random() * attachments.length)];
      
      await this.run(`
        INSERT INTO attachments (message, attachment_id, name, size)
        VALUES (?, ?, ?, ?)
      `, [
        messageRowId,
        `att-gen-${messageRowId}`,
        filename,
        Math.floor(Math.random() * 2097152) + 10240 // 10KB to 2MB
      ]);
    }
  }

  async insertOrGetSubject(subject) {
    const existing = await this.query('SELECT ROWID FROM subjects WHERE subject = ?', [subject]);
    if (existing) return existing.ROWID;
    
    const result = await this.run('INSERT INTO subjects (subject) VALUES (?)', [subject]);
    return result.lastID;
  }

  async insertOrGetAddress(address, comment) {
    const existing = await this.query(
      'SELECT ROWID FROM addresses WHERE address = ? AND comment = ?', 
      [address, comment]
    );
    if (existing) return existing.ROWID;
    
    const result = await this.run(
      'INSERT INTO addresses (address, comment) VALUES (?, ?)', 
      [address, comment]
    );
    return result.lastID;
  }

  extractName(email) {
    const parts = email.split('@')[0].split(/[.-]/);
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }

  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  async showStats() {
    const stats = await Promise.all([
      this.query('SELECT COUNT(*) as count FROM messages'),
      this.query('SELECT COUNT(*) as count FROM subjects'),
      this.query('SELECT COUNT(*) as count FROM addresses'),
      this.query('SELECT COUNT(*) as count FROM recipients'),
      this.query('SELECT COUNT(*) as count FROM attachments')
    ]);
    
    console.log('\n📊 Database Statistics:');
    console.log(`   📧 Total Messages: ${stats[0].count}`);
    console.log(`   📝 Unique Subjects: ${stats[1].count}`);
    console.log(`   👥 Email Addresses: ${stats[2].count}`);
    console.log(`   📨 Recipients: ${stats[3].count}`);
    console.log(`   📎 Attachments: ${stats[4].count}`);
  }

  closeDatabase() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

// CLI usage
if (require.main === module) {
  const count = parseInt(process.argv[2]) || 50;
  const generator = new FakeDataGenerator();
  generator.generate(count);
}

module.exports = FakeDataGenerator;