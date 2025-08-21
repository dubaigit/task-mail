#!/bin/bash

# Production deployment script for Apple-MCP
set -e

echo "🚀 Starting Apple-MCP Production Deployment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found. Please copy env.example to .env and configure it."
    exit 1
fi

# Source environment variables
source .env

# Validate required environment variables
required_vars=("DB_PASSWORD" "JWT_SECRET" "REDIS_PASSWORD" "OPENAI_API_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: Required environment variable $var is not set"
        exit 1
    fi
done

# Check JWT secret length
if [ ${#JWT_SECRET} -lt 32 ]; then
    echo "❌ Error: JWT_SECRET must be at least 32 characters long"
    exit 1
fi

echo "✅ Environment validation passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Install frontend dependencies and build
echo "🎨 Building frontend..."
cd dashboard/frontend
npm ci
npm run build
cd ../..

# Create logs directory
mkdir -p logs

# Set up log rotation (logrotate configuration)
echo "📝 Setting up log rotation..."
sudo tee /etc/logrotate.d/apple-mcp > /dev/null <<EOF
/Users/iamomen/apple-mcp/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $(whoami) $(whoami)
    postrotate
        pkill -SIGUSR1 node || true
    endscript
}
EOF

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check health
echo "🏥 Checking application health..."
if curl -f http://localhost:${PORT:-8000}/health > /dev/null 2>&1; then
    echo "✅ Application is healthy"
else
    echo "❌ Application health check failed"
    exit 1
fi

echo "🎉 Production deployment completed successfully!"
echo "📊 Application is running at: http://localhost:${PORT:-8000}"
echo "🏥 Health check: http://localhost:${PORT:-8000}/health"
echo "📝 Logs: tail -f logs/combined.log"
