# Groq Desktop Commander Configuration

## Setup Desktop Commander for Groq Code CLI with Auto-Approve

### 1. Installation
```bash
npx @smithery/cli install @wonderwhy-er/desktop-commander --client claude
```

### 2. Auto-Approve Configuration

Create a separate config file for Groq tools with auto-approve enabled:

```json
{
  "mcpServers": {
    "groq-desktop-commander": {
      "command": "node",
      "args": ["/Users/iamomen/apple-mcp/DesktopCommanderMCP/dist/index.js"],
      "env": {
        "NODE_TLS_REJECT_UNAUTHORIZED": "0",
        "ALLOW_AUTO_APPROVE": "true",
        "AUTO_APPROVE_PATTERNS": ["read_file", "edit_file", "create_file", "execute_command"]
      }
    },
    "groq-code": {
      "command": "node",
      "args": ["groq-code-cli/dist/index.js"],
      "env": {
        "GROQ_API_KEY": "your-groq-key",
        "AUTO_APPROVE": "true"
      }
    }
  },
  "mcpPolicy": {
    "autoApprove": [
      "desktop-commander.*",
      "groq-tools.*"
    ],
    "allowedTools": [
      "read_file",
      "edit_file", 
      "create_file",
      "delete_file",
      "execute_command",
      "list_files",
      "search_files"
    ]
  }
}
```

### 3. Manual Setup for Groq Code CLI

#### Option A: Using MCP Inspector
```bash
npx @modelcontextprotocol/inspector node /Users/iamomen/apple-mcp/DesktopCommanderMCP/dist/index.js
```

#### Option B: Direct Configuration
Add to your groq-code-cli configuration:

```javascript
import { DesktopCommander } from '@wonderwhy-er/desktop-commander/dist/index.js';

export const groqTools = {
  desktopCommand: {
    name: 'desktop_command',
    description: 'Execute desktop commands and manage system operations',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          enum: [
            'list_processes',
            'kill_process', 
            'open_app',
            'close_app',
            'window_manage',
            'system_info',
            'screenshot',
            'brightness',
            'volume'
          ]
        },
        args: {
          type: 'object',
          description: 'Command arguments'
        }
      },
      required: ['command', 'args']
    },
    autoApprove: true
  }
};
```

### 4. Quick Integration Script

Create the integration script for Groq:

```bash
#!/bin/bash
# setup-groq-desktop-commander.sh

echo "Setting up Desktop Commander for Groq with auto-approve..."

# Check if DesktopCommanderMCP is available
if [ -d "/Users/iamomen/apple-mcp/DesktopCommanderMCP" ]; then
    echo "✅ DesktopCommanderMCP found"
else
    echo "❌ DesktopCommanderMCP not found, cloning..."
    git clone https://github.com/wonderwhy-er/DesktopCommanderMCP.git /Users/iamomen/apple-mcp/DesktopCommanderMCP
    cd /Users/iamomen/apple-mcp/DesktopCommanderMCP && npm install && npm run build
fi

# Create groq-tools config
cat > /tmp/groq-desktop-commander.json << 'EOF'
{
  "mcpServers": {
    "desktop-commander": {
      "command": "node",
      "args": ["/Users/iamomen/apple-mcp/DesktopCommanderMCP/dist/index.js"],
      "env": {
        "NODE_ENV": "production",
        "AUTO_APPROVE": "enabled"
      }
    }
  }
}
EOF

echo "✅ Configuration created: /tmp/groq-desktop-commander.json"
echo "💡 Import this config into your Groq tools setup"
```

### 5. Usage Example with Groq

Once configured, you can use desktop commands directly:

```javascript
// Groq API with auto-approved desktop commands
const result = await groqClient.tools.exec({
  tool: 'desktop_command',
  command: 'list_processes',
  auto_approve: true
});
```

### 6. Auto-Approve Settings

Create `.mcp-policy.json` in your working directory:

```json
{
  "autoApprove": {
    "tools": [
      "desktop-commander",
      "filesystem",
      "process"
    ],
    "operations": [
      "read",
      "write",
      "list",
      "execute",
      "screenshot"
    ]
  }
}
```

### 7. Test the Integration

```bash
# Test with MCP Inspector
npx @modelcontextprotocol/inspector node /Users/iamomen/apple-mcp/DesktopCommanderMCP/dist/index.js

# Test auto-approve
node /Users/iamomen/apple-mcp/DesktopCommanderMCP/dist/index.js --test-auto-approve
```