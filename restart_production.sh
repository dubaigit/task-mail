#!/bin/bash

# Restart Production Email Intelligence Services
# Graceful restart with health checks

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

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

# Check if services are running
check_services() {
    local backend_port="${PORT:-8000}"
    local services_running=0
    local total_services=4
    
    # Check backend
    if curl -s "http://localhost:$backend_port" >/dev/null 2>&1; then
        services_running=$((services_running + 1))
        info "✓ Backend service is running"
    else
        warn "✗ Backend service is not running"
    fi
    
    # Check if other services are running via process check
    if pgrep -f "python.*realtime_analytics" >/dev/null 2>&1; then
        services_running=$((services_running + 1))
        info "✓ Analytics service is running"
    else
        warn "✗ Analytics service is not running"
    fi
    
    if pgrep -f "python.*realtime_email_monitor" >/dev/null 2>&1; then
        services_running=$((services_running + 1))
        info "✓ Email monitor service is running"
    else
        warn "✗ Email monitor service is not running"
    fi
    
    if pgrep -f "node.*3000\|npm.*start" >/dev/null 2>&1; then
        services_running=$((services_running + 1))
        info "✓ UI service is running"
    else
        warn "✗ UI service is not running"
    fi
    
    echo "$services_running"
}

# Perform health check
health_check() {
    log "Performing health check..."
    
    if [ -f "verify_service.py" ]; then
        if python3 verify_service.py --no-ai --no-email --no-performance --timeout 5; then
            log "✅ Health check passed"
            return 0
        else
            warn "⚠️  Health check failed - some issues detected"
            return 1
        fi
    else
        # Basic health check
        local backend_port="${PORT:-8000}"
        if curl -s "http://localhost:$backend_port" | grep -q "healthy"; then
            log "✅ Basic health check passed"
            return 0
        else
            error "❌ Basic health check failed"
            return 1
        fi
    fi
}

# Rolling restart function
rolling_restart() {
    log "Performing rolling restart..."
    
    # Restart services one by one to maintain availability
    local services=("email_monitor" "analytics" "ui" "backend")
    
    for service in "${services[@]}"; do
        log "Restarting $service..."
        
        # Stop the service
        if [ -f "pids/${service}.pid" ]; then
            local pid=$(cat "pids/${service}.pid" 2>/dev/null || echo "")
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                kill -TERM "$pid" 2>/dev/null || true
                
                # Wait for graceful shutdown
                local count=0
                while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
                    sleep 1
                    count=$((count + 1))
                done
                
                # Force kill if needed
                if kill -0 "$pid" 2>/dev/null; then
                    kill -KILL "$pid" 2>/dev/null || true
                fi
            fi
        fi
        
        # Remove PID file
        rm -f "pids/${service}.pid"
        
        # Wait a bit before restarting
        sleep 2
        
        log "✓ $service stopped, will be restarted with the full system"
    done
}

# Restart with backup
restart_with_backup() {
    log "Creating configuration backup..."
    
    # Backup current configuration
    local backup_dir="backups/restart_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup important files
    for file in .env.production production_config.py docker-compose.production.yml; do
        if [ -f "$file" ]; then
            cp "$file" "$backup_dir/"
        fi
    done
    
    # Backup logs
    if [ -d "logs" ]; then
        cp -r logs "$backup_dir/"
    fi
    
    log "✓ Backup created in $backup_dir"
    
    # Perform restart
    log "Starting restart sequence..."
    
    # Stop all services
    ./stop_production.sh || warn "Stop script encountered issues"
    
    # Wait for clean shutdown
    sleep 5
    
    # Start all services
    ./start_production.sh
}

# Quick restart function
quick_restart() {
    log "Performing quick restart..."
    
    ./stop_production.sh
    sleep 3
    ./start_production.sh
}

# Usage information
usage() {
    echo "Email Intelligence System - Production Restart"
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --quick     - Quick restart (stop and start)"
    echo "  --rolling   - Rolling restart (maintain availability)"
    echo "  --backup    - Restart with backup (safest)"
    echo "  --check     - Just check service status"
    echo "  --health    - Run health check only"
    echo "  --help      - Show this help"
    echo ""
    echo "Default: backup restart (safest option)"
}

# Main function
main() {
    local restart_type="backup"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --quick)
                restart_type="quick"
                shift
                ;;
            --rolling)
                restart_type="rolling"
                shift
                ;;
            --backup)
                restart_type="backup"
                shift
                ;;
            --check)
                log "Checking service status..."
                local running_count=$(check_services)
                log "Services running: $running_count/4"
                exit 0
                ;;
            --health)
                health_check
                exit $?
                ;;
            --help)
                usage
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    log "Email Intelligence System - Production Restart"
    log "Restart type: $restart_type"
    log "=============================================="
    
    # Pre-restart checks
    log "Checking current service status..."
    local running_services=$(check_services)
    log "Currently running services: $running_services/4"
    
    # Perform restart based on type
    case $restart_type in
        quick)
            quick_restart
            ;;
        rolling)
            if [ "$running_services" -eq 4 ]; then
                rolling_restart
                sleep 5
                ./start_production.sh
            else
                warn "Not all services running - falling back to full restart"
                quick_restart
            fi
            ;;
        backup)
            restart_with_backup
            ;;
    esac
    
    # Post-restart verification
    log "Verifying restart..."
    sleep 10
    
    local new_running_count=$(check_services)
    if [ "$new_running_count" -eq 4 ]; then
        log "🎉 All services restarted successfully"
        
        # Run health check if available
        if health_check; then
            log "🏥 System health verified"
        else
            warn "⚠️  Health check detected issues - check logs"
        fi
        
    else
        error "❌ Some services failed to start ($new_running_count/4 running)"
        error "Check logs for details: ./view_logs.sh"
        exit 1
    fi
    
    log "Restart completed successfully"
    log "Monitor logs: ./view_logs.sh -f"
    log "Check status: ./verify_service.py"
}

# Handle Ctrl+C
trap 'echo -e "\n${YELLOW}Restart interrupted${NC}"; exit 130' INT

# Run main function
main "$@"