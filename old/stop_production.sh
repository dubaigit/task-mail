#!/bin/bash

# Stop Production Email Intelligence Services
# Gracefully shutdown all components

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
PIDS_DIR="pids"
LOGS_DIR="logs"
GRACE_PERIOD=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Stop service by PID file
stop_service() {
    local service_name=$1
    local pid_file="$PIDS_DIR/${service_name}.pid"
    
    if [ ! -f "$pid_file" ]; then
        info "$service_name: No PID file found"
        return 0
    fi
    
    local pid=$(cat "$pid_file" 2>/dev/null || echo "")
    if [ -z "$pid" ]; then
        warn "$service_name: Empty PID file"
        rm -f "$pid_file"
        return 0
    fi
    
    # Check if process is running
    if ! kill -0 "$pid" 2>/dev/null; then
        info "$service_name: Process not running (PID $pid)"
        rm -f "$pid_file"
        return 0
    fi
    
    log "Stopping $service_name (PID $pid)..."
    
    # Send TERM signal
    kill -TERM "$pid" 2>/dev/null || true
    
    # Wait for graceful shutdown
    local count=0
    while kill -0 "$pid" 2>/dev/null && [ $count -lt $GRACE_PERIOD ]; do
        sleep 1
        count=$((count + 1))
    done
    
    # Force kill if still running
    if kill -0 "$pid" 2>/dev/null; then
        warn "$service_name: Forcing shutdown"
        kill -KILL "$pid" 2>/dev/null || true
        sleep 2
    fi
    
    # Check if stopped
    if kill -0 "$pid" 2>/dev/null; then
        error "$service_name: Failed to stop (PID $pid)"
        return 1
    else
        log "✓ $service_name stopped successfully"
        rm -f "$pid_file"
        return 0
    fi
}

# Stop Docker services
stop_docker_services() {
    log "Stopping Docker services..."
    
    if ! command -v docker &> /dev/null; then
        info "Docker not available - skipping"
        return 0
    fi
    
    # Use production compose file if available
    compose_file="docker-compose.production.yml"
    if [ ! -f "$compose_file" ]; then
        compose_file="docker-compose.yml"
    fi
    
    if [ -f "$compose_file" ]; then
        # Stop services but keep data volumes
        docker-compose -f "$compose_file" stop redis mongodb mongo-express 2>/dev/null || true
        log "✓ Docker services stopped"
    else
        info "Docker compose file not found - skipping"
    fi
}

# Kill processes by pattern
kill_processes_by_pattern() {
    local pattern=$1
    local description=$2
    
    local pids=$(pgrep -f "$pattern" 2>/dev/null || echo "")
    if [ -n "$pids" ]; then
        log "Stopping $description processes..."
        echo "$pids" | xargs -r kill -TERM 2>/dev/null || true
        sleep 2
        
        # Force kill if still running
        local remaining_pids=$(pgrep -f "$pattern" 2>/dev/null || echo "")
        if [ -n "$remaining_pids" ]; then
            warn "Force killing $description processes"
            echo "$remaining_pids" | xargs -r kill -KILL 2>/dev/null || true
        fi
        log "✓ $description processes stopped"
    fi
}

# Clean up stale resources
cleanup_resources() {
    log "Cleaning up resources..."
    
    # Remove stale PID files
    if [ -d "$PIDS_DIR" ]; then
        find "$PIDS_DIR" -name "*.pid" -type f | while read -r pidfile; do
            if [ -f "$pidfile" ]; then
                pid=$(cat "$pidfile" 2>/dev/null || echo "")
                if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
                    rm -f "$pidfile"
                    info "Removed stale PID file: $(basename "$pidfile")"
                fi
            fi
        done
    fi
    
    # Clean up any remaining Python processes
    kill_processes_by_pattern "python.*realtime_main" "Backend API"
    kill_processes_by_pattern "python.*realtime_analytics" "Analytics Engine"
    kill_processes_by_pattern "python.*realtime_email_monitor" "Email Monitor"
    
    # Clean up Node.js processes (UI)
    kill_processes_by_pattern "node.*3000" "UI Dashboard"
    kill_processes_by_pattern "npm.*start" "UI Server"
    
    log "✓ Resource cleanup completed"
}

# Display final status
show_final_status() {
    log "Final service status check..."
    
    local services=("backend" "analytics" "email_monitor" "ui")
    local all_stopped=true
    
    for service in "${services[@]}"; do
        pid_file="$PIDS_DIR/${service}.pid"
        if [ -f "$pid_file" ]; then
            pid=$(cat "$pid_file" 2>/dev/null || echo "")
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                error "$service still running (PID $pid)"
                all_stopped=false
            fi
        fi
    done
    
    # Check for any remaining processes
    local remaining_processes=()
    
    if pgrep -f "python.*realtime" >/dev/null 2>&1; then
        remaining_processes+=("Python services")
    fi
    
    if pgrep -f "node.*3000" >/dev/null 2>&1; then
        remaining_processes+=("UI Dashboard")
    fi
    
    if [ ${#remaining_processes[@]} -gt 0 ]; then
        warn "Some processes may still be running: ${remaining_processes[*]}"
        all_stopped=false
    fi
    
    if [ "$all_stopped" = true ]; then
        log "🛑 All Email Intelligence System services stopped successfully"
    else
        warn "⚠️  Some services may not have stopped completely"
        info "Run 'ps aux | grep -E \"(realtime|email)\"' to check manually"
    fi
}

# Main shutdown sequence
main() {
    log "Stopping Email Intelligence System (Production Mode)"
    log "=================================================="
    
    # Create directories if they don't exist
    mkdir -p "$PIDS_DIR"
    
    # Stop services in reverse order of startup
    stop_service "ui"
    stop_service "email_monitor"  
    stop_service "analytics"
    stop_service "backend"
    
    # Stop Docker services
    stop_docker_services
    
    # Additional cleanup
    cleanup_resources
    
    # Final status
    show_final_status
    
    log "Shutdown sequence completed"
}

# Handle script arguments
case "${1:-stop}" in
    stop)
        main
        ;;
    force)
        log "Force stopping all services..."
        cleanup_resources
        show_final_status
        ;;
    docker)
        log "Stopping only Docker services..."
        stop_docker_services
        ;;
    *)
        echo "Usage: $0 [stop|force|docker]"
        echo "  stop   - Graceful shutdown (default)"
        echo "  force  - Force kill all processes"
        echo "  docker - Stop only Docker services"
        exit 1
        ;;
esac