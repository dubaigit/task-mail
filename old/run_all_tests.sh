#!/usr/bin/env bash
set -euo pipefail

# Comprehensive test runner for Email Intelligence System
# Runs all unit tests, integration tests, and generates coverage reports

echo "========================================="
echo "Email Intelligence System - Test Suite"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create test results directory
RESULTS_DIR="test_results"
mkdir -p "$RESULTS_DIR"

# Function to run tests with category
run_test_category() {
    local category=$1
    local test_file=$2
    
    echo -e "${YELLOW}Running $category tests...${NC}"
    if python -m pytest "$test_file" -v --tb=short; then
        echo -e "${GREEN}✓ $category tests passed${NC}"
        return 0
    else
        echo -e "${RED}✗ $category tests failed${NC}"
        return 1
    fi
}

# Track test results
FAILED_TESTS=()
PASSED_TESTS=()

# 1. Run Email Intelligence Engine tests
echo "1. Testing Email Intelligence Engine..."
echo "----------------------------------------"
if run_test_category "Email Intelligence Engine" "tests/test_email_intelligence_engine.py"; then
    PASSED_TESTS+=("Email Intelligence Engine")
else
    FAILED_TESTS+=("Email Intelligence Engine")
fi
echo ""

# 2. Run AppleScript Integration tests
echo "2. Testing AppleScript Integration..."
echo "----------------------------------------"
if run_test_category "AppleScript Integration" "tests/test_applescript_integration.py"; then
    PASSED_TESTS+=("AppleScript Integration")
else
    FAILED_TESTS+=("AppleScript Integration")
fi
echo ""

# 3. Run Database Reader tests
echo "3. Testing Apple Mail Database Reader..."
echo "----------------------------------------"
if run_test_category "Database Reader" "tests/test_apple_mail_db_reader.py"; then
    PASSED_TESTS+=("Database Reader")
else
    FAILED_TESTS+=("Database Reader")
fi
echo ""

# 4. Run FastAPI Endpoint tests
echo "4. Testing FastAPI Endpoints..."
echo "----------------------------------------"
if run_test_category "FastAPI Endpoints" "tests/test_fastapi_endpoints.py"; then
    PASSED_TESTS+=("FastAPI Endpoints")
else
    FAILED_TESTS+=("FastAPI Endpoints")
fi
echo ""

# 5. Run all tests with coverage
echo "5. Running Complete Test Suite with Coverage..."
echo "------------------------------------------------"
python -m pytest tests/ \
    --cov=. \
    --cov-report=term-missing \
    --cov-report=html:$RESULTS_DIR/htmlcov \
    --cov-report=xml:$RESULTS_DIR/coverage.xml \
    --junit-xml=$RESULTS_DIR/junit.xml \
    --html=$RESULTS_DIR/report.html \
    --self-contained-html \
    -v 2>&1 | tee "$RESULTS_DIR/test_output.log"

# 6. Generate detailed coverage report
echo ""
echo "6. Coverage Report Summary"
echo "-------------------------"
python -m coverage report --precision=2

# 7. Test Summary
echo ""
echo "========================================="
echo "Test Results Summary"
echo "========================================="
echo ""

echo -e "${GREEN}Passed Test Suites (${#PASSED_TESTS[@]}):${NC}"
for test in "${PASSED_TESTS[@]}"; do
    echo -e "  ✓ $test"
done

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}Failed Test Suites (${#FAILED_TESTS[@]}):${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "  ✗ $test"
    done
fi

echo ""
echo "Coverage reports generated in:"
echo "  - HTML: $RESULTS_DIR/htmlcov/index.html"
echo "  - XML: $RESULTS_DIR/coverage.xml"
echo "  - Test Report: $RESULTS_DIR/report.html"
echo "  - JUnit XML: $RESULTS_DIR/junit.xml"
echo ""

# Open coverage report in browser (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Opening coverage report in browser..."
    open "$RESULTS_DIR/htmlcov/index.html" 2>/dev/null || true
fi

# Exit with error if any tests failed
if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
    echo -e "${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
else
    echo -e "${GREEN}All tests passed successfully!${NC}"
    exit 0
fi