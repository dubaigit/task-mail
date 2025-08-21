#!/bin/bash

# Docker Services Management Script for Apple MCP Email Task Manager

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Check if docker-compose is installed
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null; then
        print_error "docker-compose is not installed. Please install it first."
        exit 1
    fi
}

# Start services
start_services() {
    print_header "Starting Email Task Manager Services"
    check_docker_compose
    
    print_status "Starting PostgreSQL and Redis containers..."
    docker-compose up -d
    
    print_status "Waiting for services to be ready..."
    sleep 10
    
    # Check PostgreSQL health
    print_status "Checking PostgreSQL connection..."
    docker-compose exec postgres pg_isready -U email_admin -d email_management || {
        print_error "PostgreSQL is not ready"
        exit 1
    }
    
    # Check Redis health
    print_status "Checking Redis connection..."
    docker-compose exec redis redis-cli ping || {
        print_error "Redis is not ready"
        exit 1
    }
    
    print_status "✅ All services are running successfully!"
    show_status
}

# Stop services
stop_services() {
    print_header "Stopping Email Task Manager Services"
    check_docker_compose
    
    print_status "Stopping all containers..."
    docker-compose down
    
    print_status "✅ All services stopped"
}

# Restart services
restart_services() {
    print_header "Restarting Email Task Manager Services"
    stop_services
    start_services
}

# Show status
show_status() {
    print_header "Service Status"
    
    echo -e "${BLUE}Docker Containers:${NC}"
    docker-compose ps
    
    echo -e "\n${BLUE}Database Connection:${NC}"
    docker-compose exec postgres psql -U email_admin -d email_management -c "SELECT COUNT(*) as total_emails FROM emails;" 2>/dev/null || echo "❌ Database not accessible"
    
    echo -e "\n${BLUE}Redis Status:${NC}"
    docker-compose exec redis redis-cli ping 2>/dev/null || echo "❌ Redis not accessible"
    
    echo -e "\n${BLUE}Ports:${NC}"
    echo "PostgreSQL: localhost:5432"
    echo "Redis: localhost:6379"
}

# Show logs
show_logs() {
    print_header "Service Logs"
    if [ -n "$2" ]; then
        docker-compose logs -f "$2"
    else
        docker-compose logs -f
    fi
}

# Clean up (remove containers and volumes)
cleanup() {
    print_header "Cleaning Up Email Task Manager Services"
    print_warning "This will remove all containers and data volumes!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v --remove-orphans
        print_status "✅ Cleanup completed"
    else
        print_status "Cleanup cancelled"
    fi
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
        show_status
        ;;
    logs)
        show_logs "$@"
        ;;
    cleanup)
        cleanup
        ;;
    *)
        print_header "Email Task Manager - Docker Services"
        echo "Usage: $0 {start|stop|restart|status|logs|cleanup}"
        echo ""
        echo "Commands:"
        echo "  start    - Start PostgreSQL and Redis services"
        echo "  stop     - Stop all services"
        echo "  restart  - Restart all services"
        echo "  status   - Show status of all services"
        echo "  logs     - Show logs (add service name for specific logs)"
        echo "  cleanup  - Remove all containers and volumes (DESTRUCTIVE)"
        echo ""
        echo "Examples:"
        echo "  $0 start"
        echo "  $0 logs postgres"
        echo "  $0 status"
        exit 1
        ;;
esac
