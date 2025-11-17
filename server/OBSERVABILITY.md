# Observability Standards & Guidelines

This document provides comprehensive guidelines for implementing observability across the Readspace server application. Follow these standards to maintain consistent, high-quality monitoring and logging throughout the codebase.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Logging Standards](#logging-standards)
4. [Metrics Standards](#metrics-standards)
5. [Implementation Patterns](#implementation-patterns)
6. [Priority Modules for Instrumentation](#priority-modules-for-instrumentation)
7. [Testing Observability](#testing-observability)
8. [Grafana Dashboards](#grafana-dashboards)
9. [Best Practices](#best-practices)

---

## Overview

### Goals

- **Comprehensive visibility** into system behavior, performance, and errors
- **Proactive issue detection** through metrics and alerts
- **Efficient debugging** via structured logging
- **Cost monitoring** for external services (AI, RSS fetching)
- **Business insights** through KPI tracking

### Infrastructure

- **Logging**: structlog with JSON output
- **Metrics**: Prometheus client library
- **Visualization**: Grafana dashboards
- **Scraping**: Prometheus scrapes `/metrics` endpoint
- **Caching**: Redis metrics via redis_exporter (don't duplicate!)

---

## Architecture

### Core Modules

```
server/app/core/
├── metrics.py              # Technical infrastructure metrics
├── business_metrics.py     # Business KPIs and user behavior
└── constants.py            # Metric-related constants
```

### Metric Organization

**`core/metrics.py`** - Technical/Infrastructure Metrics:
- HTTP request/response metrics
- Database query performance
- External API calls (RSS, AI, content extraction)
- Worker task metrics
- Cache operations (use redis_exporter for detailed Redis metrics)

**`core/business_metrics.py`** - Business Metrics:
- User activity and engagement
- Content processing statistics
- Feed health indicators
- Reading behavior
- Subscription patterns

### Middleware

```
server/app/middleware/
└── metrics_middleware.py   # HTTP request metrics collection
```

Automatically tracks all API endpoints with:
- Request duration
- Request/response sizes
- Status codes
- Active request count

---

## Logging Standards

### Log Levels

Follow this hierarchy strictly:

| Level | When to Use | Examples |
|-------|-------------|----------|
| **DEBUG** | Development/diagnostic info (disabled in production) | Entry parsing details, cache lookups, routine operations |
| **INFO** | Normal operational events | Feed refreshed, article saved, user subscribed |
| **WARNING** | Unexpected but recoverable situations | Malformed feed data, missing optional fields, deprecated features |
| **ERROR** | Operation failures requiring attention | HTTP errors (5xx), timeout errors, database failures |
| **CRITICAL** | System-wide failures | Database connection lost, required service unavailable |

### Structured Logging Pattern

**✅ GOOD - Use structured fields:**
```python
logger.info(
    "Feed refreshed successfully",
    feed_id=str(feed_id),
    duration_seconds=round(duration, 3),
    articles_found=article_count,
    cached=False,
)
```

**❌ BAD - Avoid f-strings:**
```python
logger.info(f"Feed {feed_id} refreshed in {duration}s with {article_count} articles")
```

### Standard Fields

Include these fields when applicable:

- **Identifiers**: `user_id`, `feed_id`, `article_id`, `task_id`, `request_id`
- **Duration**: `duration_seconds` (always rounded to 3 decimals)
- **Counts**: `article_count`, `batch_size`, `result_count`
- **Status**: `status`, `success`, `cached`
- **Errors**: `error`, `error_type`, `error_category`
- **Context**: `operation`, `model`, `endpoint`, `method`

### Error Logging Pattern

```python
except Exception as e:
    duration = time.perf_counter() - start_time

    logger.error(
        "Operation failed",
        operation="fetch_feed",
        feed_url=url,
        error=str(e),
        error_type=type(e).__name__,
        error_category="network",  # network/validation/database/external_api
        duration_seconds=round(duration, 3),
        exc_info=True,  # Include stack trace
    )
```

### Noisy Logs to Avoid

- ❌ Debug-level information at INFO level
- ❌ Logging every iteration in loops (use debug or aggregate)
- ❌ Redundant success logs (use metrics instead)
- ❌ Full request/response payloads (log size/count instead)

---

## Metrics Standards

### Naming Convention

Format: `readspace_<subsystem>_<name>_<unit>`

Examples:
- `readspace_http_requests_total`
- `readspace_feed_refresh_duration_seconds`
- `readspace_db_connections_active`

### Metric Types

#### Counter
Monotonically increasing values (never decreases).

```python
from prometheus_client import Counter

operations_total = Counter(
    "readspace_operations_total",
    "Total operations performed",
    ["operation", "status"],  # Labels for filtering
)

# Usage
operations_total.labels(operation="subscribe", status="success").inc()
```

**Use for:** Total requests, errors, operations, events

#### Gauge
Values that can go up or down.

```python
from prometheus_client import Gauge

connections_active = Gauge(
    "readspace_connections_active",
    "Number of active connections",
)

# Usage
connections_active.inc()  # Increment
connections_active.dec()  # Decrement
connections_active.set(42)  # Set to value
```

**Use for:** Current connections, queue depth, in-progress operations, resource usage

#### Histogram
Distribution of values (automatically creates buckets).

```python
from prometheus_client import Histogram

request_duration = Histogram(
    "readspace_request_duration_seconds",
    "Request duration in seconds",
    ["endpoint"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0, 10.0],  # Custom buckets
)

# Usage
request_duration.labels(endpoint="/api/feeds").observe(0.234)
```

**Use for:** Durations, sizes, counts (when you need percentiles)

### Bucket Selection Guide

Choose buckets based on expected latency:

```python
# Database queries (milliseconds to seconds)
buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]

# HTTP requests (milliseconds to seconds)
buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]

# External API calls (seconds to minutes)
buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0, 120.0]

# Cache operations (microseconds to milliseconds)
buckets=[0.0001, 0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1]

# Batch sizes
buckets=[1, 5, 10, 25, 50, 100, 250, 500, 1000]
```

### Label Guidelines

**✅ Good labels** (low cardinality):
- `status` (success/error/timeout)
- `method` (GET/POST/PUT/DELETE)
- `operation` (subscribe/unsubscribe/refresh)
- `model` (gemini-2.0-flash/text-embedding-004)

**❌ Bad labels** (high cardinality):
- User IDs
- Feed URLs
- Timestamps
- Article titles
- Request IDs

> **Rule**: Labels should have <100 unique values. High cardinality kills Prometheus performance!

---

## Implementation Patterns

### Pattern 1: Service/Worker Method Instrumentation

Use this pattern for any service method or worker task:

```python
import time
from app.core.metrics import (
    operation_total,
    operation_duration_seconds,
    operation_in_progress,
)

async def process_item(self, item_id: UUID) -> Result:
    """Process an item with full observability."""
    start_time = time.perf_counter()
    operation_in_progress.inc()  # Track concurrent operations

    logger.info("Starting item processing", item_id=str(item_id))

    try:
        # Do the work
        result = await self._do_processing(item_id)

        # Calculate duration
        duration = time.perf_counter() - start_time

        # Record success metrics
        operation_total.labels(operation="process_item", status="success").inc()
        operation_duration_seconds.labels(operation="process_item").observe(duration)

        # Log success
        logger.info(
            "Item processing completed",
            item_id=str(item_id),
            duration_seconds=round(duration, 3),
            result_count=len(result.items) if result else 0,
        )

        return result

    except ValidationError as e:
        # Record failure metrics
        duration = time.perf_counter() - start_time
        operation_total.labels(operation="process_item", status="validation_error").inc()
        operation_duration_seconds.labels(operation="process_item").observe(duration)

        logger.error(
            "Item validation failed",
            item_id=str(item_id),
            error=str(e),
            error_type="ValidationError",
            error_category="validation",
            duration_seconds=round(duration, 3),
            exc_info=True,
        )
        raise

    except Exception as e:
        # Record unexpected failure metrics
        duration = time.perf_counter() - start_time
        operation_total.labels(operation="process_item", status="error").inc()
        operation_duration_seconds.labels(operation="process_item").observe(duration)

        logger.error(
            "Item processing failed",
            item_id=str(item_id),
            error=str(e),
            error_type=type(e).__name__,
            error_category="unknown",
            duration_seconds=round(duration, 3),
            exc_info=True,
        )
        raise

    finally:
        operation_in_progress.dec()  # Always decrement gauge
```

### Pattern 2: External API Call Instrumentation

For RSS fetching, AI calls, content extraction:

```python
import time
from app.core.metrics import (
    external_api_calls_total,
    external_api_duration_seconds,
    external_api_errors_total,
)

async def call_external_service(self, url: str) -> Response:
    """Call external service with full observability."""
    start_time = time.perf_counter()
    service_name = "external_service"

    try:
        response = await self.client.get(url, timeout=30.0)
        duration = time.perf_counter() - start_time

        # Record metrics
        external_api_calls_total.labels(
            service=service_name,
            status=str(response.status_code)
        ).inc()
        external_api_duration_seconds.labels(
            service=service_name,
            cached="false"
        ).observe(duration)

        # Log with context
        logger.info(
            "External API call succeeded",
            service=service_name,
            url=url,
            status_code=response.status_code,
            duration_seconds=round(duration, 3),
            response_size_bytes=len(response.content),
        )

        return response

    except httpx.TimeoutException as e:
        duration = time.perf_counter() - start_time
        external_api_calls_total.labels(service=service_name, status="timeout").inc()
        external_api_errors_total.labels(service=service_name, error_type="timeout").inc()
        external_api_duration_seconds.labels(service=service_name, cached="false").observe(duration)

        logger.error(
            "External API call timed out",
            service=service_name,
            url=url,
            timeout_seconds=30.0,
            duration_seconds=round(duration, 3),
            error_category="network",
        )
        raise

    except Exception as e:
        duration = time.perf_counter() - start_time
        external_api_calls_total.labels(service=service_name, status="error").inc()
        external_api_errors_total.labels(service=service_name, error_type=type(e).__name__).inc()
        external_api_duration_seconds.labels(service=service_name, cached="false").observe(duration)

        logger.error(
            "External API call failed",
            service=service_name,
            url=url,
            error=str(e),
            error_type=type(e).__name__,
            duration_seconds=round(duration, 3),
            error_category="network",
            exc_info=True,
        )
        raise
```

### Pattern 3: Database Query Instrumentation

```python
import time
from app.core.metrics import db_query_duration_seconds, db_queries_total

async def get_items(self, user_id: UUID, limit: int = 50) -> list[Item]:
    """Get items with query performance tracking."""
    start_time = time.perf_counter()
    operation = "select"
    table = "items"

    try:
        # Execute query
        stmt = select(Item).where(Item.user_id == user_id).limit(limit)
        result = await self.db.execute(stmt)
        items = result.scalars().all()

        duration = time.perf_counter() - start_time

        # Record metrics
        db_queries_total.labels(operation=operation, table=table, status="success").inc()
        db_query_duration_seconds.labels(operation=operation, table=table).observe(duration)

        # Log slow queries (>100ms)
        if duration > 0.1:
            logger.warning(
                "Slow database query detected",
                operation=operation,
                table=table,
                duration_seconds=round(duration, 3),
                limit=limit,
                result_count=len(items),
            )

        return items

    except Exception as e:
        duration = time.perf_counter() - start_time
        db_queries_total.labels(operation=operation, table=table, status="error").inc()
        db_query_duration_seconds.labels(operation=operation, table=table).observe(duration)

        logger.error(
            "Database query failed",
            operation=operation,
            table=table,
            error=str(e),
            duration_seconds=round(duration, 3),
            exc_info=True,
        )
        raise
```

### Pattern 4: Business Metric Tracking

```python
from app.core.business_metrics import (
    user_actions_total,
    articles_per_user,
    feed_refresh_success_rate,
)

# Track user actions
user_actions_total.labels(action="subscribe").inc()
user_actions_total.labels(action="read").inc()
user_actions_total.labels(action="favorite").inc()

# Track distributions
articles_per_user.observe(user_article_count)

# Track gauges (update periodically, e.g., in scheduled task)
total_success = get_successful_refreshes()
total_attempts = get_total_refreshes()
success_rate = (total_success / total_attempts * 100) if total_attempts > 0 else 0
feed_refresh_success_rate.set(success_rate)
```

---

## Priority Modules for Instrumentation

### 🔴 Critical Priority (Complete Next)

These modules handle core functionality and need immediate instrumentation:

#### 1. **`app/routers/feeds.py`**
   - **Why**: Primary API for feed operations
   - **Metrics needed**:
     - `feed_operations_total` (subscribe/unsubscribe/refresh/delete)
     - `feed_operation_duration_seconds`
     - `feeds_per_request` (for bulk operations)
   - **Pattern**: Use Pattern 1 for each endpoint

#### 2. **`app/routers/articles.py`**
   - **Why**: High-traffic article operations
   - **Metrics needed**:
     - `article_operations_total` (save/read/favorite/delete)
     - `article_operation_duration_seconds`
     - `articles_per_query`
   - **Pattern**: Use Pattern 1 + business metrics

#### 3. **`app/services/feeds/feed.py`**
   - **Why**: Core feed refresh logic
   - **Metrics needed**:
     - Phase transition tracking
     - Content change detection rates
     - Database commit duration
   - **Logs needed**:
     - Phase start/end with duration
     - Content hash comparison results
     - Article creation counts

#### 4. **`app/services/articles/content_extraction.py`**
   - **Why**: Resource-intensive operation
   - **Metrics needed**:
     - `content_extraction_total` (by method: readability/trafilatura)
     - `content_extraction_duration_seconds`
     - `extracted_content_size_bytes`
   - **Pattern**: Use Pattern 2 (external service)

### 🟡 High Priority

#### 5. **`app/crud/article/article_crud_operations.py`**
   - **Why**: High-volume database operations
   - **Metrics**: Query duration, result counts
   - **Pattern**: Use Pattern 3

#### 6. **`app/routers/opml.py`**
   - **Why**: Already has worker metrics, need router metrics
   - **Metrics**:
     - Import session start/complete
     - File size tracking
     - Progress updates
   - **Logs**: Import lifecycle events

#### 7. **`app/services/feeds/enrichment/feed_enrichment.py`**
   - **Why**: AI-powered feed enrichment
   - **Metrics**: Already tracked in ai_service, add enrichment-specific
   - **Logs**: Enrichment results, quality scores

### 🟢 Medium Priority

#### 8. **`app/services/subscription_service.py`**
   - **Metrics**: Subscription lifecycle events
   - **Business metrics**: Subscription retention

#### 9. **`app/crud/feed/feed_crud_operations.py`**
   - **Metrics**: Query performance
   - **Pattern**: Use Pattern 3

#### 10. **`app/middleware/` (remaining)**
   - Request ID tracking
   - Compression ratio tracking
   - Cache hit rates

### 🔵 Low Priority (Nice to Have)

- `app/services/user_service.py`
- `app/utils/` modules
- `app/schemas/` (validation metrics)

---

## Testing Observability

### Unit Test Pattern

```python
from prometheus_client import REGISTRY

def test_operation_emits_metrics(self):
    """Test that operation emits correct metrics."""
    # Get initial metric values
    before = REGISTRY.get_sample_value(
        'readspace_operations_total',
        {'operation': 'test_op', 'status': 'success'}
    ) or 0

    # Perform operation
    result = await service.perform_operation()

    # Check metric incremented
    after = REGISTRY.get_sample_value(
        'readspace_operations_total',
        {'operation': 'test_op', 'status': 'success'}
    ) or 0

    assert after == before + 1
```

### Integration Test Pattern

```python
async def test_endpoint_metrics(client):
    """Test endpoint emits HTTP metrics."""
    response = await client.get("/api/feeds")

    # Verify metrics endpoint exposes data
    metrics_response = await client.get("/metrics")
    assert metrics_response.status_code == 200
    assert b"readspace_http_requests_total" in metrics_response.content
```

### Log Testing Pattern

```python
import structlog
from structlog.testing import LogCapture

def test_operation_logs_correctly():
    """Test operation produces correct logs."""
    cap = LogCapture()
    structlog.configure(processors=[cap])

    service.perform_operation()

    assert len(cap.entries) == 1
    assert cap.entries[0]["event"] == "Operation completed"
    assert "duration_seconds" in cap.entries[0]
```

---

## Grafana Dashboards

### Recommended Dashboard Structure

#### 1. **System Health Dashboard**
   - HTTP request rate, latency, error rate (RED metrics)
   - Database connection pool status
   - Worker queue depths
   - Cache hit/miss rates

#### 2. **Feed Processing Dashboard**
   - Feed refresh rate and duration
   - RSS fetch success/failure rates
   - Article processing rate
   - Feed health indicators

#### 3. **AI Service Dashboard**
   - AI request rate by operation (text/embed/enrich)
   - Token usage over time
   - AI service latency
   - Error rates

#### 4. **Business Metrics Dashboard**
   - Active users (daily/weekly)
   - User actions (subscribes, reads, favorites)
   - Content statistics (total articles, feeds)
   - Subscription retention

#### 5. **Error Tracking Dashboard**
   - Error rate by type
   - Failed operations over time
   - Slow queries
   - Timeout events

### Useful PromQL Queries

```promql
# Request rate
rate(readspace_http_requests_total[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(readspace_http_request_duration_seconds_bucket[5m]))

# Error rate
rate(readspace_http_requests_total{status=~"5.."}[5m])

# Cache hit rate
rate(readspace_cache_operations_total{result="hit"}[5m]) /
rate(readspace_cache_operations_total[5m])

# AI cost (tokens per minute)
rate(readspace_ai_token_usage_total[1m])

# Feed refresh success rate
rate(readspace_feeds_refreshed_total[5m]) /
rate(readspace_feeds_refreshed_total[5m] + readspace_feeds_failed_total[5m])
```

---

## Best Practices

### DO ✅

1. **Always use structured logging** - Never f-strings in logs
2. **Measure duration** - Track time for all significant operations
3. **Use appropriate log levels** - DEBUG for development, INFO for events
4. **Include context** - IDs, counts, statuses in logs
5. **Record both success and failure** - Track all outcomes
6. **Use finally blocks for gauges** - Always decrement in-progress gauges
7. **Choose appropriate buckets** - Match expected latency distribution
8. **Track business metrics** - Not just technical metrics
9. **Log errors with stack traces** - Use `exc_info=True`
10. **Round durations** - `round(duration, 3)` for consistency

### DON'T ❌

1. **Don't log in loops** - Aggregate or use DEBUG level
2. **Don't use high-cardinality labels** - Kills Prometheus
3. **Don't duplicate Redis metrics** - Use redis_exporter
4. **Don't log sensitive data** - PII, tokens, passwords
5. **Don't create metrics in functions** - Define at module level
6. **Don't forget error cases** - Always instrument failure paths
7. **Don't skip gauge decrements** - Use try/finally
8. **Don't use print()** - Always use logger
9. **Don't log full payloads** - Log sizes/counts instead
10. **Don't create new metric names ad-hoc** - Use existing or discuss first

### Performance Considerations

- **Metrics are cheap** - Prometheus handles millions of metrics
- **Logging can be expensive** - Use DEBUG for noisy logs
- **Structured logging overhead** - Minimal with proper configuration
- **Histogram buckets** - More buckets = slightly more memory
- **Label cardinality** - Keep unique values low (<100 per label)

---

## Example: Complete Service Instrumentation

Here's a complete example showing all patterns:

```python
"""Example service with full observability."""

import time
from uuid import UUID

import structlog
from prometheus_client import Counter, Histogram, Gauge

from app.core.business_metrics import user_actions_total

logger = structlog.get_logger(__name__)

# Module-level metrics
example_operations_total = Counter(
    "readspace_example_operations_total",
    "Total example operations",
    ["operation", "status"],
)

example_operation_duration_seconds = Histogram(
    "readspace_example_operation_duration_seconds",
    "Example operation duration",
    ["operation"],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0],
)

example_operations_in_progress = Gauge(
    "readspace_example_operations_in_progress",
    "Example operations currently in progress",
    ["operation"],
)


class ExampleService:
    """Example service with comprehensive observability."""

    async def process_item(self, user_id: UUID, item_id: UUID) -> dict:
        """Process an item with full instrumentation."""
        start_time = time.perf_counter()
        operation = "process_item"

        # Track in-progress
        example_operations_in_progress.labels(operation=operation).inc()

        logger.info(
            "Starting item processing",
            user_id=str(user_id),
            item_id=str(item_id),
            operation=operation,
        )

        try:
            # Business logic
            result = await self._do_processing(item_id)

            # Calculate metrics
            duration = time.perf_counter() - start_time

            # Record success metrics
            example_operations_total.labels(
                operation=operation,
                status="success"
            ).inc()
            example_operation_duration_seconds.labels(
                operation=operation
            ).observe(duration)

            # Track business metric
            user_actions_total.labels(action="process").inc()

            # Log success
            logger.info(
                "Item processing completed",
                user_id=str(user_id),
                item_id=str(item_id),
                operation=operation,
                duration_seconds=round(duration, 3),
                result_count=len(result.get("items", [])),
            )

            return result

        except ValueError as e:
            # Validation error - user's fault
            duration = time.perf_counter() - start_time
            example_operations_total.labels(
                operation=operation,
                status="validation_error"
            ).inc()
            example_operation_duration_seconds.labels(
                operation=operation
            ).observe(duration)

            logger.warning(
                "Item validation failed",
                user_id=str(user_id),
                item_id=str(item_id),
                operation=operation,
                error=str(e),
                error_type="ValueError",
                error_category="validation",
                duration_seconds=round(duration, 3),
            )
            raise

        except Exception as e:
            # Unexpected error - system's fault
            duration = time.perf_counter() - start_time
            example_operations_total.labels(
                operation=operation,
                status="error"
            ).inc()
            example_operation_duration_seconds.labels(
                operation=operation
            ).observe(duration)

            logger.error(
                "Item processing failed",
                user_id=str(user_id),
                item_id=str(item_id),
                operation=operation,
                error=str(e),
                error_type=type(e).__name__,
                error_category="system",
                duration_seconds=round(duration, 3),
                exc_info=True,
            )
            raise

        finally:
            # Always decrement gauge
            example_operations_in_progress.labels(operation=operation).dec()

    async def _do_processing(self, item_id: UUID) -> dict:
        """Internal processing logic."""
        # Implementation here
        pass
```

---

## Quick Reference

### Import Statements

```python
# Logging
import structlog
logger = structlog.get_logger(__name__)

# Timing
import time
start_time = time.perf_counter()
duration = time.perf_counter() - start_time

# Metrics
from prometheus_client import Counter, Gauge, Histogram

# Existing metrics
from app.core.metrics import (
    http_requests_total,
    db_query_duration_seconds,
    external_api_calls_total,
)

# Business metrics
from app.core.business_metrics import (
    user_actions_total,
    articles_processed_total,
)
```

### Common Patterns

```python
# Log with structured fields
logger.info("Event occurred", field1=value1, field2=value2)

# Track counter
counter.labels(label1="value1", label2="value2").inc()

# Track duration
histogram.labels(label="value").observe(duration)

# Track gauge (with finally)
try:
    gauge.inc()
    # ... do work ...
finally:
    gauge.dec()

# Round duration
round(duration, 3)
```

---

## Getting Help

### Questions?

1. Check this document first
2. Look at reference implementations:
   - `app/workers/feed_tasks.py` - Worker metrics
   - `app/services/feeds/feed_fetcher.py` - External API metrics
   - `app/services/ai/ai_service.py` - AI service metrics
   - `app/middleware/metrics_middleware.py` - HTTP metrics
3. Ask in #observability Slack channel
4. Create an issue for unclear guidelines

### Updating This Document

When you add new patterns or metrics categories, update this document to keep it current. All changes should be reviewed by the platform team.

---

**Last Updated**: 2025-01-17
**Version**: 1.0
**Maintainer**: Platform Team
