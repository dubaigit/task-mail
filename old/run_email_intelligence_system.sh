#!/usr/bin/env bash
set -euo pipefail

# Email Intelligence System - Master Startup Script
# Launches all services with verified GPT-5 models: gpt-5-nano-2025-08-07, gpt-5-mini-2025-08-07

echo "========================================================"
echo "    EMAIL INTELLIGENCE SYSTEM - STARTUP SCRIPT"
echo "========================================================"
echo ""
echo "🚀 Starting Email Intelligence System with verified GPT-5 models:"
echo "   📧 Classification: gpt-5-nano-2025-08-07"
echo "   ✍️  Draft Generation: gpt-5-mini-2025-08-07"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
PID_DIR="$PROJECT_DIR/pids"

# Create necessary directories
mkdir -p "$LOG_DIR" "$PID_DIR"

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to start a service
start_service() {
    local service_name=$1
    local script_name=$2
    local port=$3
    local log_file="$LOG_DIR/${service_name}.log"
    local pid_file="$PID_DIR/${service_name}.pid"
    
    echo -e "${BLUE}Starting $service_name...${NC}"
    
    # Check if port is already in use
    if [[ -n "$port" ]] && check_port "$port"; then
        echo -e "${YELLOW}⚠️  Port $port is already in use. Checking if it's our service...${NC}"
        
        # Check if our PID file exists and process is running
        if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
            echo -e "${GREEN}✅ $service_name already running on port $port${NC}"
            return 0
        else
            echo -e "${RED}❌ Port $port is occupied by another process. Please free the port first.${NC}"
            return 1
        fi
    fi
    
    # Start the service
    cd "$PROJECT_DIR"
    nohup python "$script_name" > "$log_file" 2>&1 &
    local pid=$!
    echo $pid > "$pid_file"
    
    # Wait a moment and check if service started successfully
    sleep 2
    if kill -0 $pid 2>/dev/null; then
        echo -e "${GREEN}✅ $service_name started successfully (PID: $pid)${NC}"
        if [[ -n "$port" ]]; then
            echo -e "   📡 Running on port $port"
        fi
        echo -e "   📝 Logs: $log_file"
        return 0
    else
        echo -e "${RED}❌ Failed to start $service_name${NC}"
        echo -e "   📝 Check logs: $log_file"
        return 1
    fi
}

# Function to check if Redis is running
check_redis() {
    if command -v redis-cli >/dev/null 2>&1; then
        if redis-cli ping >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Redis is running${NC}"
            return 0
        fi
    fi
    
    echo -e "${YELLOW}⚠️  Redis not running or not accessible${NC}"
    echo -e "   💡 Starting Redis server..."
    
    # Try to start Redis
    if command -v redis-server >/dev/null 2>&1; then
        nohup redis-server > "$LOG_DIR/redis.log" 2>&1 &
        echo $! > "$PID_DIR/redis.pid"
        sleep 3
        
        if redis-cli ping >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Redis started successfully${NC}"
            return 0
        fi
    fi
    
    echo -e "${YELLOW}⚠️  Redis not available. Services will use memory fallback.${NC}"
    return 1
}

# Function to check Python dependencies
check_dependencies() {
    echo -e "${BLUE}🔍 Checking Python dependencies...${NC}"
    
    local missing_deps=()
    local required_deps=("fastapi" "uvicorn" "redis" "watchdog" "aiohttp" "websockets")
    
    for dep in "${required_deps[@]}"; do
        if ! python -c "import $dep" >/dev/null 2>&1; then
            missing_deps+=("$dep")
        fi
    done
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  Missing dependencies: ${missing_deps[*]}${NC}"
        echo -e "   💡 Installing missing dependencies..."
        pip install "${missing_deps[@]}"
    else
        echo -e "${GREEN}✅ All dependencies available${NC}"
    fi
}

# Function to open browser windows
open_interfaces() {
    echo -e "${BLUE}🌐 Opening web interfaces...${NC}"
    
    # Wait for services to be ready
    sleep 3
    
    # Open main web interface
    if [[ -f "$PROJECT_DIR/index.html" ]]; then
        echo -e "   📱 Opening main interface: file://$PROJECT_DIR/index.html"
        if command -v open >/dev/null 2>&1; then
            open "file://$PROJECT_DIR/index.html"
        fi
    fi
    
    # Open analytics dashboard
    if [[ -f "$PROJECT_DIR/analytics_dashboard.html" ]]; then
        echo -e "   📊 Opening analytics dashboard: file://$PROJECT_DIR/analytics_dashboard.html"
        if command -v open >/dev/null 2>&1; then
            open "file://$PROJECT_DIR/analytics_dashboard.html"
        fi
    fi
    
    echo ""
    echo -e "${GREEN}🎉 All interfaces opened! You can also access them manually:${NC}"
    echo -e "   📱 Main Interface: file://$PROJECT_DIR/index.html"
    echo -e "   📊 Analytics Dashboard: file://$PROJECT_DIR/analytics_dashboard.html"
    echo -e "   🔗 API Backend: http://localhost:8000"
    echo -e "   📈 Analytics API: http://localhost:8001"
}

# Function to display status
show_status() {
    echo ""
    echo "========================================================"
    echo "                   SYSTEM STATUS"
    echo "========================================================"
    
    local services=("main_optimized:8000" "realtime_analytics:8001" "realtime_email_monitor:" "email_scheduler:")
    
    for service_info in "${services[@]}"; do
        IFS=':' read -r service port <<< "$service_info"
        local pid_file="$PID_DIR/${service}.pid"
        
        if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
            echo -e "${GREEN}✅ $service${NC}"
            [[ -n "$port" ]] && echo -e "   📡 http://localhost:$port"
        else
            echo -e "${RED}❌ $service (not running)${NC}"
        fi
    done
    
    echo ""
    echo -e "${GREEN}🔗 Access URLs:${NC}"
    echo -e "   📱 Main Interface: file://$PROJECT_DIR/index.html"
    echo -e "   📊 Analytics Dashboard: file://$PROJECT_DIR/analytics_dashboard.html"
    echo -e "   🔗 API Documentation: http://localhost:8000/docs"
    echo -e "   📈 Analytics API: http://localhost:8001/dashboard"
    echo ""
    echo -e "${BLUE}📝 Logs Directory: $LOG_DIR${NC}"
    echo -e "${BLUE}🔧 PIDs Directory: $PID_DIR${NC}"
}

# Function to stop all services
stop_services() {
    echo -e "${YELLOW}🛑 Stopping all services...${NC}"
    
    for pid_file in "$PID_DIR"/*.pid; do
        if [[ -f "$pid_file" ]]; then
            local service_name=$(basename "$pid_file" .pid)
            if kill "$(cat "$pid_file")" 2>/dev/null; then
                echo -e "${GREEN}✅ Stopped $service_name${NC}"
            fi
            rm -f "$pid_file"
        fi
    done
    
    echo -e "${GREEN}✅ All services stopped${NC}"
}

# Main execution
main() {
    case "${1:-start}" in
        "start")
            echo -e "${GREEN}🚀 STARTING EMAIL INTELLIGENCE SYSTEM${NC}"
            echo ""
            
            # Check dependencies
            check_dependencies
            echo ""
            
            # Check Redis
            check_redis
            echo ""
            
            # Verify core files exist
            echo -e "${BLUE}🔍 Verifying core components...${NC}"
            local core_files=("main_optimized.py" "realtime_email_monitor.py" "realtime_analytics.py" "email_scheduler.py")
            local missing_files=()
            
            for file in "${core_files[@]}"; do
                if [[ ! -f "$PROJECT_DIR/$file" ]]; then
                    missing_files+=("$file")
                fi
            done
            
            if [[ ${#missing_files[@]} -gt 0 ]]; then
                echo -e "${RED}❌ Missing core files: ${missing_files[*]}${NC}"
                echo -e "   💡 Please ensure all components are available"
                exit 1
            fi
            
            echo -e "${GREEN}✅ All core components available${NC}"
            echo ""
            
            # Start services in order
            echo -e "${GREEN}🔥 LAUNCHING SERVICES${NC}"
            echo ""
            
            # 1. Main optimized backend (port 8000)
            start_service "main_optimized" "main_optimized.py" "8000"
            echo ""
            
            # 2. Real-time analytics (port 8001)
            start_service "realtime_analytics" "realtime_analytics.py" "8001"
            echo ""
            
            # 3. Real-time email monitor (no specific port)
            start_service "realtime_email_monitor" "realtime_email_monitor.py" ""
            echo ""
            
            # 4. Email scheduler (background service)
            start_service "email_scheduler" "email_scheduler.py" ""
            echo ""
            
            # Open web interfaces
            open_interfaces
            
            # Show final status
            show_status
            
            echo ""
            echo -e "${GREEN}🎉 EMAIL INTELLIGENCE SYSTEM STARTED SUCCESSFULLY!${NC}"
            echo ""
            echo -e "${YELLOW}📋 TESTING INSTRUCTIONS:${NC}"
            echo -e "   1. 📧 Send yourself a test email to trigger classification"
            echo -e "   2. 📊 Watch real-time updates in the analytics dashboard"
            echo -e "   3. 🔄 Check the main interface for email management"
            echo -e "   4. 📝 View logs in $LOG_DIR for debugging"
            echo ""
            echo -e "${BLUE}💡 To stop all services: $0 stop${NC}"
            echo -e "${BLUE}💡 To check status: $0 status${NC}"
            ;;
            
        "stop")
            stop_services
            ;;
            
        "status")
            show_status
            ;;
            
        "restart")
            echo -e "${YELLOW}🔄 Restarting Email Intelligence System...${NC}"
            stop_services
            sleep 2
            "$0" start
            ;;
            
        *)
            echo "Usage: $0 {start|stop|status|restart}"
            echo ""
            echo "Commands:"
            echo "  start   - Start all Email Intelligence services"
            echo "  stop    - Stop all services"
            echo "  status  - Show current service status"
            echo "  restart - Restart all services"
            exit 1
            ;;
    esac
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}🛑 Received interrupt signal. Stopping services...${NC}"; stop_services; exit 0' INT

# Run main function
main "$@"