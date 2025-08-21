#!/bin/bash

# Comprehensive Test Runner for Apple MCP Email Task Manager
# Runs all test suites in the correct order

set -e  # Exit on any error

echo "🧪 Starting Comprehensive Test Suite for Apple MCP"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TEST_RESULTS=()

# Function to run a test suite
run_test_suite() {
    local test_name="$1"
    local test_command="$2"
    local description="$3"
    
    echo -e "\n${BLUE}Running: $test_name${NC}"
    echo "Description: $description"
    echo "Command: $test_command"
    echo "----------------------------------------"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ $test_name PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        TEST_RESULTS+=("✅ $test_name")
    else
        echo -e "${RED}❌ $test_name FAILED${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        TEST_RESULTS+=("❌ $test_name")
    fi
}

# Function to check if server is running
check_server() {
    if curl -f http://localhost:8000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend server is running on port 8000${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️ Backend server not running on port 8000${NC}"
        return 1
    fi
}

# Function to check for conflicting ports
check_port_conflicts() {
    echo "Checking for port conflicts..."
    
    local conflicting_ports=(3001 8001 8002)
    local conflicts_found=false
    
    for port in "${conflicting_ports[@]}"; do
        if curl -f "http://localhost:$port/api/health" > /dev/null 2>&1; then
            echo -e "${RED}❌ Conflicting service found on port $port${NC}"
            conflicts_found=true
        fi
    done
    
    if [ "$conflicts_found" = false ]; then
        echo -e "${GREEN}✅ No port conflicts detected${NC}"
    fi
}

# Pre-test setup
echo "🔧 Pre-test Setup"
echo "=================="

# Check Node.js version
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Check server status
check_server
SERVER_RUNNING=$?

# Check for port conflicts
check_port_conflicts

# Create test results directory
mkdir -p tests/coverage tests/results

echo -e "\n🧪 Starting Test Execution"
echo "=========================="

# 1. System Health and Port Consistency Tests
run_test_suite \
    "System Health & Port Consistency" \
    "npm run test -- tests/system-health-comprehensive.test.ts --verbose" \
    "Validates system architecture and port configuration"

# 2. Port Consistency and Deployment Monitor
run_test_suite \
    "Deployment Monitor" \
    "npm run test -- tests/monitoring/deployment-monitor.test.ts --verbose" \
    "Monitors for configuration drift and port misconfigurations"

# 3. Integration Tests
run_test_suite \
    "Port Consistency Integration" \
    "npm run test -- tests/integration/port-consistency.test.ts --verbose" \
    "Tests API endpoints and port connectivity"

run_test_suite \
    "API Endpoints Comprehensive" \
    "npm run test -- tests/integration/api-endpoints.test.ts --verbose" \
    "Tests all backend API functionality"

# 4. Unit Tests (if they exist)
if [ -d "tests/unit" ]; then
    run_test_suite \
        "Unit Tests" \
        "npm run test -- tests/unit/ --verbose" \
        "Tests individual components and functions"
fi

# 5. E2E Tests (if server is running)
if [ $SERVER_RUNNING -eq 0 ]; then
    echo -e "\n${BLUE}Checking if Playwright is available for E2E tests...${NC}"
    
    if command -v npx &> /dev/null && npx playwright --version &> /dev/null; then
        run_test_suite \
            "End-to-End Tests" \
            "npx playwright test tests/e2e/user-workflow.spec.ts --reporter=html" \
            "Tests complete user workflows"
    else
        echo -e "${YELLOW}⚠️ Playwright not available, skipping E2E tests${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Server not running, skipping E2E tests${NC}"
fi

# 6. Frontend Tests (if frontend directory exists)
if [ -d "dashboard/frontend" ]; then
    echo -e "\n${BLUE}Running Frontend Tests...${NC}"
    cd dashboard/frontend
    
    if [ -f "package.json" ] && grep -q "test" package.json; then
        run_test_suite \
            "Frontend Tests" \
            "npm test -- --coverage --watchAll=false" \
            "Tests React components and frontend logic"
    else
        echo -e "${YELLOW}⚠️ No frontend tests configured${NC}"
    fi
    
    cd ../..
fi

# Generate comprehensive test report
echo -e "\n📊 Generating Test Report"
echo "========================="

cat > tests/results/test-summary.md << EOF
# Test Execution Summary

**Date:** $(date)
**Total Tests:** $((TESTS_PASSED + TESTS_FAILED))
**Passed:** $TESTS_PASSED
**Failed:** $TESTS_FAILED

## Test Results

EOF

for result in "${TEST_RESULTS[@]}"; do
    echo "- $result" >> tests/results/test-summary.md
done

cat >> tests/results/test-summary.md << EOF

## System Status

- Backend Server: $([ $SERVER_RUNNING -eq 0 ] && echo "✅ Running on port 8000" || echo "❌ Not running")
- Port Configuration: $([ $TESTS_FAILED -eq 0 ] && echo "✅ Consistent" || echo "❌ Issues found")

## Next Steps

$(if [ $TESTS_FAILED -gt 0 ]; then
    echo "- Fix failing tests before deployment"
    echo "- Review port configuration issues"
    echo "- Check server connectivity"
else
    echo "- All tests passing ✅"
    echo "- System ready for deployment"
fi)
EOF

# Display final results
echo -e "\n🎯 Final Results"
echo "================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed! System is healthy and ready.${NC}"
    exit 0
else
    echo -e "\n${RED}💥 Some tests failed. Please review the issues above.${NC}"
    echo "Full test report available at: tests/results/test-summary.md"
    exit 1
fi