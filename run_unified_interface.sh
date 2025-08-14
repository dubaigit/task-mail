#!/bin/bash

# Unified Email Intelligence Interface Startup Script
# Starts the FastAPI server with proper configuration

set -e

echo "🚀 Starting Unified Email Intelligence Interface..."

# Change to script directory
cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source .venv/bin/activate

# Install/upgrade dependencies
echo "📥 Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements_unified.txt

# Set environment variables for AI integration
export OPENAI_API_KEY="${OPENAI_API_KEY:-}"
export EMAIL_AI_CLASSIFY_MODEL="${EMAIL_AI_CLASSIFY_MODEL:-gpt-5-nano-2025-08-07}"
export EMAIL_AI_DRAFT_MODEL="${EMAIL_AI_DRAFT_MODEL:-gpt-5-mini-2025-08-07}"

# Port configuration
PORT="${PORT:-8003}"

echo "🧠 AI Models Configuration:"
echo "  Classification: ${EMAIL_AI_CLASSIFY_MODEL}"
echo "  Draft Generation: ${EMAIL_AI_DRAFT_MODEL}"
echo "  OpenAI API: $([ -n "$OPENAI_API_KEY" ] && echo "✅ Configured" || echo "❌ Not configured (will use fallback patterns)")"

echo ""
echo "🌐 Starting server on port ${PORT}..."
echo "📍 Interface URL: http://localhost:${PORT}"
echo ""
echo "💡 Features:"
echo "  • GPT-5 powered email classification"
echo "  • Intelligent draft generation"
echo "  • Real-time task extraction"
echo "  • Smart filtering and search"
echo "  • One-click actions"
echo ""

# Update chat server if available
curl -s -X POST http://localhost:9802/chat \
     -H 'Content-Type: application/json' \
     -d '{"agent":"python-pro","message":"Unified interface starting on port '${PORT}'"}' \
     > /dev/null 2>&1 || true

# Start the FastAPI server
python3 unified_email_interface.py

echo ""
echo "👋 Unified Email Intelligence Interface stopped."