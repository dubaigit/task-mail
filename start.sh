#!/bin/bash

echo "🚀 Starting Apple MCP Task Manager..."

# Function to kill process on a specific port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port)
    if [ ! -z "$pid" ]; then
        echo "🔫 Killing process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null || true
        sleep 1
    else
        echo "✅ Port $port is free"
    fi
}

# Kill processes on ports 8000 and 3000
echo "🧹 Cleaning up ports..."
kill_port 8000
kill_port 3000

# Start backend server on port 8000
echo "🔧 Starting backend server on port 8000..."
PORT=8000 npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend on port 3000
echo "🎨 Starting frontend on port 3000..."
cd dashboard/frontend
PORT=3000 npm start &
FRONTEND_PID=$!

# Wait for both processes
echo "⏳ Waiting for servers to start..."
wait $BACKEND_PID $FRONTEND_PID