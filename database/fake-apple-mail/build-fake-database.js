#!/usr/bin/env node
/**
 * Build script for creating fake Apple Mail SQLite database
 * This creates a realistic fake "Envelope Index" for testing
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');

class FakeAppleMailBuilder {
  constructor() {
    this.dbPath = path.join(__dirname, 'fake-envelope-index.sqlite');
    this.schemaPath = path.join(__dirname, 'create-fake-envelope-index.sql');
    this.seedPath = path.join(__dirname, 'seed-fake-data.sql');
  }

  async build() {
    console.log('🔨 Building fake Apple Mail SQLite database...');
    
    try {
      // Remove existing database
      try {
        await fs.unlink(this.dbPath);
        console.log('   Removed existing database');
      } catch (err) {
        // File doesn't exist, that's fine
      }

      // Create new database
      const db = new sqlite3.Database(this.dbPath);
      
      // Load and execute schema
      console.log('   Creating tables...');
      const schemaSQL = await fs.readFile(this.schemaPath, 'utf8');
      await this.executeSQL(db, schemaSQL);

      // Load and execute seed data
      console.log('   Seeding with fake email data...');
      const seedSQL = await fs.readFile(this.seedPath, 'utf8');
      await this.executeSQL(db, seedSQL);

      // Verify the data
      await this.verifyDatabase(db);

      // Close database
      await this.closeDatabase(db);

      console.log('✅ Fake Apple Mail database created successfully!');
      console.log(`   Location: ${this.dbPath}`);
      console.log(`   Size: ${await this.getFileSize()} bytes`);
      
      // Show usage instructions
      this.showUsageInstructions();
      
    } catch (error) {
      console.error('❌ Failed to build fake database:', error);
      process.exit(1);
    }
  }

  executeSQL(db, sql) {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async verifyDatabase(db) {
    console.log('   Verifying data...');
    
    const counts = await Promise.all([
      this.getCount(db, 'messages'),
      this.getCount(db, 'subjects'),
      this.getCount(db, 'addresses'), 
      this.getCount(db, 'recipients'),
      this.getCount(db, 'mailboxes'),
      this.getCount(db, 'attachments'),
      this.getCount(db, 'message_data')
    ]);

    const [messages, subjects, addresses, recipients, mailboxes, attachments, messageData] = counts;
    
    console.log(`   📧 Messages: ${messages}`);
    console.log(`   📝 Subjects: ${subjects}`);
    console.log(`   👥 Addresses: ${addresses}`);
    console.log(`   📨 Recipients: ${recipients}`);
    console.log(`   📁 Mailboxes: ${mailboxes}`);
    console.log(`   📎 Attachments: ${attachments}`);
    console.log(`   💬 Message Content: ${messageData}`);

    if (messages === 0) {
      throw new Error('No messages were created!');
    }
  }

  getCount(db, table) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  }

  closeDatabase(db) {
    return new Promise((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getFileSize() {
    const stats = await fs.stat(this.dbPath);
    return stats.size;
  }

  showUsageInstructions() {
    console.log('\n📋 Usage Instructions:');
    console.log('   1. Update your .env file:');
    console.log(`      APPLE_MAIL_DB_PATH=${this.dbPath}`);
    console.log('   2. Restart your application');
    console.log('   3. The sync service will now read from the fake database');
    console.log('\n💡 To switch back to real Apple Mail:');
    console.log('   APPLE_MAIL_DB_PATH=/Users/[username]/Library/Mail/V10/MailData/Envelope Index');
  }
}

// Run the builder
if (require.main === module) {
  const builder = new FakeAppleMailBuilder();
  builder.build();
}

module.exports = FakeAppleMailBuilder;