# API Benchmarking Scripts

This directory contains scripts for populating test data and benchmarking API performance.

## Prerequisites

```bash
# Install required packages
pip install faker httpx
```

## Step 1: Create Test User

First, create a test user in your database. You can do this through your application's user creation endpoint or directly in the database.

Save the user's UUID for the next steps.

## Step 2: Populate Test Data

This script creates:
- 10,000 fake feeds in the global feeds table (marked with "BENCHMARK_TEST" tag)
- ~1,000,000 articles across those feeds (~100 per feed)
- 50 folders for the test user
- 1,000 subscriptions (user subscribes to a subset of feeds)
- User article states for subscribed feeds only (read status, favorites, etc.)

**Configuration:** These numbers are easily adjustable at the top of `populate_test_data.py`:
```python
NUM_FEEDS = 10_000              # Total feeds in global table
NUM_SUBSCRIBED_FEEDS = 1_000    # Feeds user subscribes to
NUM_FOLDERS = 50                # User's folders
NUM_ARTICLES = 1_000_000        # Total articles
```

```bash
cd server
python scripts/populate_test_data.py <test_user_id>

# Example:
python scripts/populate_test_data.py 123e4567-e89b-12d3-a456-426614174000
```

**Note:** This will take several minutes to complete. Progress is shown during execution.

### Data Characteristics

- **Feeds**: 
  - 10,000 total feeds in global table
  - Marked with "BENCHMARK_TEST" in tags for easy cleanup
  - User subscribes to 1,000 of them
- **Articles**: 
  - ~1,000,000 total articles across all feeds
  - Published dates spread over the last year
  - User states created only for subscribed feeds
  - 30% marked as read
  - 10% marked as favorite
  - 20% marked as read later
  - Realistic content using Faker library
- **Folders**: 
  - 50 folders for the test user
  - Named "BENCHMARK_TEST_Folder_N"
- **Subscriptions**: 
  - 1,000 subscriptions
  - Randomly distributed across folders

## Step 3: Run Benchmarks

The benchmark script tests all RSS API endpoints with various parameters and measures:
- Response time (min, max, average)
- Data transfer size
- Success rate
- Error patterns

```bash
cd server
python scripts/benchmark_api.py <base_url> <auth_token> <test_user_id>

# Example:
python scripts/benchmark_api.py http://localhost:8000 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... 123e4567-e89b-12d3-a456-426614174000
```

### Tested Endpoints

**Folders:**
- List folders
- Get specific folder

**Feeds:**
- List all feeds (with pagination)
- List feeds with filters (folder, search, favorites)
- Get specific feed
- Get trending feeds

**Articles:**
- List articles with various page sizes (20, 50, 100)
- Filter by feed, folder, read status, favorites, read later
- Filter by date range
- Search articles
- Sort by different fields (published_at, created_at, title)
- Pagination stress test (pages 1, 2, 5, 10, 50)
- Today's articles
- Recently read articles
- Read later articles
- Unread counts (global and per folder)
- Get specific article

**Discovery:**
- Search feeds (with/without query, category, language)
- Get categories
- Get category feeds
- Get recommendations

**Similar Feeds:**
- Get similar feeds for a given feed

### Output

The script provides:

1. **Console output** with real-time progress and summary statistics
2. **JSON file** with detailed results (`benchmark_results_YYYYMMDD_HHMMSS.json`)

Example output:
```
📊 BENCHMARK RESULTS
================================================================================

Endpoint                                                     Calls    Avg (ms)     Min (ms)     Max (ms)     Avg Size    
------------------------------------------------------------------------------------------------------------------------
GET /api/rss/articles                                        8        245.32       198.45       312.67       125.45 KB    ✅
GET /api/rss/feeds                                           4        156.78       142.33       178.90       45.23 KB     ✅
...

📈 OVERALL STATISTICS
================================================================================
Total API Calls: 87
Total Failures: 0
Success Rate: 100.00%
Total Data Transferred: 8.45 MB
Total Duration: 23.45s
Average Call Duration: 269.54ms
```

## Step 4: Clean Up Test Data

After benchmarking, clean up the test data:

```bash
cd server
python scripts/cleanup_test_data.py <test_user_id>

# Example:
python scripts/cleanup_test_data.py 123e4567-e89b-12d3-a456-426614174000
```

This removes:
- All feeds with "BENCHMARK_TEST" tag (cascades to articles)
- All folders with "BENCHMARK_TEST" prefix (cascades to subscriptions)

## Performance Tips

### For Data Population

- The script uses batch inserts (1000 records at a time) for optimal performance
- Expect ~5-10 minutes for 1M articles depending on your hardware
- Monitor your database connection pool if you see timeouts

### For Benchmarking

- Run benchmarks when the server is under normal load to get realistic results
- Consider running multiple times and averaging results
- Use the JSON output for detailed analysis and comparison over time

## Troubleshooting

### "Test user not found"
Create the test user first through your application or database.

### Timeout errors during population
Increase the batch size or reduce the number of articles:
```python
# In populate_test_data.py
NUM_ARTICLES = 500_000  # Reduce from 1M
BATCH_SIZE = 2000       # Increase from 1000
```

### Benchmark connection errors
Ensure:
- Server is running
- Auth token is valid and not expired
- Base URL is correct (include http:// or https://)

### Memory issues
The scripts are designed to be memory-efficient with batch processing, but if you encounter issues:
- Reduce `BATCH_SIZE` in populate_test_data.py
- Run benchmarks in smaller batches by commenting out some test sections

## Analyzing Results

The JSON output file contains detailed information for each API call:

```json
{
  "timestamp": "2024-01-15T10:30:00",
  "base_url": "http://localhost:8000",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "total_calls": 87,
  "results": [
    {
      "endpoint": "/api/rss/articles",
      "method": "GET",
      "params": {"page": 1, "size": 20},
      "duration_ms": 245.32,
      "response_size_bytes": 128512,
      "status_code": 200,
      "success": true,
      "error": null
    }
  ]
}
```

You can use this data to:
- Track performance over time
- Identify regression after code changes
- Compare different deployment environments
- Optimize slow endpoints
