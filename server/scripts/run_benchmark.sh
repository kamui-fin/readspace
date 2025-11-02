#!/bin/bash

# Quick benchmark runner script
# Usage: ./run_benchmark.sh <test_user_id> <email> <password>

set -e

if [ "$#" -lt 3 ]; then
    echo "Usage: ./run_benchmark.sh <test_user_id> <email> <password> [base_url]"
    echo "Example: ./run_benchmark.sh 123e4567-e89b-12d3-a456-426614174000 test@example.com password123 http://localhost:8000"
    exit 1
fi

TEST_USER_ID=$1
EMAIL=$2
PASSWORD=$3
BASE_URL=${4:-http://localhost:8000}

echo "=========================================="
echo "RSS API Benchmark Suite"
echo "=========================================="
echo "Test User ID: $TEST_USER_ID"
echo "Base URL: $BASE_URL"
echo ""

# Step 1: Populate test data
echo "Step 1: Populating test data..."
python scripts/populate_test_data.py "$TEST_USER_ID"

if [ $? -ne 0 ]; then
    echo "❌ Failed to populate test data"
    exit 1
fi

echo ""
echo "Step 2: Running benchmarks..."
python scripts/benchmark_api.py "$BASE_URL" "$EMAIL" "$PASSWORD" "$TEST_USER_ID"

if [ $? -ne 0 ]; then
    echo "❌ Benchmark failed"
    exit 1
fi

echo ""
echo "=========================================="
echo "Benchmark complete!"
echo "=========================================="
echo ""
read -p "Do you want to clean up test data? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleaning up test data..."
    python scripts/cleanup_test_data.py "$TEST_USER_ID"
    echo "✅ Cleanup complete"
fi
