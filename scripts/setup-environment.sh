#!/bin/bash

# Apple MCP Email Intelligence Dashboard - Environment Setup Script
# This script helps set up the environment for development and production

set -e

echo "🚀 Setting up Apple MCP Email Intelligence Dashboard Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
if [ ! -f .env ]; then
    print_status "Creating .env file from template..."
    cp config/env.example .env
    print_success ".env file created from template"
else
    print_warning ".env file already exists, skipping creation"
fi

# Check if required directories exist
print_status "Creating required directories..."
mkdir -p logs
mkdir -p database
mkdir -p config
mkdir -p scripts

print_success "Required directories created"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    print_error "Node.js version 16+ is required. Current version: $(node --version)"
    exit 1
fi

print_success "Node.js version check passed: $(node --version)"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_success "npm check passed: $(npm --version)"

# Install backend dependencies
print_status "Installing backend dependencies..."
npm install

if [ $? -eq 0 ]; then
    print_success "Backend dependencies installed successfully"
else
    print_error "Failed to install backend dependencies"
    exit 1
fi

# Install frontend dependencies
print_status "Installing frontend dependencies..."
cd dashboard/frontend
npm install

if [ $? -eq 0 ]; then
    print_success "Frontend dependencies installed successfully"
else
    print_error "Failed to install frontend dependencies"
    exit 1
fi

cd ../..

# Check if Docker is available for Supabase
if command -v docker &> /dev/null; then
    print_status "Docker detected, checking if Supabase containers are running..."
    
    if docker ps | grep -q supabase; then
        print_success "Supabase containers are running"
    else
        print_warning "Supabase containers are not running. You can start them with:"
        echo "  docker-compose up -d"
    fi
else
    print_warning "Docker not detected. You'll need to set up Supabase manually or use a cloud instance."
fi

# Check Apple Mail database path
APPLE_MAIL_PATH_DEFAULT="$ROOT_DIR/database/fake-apple-mail/fake-envelope-index.sqlite"
if [ -f "$APPLE_MAIL_PATH_DEFAULT" ]; then
    print_success "Using fake Apple Mail database at: $APPLE_MAIL_PATH_DEFAULT"
else
    print_warning "Apple Mail database not found at expected path: $APPLE_MAIL_PATH"
    print_warning "Please update the APPLE_MAIL_DB_PATH in your .env file"
fi

# Create a simple test script
print_status "Creating test script..."
cat > test-setup.js << 'EOF'
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing environment setup...');

// Check if .env exists
if (fs.existsSync('.env')) {
    console.log('✅ .env file exists');
} else {
    console.log('❌ .env file missing');
}

// Check if node_modules exists
if (fs.existsSync('node_modules')) {
    console.log('✅ Backend dependencies installed');
} else {
    console.log('❌ Backend dependencies missing');
}

// Check if frontend node_modules exists
if (fs.existsSync('dashboard/frontend/node_modules')) {
    console.log('✅ Frontend dependencies installed');
} else {
    console.log('❌ Frontend dependencies missing');
}

// Check if package.json exists
if (fs.existsSync('package.json')) {
    console.log('✅ package.json exists');
} else {
    console.log('❌ package.json missing');
}

console.log('\n🎯 Setup complete! Next steps:');
console.log('1. Update your .env file with your actual API keys and database URLs');
console.log('2. Start Supabase: docker-compose up -d');
console.log('3. Initialize database: npm run db:init');
console.log('4. Start the application: npm run start:full');
EOF

print_success "Test script created: test-setup.js"

# Make the script executable
chmod +x scripts/setup-environment.sh

print_success "Environment setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env file with your actual configuration values"
echo "2. Start Supabase: docker-compose up -d"
echo "3. Initialize database: npm run db:init"
echo "4. Start the application: npm run start:full"
echo ""
echo "🔧 To test the setup, run: node test-setup.js"
echo ""
echo "📚 For more information, see CLAUDE.md"
