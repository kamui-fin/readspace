# Celery Testing Quick Reference

## TL;DR

**Use Celery eager mode for E2E tests** - tasks execute synchronously, no workers needed, fully deterministic.

```python
# Celery executes tasks in-process, synchronously
celery.conf.task_always_eager = True
```

## Quick Start

### Run Tests (Default: Eager Mode)

```bash
# Fast, deterministic, no workers needed
pytest tests/e2e/test_opml_e2e_improved.py
pytest tests/e2e/test_feed_tasks_e2e.py
```

### Run Tests (Async Mode - Optional)

```bash
# Terminal 1: Start worker
celery -A app.core.celery_app worker --loglevel=info

# Terminal 2: Run tests
CELERY_ALWAYS_EAGER=false pytest tests/e2e/
```

## Test File Structure

```
tests/
├── unit/
│   ├── test_feed_tasks.py          # Test async implementations
│   └── test_opml_import_*.py       # Test business logic
│
├── e2e/
│   ├── test_opml_e2e.py            # LEGACY (mocked) - deprecated
│   ├── test_opml_e2e_improved.py   # NEW (eager mode) - use this
│   ├── test_feed_tasks_e2e.py      # NEW (eager mode) - use this
│   ├── CELERY_TESTING_GUIDE.md     # Full guide
│   └── CELERY_TESTING_QUICK_REF.md # This file
```

## Testing Modes Comparison

| Feature | Eager Mode | Async Mode | Unit Tests |
|---------|-----------|------------|------------|
| Speed | ⚡ Fast | 🐌 Slow | ⚡⚡ Fastest |
| Deterministic | ✅ Yes | ⚠️ Timing-dependent | ✅ Yes |
| Worker needed | ❌ No | ✅ Yes | ❌ No |
| Tests business logic | ✅ Yes | ✅ Yes | ✅ Yes |
| Tests async behavior | ❌ No | ✅ Yes | ❌ No |
| Tests DB integration | ✅ Yes | ✅ Yes | ⚠️ Mocked |
| Tests Redis | ✅ Yes | ✅ Yes | ⚠️ Mocked |
| Easy debugging | ✅ Yes | ⚠️ Harder | ✅ Yes |
| **Use for** | **95% of tests** | **5% critical paths** | **Logic & edge cases** |

## Example Test Patterns

### ✅ Good: Eager Mode E2E Test

```python
@pytest.mark.asyncio
async def test_import_opml_full_workflow(async_client, db_session):
    """Test complete OPML import with real execution."""
    # Upload OPML
    response = await async_client.post("/api/opml/import/", files=files)
    task_id = response.json()["task_id"]
    
    # Check status (completes immediately in eager mode)
    status = await async_client.get(f"/api/opml/import/status/{task_id}")
    assert status.json()["status"] == "completed"
    
    # Verify database changes
    subscriptions = await db_session.execute(select(FeedSubscription)...)
    assert len(subscriptions) >= 1
```

### ✅ Good: Unit Test for Task Logic

```python
@pytest.mark.asyncio
async def test_async_refresh_single_feed():
    """Test async implementation directly."""
    with patch("app.workers.feed_tasks.get_worker_db") as mock_db:
        # Setup mocks
        mock_session = AsyncMock()
        mock_db.return_value = async_gen(mock_session)
        
        # Test the async function
        await async_refresh_single_feed(feed_id=feed_id)
        
        # Verify behavior
        mock_service.refresh_feed.assert_called_once()
```

### ⚠️ Optional: Async Mode for Critical Paths

```python
@pytest.mark.skipif(CELERY_EAGER_MODE, reason="Requires workers")
@pytest.mark.asyncio
async def test_import_opml_async_workflow(async_client):
    """Test with real async execution."""
    response = await async_client.post("/api/opml/import/", files=files)
    task_id = response.json()["task_id"]
    
    # Wait for task to complete
    await wait_for_celery_task(task_id, timeout=30)
    
    # Verify completion
    status = await async_client.get(f"/api/opml/import/status/{task_id}")
    assert status.json()["status"] == "completed"
```

### ❌ Bad: Heavy Mocking

```python
# Don't do this - defeats purpose of E2E tests
@patch("app.workers.opml_tasks.import_opml_task.delay")
@patch("celery.result.AsyncResult")
async def test_import_opml(mock_result, mock_task, async_client):
    mock_task.return_value = Mock(id="fake-id")
    mock_result.return_value = Mock(state="SUCCESS")
    # This doesn't test anything real!
```

## What to Test Where

### Unit Tests (`tests/unit/`)
- ✅ Async implementation functions
- ✅ Business logic
- ✅ Error handling
- ✅ Edge cases
- ✅ Retry logic

### E2E Eager Mode (`tests/e2e/`)
- ✅ Full API workflows
- ✅ Database integration
- ✅ Redis integration
- ✅ Task execution (sync)
- ✅ Status tracking
- ✅ Authorization

### E2E Async Mode (`tests/e2e/`)
- ✅ Task queuing
- ✅ Worker isolation
- ✅ Parallel execution
- ✅ Long-running workflows
- ✅ Task cancellation

## Common Commands

```bash
# Run all E2E tests (eager mode)
pytest tests/e2e/

# Run specific test file
pytest tests/e2e/test_opml_e2e_improved.py

# Run with verbose output
pytest tests/e2e/ -v

# Run only async mode tests (requires workers)
CELERY_ALWAYS_EAGER=false pytest tests/e2e/ -m "not skipif"

# Run unit tests
pytest tests/unit/test_feed_tasks.py

# Run with print debugging
pytest tests/e2e/test_opml_e2e_improved.py -s -v

# Run specific test
pytest tests/e2e/test_opml_e2e_improved.py::TestOpmlImportEagerMode::test_import_opml_full_workflow
```

## Debugging

```python
# Enable Celery logging
import logging
logging.getLogger('celery').setLevel(logging.DEBUG)

# Check task state
from celery.result import AsyncResult
task = AsyncResult(task_id)
print(f"State: {task.state}")
print(f"Result: {task.result}")

# Use pytest -s to see prints
pytest tests/e2e/test_opml_e2e_improved.py -s
```

## Key Takeaways

1. **Eager mode is your friend** - Use it for 95% of E2E tests
2. **Minimize mocking** - Only mock external services (HTTP, AI)
3. **Test real integration** - Database, Redis, task execution
4. **Verify actual results** - Check database changes, not just status codes
5. **Use async mode sparingly** - Only for critical workflow tests
6. **Unit test task logic** - Test async implementations directly

## Migration Path

If you have existing mocked tests:

1. Keep validation tests (no Celery needed)
2. Convert workflow tests to eager mode
3. Add 1-2 async mode tests for critical paths
4. Move business logic to unit tests

## Need More Info?

See `CELERY_TESTING_GUIDE.md` for the complete guide with detailed examples and best practices.
