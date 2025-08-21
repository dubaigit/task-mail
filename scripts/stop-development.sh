#!/bin/bash

# Apple MCP Email Task Manager - Stop Development Services

echo "🛑 Stopping Apple MCP Email Task Manager services..."

# Kill Node.js processes for this project
echo "Stopping backend server..."
pkill -f "node.*server.js" || true

echo "Stopping frontend React app..."
pkill -f "craco start" || true

# Stop Docker services
echo "Stopping Docker services..."
docker-compose down

echo "✅ All services stopped successfully!"