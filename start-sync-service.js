#!/usr/bin/env node

/**
 * Apple Mail to Supabase Sync Service Starter
 * 
 * This script starts the email synchronization service that:
 * 1. Connects to Apple Mail SQLite database
 * 2. Syncs emails to Supabase in real-time
 * 3. Monitors for new emails every 5 seconds
 */

require('dotenv').config();
const syncService = require('./src/services/apple-mail-sync');

async function startSyncService() {
  console.log('🚀 Starting Apple Mail to Supabase Sync Service...');
  
  try {
    await syncService.initialize();
    await syncService.start();
    console.log('✅ Sync service started successfully');
    console.log('📧 Monitoring for new emails every 5 seconds...');
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping sync service...');
      await syncService.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Stopping sync service...');
      await syncService.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start sync service:', error.message);
    process.exit(1);
  }
}

// Start the service
startSyncService();