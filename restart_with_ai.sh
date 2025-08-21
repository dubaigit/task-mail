#!/bin/bash

# Kill existing server
pkill -f "node server.js"
sleep 2

# Start server with OpenAI API key
export OPENAI_API_KEY="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"
node server.js > server.log 2>&1 &

echo "✅ Server restarted with AI enabled"
echo "📝 Check server.log for details"

