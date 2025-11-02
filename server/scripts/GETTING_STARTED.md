# Getting Started with API Benchmarking

## Overview

This benchmarking suite helps you measure the performance of your RSS API with realistic data at scale.

## Step-by-Step Guide

### 1. Create a Test User

First, you need a test user in your database. You can create one through:

**Option A: Using your application's signup endpoint**
```bash
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "benchmark-test@example.com",
    "password": "SecurePassword123!"
  }'
```

**Option B: Directly in the database**
```sql
INSERT INTO profiles (id, email, created_at, updated_at)
VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  'benchmark-test@example.com',
  NOW(),
  NOW()
);
```

**Save the user UUID** - you'll need it for all subsequent steps.

### 2. Prepare Test Credentials

You'll need the email and password for your test user. The benchmark script will automatically authenticate and obtain an access token.

### 3. Run the Benchmark Suite

#### Quick Method (Recommended)

```bash
cd server
./scripts/run_benchmark.sh <user_id> <email> <password> [base_url]
```

Example:
```bash
./scripts/run_benchmark.sh \
  123e4567-e89b-12d3-a456-426614174000 \
  benchmark-test@example.com \
  SecurePassword123! \
  http://localhost:8000
```

This will:
1. ✅ Populate 10,000 feeds and ~1M articles
2. ✅ Run comprehensive benchmarks
3. ✅ Ask if you want to clean up

#### Manual Method

If you prefer more control:

```bash
cd server

# Step 1: Populate test data (5-10 minutes)
python scripts/populate_test_data.py 123e4567-e89b-12d3-a456-426614174000

# Step 2: Verify data was created correctly
python scripts/verify_test_data.py 123e4567-e89b-12d3-a456-426614174000

# Step 3: Run benchmarks (30-60 seconds)
python scripts/benchmark_api.py \
  http://localhost:8000 \
  benchmark-test@example.com \
  SecurePassword123! \
  123e4567-e89b-12d3-a456-426614174000

# Step 4: Clean up when done
python scripts/cleanup_test_data.py 123e4567-e89b-12d3-a456-426614174000
```

### 4. Analyze Results

The benchmark script outputs:

1. **Console summary** with key metrics
2. **JSON file** (`benchmark_results_YYYYMMDD_HHMMSS.json`) with detailed data

Example console output:
```
📊 BENCHMARK RESULTS
================================================================================

Endpoint                                                     Calls    Avg (ms)     Min (ms)     Max (ms)     Avg Size    
------------------------------------------------------------------------------------------------------------------------
GET /api/rss/articles                                        8        245.32       198.45       312.67       125.45 KB    ✅
GET /api/rss/feeds                                           4        156.78       142.33       178.90       45.23 KB     ✅

📈 OVERALL STATISTICS
================================================================================
Total API Calls: 87
Total Failures: 0
Success Rate: 100.00%
Total Data Transferred: 8.45 MB
Total Duration: 23.45s
Average Call Duration: 269.54ms
```

## What Gets Created

### Test Data Structure

```
10,000 Feeds (Global)
├── Marked with "BENCHMARK_TEST" tag
├── Distributed across categories
├── Realistic metadata (titles, descriptions, URLs)
└── ~100 articles each = ~1,000,000 total articles

1,000 Subscriptions (User-specific)
├── User subscribes to 1,000 out of 10,000 feeds
└── Distributed across 50 folders

50 Folders (User-specific)
├── Named "BENCHMARK_TEST_Folder_1" through "BENCHMARK_TEST_Folder_50"
└── Subscriptions distributed across folders

~1,000,000 Articles (Global)
├── Realistic content using Faker
├── Published dates spread over last year
└── User states created only for subscribed feeds:
    ├── 30% marked as read
    ├── 10% marked as favorite
    └── 20% marked as read later
```

**Configuration:** Easily adjust these numbers in `populate_test_data.py`:
```python
NUM_FEEDS = 10_000              # Total feeds in global table
NUM_SUBSCRIBED_FEEDS = 1_000    # Feeds user subscribes to
NUM_FOLDERS = 50                # User's folders
NUM_ARTICLES = 1_000_000        # Total articles
```

### API Endpoints Tested

- **Folders**: List, get specific
- **Feeds**: List (with filters), get specific, trending
- **Articles**: List (many variations), search, sort, pagination, today, recently read, read later, unread counts
- **Discovery**: Search, categories, recommendations
- **Similar Feeds**: Vector similarity search

**Total: ~50 API calls** with various parameters

## Performance Expectations

With 1 million articles, expect:

| Endpoint | Target | Good | Needs Work |
|----------|--------|------|------------|
| List articles (page 1) | <200ms | 200-400ms | >400ms |
| List feeds | <100ms | 100-200ms | >200ms |
| Get article | <50ms | 50-100ms | >100ms |
| Search articles | <300ms | 300-600ms | >600ms |
| Unread counts | <200ms | 200-400ms | >400ms |

## Troubleshooting

### "Test user not found"
Make sure you created the test user first (Step 1).

### "Authentication failed"
Check that your email and password are correct for the test user.

### Timeout during data population
This is normal for 1M articles. It can take 5-10 minutes. If it times out:
- Check your database connection
- Reduce article count in `populate_test_data.py`

### Benchmark shows slow responses
This is valuable data! Use it to:
1. Check database indexes
2. Analyze slow queries with EXPLAIN ANALYZE
3. Consider caching strategies
4. Optimize query patterns

### Memory issues
Increase batch size in `populate_test_data.py`:
```python
BATCH_SIZE = 2000  # Instead of 1000
```

## Best Practices

1. **Run on a dedicated test database** - Don't mix with production data
2. **Run multiple times** - Average results for consistency
3. **Test different scenarios** - Try different page sizes, filters, etc.
4. **Monitor database** - Watch CPU, memory, and connection pool during tests
5. **Track over time** - Save JSON results to catch regressions
6. **Clean up after** - Remove test data when done

## Advanced Usage

### Custom Configuration

Edit the configuration section at the top of `populate_test_data.py`:
```python
# Total feeds to create in the global feeds table
NUM_FEEDS = 10_000

# Number of feeds the test user will subscribe to
NUM_SUBSCRIBED_FEEDS = 1_000

# Number of folders to create for the test user
NUM_FOLDERS = 50

# Total articles to create across all feeds
NUM_ARTICLES = 1_000_000

# Batch size for database inserts
BATCH_SIZE = 1000
```

Example: Smaller test dataset
```python
NUM_FEEDS = 1_000              # Fewer total feeds
NUM_SUBSCRIBED_FEEDS = 100     # User subscribes to 100
NUM_FOLDERS = 10               # Fewer folders
NUM_ARTICLES = 100_000         # Fewer articles
```

### Custom Benchmark Tests

Edit `benchmark_api.py` to add your own tests:
```python
async def benchmark_custom(self):
    """Your custom benchmark tests."""
    await self.make_request(
        "GET",
        "/api/rss/articles",
        params={"your": "params"}
    )
```

### Continuous Benchmarking

Set up a cron job to run benchmarks regularly:
```bash
# Run benchmarks daily at 2 AM
0 2 * * * cd /path/to/server && ./scripts/run_benchmark.sh <user_id> <token> > /var/log/benchmark.log 2>&1
```

## Files Reference

```
server/scripts/
├── populate_test_data.py      # Creates test data
├── cleanup_test_data.py       # Removes test data
├── verify_test_data.py        # Verifies data was created
├── benchmark_api.py           # Runs benchmarks
├── run_benchmark.sh           # Automated runner
├── GETTING_STARTED.md         # This file
├── BENCHMARK_SUMMARY.md       # Quick reference
└── README_BENCHMARKING.md     # Detailed documentation
```

## Need Help?

- Check `README_BENCHMARKING.md` for detailed documentation
- Check `BENCHMARK_SUMMARY.md` for quick reference
- Review the JSON output for detailed metrics
- Use `verify_test_data.py` to check data integrity

## Next Steps

After running your first benchmark:

1. ✅ Review the results
2. ✅ Identify slow endpoints
3. ✅ Check database indexes
4. ✅ Optimize queries
5. ✅ Run again to measure improvements
6. ✅ Set up regular benchmarking
7. ✅ Clean up test data

Happy benchmarking! 🚀
