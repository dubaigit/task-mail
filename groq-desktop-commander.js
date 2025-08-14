#!/usr/bin/env node

// groq-desktop-commander.js - Integration script for Groq with DesktopCommander
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import path from 'path';

const DESKTOP_COMMANDER_PATH = '/Users/iamomen/apple-mcp/DesktopCommanderMCP/dist/index.js';
const GROQ_CONFIG_FILE = path.join(process.cwd(), 'groq-desktop-config.json');

// Create Groq-compatible configuration
const createGroqConfig = () => ({
  mcpServers: {
    "desktop-commander": {
      command: "node",
      args: [DESKTOP_COMMANDER_PATH],
      env: {
        NODE_ENV: "production",
        ALLOW_AUTO_APPROVE: "true",
        AUTO_APPROVE_ALL: "true"
      }
    }
  }
});

// Auto-approve configuration
const createAutoApproveConfig = () => ({
  mcpPolicy: {
    autoApprove: {
      tools: [
        "list_files",
        "read_file", 
        "create_file",
        "edit_file",
        "delete_file",
        "execute_command"
      ],
      desktopTools: [
        "get_system_info",
        "list_processes", 
        "kill_process",
        "open_app",
        "close_app",
        "manage_windows",
        "take_screenshot"
      ]
    },
    allowedPatterns: [
      "^read_file",
      "^create_file", 
      "^edit_file",
      "^list_files",
      "^execute_command.*",
      "^_fs_.*",
      "^_process_.*"
    ]
  }
});

// Main setup function
async function setupDesktopCommanderForGroq() {
  console.log('🔧 Setting up Desktop Commander for Groq...');
  
  // Verify DesktopCommanderMCP is available
  try {
    const { spawn } = await import('child_process');
    const test = spawn('node', [DESKTOP_COMMANDER_PATH], { stdio: 'pipe' });
    
    test.on('error', () => {
      console.error('❌ DesktopCommanderMCP not found at:', DESKTOP_COMMANDER_PATH);
      process.exit(1);
    });
    
    test.kill();
    console.log('✅ DesktopCommanderMCP found');
  } catch (error) {
    console.error('❌ Error checking DesktopCommanderMCP:', error.message);
    process.exit(1);
  }
  
  // Create configuration files
  const groqConfig = createGroqConfig();
  const autoApproveConfig = createAutoApproveConfig();
  
  // Write configuration files
  writeFileSync(GROQ_CONFIG_FILE, JSON.stringify(groqConfig, null, 2));
  writeFileSync('groq-auto-approve.json', JSON.stringify(autoApproveConfig, null, 2));
  
  console.log('✅ Configuration created: groq-desktop-config.json');
  console.log('✅ Auto-approve config: groq-auto-approve.json');
  
  console.log('\n🎯 To use with Groq:');
  console.log('1. Import the configuration: mcp load_config ./groq-desktop-config.json');
  console.log('2. Auto-approve is enabled for file operations');
  console.log('3. Desktop tools can be used directly');
}

// Tool registry for Groq
export const groqDesktopTools = {
  name: "desktop_commander",
  displayName: "Desktop Commander",
  description: "Desktop management and automation tool",
  tools: {
    list_files: {
      name: "list_files",
      description: "List files and directories",
      schema: {
        type: "object",
        properties: {
          directory: { type: "string", description: "Directory to list" },
          recursive: { type: "boolean", description: "List recursively" }
        }
      },
      autoApprove: true
    },
    
    system_info: {
      name: "get_system_info",
      description: "Get system information",
      schema: {
        type: "object",
        properties: {
          detailed: { type: "boolean", description: "Detailed system info" }
        }
      },
      autoApprove: true
    },
    
    manage_windows: {
      name: "manage_windows",
      description: "Manage application windows",
      schema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["minimize", "maximize", "close"] },
          app: { type: "string", description: "Application name" }
        }
      },
      autoApprove: true
    }
  }
};

// CLI Usage
const [,, command, ...args] = process.argv;

switch (command) {
  case 'setup':
    setupDesktopCommanderForGroq();
    break;
  case 'config':
    console.log(JSON.stringify(createGroqConfig(), null, 2));
    break;
  case 'approve':
    console.log(JSON.stringify(createAutoApproveConfig(), null, 2));
    break;
  default:
    console.log('🤖 Groq Desktop Commander Integration');
    console.log('Usage:');
    console.log('  node groq-desktop-commander.js setup  # Complete setup');
    console.log('  node groq-desktop-commander.js config # Show config');
    console.log('  node groq-desktop-commander.js approve # Show approval settings');
    break;
}

// Export for programmatic use
export {
  createGroqConfig,
  createAutoApproveConfig,
  setupDesktopCommanderForGroq,
  groqDesktopTools
};