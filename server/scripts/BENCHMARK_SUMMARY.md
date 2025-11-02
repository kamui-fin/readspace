# API Benchmarking Suite - Quick Reference

## What This Does

This benchmarking suite creates a realistic test environment with:
- **10,000 feeds** in global table (marked for easy cleanup)
- **1,000 subscriptions** (user subscribes to subset of feeds)
- **~1,000,000 articles** (100 per feed on average)
- **50 folders** for organization
- **User states** for subscribed feeds only (30% read, 10% favorite, 20% read later)

**All numbers are configurable** in `populate_test_data.py`

Then it tests **all RSS API endpoints** with various parameters to measure:
- Response times (min/avg/max)
- Data transfer sizes
- Success rates
- Performance patterns

## Quick Start

### Option 1: Automated (Recommended)

```bash
cd server
./scripts/run_benchmark.sh <test_user_id> <auth_token> [base_url]

# Example:
./scripts/run_benchmark.sh 123e4567-e89b-12d3-a456-426614174000 eyJhbGc... http://localhost:8000
```

This will:
1. Populate test data
2. Run all benchmarks
3. Ask if you want to clean up

### Option 2: Manual Steps

```bash
cd server

# 1. Populate test data (~5-10 minutes)
python scripts/populate_test_data.py <test_user_id>

# 2. Run benchmarks (~30-60 seconds)
python scripts/benchmark_api.py <base_url> <auth_token> <test_user_id>

# 3. Clean up when done
python scripts/cleanup_test_data.py <test_user_id>
```

## Prerequisites

1. **Create a test user** in your database first
2. **Get an auth token** for that user
3. **Ensure dependencies are installed**: `faker` and `httpx` (already in requirements.txt)

## What Gets Tested

### Folders (2 tests)
- List all folders
- Get specific folder

### Feeds (6 tests)
- List all feeds
- Filter by folder, search, favorites
- Get specific feed
- Get trending feeds

### Articles (30+ tests)
- List with various page sizes (20, 50, 100)
- Filter by: feed, folder, read status, favorites, read later, date range
- Search articles
- Sort by: published_at, created_at, title (asc/desc)
- Pagination stress test (pages 1, 2, 5, 10, 50)
- Today's articles
- Recently read
- Read later
- Unread counts (global and per folder)
- Get specific article

### Discovery (7 tests)
- Search feeds (with/without query, category, language)
- Get categories
- Get category feeds
- Get recommendations

### Similar Feeds (1 test)
- Get similar feeds for a given feed

**Total: ~50 API calls** with various parameters

## Output

### Console Output
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

🐌 SLOWEST ENDPOINTS (Top 10)
🔍 LARGEST RESPONSES (Top 10)
```

### JSON Output
Detailed results saved to `benchmark_results_YYYYMMDD_HHMMSS.json` for analysis.

## Performance Expectations

With 1M articles:

| Endpoint | Expected Avg | Notes |
|----------|--------------|-------|
| List articles (page 1) | 100-300ms | Depends on filters |
| List feeds | 50-150ms | Fast with proper indexes |
| Get article | 20-50ms | Single record lookup |
| Search articles | 200-500ms | Full-text search |
| Unread counts | 100-300ms | Aggregation query |
| Discovery search | 150-400ms | Vector similarity |

## Cleanup

The test data is marked with `BENCHMARK_TEST` identifier:
- Feeds have `BENCHMARK_TEST` in their tags array
- Folders are named `BENCHMARK_TEST_Folder_N`

To clean up:
```bash
python scripts/cleanup_test_data.py <test_user_id>
```

This removes all test data via cascading deletes.

## Tips

1. **Run multiple times** and average results for consistency
2. **Monitor database** during population (watch connection pool)
3. **Check indexes** if queries are slow
4. **Compare results** over time to catch regressions
5. **Test different environments** (local, staging, production)

## Troubleshooting

### "Test user not found"
Create the user first through your application.

### Timeout during population
Reduce article count in `populate_test_data.py`:
```python
NUM_ARTICLES = 500_000  # Instead of 1M
```

### Benchmark connection errors
- Verify server is running
- Check auth token is valid
- Confirm base URL is correct

### Memory issues
Increase batch size in `populate_test_data.py`:
```python
BATCH_SIZE = 2000  # Instead of 1000
```

## Files Created

```
server/scripts/
├── populate_test_data.py      # Creates test data
├── cleanup_test_data.py       # Removes test data
├── benchmark_api.py           # Runs benchmarks
├── run_benchmark.sh           # Automated runner
├── README_BENCHMARKING.md     # Detailed documentation
└── BENCHMARK_SUMMARY.md       # This file
```

## Next Steps

After running benchmarks:

1. **Analyze results** - Look for slow endpoints
2. **Check indexes** - Ensure proper database indexes exist
3. **Optimize queries** - Use EXPLAIN ANALYZE on slow queries
4. **Add caching** - Consider Redis for frequently accessed data
5. **Monitor production** - Set up alerts for slow endpoints
6. **Track over time** - Run benchmarks regularly to catch regressions
