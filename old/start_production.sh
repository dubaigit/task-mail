#!/bin/bash

# Production Email Intelligence Service Startup Script
# Handles complete system initialization with all components

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment variables
if [ -f ".env.production" ]; then
    source .env.production
    echo "✓ Loaded production environment configuration"
else
    echo "⚠️  Warning: .env.production not found, using defaults"
fi

# Default configuration
export PRODUCTION_MODE="${PRODUCTION_MODE:-true}"
export LOG_LEVEL="${LOG_LEVEL:-INFO}"
export PORT="${PORT:-8000}"
export WORKERS="${WORKERS:-4}"
export MAX_CONNECTIONS="${MAX_CONNECTIONS:-1000}"

# Service configuration
BACKEND_PORT="${PORT}"
ANALYTICS_PORT="${ANALYTICS_PORT:-8001}"
UI_PORT="${UI_PORT:-3000}"
HEALTH_CHECK_URL="http://localhost:${BACKEND_PORT}"

# Process tracking
PIDS_DIR="pids"
LOGS_DIR="logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

# Cleanup function for graceful shutdown
cleanup() {
    log "Initiating graceful shutdown..."
    
    # Stop all services
    ./stop_production.sh >/dev/null 2>&1 || true
    
    # Wait for processes to exit
    sleep 2
    
    log "Shutdown complete"
    exit 0
}

# Setup signal handlers
trap cleanup SIGINT SIGTERM

# Create directories
setup_directories() {
    log "Setting up directories..."
    
    mkdir -p "$PIDS_DIR" "$LOGS_DIR"
    chmod 755 "$PIDS_DIR" "$LOGS_DIR"
    
    log "✓ Directories created"
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        error "Python 3 is required but not installed"
        exit 1
    fi
    
    # Check Python version (3.8+)
    python_version=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    if [[ $(echo "$python_version < 3.8" | bc -l) -eq 1 ]]; then
        error "Python 3.8 or higher is required, found $python_version"
        exit 1
    fi
    
    # Check Node.js for UI components
    if command -v node &> /dev/null; then
        node_version=$(node --version | cut -d'v' -f2)
        info "Node.js version: $node_version"
    else
        warn "Node.js not found - UI components may not be available"
    fi
    
    # Check disk space (require at least 1GB free)
    free_space=$(df -BG . | awk 'NR==2 {print $4}' | tr -d 'G')
    if [ "$free_space" -lt 1 ]; then
        error "Insufficient disk space. At least 1GB required, found ${free_space}GB"
        exit 1
    fi
    
    # Check memory (require at least 2GB)
    total_mem=$(python3 -c "import psutil; print(int(psutil.virtual_memory().total / (1024**3)))")
    if [ "$total_mem" -lt 2 ]; then
        warn "Low memory detected: ${total_mem}GB. Recommended: 4GB+"
    fi
    
    log "✓ System requirements satisfied"
}

# Install dependencies
install_dependencies() {
    log "Installing Python dependencies..."
    
    # Create virtual environment if it doesn't exist
    if [ ! -d ".venv" ]; then
        python3 -m venv .venv
        log "✓ Created virtual environment"
    fi
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip setuptools wheel
    
    # Install production requirements
    if [ -f "requirements_production.txt" ]; then
        pip install -r requirements_production.txt
        log "✓ Production dependencies installed"
    elif [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
        log "✓ Standard dependencies installed"
    else
        error "No requirements file found"
        exit 1
    fi
}

# Initialize database
init_database() {
    log "Initializing database..."
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Run database initialization if script exists
    if [ -f "database_fix_verification.py" ]; then
        python3 database_fix_verification.py
        log "✓ Database verification completed"
    fi
    
    # Initialize email intelligence database
    python3 -c "
from email_intelligence_production import ProductionEmailIntelligenceEngine
engine = ProductionEmailIntelligenceEngine()
print('✓ Email intelligence database initialized')
engine.cleanup()
"
    
    log "✓ Database initialization completed"
}

# Start Docker services (Redis, MongoDB)
start_docker_services() {
    log "Starting Docker services..."
    
    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        warn "Docker not available - starting without external services"
        return 0
    fi
    
    # Use production compose file if available, otherwise fallback
    compose_file="docker-compose.production.yml"
    if [ ! -f "$compose_file" ]; then
        compose_file="docker-compose.yml"
    fi
    
    if [ -f "$compose_file" ]; then
        # Start only infrastructure services
        docker-compose -f "$compose_file" up -d redis mongodb
        
        # Wait for services to be ready
        info "Waiting for Docker services to be ready..."
        sleep 10
        
        # Check Redis
        if docker-compose -f "$compose_file" exec -T redis redis-cli ping >/dev/null 2>&1; then
            log "✓ Redis service ready"
        else
            warn "Redis service not responding"
        fi
        
        # Check MongoDB
        if docker-compose -f "$compose_file" exec -T mongodb mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
            log "✓ MongoDB service ready"
        else
            warn "MongoDB service not responding"
        fi
    else
        warn "Docker compose file not found - starting without external services"
    fi
}

# Start main backend service
start_backend() {
    log "Starting Email Intelligence Backend..."
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Start main production service
    nohup python3 -m uvicorn realtime_main:app \
        --host 0.0.0.0 \
        --port "$BACKEND_PORT" \
        --workers "$WORKERS" \
        --log-level "$(echo $LOG_LEVEL | tr '[:upper:]' '[:lower:]')" \
        --access-log \
        --loop uvloop \
        --http httptools \
        --ws websockets \
        --interface asgi3 \
        > "$LOGS_DIR/backend.log" 2>&1 & echo $! > "$PIDS_DIR/backend.pid"
    
    # Wait for service to start
    info "Waiting for backend service to start..."
    for i in {1..30}; do
        if curl -s "$HEALTH_CHECK_URL" >/dev/null 2>&1; then
            log "✓ Backend service ready on port $BACKEND_PORT"
            break
        fi
        if [ $i -eq 30 ]; then
            error "Backend service failed to start"
            tail -n 20 "$LOGS_DIR/backend.log"
            exit 1
        fi
        sleep 2
    done
}

# Start analytics engine
start_analytics() {
    log "Starting Real-time Analytics Engine..."
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Start analytics service
    nohup python3 realtime_analytics.py \
        --port "$ANALYTICS_PORT" \
        --backend-url "$HEALTH_CHECK_URL" \
        > "$LOGS_DIR/analytics.log" 2>&1 & echo $! > "$PIDS_DIR/analytics.pid"
    
    # Wait for analytics to start
    info "Waiting for analytics engine to initialize..."
    sleep 5
    
    if kill -0 "$(cat $PIDS_DIR/analytics.pid 2>/dev/null)" 2>/dev/null; then
        log "✓ Analytics engine ready on port $ANALYTICS_PORT"
    else
        warn "Analytics engine may have failed to start"
    fi
}

# Start email monitoring
start_email_monitor() {
    log "Starting Real-time Email Monitor..."
    
    # Activate virtual environment
    source .venv/bin/activate
    
    # Start email monitor
    nohup python3 realtime_email_monitor.py \
        --backend-url "$HEALTH_CHECK_URL" \
        --check-interval 30 \
        > "$LOGS_DIR/email_monitor.log" 2>&1 & echo $! > "$PIDS_DIR/email_monitor.pid"
    
    # Wait for monitor to start
    sleep 3
    
    if kill -0 "$(cat $PIDS_DIR/email_monitor.pid 2>/dev/null)" 2>/dev/null; then
        log "✓ Email monitor ready"
    else
        warn "Email monitor may have failed to start"
    fi
}

# Start UI dashboard (if available)
start_ui() {
    log "Starting UI Dashboard..."
    
    # Check for React dashboard
    if [ -d "dashboard/frontend" ]; then
        cd dashboard/frontend
        
        # Install Node dependencies if needed
        if [ ! -d "node_modules" ]; then
            npm install
        fi
        
        # Build production version
        npm run build >/dev/null 2>&1 || true
        
        # Start production server
        nohup npm start \
            > "../../$LOGS_DIR/ui.log" 2>&1 & echo $! > "../../$PIDS_DIR/ui.pid"
        
        cd ../..
        
        # Wait for UI to start
        info "Waiting for UI dashboard to start..."
        for i in {1..15}; do
            if curl -s "http://localhost:$UI_PORT" >/dev/null 2>&1; then
                log "✓ UI dashboard ready on port $UI_PORT"
                break
            fi
            if [ $i -eq 15 ]; then
                warn "UI dashboard may not be accessible"
            fi
            sleep 2
        done
    else
        # Serve static production UI if available
        if [ -f "production_ui.html" ]; then
            nohup python3 -m http.server "$UI_PORT" \
                > "$LOGS_DIR/ui.log" 2>&1 & echo $! > "$PIDS_DIR/ui.pid"
            log "✓ Static UI served on port $UI_PORT"
        else
            warn "UI dashboard not found"
        fi
    fi
}

# Health check all services
health_check() {
    log "Running comprehensive health checks..."
    
    local all_healthy=true
    
    # Backend API health
    if curl -s "$HEALTH_CHECK_URL" | grep -q "healthy"; then
        log "✓ Backend API healthy"
    else
        error "✗ Backend API unhealthy"
        all_healthy=false
    fi
    
    # WebSocket health
    if curl -s "$HEALTH_CHECK_URL/realtime/status" >/dev/null 2>&1; then
        log "✓ Real-time services healthy"
    else
        warn "⚠ Real-time services may have issues"
    fi
    
    # Check all process PIDs
    for service in backend analytics email_monitor ui; do
        pid_file="$PIDS_DIR/${service}.pid"
        if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file" 2>/dev/null)" 2>/dev/null; then
            log "✓ ${service} process running"
        else
            warn "⚠ ${service} process not found"
        fi
    done
    
    if [ "$all_healthy" = true ]; then
        log "✅ All health checks passed"
    else
        warn "⚠️  Some health checks failed - check logs for details"
    fi
}

# Display service information
display_service_info() {
    log "Email Intelligence System - Production Services"
    echo
    echo "🚀 Service Endpoints:"
    echo "   Main API:      http://localhost:$BACKEND_PORT"
    echo "   Health Check:  http://localhost:$BACKEND_PORT/"
    echo "   WebSocket:     ws://localhost:$BACKEND_PORT/ws"
    echo "   Real-time:     http://localhost:$BACKEND_PORT/realtime/status"
    echo "   Analytics API: http://localhost:$ANALYTICS_PORT"
    echo "   UI Dashboard:  http://localhost:$UI_PORT"
    echo
    echo "📊 Monitoring:"
    echo "   Logs:          tail -f $LOGS_DIR/*.log"
    echo "   Processes:     ps aux | grep python"
    echo "   Metrics:       curl $HEALTH_CHECK_URL/realtime/metrics"
    echo
    echo "🔧 Management:"
    echo "   Stop services: ./stop_production.sh"
    echo "   View logs:     ./view_logs.sh"
    echo "   Restart:       ./restart_production.sh"
    echo
    echo "✅ Production system is running!"
    echo
}

# Main startup sequence
main() {
    log "Starting Email Intelligence System (Production Mode)"
    log "=================================================="
    
    # Pre-flight checks
    setup_directories
    check_requirements
    
    # Stop any existing services
    if [ -f "./stop_production.sh" ]; then
        ./stop_production.sh >/dev/null 2>&1 || true
    fi
    
    # Installation and setup
    install_dependencies
    init_database
    
    # Start services in order
    start_docker_services
    start_backend
    start_analytics
    start_email_monitor
    start_ui
    
    # Final verification
    health_check
    display_service_info
    
    # Keep script running to handle signals
    if [ "${DAEMON_MODE:-false}" = "true" ]; then
        log "Running in daemon mode..."
        while true; do
            sleep 60
            # Periodic health check
            if ! curl -s "$HEALTH_CHECK_URL" >/dev/null 2>&1; then
                error "Backend service unhealthy - check logs"
            fi
        done
    else
        log "Startup complete. Press Ctrl+C to stop all services."
        log "Or run: ./stop_production.sh"
        
        # Wait for interrupt
        while true; do
            sleep 1
        done
    fi
}

# Run main function
main "$@"