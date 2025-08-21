#!/bin/bash

# Apple MCP Email Task Manager - Development Startup Script
# This script starts both backend and frontend services with proper configuration

set -e

echo "🚀 Starting Apple MCP Email Task Manager - Development Mode"
echo "============================================================"

# Check if Docker services are running
echo "📦 Checking Docker services..."
if ! docker-compose ps | grep -q "Up"; then
    echo "Starting Docker services (PostgreSQL and Redis)..."
    docker-compose up -d
    echo "⏳ Waiting for services to be ready..."
    sleep 10
fi

# Start backend server
echo "🔧 Starting backend server on port 8000..."
cd "$(dirname "$0")/.."
npm start > logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# Check if backend is healthy
for i in {1..10}; do
    if curl -s http://localhost:8000/api/health > /dev/null; then
        echo "✅ Backend is healthy and running on port 8000"
        break
    fi
    echo "Waiting for backend... (attempt $i/10)"
    sleep 2
done

# Start frontend server
echo "🎨 Starting frontend React app on port 3000..."
cd dashboard/frontend
npm start > ../../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Wait for frontend to start
echo "⏳ Waiting for frontend to start..."
sleep 10

# Check if frontend is running
for i in {1..10}; do
    if curl -s http://localhost:3000 > /dev/null; then
        echo "✅ Frontend is running on port 3000"
        break
    fi
    echo "Waiting for frontend... (attempt $i/10)"
    sleep 2
done

echo ""
echo "🎉 All services are now running!"
echo "============================================================"
echo "📈 Frontend:     http://localhost:3000"
echo "🔧 Backend API:  http://localhost:8000/api"
echo "📊 Health Check: http://localhost:8000/api/health"
echo "🤖 AI Stats:     http://localhost:8000/api/ai/usage-stats"
echo ""
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "To stop services:"
echo "kill $BACKEND_PID $FRONTEND_PID"
echo "docker-compose down"
echo ""
echo "Logs available at:"
echo "- Backend:  logs/backend.log"
echo "- Frontend: logs/frontend.log"