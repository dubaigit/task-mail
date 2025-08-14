#!/bin/bash
set -e

# =============================================================================
# Email Intelligence Service - Native Python Startup Script
# Production deployment without Docker containers
# =============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "${SCRIPT_DIR}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVICE_NAME="email-intelligence"
PYTHON_VENV="${SCRIPT_DIR}/.venv"
LOG_DIR="${SCRIPT_DIR}/logs"
PID_DIR="${SCRIPT_DIR}/pids"
ENV_FILE="${SCRIPT_DIR}/.env.production"
REQUIREMENTS_FILE="${SCRIPT_DIR}/requirements_runtime.txt"

# Service ports
BACKEND_PORT=8000
ANALYTICS_PORT=8001
UI_PORT=3000

# Create directories
mkdir -p "${LOG_DIR}" "${PID_DIR}"

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

# Check if service is already running
check_running() {
    local service_name=$1
    local pid_file="${PID_DIR}/${service_name}.pid"
    
    if [[ -f "${pid_file}" ]]; then
        local pid=$(cat "${pid_file}")
        if kill -0 "${pid}" 2>/dev/null; then
            return 0  # Running
        else
            rm -f "${pid_file}"  # Stale PID file
            return 1  # Not running
        fi
    fi
    return 1  # Not running
}

# Stop running services
stop_services() {
    info "Stopping Email Intelligence services..."
    
    local services=("backend" "realtime_monitor" "analytics" "email_scheduler")
    
    for service in "${services[@]}"; do
        local pid_file="${PID_DIR}/${service}.pid"
        
        if [[ -f "${pid_file}" ]]; then
            local pid=$(cat "${pid_file}")
            if kill -0 "${pid}" 2>/dev/null; then
                log "Stopping ${service} (PID: ${pid})"
                kill -TERM "${pid}"
                
                # Wait for graceful shutdown
                for i in {1..10}; do
                    if ! kill -0 "${pid}" 2>/dev/null; then
                        break
                    fi
                    sleep 1
                done
                
                # Force kill if still running
                if kill -0 "${pid}" 2>/dev/null; then
                    warn "Force killing ${service}"
                    kill -KILL "${pid}"
                fi
                
                rm -f "${pid_file}"
                log "Stopped ${service}"
            else
                rm -f "${pid_file}"
            fi
        fi
    done
}

# Check system dependencies
check_dependencies() {
    info "Checking system dependencies..."
    
    # Check Python 3.9+
    if ! command -v python3 &> /dev/null; then
        error "Python 3 is not installed"
        exit 1
    fi
    
    local python_version=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
    local required_version="3.9"
    
    if [[ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]]; then
        error "Python 3.9+ required, found ${python_version}"
        exit 1
    fi
    
    # Check environment file
    if [[ ! -f "${ENV_FILE}" ]]; then
        warn "Environment file not found: ${ENV_FILE}"
        info "Creating default environment file..."
        create_env_file
    fi
    
    # Check Apple Mail database access
    local mail_db_path="/Users/$(whoami)/Library/Mail/V10/MailData/Envelope Index"
    if [[ ! -f "${mail_db_path}" ]]; then
        warn "Apple Mail database not found at: ${mail_db_path}"
        warn "Email processing may not work properly"
    fi
    
    log "System dependencies OK"
}

# Create default environment file
create_env_file() {
    cat > "${ENV_FILE}" << 'EOF'
# Email Intelligence Service - Production Environment
ENVIRONMENT=production
DEBUG=false

# Service Configuration
HOST=0.0.0.0
PORT=8000
ANALYTICS_PORT=8001
UI_PORT=3000
WORKERS=4

# Database
DATABASE_PATH=email_intelligence_production.db
REDIS_URL=redis://localhost:6379/0
MONGODB_URL=mongodb://admin:emailpass123@localhost:27017/emaildb

# AI Configuration (Configure these with your API keys)
OPENAI_API_KEY=
OPENAI_MODEL_CLASSIFIER=gpt-5-nano-2025-08-07
OPENAI_MODEL_DRAFT=gpt-5-mini-2025-08-07
AI_REQUESTS_PER_MINUTE=60

# Cache Configuration
CACHE_ENABLED=true
CACHE_TTL_SECONDS=3600

# WebSocket Configuration
WS_ENABLED=true
WS_MAX_CONNECTIONS=500

# Email Processing
EMAIL_BATCH_SIZE=50
EMAIL_CHECK_INTERVAL=30

# Performance
MAX_CONNECTIONS=1000
MAX_CONCURRENT_REQUESTS=100

# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/email_intelligence_production.log

# Security
SECRET_KEY=change-this-super-secret-key-in-production

# Feature Flags
FEATURE_AI_CLASSIFICATION=true
FEATURE_REAL_TIME_MONITORING=true
FEATURE_ANALYTICS_DASHBOARD=true
FEATURE_AUTO_RESPONSES=false
EOF
    
    log "Created default environment file: ${ENV_FILE}"
    warn "Please update the environment file with your configuration"
}

# Setup Python virtual environment
setup_virtualenv() {
    info "Setting up Python virtual environment..."
    
    if [[ ! -d "${PYTHON_VENV}" ]]; then
        log "Creating virtual environment..."
        python3 -m venv "${PYTHON_VENV}"
    fi
    
    # Activate virtual environment
    source "${PYTHON_VENV}/bin/activate"
    
    # Upgrade pip
    pip install --upgrade pip wheel setuptools
    
    # Install requirements
    if [[ -f "${REQUIREMENTS_FILE}" ]]; then
        log "Installing Python dependencies..."
        pip install -r "${REQUIREMENTS_FILE}"
    else
        error "Requirements file not found: ${REQUIREMENTS_FILE}"
        exit 1
    fi
    
    log "Virtual environment ready"
}

# Initialize database
init_database() {
    info "Initializing database..."
    
    source "${PYTHON_VENV}/bin/activate"
    
    # Create database tables
    python3 -c "
from email_intelligence_production import ProductionEmailIntelligenceEngine
from database_models import Base
import sqlite3
import logging

logging.basicConfig(level=logging.INFO)

# Initialize engine to create database structure
engine = ProductionEmailIntelligenceEngine()
print('Database initialized successfully')
"
    
    log "Database initialization complete"
}

# Start background services
start_backend() {
    info "Starting backend API service..."
    
    source "${PYTHON_VENV}/bin/activate"
    
    local log_file="${LOG_DIR}/backend.log"
    local pid_file="${PID_DIR}/backend.pid"
    
    # Start backend with production settings
    nohup python3 -m uvicorn backend_architecture:app \
        --host 0.0.0.0 \
        --port ${BACKEND_PORT} \
        --workers 4 \
        --log-level info \
        --no-reload \
        --timeout-keep-alive 75 \
        > "${log_file}" 2>&1 &
    
    echo $! > "${pid_file}"
    
    log "Backend API started (PID: $(cat ${pid_file})) - Port ${BACKEND_PORT}"
}

start_realtime_monitor() {
    info "Starting real-time email monitor..."
    
    source "${PYTHON_VENV}/bin/activate"
    
    local log_file="${LOG_DIR}/realtime_monitor.log"
    local pid_file="${PID_DIR}/realtime_monitor.pid"
    
    nohup python3 realtime_email_monitor.py \
        > "${log_file}" 2>&1 &
    
    echo $! > "${pid_file}"
    
    log "Real-time monitor started (PID: $(cat ${pid_file}))"
}

start_analytics() {
    info "Starting analytics service..."
    
    source "${PYTHON_VENV}/bin/activate"
    
    local log_file="${LOG_DIR}/analytics.log"
    local pid_file="${PID_DIR}/analytics.pid"
    
    nohup python3 realtime_analytics.py \
        --port ${ANALYTICS_PORT} \
        > "${log_file}" 2>&1 &
    
    echo $! > "${pid_file}"
    
    log "Analytics service started (PID: $(cat ${pid_file})) - Port ${ANALYTICS_PORT}"
}

start_email_scheduler() {
    info "Starting email scheduler..."
    
    source "${PYTHON_VENV}/bin/activate"
    
    local log_file="${LOG_DIR}/email_scheduler.log"
    local pid_file="${PID_DIR}/email_scheduler.pid"
    
    nohup python3 email_scheduler.py \
        > "${log_file}" 2>&1 &
    
    echo $! > "${pid_file}"
    
    log "Email scheduler started (PID: $(cat ${pid_file}))"
}

# Wait for services to start
wait_for_services() {
    info "Waiting for services to initialize..."
    
    local services=(
        "backend:${BACKEND_PORT}"
        "analytics:${ANALYTICS_PORT}"
    )
    
    for service_info in "${services[@]}"; do
        local service_name="${service_info%%:*}"
        local service_port="${service_info##*:}"
        
        log "Waiting for ${service_name} on port ${service_port}..."
        
        for i in {1..30}; do
            if curl -sf "http://localhost:${service_port}/health" > /dev/null 2>&1; then
                log "${service_name} is ready"
                break
            fi
            
            if [[ $i -eq 30 ]]; then
                error "${service_name} failed to start within timeout"
                return 1
            fi
            
            sleep 2
        done
    done
    
    log "All services are ready"
}

# Health check
health_check() {
    info "Performing health check..."
    
    source "${PYTHON_VENV}/bin/activate"
    
    if python3 verify_health.py; then
        log "Health check passed"
        return 0
    else
        error "Health check failed"
        return 1
    fi
}

# Display service status
show_status() {
    info "Email Intelligence Service Status"
    echo "=================================="
    
    local services=("backend" "realtime_monitor" "analytics" "email_scheduler")
    
    for service in "${services[@]}"; do
        if check_running "${service}"; then
            local pid=$(cat "${PID_DIR}/${service}.pid")
            echo -e "  ${service}: ${GREEN}RUNNING${NC} (PID: ${pid})"
        else
            echo -e "  ${service}: ${RED}STOPPED${NC}"
        fi
    done
    
    echo ""
    info "Service URLs:"
    echo "  Backend API:     http://localhost:${BACKEND_PORT}"
    echo "  API Docs:        http://localhost:${BACKEND_PORT}/docs"
    echo "  Health Check:    http://localhost:${BACKEND_PORT}/health"
    echo "  Analytics:       http://localhost:${ANALYTICS_PORT}"
    echo "  Metrics:         http://localhost:${BACKEND_PORT}/metrics"
    echo ""
    info "Logs directory:   ${LOG_DIR}"
    info "PIDs directory:   ${PID_DIR}"
    echo ""
}

# Main startup sequence
main() {
    log "Starting Email Intelligence Service (Native Python)"
    echo "=================================================="
    
    # Handle command line arguments
    case "${1:-start}" in
        start)
            # Stop any running instances
            if check_running "backend"; then
                warn "Service appears to be running. Stopping first..."
                stop_services
                sleep 2
            fi
            
            # Startup sequence
            check_dependencies
            setup_virtualenv
            init_database
            
            # Start services
            start_backend
            start_realtime_monitor
            start_analytics
            start_email_scheduler
            
            # Wait for services to be ready
            sleep 5
            wait_for_services
            
            # Verify health
            if health_check; then
                log "Email Intelligence Service started successfully!"
                show_status
                
                info "To monitor logs: tail -f ${LOG_DIR}/*.log"
                info "To stop services: ${0} stop"
            else
                error "Service startup failed health check"
                stop_services
                exit 1
            fi
            ;;
            
        stop)
            stop_services
            log "Email Intelligence Service stopped"
            ;;
            
        restart)
            stop_services
            sleep 2
            exec "$0" start
            ;;
            
        status)
            show_status
            ;;
            
        logs)
            info "Following service logs (Ctrl+C to exit):"
            tail -f "${LOG_DIR}"/*.log 2>/dev/null || {
                warn "No log files found in ${LOG_DIR}"
            }
            ;;
            
        health)
            if health_check; then
                log "All services are healthy"
                exit 0
            else
                error "Health check failed"
                exit 1
            fi
            ;;
            
        *)
            echo "Usage: $0 {start|stop|restart|status|logs|health}"
            echo ""
            echo "Commands:"
            echo "  start    - Start all services"
            echo "  stop     - Stop all services"
            echo "  restart  - Restart all services"
            echo "  status   - Show service status"
            echo "  logs     - Follow service logs"
            echo "  health   - Run health check"
            exit 1
            ;;
    esac
}

# Trap signals for graceful shutdown
trap 'stop_services; exit 0' SIGTERM SIGINT

# Run main function
main "$@"