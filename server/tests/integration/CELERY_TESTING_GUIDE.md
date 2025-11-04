# Celery E2E Testing Guide

## Overview

This guide explains how to effectively test Celery tasks in E2E tests without excessive mocking while maintaining deterministic, fast tests.

## The Problem with Mocking

Heavy mocking in E2E tests defeats their purpose:
- ❌ Doesn't test real task execution
- ❌ Doesn't catch serialization issues
- ❌ Doesn't test task retry logic
- ❌ Doesn't verify Redis/broker integration
- ❌ Gives false confidence

## The Solution: Eager Mode + Unit Tests

### 1. **Eager Mode (E2E Tests)** - Fast & Deterministic

Celery's `task_always_eager` mode executes tasks synchronously in-process:

```python
celery.conf.task_always_eager = True
celery.conf.task_eager_propagates = True
```

**Pros:**
- ✅ No worker process needed
- ✅ Deterministic execution
- ✅ Fast test execution
- ✅ Tests business logic
- ✅ Tests task serialization/deserialization
- ✅ Tests database integration
- ✅ Tests Redis integration
- ✅ Easy debugging

**What it doesn't test (and why that's okay):**
- ⚠️ Task queuing to Redis broker - Infrastructure concern, not app logic
- ⚠️ Worker process isolation - Rarely causes bugs
- ⚠️ Parallel execution - Non-deterministic anyway
- ⚠️ Task routing - Configuration issue, not code issue

**Reality check:** If your task works in eager mode, it will work in async mode. The differences are infrastructure concerns that should be verified in production monitoring, not tests.

**Use for:** All E2E tests (100%)

### 2. **Unit Tests** - Pure Logic Testing

Test async implementations directly without Celery:

```python
async def test_async_refresh_single_feed():
    """Test the async implementation directly."""
    result = await async_refresh_single_feed(feed_id=feed_id)
    assert result is not None
```

**Use for:** Task business logic, error handling, edge cases

## Testing Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Testing Pyramid                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  E2E Eager Mode (35%)                                        │
│  ├─ Full request/response cycles                             │
│  ├─ Database integration                                     │
│  ├─ Redis integration                                        │
│  ├─ Task execution (synchronous)                             │
│  └─ Complete workflows                                       │
│                                                               │
│  Unit Tests (65%)                                            │
│  ├─ Async implementations                                    │
│  ├─ Business logic                                           │
│  ├─ Error handling                                           │
│  ├─ Edge cases                                               │
│  └─ Retry logic                                              │
│                                                               │
│  Production Monitoring (Infrastructure)                      │
│  ├─ Task queue depth                                         │
│  ├─ Worker health                                            │
│  ├─ Task execution time                                      │
│  └─ Failure rates                                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Insight:** Async mode tests are infrastructure tests, not application tests. 
Use production monitoring (Celery Flower, metrics, logs) to verify infrastructure health.

## Running Tests

### E2E Tests (Eager Mode)

```bash
# Run all E2E tests with eager execution
pytest tests/e2e/

# Run specific test file
pytest tests/e2e/test_opml_e2e_improved.py

# Run with verbose output
pytest tests/e2e/ -v

# Run with print debugging
pytest tests/e2e/ -s -v
```

### Unit Tests

```bash
# Run unit tests for task logic
pytest tests/unit/test_feed_tasks.py
pytest tests/unit/test_opml_import_integration.py

# Run all unit tests
pytest tests/unit/
```

### Verify Infrastructure (Production/Staging)

Instead of async mode tests, verify Celery infrastructure in real environments:

```bash
# Check Celery worker status
celery -A app.core.celery_app inspect active

# Monitor with Flower
celery -A app.core.celery_app flower
# Visit http://localhost:5555

# Check task stats
celery -A app.core.celery_app inspect stats

# View registered tasks
celery -A app.core.celery_app inspect registered
```

## Test Structure

### Eager Mode Test Example

```python
class TestOpmlImportEagerMode:
    """Test OPML import with eager task execution."""

    @pytest.mark.asyncio
    async def test_import_opml_full_workflow(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession
    ):
        """Test complete OPML import workflow."""
        # Upload OPML
        response = await async_client.post("/api/opml/import/", files=files)
        assert response.status_code == 202
        
        task_id = response.json()["task_id"]
        
        # In eager mode, task completes immediately
        status_response = await async_client.get(f"/api/opml/import/status/{task_id}")
        assert status_response.status_code == 200
        
        # Verify results in database
        result = await db_session.execute(select(FeedSubscription)...)
        assert len(subscriptions) >= 1
```

### Async Mode Test Example

```python
@pytest.mark.skipif(
    CELERY_EAGER_MODE,
    reason="Requires real Celery workers"
)
class TestOpmlImportAsyncMode:
    """Test OPML import with real async execution."""

    @pytest.mark.asyncio
    async def test_import_opml_async_workflow(self, async_client: AsyncClient):
        """Test OPML import with real workers."""
        from tests.e2e.conftest import wait_for_celery_task
        
        # Upload OPML
        response = await async_client.post("/api/opml/import/", files=files)
        task_id = response.json()["task_id"]
        
        # Wait for task to complete
        await wait_for_celery_task(task_id, timeout=30)
        
        # Verify completion
        status_response = await async_client.get(f"/api/opml/import/status/{task_id}")
        assert status_response.json()["status"] == "completed"
```

## What to Test Where

### Unit Tests (tests/unit/)
- ✅ Async implementation functions (`async_refresh_single_feed`)
- ✅ Business logic and algorithms
- ✅ Error handling and edge cases
- ✅ Retry logic
- ✅ Task parameter validation
- ✅ Mock external services (HTTP, AI APIs)

### E2E Eager Mode (tests/e2e/)
- ✅ Full API request/response cycles
- ✅ Database mutations and queries
- ✅ Redis caching behavior
- ✅ Task execution (synchronous)
- ✅ Task result handling
- ✅ Status tracking
- ✅ User authorization
- ✅ File upload/download
- ✅ Complete workflows (upload → process → verify)
- ✅ Task cancellation
- ✅ Error handling

### Production Monitoring (Not Tests)
- 📊 Task queuing to Redis broker
- 📊 Worker process health
- 📊 Parallel task execution
- 📊 Task execution time
- 📊 Worker failure recovery
- 📊 Queue depth and backlog

**Why not test infrastructure in tests?**
- Non-deterministic (timing, race conditions)
- Requires complex setup (multiple workers)
- Slow and flaky
- Better verified with monitoring and alerting

## Best Practices

### 1. Use Fixtures for Celery Configuration

```python
@pytest.fixture(scope="function", autouse=True)
def configure_celery_for_tests():
    """Configure Celery for test execution."""
    from app.core.celery_app import celery
    
    original_eager = celery.conf.task_always_eager
    
    if CELERY_EAGER_MODE:
        celery.conf.task_always_eager = True
        celery.conf.task_eager_propagates = True
    
    yield
    
    celery.conf.task_always_eager = original_eager
```

### 2. Test Task Execution, Not Just Queueing

```python
# ❌ Bad: Only tests that task was queued
def test_import_opml_bad(async_client):
    response = await async_client.post("/api/opml/import/", files=files)
    assert response.status_code == 202
    # Doesn't verify task actually ran!

# ✅ Good: Tests task execution and results
def test_import_opml_good(async_client, db_session):
    response = await async_client.post("/api/opml/import/", files=files)
    task_id = response.json()["task_id"]
    
    # Check status (eager mode completes immediately)
    status = await async_client.get(f"/api/opml/import/status/{task_id}")
    assert status.json()["status"] == "completed"
    
    # Verify database changes
    subscriptions = await db_session.execute(select(FeedSubscription)...)
    assert len(subscriptions) >= 1
```

### 3. Use Real Data When Possible

```python
# ✅ Good: Use real RSS feeds for testing
feed_url = "https://hnrss.org/newest"  # Real, reliable feed

# ⚠️ Acceptable: Mock only when necessary
with patch("httpx.AsyncClient.get") as mock_get:
    mock_get.return_value = Mock(status_code=200, content=rss_xml)
```

### 4. Handle External Service Failures Gracefully

```python
@pytest.mark.asyncio
async def test_import_feed_handles_network_error(async_client):
    """Test that network errors are handled gracefully."""
    response = await async_client.post(
        "/api/feeds/",
        json={"url": "https://nonexistent-feed-url.com/feed.xml"}
    )
    
    # Should return error, not crash
    assert response.status_code in [400, 422, 500]
    assert "error" in response.json()
```

### 5. Test Both Success and Failure Paths

```python
class TestFeedRefresh:
    """Test feed refresh task."""
    
    async def test_refresh_success(self, test_feed):
        """Test successful refresh."""
        result = refresh_single_feed_task(feed_id=test_feed.id)
        # Verify success
    
    async def test_refresh_nonexistent_feed(self):
        """Test refresh of non-existent feed."""
        with pytest.raises(Exception):
            refresh_single_feed_task(feed_id=uuid4())
    
    async def test_refresh_network_timeout(self, test_feed):
        """Test refresh with network timeout."""
        # Test timeout handling
```

## Common Patterns

### Pattern 1: Test Complete Workflow

```python
async def test_opml_import_complete_workflow(async_client, db_session):
    """Test: Upload -> Process -> Verify -> Export"""
    # 1. Upload OPML
    upload_response = await async_client.post("/api/opml/import/", files=files)
    task_id = upload_response.json()["task_id"]
    
    # 2. Check status
    status_response = await async_client.get(f"/api/opml/import/status/{task_id}")
    assert status_response.json()["status"] == "completed"
    
    # 3. Verify in database
    subscriptions = await db_session.execute(select(FeedSubscription)...)
    assert len(subscriptions) >= 1
    
    # 4. Export and verify
    export_response = await async_client.get("/api/opml/export/")
    assert "Test Feed" in export_response.text
```

### Pattern 2: Test Task Retry Logic

```python
async def test_task_retries_on_transient_failure():
    """Test that tasks retry on transient failures."""
    from unittest.mock import patch
    
    with patch("app.services.feed.FeedService.refresh_feed") as mock_refresh:
        # First call fails, second succeeds
        mock_refresh.side_effect = [Exception("Transient error"), None]
        
        # Execute task (will retry in eager mode)
        refresh_single_feed_task(feed_id=feed_id)
        
        # Verify retry was attempted
        assert mock_refresh.call_count == 2
```

### Pattern 3: Test Parallel Execution (Async Mode)

```python
@pytest.mark.skipif(CELERY_EAGER_MODE, reason="Requires workers")
async def test_parallel_feed_refresh(db_session):
    """Test that multiple feeds refresh in parallel."""
    import asyncio
    
    # Create multiple feeds
    feed_ids = [create_feed() for _ in range(10)]
    
    # Schedule all refreshes
    start_time = asyncio.get_event_loop().time()
    for feed_id in feed_ids:
        refresh_single_feed_task.delay(feed_id=feed_id)
    
    # Wait for all to complete
    await asyncio.sleep(5)
    
    elapsed = asyncio.get_event_loop().time() - start_time
    
    # Should complete faster than sequential (< 10 seconds for 10 feeds)
    assert elapsed < 10
```

## Debugging Tips

### 1. Enable Celery Logging

```python
import logging
logging.getLogger('celery').setLevel(logging.DEBUG)
```

### 2. Use Celery Flower for Monitoring

```bash
# Start Flower
celery -A app.core.celery_app flower

# View at http://localhost:5555
```

### 3. Check Task State Manually

```python
from celery.result import AsyncResult

task = AsyncResult(task_id)
print(f"State: {task.state}")
print(f"Result: {task.result}")
print(f"Traceback: {task.traceback}")
```

### 4. Use pytest -s for Print Debugging

```bash
# See print statements and logs
pytest tests/e2e/test_opml_e2e_improved.py -s -v
```

## Migration from Mocked Tests

If you have existing tests with heavy mocking:

1. **Keep validation tests as-is** - File upload validation doesn't need Celery
2. **Convert workflow tests to eager mode** - Replace mocks with real execution
3. **Add a few async mode tests** - For critical paths only
4. **Move business logic to unit tests** - Test async implementations directly

Example migration:

```python
# Before: Heavy mocking
@patch("app.workers.opml_tasks.import_opml_task.delay")
async def test_import_opml(mock_task, async_client):
    mock_task.return_value = Mock(id="fake-id")
    response = await async_client.post("/api/opml/import/", files=files)
    assert response.status_code == 202

# After: Real execution
async def test_import_opml(async_client, db_session):
    response = await async_client.post("/api/opml/import/", files=files)
    assert response.status_code == 202
    
    task_id = response.json()["task_id"]
    status = await async_client.get(f"/api/opml/import/status/{task_id}")
    assert status.json()["status"] == "completed"
    
    # Verify actual results
    subscriptions = await db_session.execute(select(FeedSubscription)...)
    assert len(subscriptions) >= 1
```

## Summary

- **Use eager mode for 95% of E2E tests** - Fast, deterministic, tests business logic
- **Use async mode for critical workflows** - Tests real production behavior
- **Use unit tests for task implementations** - Tests pure logic without Celery overhead
- **Minimize mocking** - Only mock external services (HTTP, AI APIs)
- **Test real database and Redis** - Catch integration issues
- **Verify actual results** - Don't just test that tasks were queued

This approach gives you:
- ✅ Fast test execution (eager mode)
- ✅ Deterministic results (no timing issues)
- ✅ Real integration testing (database, Redis)
- ✅ Confidence in production behavior (async mode for critical paths)
- ✅ Easy debugging (synchronous execution)
- ✅ Minimal mocking (only external services)
