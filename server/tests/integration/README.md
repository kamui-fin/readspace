# End-to-End API Tests

**True end-to-end tests** for all API routes in the Readspace application using **real services**.

## Overview

These are **genuine e2e tests** that test the complete system from HTTP request to database persistence:

- ✅ **Real PostgreSQL database** (with transaction rollback for isolation)
- ✅ **Real Redis** (for caching and task metadata)
- ✅ **Real HTTP clients** (for external API calls)
- ✅ **Real AI services** (may be unavailable in test environment)
- ✅ **Real content extraction** (actual HTTP requests to URLs)
- ⚠️ **Mocked authentication** (to avoid JWT complexity)
- ⚠️ **Mocked Celery task execution** (tasks are queued to real Redis, but execution is mocked since workers run in separate processes)

### What We Test

- Request/response validation
- Database mutations and persistence
- Redis caching behavior
- Celery task execution
- Authorization and access control
- Error handling and edge cases
- Complete user workflows

## Test Structure

```
e2e/
├── conftest.py                      # Shared fixtures and test setup
├── test_users_e2e.py               # User profile endpoints
├── test_folders_e2e.py             # Folder CRUD operations
├── test_feeds_e2e.py               # Feed management and subscriptions
├── test_articles_e2e.py            # Article listing and management
├── test_discover_e2e.py            # Feed discovery and search
├── test_similar_e2e.py             # Similar feed recommendations
├── test_article_enhancements_e2e.py # AI features (summarize, translate, extract)
└── test_opml_e2e.py                # OPML import/export
```

## Prerequisites

These tests **use your existing `.env` file** and require the same services as your development environment.

### Environment Configuration

The tests automatically load `server/.env` and use your existing configuration:
- Database connection from `SUPABASE_DB_CONNECTION`
- Redis from `REDIS_URL`
- AI services from `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.
- All other settings from your `.env`

Only `ENVIRONMENT` is overridden to `"test"` for safety.

### Required Services

The same services you run for development:

```bash
# Start your normal development services
docker-compose up -d

# Or just the essentials for testing
docker-compose up -d postgres redis
```

### Optional: Test-Specific Database

If you want a separate test database, set:

```bash
export TEST_DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5433/test_db"
```

Otherwise, tests use your development database with transaction isolation.

## Running Tests

### Run all e2e tests
```bash
pytest server/tests/e2e/
```

### Run specific test file
```bash
pytest server/tests/e2e/test_feeds_e2e.py
```

### Run specific test class
```bash
pytest server/tests/e2e/test_feeds_e2e.py::TestFeedSubscribe
```

### Run specific test
```bash
pytest server/tests/e2e/test_feeds_e2e.py::TestFeedSubscribe::test_subscribe_to_feed_success
```

### Run with verbose output
```bash
pytest server/tests/e2e/ -v
```

### Run with coverage
```bash
pytest server/tests/e2e/ --cov=app.routers --cov-report=html
```

## Test Coverage

### Users (`test_users_e2e.py`)
- ✅ Get current user profile
- ✅ Profile not found handling
- ✅ Unauthenticated access
- ✅ Response schema validation

### Folders (`test_folders_e2e.py`)
- ✅ Create folder (success, minimal, validation)
- ✅ List folders (empty, with data, pagination, isolation)
- ✅ Get folder (success, not found, access control)
- ✅ Update folder (name, description, persistence)
- ✅ Delete folder (success, not found, access control)

### Feeds (`test_feeds_e2e.py`)
- ✅ Subscribe to feed (success, with folder, already subscribed)
- ✅ Add new feed (success, with folder, invalid URL)
- ✅ List feeds (empty, with data, filtering, search, pagination)
- ✅ Get feed (success, not subscribed, not found)
- ✅ Update feed (custom title, folder, not subscribed)
- ✅ Refresh feed (success, not subscribed, preview mode)
- ✅ Delete feed (success, not subscribed)
- ✅ Bulk operations (delete, update folder)
- ✅ Admin operations (update, delete global feeds)

### Articles (`test_articles_e2e.py`)
- ✅ Save web article (success, with metadata, invalid URL)
- ✅ List articles (empty, with data, filtering, search, sorting, pagination)
- ✅ Get article (success, not found, invalid UUID)
- ✅ Update article (mark read, favorite, read later)
- ✅ Today's articles
- ✅ Recently read articles
- ✅ Read later articles
- ✅ Unread counts (global, by folder)
- ✅ Check if article saved

### Discovery (`test_discover_e2e.py`)
- ✅ Search feeds (by query, category, language, limit)
- ✅ Get recommendations (single/multiple categories, deduplication)
- ✅ Get categories (default/specific language, structure)
- ✅ Get category feeds (success, with filters, non-existent)
- ✅ Preview articles (success, with limit, invalid URL)
- ✅ Integration flows (discover -> preview -> subscribe)

### Similar Feeds (`test_similar_e2e.py`)
- ✅ Get similar feeds (success, with limit, min similarity)
- ✅ Not subscribed handling
- ✅ Not found handling
- ✅ Invalid parameters
- ✅ Source feed info
- ✅ Result structure validation

### Article Enhancements (`test_article_enhancements_e2e.py`)
- ✅ Extract full text (success, failure, not found)
- ✅ Summarize article (success, custom content, AI failure)
- ✅ Translate article (success, multiple languages, invalid params)
- ✅ Enhancement workflow integration
- ✅ Custom content handling

### OPML (`test_opml_e2e.py`)
- ✅ Import OPML (success, minimal, invalid file type, too large)
- ✅ Import status (pending, in progress, completed, failed)
- ✅ List user tasks (empty, with active, filter completed)
- ✅ Get active task (none, most recent)
- ✅ Cancel task (success, not found, unauthorized, already completed)
- ✅ Export OPML (success, empty, with folders, multiple feeds)
- ✅ Import/export roundtrip
- ✅ Concurrent imports

## Test Patterns

### Database Verification
Tests verify that mutations are persisted to the database:

```python
@pytest.mark.asyncio
async def test_create_folder_persists_to_db(
    self, client: TestClient, test_user: Profile, db_session: AsyncSession
):
    response = client.post("/api/v1/folders/", json={"name": "DB Test Folder"})
    assert response.status_code == 201
    folder_id = response.json()["id"]

    # Verify in database
    result = await db_session.execute(select(Folder).where(Folder.id == folder_id))
    folder = result.scalar_one_or_none()
    assert folder is not None
    assert folder.name == "DB Test Folder"
```

### Access Control
Tests verify user isolation and authorization:

```python
@pytest.mark.asyncio
async def test_get_folder_access_control(self, client: TestClient, db_session: AsyncSession):
    # Create another user's folder
    other_user_id = str(uuid4())
    other_folder = Folder(user_id=other_user_id, name="Other User Folder")
    db_session.add(other_folder)
    await db_session.flush()

    response = client.get(f"/api/v1/folders/{other_folder.id}")
    assert response.status_code == 404  # Should not access other user's data
```

### Error Handling
Tests verify proper error responses:

```python
def test_create_folder_empty_name(self, client: TestClient):
    response = client.post("/api/v1/folders/", json={"name": ""})
    assert response.status_code == 422
```

### Testing Real Services
Tests use real services (Redis, Celery, Database):

```python
@pytest.mark.asyncio
async def test_add_feed_with_real_services(self, client: TestClient):
    """This test hits real database, Redis, and may trigger real Celery tasks."""
    response = client.post(
        "/api/v1/feeds/",
        json={"url": "https://example.com/feed.xml"},
    )
    assert response.status_code == 201
    
    # Verify in real database
    result = await db_session.execute(select(Feed).where(Feed.url == "https://example.com/feed.xml"))
    feed = result.scalar_one_or_none()
    assert feed is not None
```

## Fixtures

### Core Fixtures (from `conftest.py`)

All fixtures use **real services**:

- `db_session`: Real async database session with transaction rollback for isolation
- `test_user`: Real user profile with auth entry in database
- `admin_user`: Real admin user profile
- `client`: Test client with real database and Redis (only auth is mocked)
- `admin_client`: Test client with admin user
- `test_folder`: Real folder created in database
- `test_feed`: Real feed created in database
- `http_client`: Real HTTP client for external API calls

### Helper Functions

- `wait_for_celery_task()`: Wait for real Celery task completion
- `cleanup_redis_keys()`: Clean up Redis keys after tests

## Best Practices

1. **Real Services**: Use real PostgreSQL, Redis, and Celery - no mocking except auth
2. **Test Isolation**: Each test uses transaction rollback to ensure clean state
3. **Comprehensive Coverage**: Test success cases, error cases, edge cases, and access control
4. **Database Verification**: Verify mutations are persisted in real database
5. **Realistic Data**: Use realistic test data that matches production scenarios
6. **Clear Assertions**: Use descriptive assertions that explain what's being tested
7. **Async Support**: Use `@pytest.mark.asyncio` for async tests
8. **Service Dependencies**: Ensure all required services are running before tests
9. **Cleanup**: Tests automatically rollback database transactions; Redis may need manual cleanup
10. **Performance**: E2E tests are slower than unit tests - that's expected and acceptable

## Common Issues

### Services Not Running
```bash
# Check if services are running
docker-compose ps

# Start required services
docker-compose up -d postgres redis

# Check logs if services fail
docker-compose logs postgres
docker-compose logs redis
```

### Database Connection
If tests fail with database connection errors:
```bash
# Ensure test database is running on correct port
docker-compose up -d postgres

# Verify connection
psql postgresql://postgres:postgres@localhost:54322/postgres -c "SELECT 1"
```

### Redis Connection
If tests fail with Redis errors:
```bash
# Ensure Redis is running
docker-compose up -d redis

# Verify connection
redis-cli -h localhost -p 6379 ping
```

### Celery Tasks
If background task tests fail:
```bash
# Start Celery worker for testing
celery -A app.core.celery_app worker --loglevel=info

# Or run tests without Celery-dependent tests
pytest server/tests/e2e/ -m "not requires_celery"
```

### Port Conflicts
If services fail to start:
```bash
# Check if ports are in use
lsof -i :54322  # PostgreSQL
lsof -i :6379   # Redis

# Stop conflicting services or change ports in docker-compose.yml
```

### Import Errors
```bash
# Install test dependencies
pip install -e ".[test]"

# Or install specific packages
pip install pytest pytest-asyncio httpx
```

## Contributing

When adding new routes:

1. Create tests in the appropriate test file
2. Follow existing test patterns
3. Test all common cases:
   - Success scenarios
   - Validation errors
   - Not found errors
   - Access control
   - Database mutations
4. Add docstrings explaining what's being tested
5. Update this README with new coverage

## CI/CD

These tests run automatically on:
- Pull requests
- Commits to main branch
- Pre-deployment checks

Minimum required coverage: 80%
