#!/usr/bin/env node
require('dotenv').config();
const AIEmailProcessor = require('./ai-processor');

const processor = new AIEmailProcessor();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await processor.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await processor.stop();
    process.exit(0);
});

// Start the processor
processor.start().catch(error => {
    console.error('💥 Failed to start AI processor:', error);
    process.exit(1);
});

console.log('✅ AI Email Processor started successfully');
console.log('📊 Use Ctrl+C to stop gracefully');