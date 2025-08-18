#!/bin/bash

# Service management script for the Task-First Email Manager

# Configuration
BACKEND_PORT=8000
FRONTEND_PORT=3000
PID_DIR=".pids"
BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"
BACKEND_LOG_FILE="backend.log"
FRONTEND_LOG_FILE="frontend.log"

# Ensure the PID directory exists
mkdir -p $PID_DIR

# Function to kill processes on a given port
kill_port() {
    PORT=$1
    echo "Checking for process on port $PORT..."
    PID=$(lsof -t -i:$PORT)
    if [ -n "$PID" ]; then
        echo "Killing process $PID on port $PORT"
        kill -9 $PID
    else
        echo "No process found on port $PORT"
    fi
}

# Function to start the Node.js server (serves both frontend and backend)
start_server() {
    echo "Starting Node.js server (frontend + backend)..."
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT
    nohup node server.js > server.log 2>&1 &
    echo $! > $BACKEND_PID_FILE
    echo "Server started with PID $(cat $BACKEND_PID_FILE)"
    echo "Frontend and API available at http://localhost:$BACKEND_PORT"
}

# Legacy functions for compatibility
start_backend() {
    start_server
}

start_frontend() {
    echo "Frontend is served by the Node.js server"
}

# Function to stop the backend
stop_backend() {
    echo "Stopping backend..."
    if [ -f $BACKEND_PID_FILE ]; then
        PID=$(cat $BACKEND_PID_FILE)
        if ps -p $PID > /dev/null; then
            kill -9 $PID
            rm $BACKEND_PID_FILE
            echo "Backend stopped"
        else
            echo "Backend process not found"
            rm $BACKEND_PID_FILE
        fi
    else
        echo "Backend PID file not found"
    fi
}

# Function to stop the frontend
stop_frontend() {
    echo "Stopping frontend..."
    if [ -f $FRONTEND_PID_FILE ]; then
        PID=$(cat $FRONTEND_PID_FILE)
        if ps -p $PID > /dev/null; then
            kill -9 $PID
            rm $FRONTEND_PID_FILE
            echo "Frontend stopped"
        else
            echo "Frontend process not found"
            rm $FRONTEND_PID_FILE
        fi
    else
        echo "Frontend PID file not found"
    fi
}

# Function to check the status of a service
check_status() {
    SERVICE_NAME=$1
    PID_FILE=$2
    if [ -f $PID_FILE ]; then
        PID=$(cat $PID_FILE)
        if ps -p $PID > /dev/null; then
            echo "$SERVICE_NAME is running (PID: $PID)"
        else
            echo "$SERVICE_NAME is not running, but PID file exists"
        fi
    else
        echo "$SERVICE_NAME is not running"
    fi
}

# Main script logic
case "$1" in
    start)
        start_backend
        start_frontend
        ;;
    stop)
        stop_backend
        stop_frontend
        ;;
    restart)
        stop_backend
        stop_frontend
        sleep 2
        start_backend
        start_frontend
        ;;
    kill-ports)
        kill_port $BACKEND_PORT
        kill_port $FRONTEND_PORT
        ;;
    status)
        check_status "Backend" $BACKEND_PID_FILE
        check_status "Frontend" $FRONTEND_PID_FILE
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|kill-ports|status}"
        exit 1
esac
