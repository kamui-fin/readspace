# E2E Testing Philosophy

## What We Test

These are **true end-to-end tests** that exercise the complete application stack from HTTP request to database persistence.

## Real Services Used

### ✅ Always Real
- **PostgreSQL Database**: All database operations use real PostgreSQL with transaction rollback for isolation
- **Redis**: Caching, session storage, and Celery broker use real Redis instance
- **HTTP Clients**: External API calls use real HTTP clients (may fail if services unavailable)
- **Content Extraction**: Real trafilatura extraction from URLs
- **AI Services**: Real OpenAI/Anthropic API calls (gracefully handle unavailability)

### ⚠️ Mocked (With Good Reason)

#### Authentication (Mocked)
**Why**: JWT token generation and validation adds complexity without testing business logic
**What we mock**: `get_current_user` dependency returns TokenData directly
**What's still real**: User lookup in database, authorization checks

#### Celery Task Execution (Partially Mocked)
**Why**: Celery workers run in separate processes; testing requires complex worker setup
**What we mock**: Task execution (`.delay()` returns mock task ID)
**What's still real**: 
- Task queueing to Redis
- Task status checking
- Task metadata storage
- All the business logic inside tasks (tested separately)

## What This Means

### You Get Real Testing Of:
- Database mutations and queries
- Redis caching behavior  
- Transaction isolation
- Authorization logic
- Error handling
- External API integration (when available)
- Complete request/response cycles

### You Don't Get:
- JWT token validation (use integration tests for auth)
- Actual Celery worker execution (use unit tests for task logic)
- Guaranteed external service availability (tests handle failures gracefully)

## Running Tests

```bash
# Ensure services are running
docker-compose up -d postgres redis

# Run tests
pytest server/tests/e2e/

# Run with real Celery workers (optional)
celery -A app.core.celery_app worker &
pytest server/tests/e2e/
```

## Test Isolation

Each test:
1. Gets a fresh database transaction
2. Creates its own test data
3. Rolls back all changes after completion
4. Cannot see data from other tests

Redis state persists between tests but is namespaced by test user IDs.

## Philosophy

> "Test as close to production as possible, but mock what's impractical"

We mock only what's necessary for test practicality:
- Auth (JWT complexity)
- Celery execution (separate process complexity)

Everything else uses real implementations to catch real bugs.
