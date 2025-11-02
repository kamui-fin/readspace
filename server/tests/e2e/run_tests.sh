#!/bin/bash

# E2E Test Runner Script
# This script runs all end-to-end tests with proper configuration

set -e  # Exit on error

echo "🧪 Running Readspace E2E Tests"
echo "================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "pyproject.toml" ]; then
    echo -e "${RED}Error: Must be run from server directory${NC}"
    exit 1
fi

# Check if virtual environment is activated
if [ -z "$VIRTUAL_ENV" ]; then
    echo -e "${YELLOW}Warning: No virtual environment detected${NC}"
    echo "Consider activating your virtual environment first"
fi

# Parse command line arguments
VERBOSE=""
COVERAGE=""
SPECIFIC_TEST=""
MARKERS=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE="-v"
            shift
            ;;
        -c|--coverage)
            COVERAGE="--cov=app.routers --cov-report=html --cov-report=term"
            shift
            ;;
        -t|--test)
            SPECIFIC_TEST="$2"
            shift 2
            ;;
        -m|--markers)
            MARKERS="-m $2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: ./run_tests.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --verbose       Run tests with verbose output"
            echo "  -c, --coverage      Run tests with coverage report"
            echo "  -t, --test FILE     Run specific test file"
            echo "  -m, --markers EXPR  Run tests matching marker expression"
            echo "  -h, --help          Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./run_tests.sh                          # Run all tests"
            echo "  ./run_tests.sh -v                       # Run with verbose output"
            echo "  ./run_tests.sh -c                       # Run with coverage"
            echo "  ./run_tests.sh -t test_feeds_e2e.py    # Run specific file"
            echo "  ./run_tests.sh -m asyncio              # Run async tests only"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Set test path
if [ -n "$SPECIFIC_TEST" ]; then
    TEST_PATH="tests/e2e/$SPECIFIC_TEST"
else
    TEST_PATH="tests/e2e/"
fi

# Check if test path exists
if [ ! -e "$TEST_PATH" ]; then
    echo -e "${RED}Error: Test path not found: $TEST_PATH${NC}"
    exit 1
fi

# Build pytest command
PYTEST_CMD="pytest $TEST_PATH $VERBOSE $COVERAGE $MARKERS"

echo -e "${GREEN}Running command:${NC} $PYTEST_CMD"
echo ""

# Run tests
$PYTEST_CMD

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ All tests passed!${NC}"
    
    if [ -n "$COVERAGE" ]; then
        echo ""
        echo -e "${GREEN}📊 Coverage report generated in htmlcov/index.html${NC}"
    fi
else
    echo ""
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
