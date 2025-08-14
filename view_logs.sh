#!/bin/bash

# Production Log Viewer
# Real-time log monitoring for Email Intelligence System

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
LOGS_DIR="logs"
MAX_LINES="${MAX_LINES:-50}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Service colors
declare -A SERVICE_COLORS=(
    ["backend"]=$GREEN
    ["analytics"]=$BLUE
    ["email_monitor"]=$YELLOW
    ["ui"]=$CYAN
    ["production"]=$PURPLE
)

# Print usage
usage() {
    echo "Email Intelligence System - Log Viewer"
    echo "Usage: $0 [OPTIONS] [SERVICE]"
    echo ""
    echo "Services:"
    echo "  backend        - Main API backend logs"
    echo "  analytics      - Real-time analytics logs" 
    echo "  email_monitor  - Email monitoring logs"
    echo "  ui            - UI dashboard logs"
    echo "  all           - All services (default)"
    echo ""
    echo "Options:"
    echo "  -f, --follow   - Follow log output (tail -f)"
    echo "  -n, --lines N  - Show last N lines (default: $MAX_LINES)"
    echo "  -e, --errors   - Show only error lines"
    echo "  -g, --grep     - Filter logs with pattern"
    echo "  -h, --help     - Show this help"
    echo ""
    echo "Examples:"
    echo "  $0                     # Show recent logs from all services"
    echo "  $0 -f backend          # Follow backend logs"
    echo "  $0 -n 100 analytics    # Show last 100 analytics lines"
    echo "  $0 -e all              # Show only errors from all services"
    echo "  $0 -g \"WebSocket\" backend  # Filter backend logs for WebSocket"
}

# Format log line with colors
format_log_line() {
    local line="$1"
    local service="$2"
    local color="${SERVICE_COLORS[$service]:-$NC}"
    
    # Add timestamp if not present
    if [[ ! "$line" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]]; then
        line="$(date +'%Y-%m-%d %H:%M:%S') $line"
    fi
    
    # Color coding based on log level
    if echo "$line" | grep -qi "error\|exception\|failed\|critical"; then
        echo -e "${RED}[$service]${NC} $line"
    elif echo "$line" | grep -qi "warning\|warn"; then
        echo -e "${YELLOW}[$service]${NC} $line"
    elif echo "$line" | grep -qi "info"; then
        echo -e "${color}[$service]${NC} $line"
    elif echo "$line" | grep -qi "debug"; then
        echo -e "${CYAN}[$service]${NC} $line"
    else
        echo -e "${color}[$service]${NC} $line"
    fi
}

# Show logs for a service
show_service_logs() {
    local service="$1"
    local follow="$2"
    local lines="$3"
    local errors_only="$4"
    local grep_pattern="$5"
    
    local log_file="$LOGS_DIR/${service}.log"
    
    if [ ! -f "$log_file" ]; then
        echo -e "${RED}Log file not found: $log_file${NC}"
        return 1
    fi
    
    echo -e "${SERVICE_COLORS[$service]:-$NC}=== $service logs ===${NC}"
    
    if [ "$follow" = true ]; then
        # Follow mode
        local tail_cmd="tail -f"
        if [ "$lines" -gt 0 ]; then
            tail_cmd="tail -f -n $lines"
        fi
        
        if [ -n "$grep_pattern" ]; then
            $tail_cmd "$log_file" | grep --color=always "$grep_pattern" | while read -r line; do
                format_log_line "$line" "$service"
            done
        elif [ "$errors_only" = true ]; then
            $tail_cmd "$log_file" | grep -i "error\|exception\|failed\|critical" | while read -r line; do
                format_log_line "$line" "$service"
            done
        else
            $tail_cmd "$log_file" | while read -r line; do
                format_log_line "$line" "$service"
            done
        fi
    else
        # Static mode
        local tail_cmd="tail"
        if [ "$lines" -gt 0 ]; then
            tail_cmd="tail -n $lines"
        fi
        
        local content
        if [ -n "$grep_pattern" ]; then
            content=$($tail_cmd "$log_file" | grep "$grep_pattern" || true)
        elif [ "$errors_only" = true ]; then
            content=$($tail_cmd "$log_file" | grep -i "error\|exception\|failed\|critical" || true)
        else
            content=$($tail_cmd "$log_file")
        fi
        
        if [ -n "$content" ]; then
            echo "$content" | while read -r line; do
                format_log_line "$line" "$service"
            done
        else
            echo -e "${YELLOW}No matching log entries found${NC}"
        fi
    fi
}

# Show logs for all services
show_all_logs() {
    local follow="$1"
    local lines="$2"
    local errors_only="$3"
    local grep_pattern="$4"
    
    local services=("backend" "analytics" "email_monitor" "ui")
    local existing_services=()
    
    # Check which services have log files
    for service in "${services[@]}"; do
        if [ -f "$LOGS_DIR/${service}.log" ]; then
            existing_services+=("$service")
        fi
    done
    
    if [ ${#existing_services[@]} -eq 0 ]; then
        echo -e "${RED}No log files found in $LOGS_DIR${NC}"
        return 1
    fi
    
    if [ "$follow" = true ]; then
        echo -e "${PURPLE}=== Following logs from all services (Ctrl+C to stop) ===${NC}"
        echo
        
        # Create temporary files for each service tail process
        local tmp_dir="/tmp/email_logs_$$"
        mkdir -p "$tmp_dir"
        
        # Start tail processes for each service
        local pids=()
        for service in "${existing_services[@]}"; do
            local log_file="$LOGS_DIR/${service}.log"
            
            if [ -n "$grep_pattern" ]; then
                tail -f "$log_file" | grep --color=never "$grep_pattern" | sed "s/^/[$service] /" > "$tmp_dir/$service" &
            elif [ "$errors_only" = true ]; then
                tail -f "$log_file" | grep -i "error\|exception\|failed\|critical" | sed "s/^/[$service] /" > "$tmp_dir/$service" &
            else
                tail -f "$log_file" | sed "s/^/[$service] /" > "$tmp_dir/$service" &
            fi
            pids+=($!)
        done
        
        # Follow the combined output
        tail -f "$tmp_dir"/* | while read -r line; do
            # Extract service name and log content
            if [[ "$line" =~ ^\[([^\]]+)\]\ (.*)$ ]]; then
                local service="${BASH_REMATCH[1]}"
                local content="${BASH_REMATCH[2]}"
                format_log_line "$content" "$service"
            else
                echo "$line"
            fi
        done
        
        # Cleanup on exit
        trap 'kill ${pids[@]} 2>/dev/null; rm -rf "$tmp_dir"' EXIT
        
    else
        # Static mode - show recent logs from each service
        for service in "${existing_services[@]}"; do
            show_service_logs "$service" false "$lines" "$errors_only" "$grep_pattern"
            echo
        done
    fi
}

# Main function
main() {
    local follow=false
    local lines=$MAX_LINES
    local errors_only=false
    local grep_pattern=""
    local service="all"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--follow)
                follow=true
                shift
                ;;
            -n|--lines)
                lines="$2"
                shift 2
                ;;
            -e|--errors)
                errors_only=true
                shift
                ;;
            -g|--grep)
                grep_pattern="$2"
                shift 2
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            backend|analytics|email_monitor|ui|all)
                service="$1"
                shift
                ;;
            *)
                echo "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    # Validate lines parameter
    if ! [[ "$lines" =~ ^[0-9]+$ ]]; then
        echo "Error: Lines must be a number"
        exit 1
    fi
    
    # Create logs directory if it doesn't exist
    mkdir -p "$LOGS_DIR"
    
    # Check if any log files exist
    if [ ! "$(ls -A $LOGS_DIR 2>/dev/null)" ]; then
        echo -e "${YELLOW}No log files found in $LOGS_DIR${NC}"
        echo "Make sure the Email Intelligence System is running or has been run before."
        exit 1
    fi
    
    echo "Email Intelligence System - Log Viewer"
    echo "======================================"
    echo
    
    # Show logs based on service selection
    if [ "$service" = "all" ]; then
        show_all_logs "$follow" "$lines" "$errors_only" "$grep_pattern"
    else
        show_service_logs "$service" "$follow" "$lines" "$errors_only" "$grep_pattern"
    fi
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}Log viewer interrupted${NC}"; exit 0' INT

# Run main function
main "$@"