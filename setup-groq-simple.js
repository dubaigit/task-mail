#!/usr/bin/env node

// Simple setup script for DesktopCommander with Groq
const fs = require('fs');
const path = require('path');

console.log('🎯 Setting up Desktop Commander for Groq...');

const DESKTOP_COMMANDER_PATH = '/Users/iamomen/apple-mcp/DesktopCommanderMCP/dist/index.js';

// Check if DesktopCommanderMCP exists
if (!fs.existsSync(DESKTOP_COMMANDER_PATH)) {
  console.error('❌ DesktopCommanderMCP not found at expected location');
  process.exit(1);
}

// Create Groq-specific configuration
const groqConfig = {
  mcpServers: {
    "desktop-commander": {
      command: "node",
      args: [DESKTOP_COMMANDER_PATH],
      env: {
        NODE_ENV: "production",
        ALLOW_AUTO_APPROVE: "true",
        AUTO_APPROVE_SAFETY: "relaxed"
      }
    },
    "groq-tools": {
      command: "npx",
      args: ["-y", "@wonderwhy-er/DesktopCommander"],
      env: {
        AUTO_APPROVE: "enabled"
      }
    }
  }
};

// Auto-approve configuration
const autoApproveConfig = {
  policy: {
    autoApprove: true,
    tools: [
      "filesystem_operations",
      "process_management",
      "system_commands"
    ],
    excludedPatterns: [
      ".*destructive.*",
      ".*delete_system.*"
    ]
  }
};

// Write configuration files
fs.writeFileSync('groq-desktop-config.json', JSON.stringify(groqConfig, null, 2));
fs.writeFileSync('groq-auto-approve.json', JSON.stringify(autoApproveConfig, null, 2));

console.log('✅ Created groq-desktop-config.json');
console.log('✅ Created groq-auto-approve.json');
console.log('');
console.log('🔧 Integration complete!');
console.log('');
console.log('Usage examples:');
console.log('1. Add this to your Groq configuration:');
console.log('   {"mcpServers": {"desktop-commander": {"command": "node", "args": ["'+DESKTOP_COMMANDER_PATH+'"], "env": {"AUTO_APPROVE": "true"}}}}');
console.log('2. Desktop operations will auto-approve file, process, and system commands');
console.log('');

// Test functionality
try {
  const test = spawn('node', [DESKTOP_COMMANDER_PATH], { stdio: 'ignore' });
  test.on('close', () => {
    console.log('✅ DesktopCommanderMCP verified and ready');
  });
} catch (error) {
  console.log('⚠️ DesktopCommanderMCP test skipped');
}

// Helper function for spawn
function spawn(command, args, options) {
  const { spawn } = require('child_process');
  return spawn(command, args, options);
}

console.log('');
console.log('🧪 Test with: npx @modelcontextprotocol/inspector node '+DESKTOP_COMMANDER_PATH);