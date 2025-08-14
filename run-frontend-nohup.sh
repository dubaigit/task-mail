#!/usr/bin/env bash
set -euo pipefail

# Start React frontend under nohup
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/dashboard/frontend"
LOG_FILE="$ROOT_DIR/frontend.log"
PID_FILE="$ROOT_DIR/frontend.pid"

# Check if frontend directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "Frontend directory not found: $FRONTEND_DIR"
    exit 1
fi

cd "$FRONTEND_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install > /dev/null 2>&1
fi

# Kill existing frontend if running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "Stopping existing frontend (PID $OLD_PID)..."
        kill "$OLD_PID" 2>/dev/null || true
        sleep 2
    fi
fi

# Start frontend with nohup
echo "Starting frontend server..."
BROWSER=none PORT=3001 nohup npm start > "$LOG_FILE" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"

echo "Frontend started (PID $NEW_PID) on http://localhost:3001"
echo "Logs: $LOG_FILE"
echo "PID file: $PID_FILE"