#!/bin/bash

# Unified Apple MCP Email Task Manager Startup Script
# Consolidates all services on the correct ports

set -e

echo "🚀 Starting Apple MCP Email Task Manager - Unified Architecture"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    echo -e "${YELLOW}Stopping existing service on port $port...${NC}"
    if check_port $port; then
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Check for required dependencies
echo -e "${BLUE}🔍 Checking dependencies...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Dependencies check passed${NC}"

# Set environment variables for unified configuration
export PORT=8000
export NODE_ENV=${NODE_ENV:-development}

echo -e "${BLUE}📋 Configuration:${NC}"
echo "   Backend Port: $PORT"
echo "   Frontend Port: 3000 (dev) / $PORT (production)"
echo "   Environment: $NODE_ENV"
echo "   Database: PostgreSQL on 5432"
echo "   Redis: 6379"

# Clean up any existing services on our ports
echo -e "${BLUE}🧹 Cleaning up existing services...${NC}"
kill_port 8000
kill_port 3000
kill_port 8001  # Kill mock server if running

# Start database services
echo -e "${BLUE}🗄️ Starting database services...${NC}"
if command -v docker-compose &> /dev/null; then
    docker-compose up -d postgres redis
    echo -e "${GREEN}✅ Database services started${NC}"
else
    echo -e "${YELLOW}⚠️ Docker Compose not found, assuming external database services${NC}"
fi

# Wait for database to be ready
echo -e "${BLUE}⏳ Waiting for database connection...${NC}"
for i in {1..30}; do
    if nc -z localhost 5432 2>/dev/null; then
        echo -e "${GREEN}✅ Database connection established${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Database connection timeout${NC}"
        exit 1
    fi
    sleep 1
done

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
    npm install
fi

if [ ! -d "dashboard/frontend/node_modules" ]; then
    echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
    cd dashboard/frontend && npm install && cd ../..
fi

# Build frontend for production if needed
if [ "$NODE_ENV" = "production" ]; then
    echo -e "${BLUE}🏗️ Building frontend for production...${NC}"
    cd dashboard/frontend && npm run build && cd ../..
    echo -e "${GREEN}✅ Frontend build completed${NC}"
fi

# Start the unified backend server
echo -e "${BLUE}🚀 Starting unified backend server on port $PORT...${NC}"
if [ "$NODE_ENV" = "production" ]; then
    # Production mode: backend serves both API and static frontend
    npm start &
    BACKEND_PID=$!
    echo -e "${GREEN}✅ Production server started (PID: $BACKEND_PID)${NC}"
else
    # Development mode: start both backend and frontend dev server
    npm run dev &
    BACKEND_PID=$!
    echo -e "${GREEN}✅ Backend server started (PID: $BACKEND_PID)${NC}"
    
    # Start frontend development server
    echo -e "${BLUE}🖥️ Starting frontend development server on port 3000...${NC}"
    cd dashboard/frontend
    PORT=3000 npm start &
    FRONTEND_PID=$!
    cd ../..
    echo -e "${GREEN}✅ Frontend dev server started (PID: $FRONTEND_PID)${NC}"
fi

# Wait for services to be ready
echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"

# Check backend health
for i in {1..30}; do
    if curl -s http://localhost:8000/api/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend server is healthy${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Backend health check timeout${NC}"
        exit 1
    fi
    sleep 1
done

if [ "$NODE_ENV" = "development" ]; then
    # Check frontend dev server
    for i in {1..30}; do
        if curl -s http://localhost:3000 >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Frontend dev server is ready${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${YELLOW}⚠️ Frontend dev server not responding (may still be starting)${NC}"
            break
        fi
        sleep 1
    done
fi

echo ""
echo -e "${GREEN}🎉 Apple MCP Email Task Manager is running!${NC}"
echo "=================================================="
echo ""

if [ "$NODE_ENV" = "production" ]; then
    echo -e "${BLUE}🌐 Application URL:${NC} http://localhost:8000"
    echo -e "${BLUE}🏥 Health Check:${NC} http://localhost:8000/api/health"
    echo -e "${BLUE}📊 AI Usage Stats:${NC} http://localhost:8000/api/ai/usage-stats"
else
    echo -e "${BLUE}🖥️ Frontend (Dev):${NC} http://localhost:3000"
    echo -e "${BLUE}🔌 Backend API:${NC} http://localhost:8000"
    echo -e "${BLUE}🏥 Health Check:${NC} http://localhost:8000/api/health"
    echo -e "${BLUE}📊 AI Usage Stats:${NC} http://localhost:8000/api/ai/usage-stats"
fi

echo ""
echo -e "${YELLOW}📋 Service Architecture:${NC}"
echo "   ├── Frontend: Port 3000 (dev) / 8000 (prod)"
echo "   ├── Backend API: Port 8000"
echo "   ├── PostgreSQL: Port 5432"
echo "   └── Redis: Port 6379"
echo ""
echo -e "${BLUE}💡 Tips:${NC}"
echo "   • Use Ctrl+C to stop all services gracefully"
echo "   • Frontend proxies API calls to backend automatically"
echo "   • All functions should work properly in this unified setup"
echo ""

# Function to handle cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping services...${NC}"
    
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Kill any remaining processes on our ports
    kill_port 8000
    kill_port 3000
    
    echo -e "${GREEN}✅ Services stopped gracefully${NC}"
    exit 0
}

# Set up signal handlers for graceful shutdown
trap cleanup SIGINT SIGTERM

# Keep the script running and monitor services
echo -e "${BLUE}🔍 Monitoring services... (Press Ctrl+C to stop)${NC}"
while true; do
    sleep 5
    
    # Check if backend is still running
    if ! check_port 8000; then
        echo -e "${RED}❌ Backend server stopped unexpectedly${NC}"
        cleanup
    fi
    
    if [ "$NODE_ENV" = "development" ] && ! check_port 3000; then
        echo -e "${YELLOW}⚠️ Frontend dev server stopped${NC}"
    fi
done