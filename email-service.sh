#!/bin/bash

# Email Intelligence Service Manager
# Manages both backend (Python/FastAPI) and frontend (React) services
# Usage: ./email-service.sh {start|stop|restart|status|logs|test}

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Service configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR"
BACKEND_DIR="$PROJECT_ROOT"
FRONTEND_DIR="$PROJECT_ROOT/dashboard/frontend"

# Service ports
BACKEND_PORT=8002
FRONTEND_PORT=3000

# PID files for tracking running processes
PID_DIR="$PROJECT_ROOT/.pids"
BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"

# Log files
LOG_DIR="$PROJECT_ROOT/logs"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

# Service names for display
SERVICE_NAME="Email Intelligence Service"
BACKEND_NAME="Backend API (FastAPI)"
FRONTEND_NAME="Frontend UI (React)"

# Create necessary directories
mkdir -p "$PID_DIR"
mkdir -p "$LOG_DIR"

# Helper functions
print_header() {
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}   📧 $SERVICE_NAME Manager${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_status() {
    local service=$1
    local status=$2
    local icon=$3
    
    printf "%-30s" "$service:"
    if [ "$status" = "running" ]; then
        echo -e "${GREEN}$icon Running${NC}"
    elif [ "$status" = "stopped" ]; then
        echo -e "${RED}$icon Stopped${NC}"
    else
        echo -e "${YELLOW}$icon $status${NC}"
    fi
}

check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

get_pid_from_file() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        cat "$pid_file"
    else
        echo ""
    fi
}

is_process_running() {
    local pid=$1
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

cleanup_pid_file() {
    local pid_file=$1
    local pid=$(get_pid_from_file "$pid_file")
    
    if [ -n "$pid" ] && ! is_process_running "$pid"; then
        rm -f "$pid_file"
    fi
}

# Backend service functions
start_backend() {
    echo -e "${BLUE}🚀 Starting $BACKEND_NAME...${NC}"
    
    cleanup_pid_file "$BACKEND_PID_FILE"
    
    if check_port $BACKEND_PORT; then
        echo -e "${YELLOW}⚠️  Backend is already running on port $BACKEND_PORT${NC}"
        return 1
    fi
    
    cd "$BACKEND_DIR"
    
    # Start backend with proper Python environment
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    fi
    
    nohup python backend_architecture.py > "$BACKEND_LOG" 2>&1 &
    local pid=$!
    echo $pid > "$BACKEND_PID_FILE"
    
    # Wait for backend to start
    echo -n "   Waiting for backend to start"
    for i in {1..30}; do
        if check_port $BACKEND_PORT; then
            echo -e "\n${GREEN}✅ Backend started successfully (PID: $pid)${NC}"
            echo "   Access API at: http://localhost:$BACKEND_PORT"
            echo "   API Docs at: http://localhost:$BACKEND_PORT/docs"
            return 0
        fi
        echo -n "."
        sleep 1
    done
    
    echo -e "\n${RED}❌ Backend failed to start. Check logs: $BACKEND_LOG${NC}"
    return 1
}

stop_backend() {
    echo -e "${BLUE}🛑 Stopping $BACKEND_NAME...${NC}"
    
    local pid=$(get_pid_from_file "$BACKEND_PID_FILE")
    
    if [ -n "$pid" ] && is_process_running "$pid"; then
        kill "$pid"
        rm -f "$BACKEND_PID_FILE"
        echo -e "${GREEN}✅ Backend stopped (PID: $pid)${NC}"
    else
        # Try to find and kill by port
        local port_pid=$(lsof -ti:$BACKEND_PORT)
        if [ -n "$port_pid" ]; then
            kill "$port_pid"
            echo -e "${GREEN}✅ Backend stopped (PID: $port_pid)${NC}"
        else
            echo -e "${YELLOW}⚠️  Backend was not running${NC}"
        fi
        rm -f "$BACKEND_PID_FILE"
    fi
}

# Frontend service functions
start_frontend() {
    echo -e "${BLUE}🚀 Starting $FRONTEND_NAME...${NC}"
    
    cleanup_pid_file "$FRONTEND_PID_FILE"
    
    if check_port $FRONTEND_PORT; then
        echo -e "${YELLOW}⚠️  Frontend is already running on port $FRONTEND_PORT${NC}"
        return 1
    fi
    
    cd "$FRONTEND_DIR"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "   Installing frontend dependencies..."
        npm install > /dev/null 2>&1
    fi
    
    # Start frontend
    nohup npm start > "$FRONTEND_LOG" 2>&1 &
    local pid=$!
    echo $pid > "$FRONTEND_PID_FILE"
    
    # Wait for frontend to start
    echo -n "   Waiting for frontend to compile"
    for i in {1..60}; do
        if check_port $FRONTEND_PORT; then
            echo -e "\n${GREEN}✅ Frontend started successfully (PID: $pid)${NC}"
            echo "   Access UI at: http://localhost:$FRONTEND_PORT"
            return 0
        fi
        echo -n "."
        sleep 1
    done
    
    echo -e "\n${RED}❌ Frontend failed to start. Check logs: $FRONTEND_LOG${NC}"
    return 1
}

stop_frontend() {
    echo -e "${BLUE}🛑 Stopping $FRONTEND_NAME...${NC}"
    
    local pid=$(get_pid_from_file "$FRONTEND_PID_FILE")
    
    if [ -n "$pid" ] && is_process_running "$pid"; then
        # Kill the process group to stop all React processes
        pkill -P "$pid" 2>/dev/null || true
        kill "$pid" 2>/dev/null || true
        rm -f "$FRONTEND_PID_FILE"
        echo -e "${GREEN}✅ Frontend stopped (PID: $pid)${NC}"
    else
        # Try to find and kill React processes
        pkill -f "react-scripts" 2>/dev/null || true
        pkill -f "npm.*start" 2>/dev/null || true
        
        # Kill by port
        local port_pid=$(lsof -ti:$FRONTEND_PORT)
        if [ -n "$port_pid" ]; then
            kill "$port_pid" 2>/dev/null || true
            echo -e "${GREEN}✅ Frontend stopped (PID: $port_pid)${NC}"
        else
            echo -e "${YELLOW}⚠️  Frontend was not running${NC}"
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi
}

# Main service control functions
start_services() {
    print_header
    echo -e "${CYAN}Starting all services...${NC}\n"
    
    start_backend
    echo ""
    start_frontend
    echo ""
    
    if check_port $BACKEND_PORT && check_port $FRONTEND_PORT; then
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}🎉 All services started successfully!${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "  📧 Email Intelligence Dashboard: ${CYAN}http://localhost:$FRONTEND_PORT${NC}"
        echo -e "  🔌 Backend API:                  ${CYAN}http://localhost:$BACKEND_PORT${NC}"
        echo -e "  📚 API Documentation:            ${CYAN}http://localhost:$BACKEND_PORT/docs${NC}"
        echo ""
    else
        echo -e "${RED}⚠️  Some services failed to start. Check the logs for details.${NC}"
        return 1
    fi
}

stop_services() {
    print_header
    echo -e "${CYAN}Stopping all services...${NC}\n"
    
    stop_frontend
    echo ""
    stop_backend
    echo ""
    
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ All services stopped${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

restart_services() {
    print_header
    echo -e "${CYAN}Restarting all services...${NC}\n"
    
    stop_services
    echo ""
    sleep 2
    start_services
}

check_status() {
    print_header
    echo -e "${CYAN}Service Status${NC}\n"
    
    # Check backend
    local backend_status="stopped"
    local backend_pid=$(get_pid_from_file "$BACKEND_PID_FILE")
    
    if check_port $BACKEND_PORT; then
        backend_status="running"
    elif [ -n "$backend_pid" ] && is_process_running "$backend_pid"; then
        backend_status="running (port issue)"
    fi
    
    # Check frontend
    local frontend_status="stopped"
    local frontend_pid=$(get_pid_from_file "$FRONTEND_PID_FILE")
    
    if check_port $FRONTEND_PORT; then
        frontend_status="running"
    elif [ -n "$frontend_pid" ] && is_process_running "$frontend_pid"; then
        frontend_status="running (port issue)"
    fi
    
    # Display status
    print_status "$BACKEND_NAME" "$backend_status" "🔌"
    if [ "$backend_status" = "running" ]; then
        echo "                              Port: $BACKEND_PORT | PID: ${backend_pid:-unknown}"
        echo "                              URL: http://localhost:$BACKEND_PORT"
    fi
    echo ""
    
    print_status "$FRONTEND_NAME" "$frontend_status" "🎨"
    if [ "$frontend_status" = "running" ]; then
        echo "                              Port: $FRONTEND_PORT | PID: ${frontend_pid:-unknown}"
        echo "                              URL: http://localhost:$FRONTEND_PORT"
    fi
    echo ""
    
    # Check Apple Mail connection
    echo -e "${CYAN}Data Sources:${NC}"
    if [ "$backend_status" = "running" ]; then
        local apple_mail_status=$(curl -s http://localhost:$BACKEND_PORT/health | grep -q "healthy" && echo "connected" || echo "disconnected")
        print_status "  Apple Mail Database" "$apple_mail_status" "📮"
    else
        print_status "  Apple Mail Database" "unavailable" "📮"
    fi
    echo ""
    
    # Overall status
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    if [ "$backend_status" = "running" ] && [ "$frontend_status" = "running" ]; then
        echo -e "${GREEN}✅ System Status: OPERATIONAL${NC}"
    elif [ "$backend_status" = "running" ] || [ "$frontend_status" = "running" ]; then
        echo -e "${YELLOW}⚠️  System Status: PARTIAL${NC}"
    else
        echo -e "${RED}❌ System Status: OFFLINE${NC}"
    fi
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

show_logs() {
    print_header
    echo -e "${CYAN}Service Logs${NC}\n"
    
    local service=$1
    
    if [ "$service" = "backend" ] || [ -z "$service" ]; then
        echo -e "${BLUE}📄 Backend Logs (last 20 lines):${NC}"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        if [ -f "$BACKEND_LOG" ]; then
            tail -n 20 "$BACKEND_LOG"
        else
            echo "No backend logs found"
        fi
        echo ""
    fi
    
    if [ "$service" = "frontend" ] || [ -z "$service" ]; then
        echo -e "${BLUE}📄 Frontend Logs (last 20 lines):${NC}"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        if [ -f "$FRONTEND_LOG" ]; then
            tail -n 20 "$FRONTEND_LOG"
        else
            echo "No frontend logs found"
        fi
    fi
}

test_services() {
    print_header
    echo -e "${CYAN}Testing Services...${NC}\n"
    
    # Test backend health
    echo -e "${BLUE}🔍 Testing Backend API...${NC}"
    if check_port $BACKEND_PORT; then
        local health_response=$(curl -s http://localhost:$BACKEND_PORT/health 2>/dev/null)
        if echo "$health_response" | grep -q "healthy"; then
            echo -e "${GREEN}✅ Backend API is healthy${NC}"
            
            # Test email endpoint
            local email_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$BACKEND_PORT/emails/ 2>/dev/null)
            if [ "$email_response" = "200" ]; then
                echo -e "${GREEN}✅ Email endpoint is responding${NC}"
            else
                echo -e "${RED}❌ Email endpoint returned: $email_response${NC}"
            fi
        else
            echo -e "${RED}❌ Backend API is unhealthy${NC}"
        fi
    else
        echo -e "${RED}❌ Backend is not running${NC}"
    fi
    echo ""
    
    # Test frontend
    echo -e "${BLUE}🔍 Testing Frontend UI...${NC}"
    if check_port $FRONTEND_PORT; then
        local frontend_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$FRONTEND_PORT 2>/dev/null)
        if [ "$frontend_response" = "200" ]; then
            echo -e "${GREEN}✅ Frontend is responding${NC}"
        else
            echo -e "${RED}❌ Frontend returned: $frontend_response${NC}"
        fi
    else
        echo -e "${RED}❌ Frontend is not running${NC}"
    fi
    echo ""
    
    # Test connectivity between services
    echo -e "${BLUE}🔍 Testing Service Integration...${NC}"
    if check_port $BACKEND_PORT && check_port $FRONTEND_PORT; then
        echo -e "${GREEN}✅ Both services are running and accessible${NC}"
        echo -e "${GREEN}✅ Ready to process emails with AI intelligence${NC}"
    else
        echo -e "${YELLOW}⚠️  Service integration cannot be tested - not all services running${NC}"
    fi
    echo ""
    
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Test URLs:${NC}"
    echo -e "  Dashboard:   ${CYAN}http://localhost:$FRONTEND_PORT${NC}"
    echo -e "  API Health:  ${CYAN}http://localhost:$BACKEND_PORT/health${NC}"
    echo -e "  API Docs:    ${CYAN}http://localhost:$BACKEND_PORT/docs${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

show_help() {
    print_header
    echo -e "${CYAN}Usage:${NC} $0 {start|stop|restart|status|logs|test|help}\n"
    
    echo -e "${YELLOW}Commands:${NC}"
    echo -e "  ${GREEN}start${NC}    - Start all services (backend and frontend)"
    echo -e "  ${GREEN}stop${NC}     - Stop all services"
    echo -e "  ${GREEN}restart${NC}  - Restart all services"
    echo -e "  ${GREEN}status${NC}   - Show current status of all services"
    echo -e "  ${GREEN}logs${NC}     - Show recent logs from all services"
    echo -e "  ${GREEN}test${NC}     - Test service health and connectivity"
    echo -e "  ${GREEN}help${NC}     - Show this help message"
    echo ""
    
    echo -e "${YELLOW}Examples:${NC}"
    echo -e "  $0 start              # Start all services"
    echo -e "  $0 status             # Check service status"
    echo -e "  $0 logs backend       # Show backend logs only"
    echo -e "  $0 logs frontend      # Show frontend logs only"
    echo -e "  $0 restart            # Restart all services"
    echo ""
    
    echo -e "${YELLOW}Service Information:${NC}"
    echo -e "  Backend:  FastAPI server on port $BACKEND_PORT"
    echo -e "  Frontend: React app on port $FRONTEND_PORT"
    echo -e "  Data:     Apple Mail integration (8000+ emails)"
    echo -e "  AI:       Email classification and intelligence"
    echo ""
}

# Main script logic
case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    status)
        check_status
        ;;
    logs)
        show_logs "$2"
        ;;
    test)
        test_services
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Invalid command: $1${NC}"
        echo "Usage: $0 {start|stop|restart|status|logs|test|help}"
        exit 1
        ;;
esac

exit 0