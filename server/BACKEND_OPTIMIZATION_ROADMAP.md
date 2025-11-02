# Backend Optimization & Technical Debt Roadmap

**Goal**: Build a Feedly-scale RSS feed reader backend that is highly performant and bullet-speed fast, with ZERO technical debt.

**Date**: 2025-11-02
**Status**: Comprehensive Analysis Complete

---

## 🔴 CRITICAL ISSUES (Fix Immediately - Week 1)

### Security Vulnerabilities

- [ ] **SSRF Protection**: Add URL validation and SSRF protection across all endpoints
  - `app/routers/article_enhancements.py:116` - URL extraction without validation
  - `app/routers/articles.py:102` - Article URL saving allows arbitrary URLs
  - `app/routers/feeds.py:272` - Feed URL subscription without SSRF checks
  - `app/routers/discover.py:366,377,380` - Preview URL fetching vulnerable to SSRF
  - **Solution**: Implement URL whitelist/blacklist, validate against private IP ranges, add timeout/size limits

- [ ] **JWT Security Flaw**: Enable audience verification in Supabase JWT validation
  - `app/services/auth.py:23` - `verify_aud: False` is a security risk
  - **Solution**: Set `verify_aud: True` and configure proper audience claim

- [ ] **XXE Vulnerability**: Add XML security configuration for OPML parser
  - `app/services/opml_processor.py:36` - XML parsing with `noqa: S314` suppresses security warning
  - No XXE (XML External Entity) protection
  - **Solution**: Configure XML parser to disable external entities and DTD processing

- [ ] **Authorization Bypass**: Fix preview mode security hole
  - `app/routers/feeds.py:859` - Preview mode bypasses subscription checks completely
  - **Solution**: Add stricter validation, rate limiting, and logging for preview mode

### Critical Import Errors

- [ ] **Fix module import paths** (breaking changes from refactor)
  - `app/services/subscription.py:16` - `from app.services.feed_service` should be `from app.services.feed`
  - `app/services/subscription.py:17` - `from app.services.folder_service` should be `from app.services.folder`
  - `app/services/opml_import.py:11` - Same issue with `folder_service` import
  - `app/crud/feed.py:13-28` - Imports from `crud_feed_queries`, `crud_feed_scheduling` but files named differently

### N+1 Query Problems

- [x] **Remove unnecessary eager loading** in article specialized queries
  - `app/crud/article_specialized_queries.py:181` - `selectinload(FeedArticle.user_states)` loads ALL user states instead of just current user's
  - **Solution**: ✅ COMPLETED - Removed eager load from both get_read_later_articles and get_trending_articles

- [x] **Fix COUNT query inefficiency** in user article state
  - `app/crud/user_article_state.py:154-183` - Fetches all article IDs just to count them
  - **Solution**: ✅ COMPLETED - Changed to use `func.count()` instead of `len(result.scalars().all())`

### Blocking Operations in Async Context

- [ ] **Make file I/O async** in PageRankService
  - `app/services/page_rank.py:29` - Synchronous file reading in `__init__` blocks event loop
  - **Solution**: Use `aiofiles` for async file operations or load on first access

- [ ] **Remove blocking HTTP calls from search path**
  - `app/services/rss_search.py:486` - `_fetch_feed_content()` blocks during preview
  - `app/services/rss_search.py:560` - AI embedding generation has no timeout
  - **Solution**: Add timeouts, make truly async, or move to background task

- [ ] **Remove blocking XML parsing**
  - `app/services/opml_processor.py:36,299,304` - Synchronous XML parsing in async methods
  - **Solution**: Use async XML parser or process in thread pool

---

## 🟠 HIGH PRIORITY (Fix in Week 2)

### Missing Rate Limiting

- [ ] **Add rate limiting to expensive AI endpoints**
  - `app/routers/article_enhancements.py` - Summarize and translate endpoints have no limits
  - **Solution**: Use `slowapi` or Redis-based rate limiter (e.g., 10 requests/minute per user)

- [ ] **Implement OPML import limits**
  - `app/routers/opml.py:307` - No rate limit on OPML imports
  - No concurrent import limit per user
  - **Solution**: Max 1 active import per user, max 5 imports per hour

- [ ] **Add feed refresh rate limiting**
  - `app/routers/feeds.py:670` - `/refresh` endpoint can spam Celery queue
  - `app/routers/feeds.py:762` - Individual feed refresh has no limits
  - **Solution**: Max 1 bulk refresh per 5 minutes, max 10 individual refreshes per hour

- [ ] **Rate limit article saving**
  - `app/routers/articles.py` - POST endpoint has no protection against abuse
  - **Solution**: Max 50 articles saved per hour per user

### Database Performance - Missing Indexes

- [x] **Add critical composite indexes** for query performance
  - ✅ COMPLETED - Most indexes already exist in migration `20251101_000000_add_performance_indexes.py`
  - ✅ Added `idx_user_states_read_at` for (user_id, read_at DESC) with partial index
  - All other critical indexes already present

- [x] **Add indexes for feed scheduling**
  - ✅ COMPLETED - Already in migration:
    - `idx_feeds_last_fetched`
    - `idx_feeds_refresh_priority` (subscriber_count + last_fetched_at)
    - `idx_feeds_subscriber_count`

- [x] **Add full-text search indexes**
  - ✅ SKIPPED - Article search not currently supported, uses ILIKE
  - Note added to migration documenting FTS index for future implementation

### Redundant Database Calls

- [x] **Eliminate double refresh in article update**
  - `app/crud/article_crud_operations.py:423-427` - Refreshes both `feed_article` and `user_state` separately
  - **Solution**: ✅ COMPLETED - Removed redundant user_state refresh, only refresh feed_article

- [x] **Fix post-insert reloads**
  - `app/crud/subscription.py:203-206` - Fetches subscription after insert instead of using eager loading
  - **Solution**: ✅ COMPLETED - Replaced refresh+fetch with single eager-loaded query

- [x] **Optimize folder batch creation**
  - `app/crud/folder.py:154-161` - Separate SELECT after INSERT
  - **Solution**: ✅ COMPLETED - Changed to ON CONFLICT DO UPDATE to return all rows in one query

### Code Duplication

- [x] **Extract URL normalization to shared utility**
  - `app/services/feed_similarity.py:23-42` - Identical `_normalize_url` method
  - **Solution**: ✅ COMPLETED - Using existing `normalize_url_for_display()` from `app/utils/url_normalizer.py`

- [x] **Extract domain extraction logic**
  - Duplicated in `popularity_scorer.py:37-38`, `page_rank.py:65`
  - **Solution**: ✅ COMPLETED - Created `app/utils/domain_helpers.py` with `extract_clean_domain()` function
  - Updated both popularity_scorer.py and page_rank.py to use shared utility

- [x] **Consolidate mark as read/unread**
  - `app/crud/user_article_state.py:90-109` and `111-129` are nearly identical
  - **Solution**: ✅ COMPLETED - Created `update_article_read_status(is_read: bool)` base function
  - Kept convenience wrappers mark_article_read/unread for backwards compatibility

### Missing Batch Operations

- [ ] **Implement bulk mark as read/unread**
  - `app/crud/user_article_state.py` - Only has single-record operations
  - **Solution**: Add `mark_articles_read_batch(article_ids: list[UUID])` method

- [ ] **Add batch article transformation**
  - `app/crud/article_transformer.py:10-225` - Transforms articles one-by-one
  - **Solution**: Add `transform_batch()` method for large result sets

---

## 🟡 MEDIUM PRIORITY (Fix in Weeks 3-4)

### Service Layer Violations

- [ ] **Reduce service-to-service coupling** in SubscriptionService
  - `app/services/subscription.py:28,44,267` - Creates multiple service instances
  - **Solution**: Use dependency injection, pass services as constructor parameters

- [ ] **Split God Service** - RssSearchService is 1057 lines
  - `app/services/rss_search.py` - Handles search, preview, trending, categories
  - **Solution**: Split into:
    - `SearchService` - Core search logic
    - `FeedPreviewService` - URL preview functionality
    - `UrlPatternDetector` - URL/pattern detection utility
    - `TrendingService` - Trending/popular feeds

- [ ] **Eliminate nested functions** (violates CLAUDE.md guidelines)
  - `app/services/rss_search.py:936-937` - Nested async in `get_trending_feeds`
  - `app/services/rss_search.py:1028-1029` - Nested async in `get_categories_with_counts`
  - **Solution**: Extract to module-level functions

### Missing Caching

- [ ] **Cache PageRank dataset** properly
  - `app/services/page_rank.py:22-46` - Loads entire JSON file on every service instantiation
  - **Solution**: Use module-level singleton with lazy loading or FastAPI startup event

- [ ] **Add caching for expensive calculations**
  - Similarity search results (`app/services/feed_similarity.py`)
  - Popularity score calculations (`app/services/popularity_scorer.py:66-107`)
  - Domain lookups in PageRank (`app/services/page_rank.py:48-81`)
  - **Solution**: Use Redis cache with 1-hour TTL

- [ ] **Cache hybrid search results**
  - `app/services/rss_search.py:722` - Only trending feeds cached, not search results
  - **Solution**: Cache search results with 30-minute TTL

### Query Optimization

- [ ] **Replace string SQL with SQLAlchemy query builder**
  - `app/services/rss_search.py:587-678` - Large SQL string with f-string interpolation
  - `app/services/feed_similarity.py:91-123` - Raw SQL with string formatting
  - **Solution**: Use SQLAlchemy's ORM or at minimum parameterized queries

- [ ] **Optimize union queries** with materialized views
  - `app/crud/unified_article_query_builder.py:200-262` - Complex union with many NULL columns
  - **Solution**: Consider materialized views or separate simpler queries

- [ ] **Add functional indexes for computed columns**
  - `app/crud/subscription.py:129` - Order by `COALESCE(custom_title, feed_title)`
  - **Solution**: Create functional index or computed column

### Input Validation

- [ ] **Add content length limits** for AI operations
  - `app/routers/article_enhancements.py:36,56` - No max length on content
  - **Solution**: Max 100KB for summarization, 50KB for translation

- [ ] **Validate language codes** against whitelist
  - `app/routers/article_enhancements.py:50-54` - Accepts any string
  - **Solution**: Use ISO 639-1 language code enum

- [ ] **Add timezone validation**
  - `app/routers/articles.py:214` - `user_timezone` string not validated
  - **Solution**: Validate against IANA timezone database using `pytz`

- [ ] **Add OPML file size and structure validation**
  - `app/routers/opml.py:307` - Naive feed count using string search
  - **Solution**: Parse XML structure properly before processing

### Celery Task Inefficiencies

- [ ] **Implement exponential backoff** for task retries
  - `app/workers/feed_tasks.py:138,181` - Uses linear backoff
  - `app/workers/opml_tasks.py:158` - Hardcoded retry countdown
  - **Solution**: Use exponential backoff with jitter: `countdown=30 * (2 ** self.request.retries)`

- [ ] **Add circuit breaker** for failing feeds
  - No circuit breaker pattern in feed refresh tasks
  - Failed feeds retry indefinitely
  - **Solution**: Track consecutive failures, disable feed after 5 failures, re-enable after 24h

- [ ] **Optimize task group dispatching**
  - `app/routers/feeds.py:724-730` - Individual `.delay()` calls in loop
  - **Solution**: Already uses `group()` in feed_tasks.py, extend pattern to refresh endpoint

- [ ] **Add task deduplication**
  - No protection against concurrent refreshes of same feed
  - **Solution**: Use Redis lock: `feed:refresh:{feed_id}` with TTL

---

## 🟢 LOW PRIORITY (Fix in Month 2)

### Code Quality Improvements

- [x] **Precompile all regex patterns** at module level
  - ✅ COMPLETED - All regex patterns precompiled as module constants
  - `app/utils/validators.py` - Added `EMAIL_PATTERN` and `TAG_NAME_PATTERN`
  - `app/utils/reading_time.py` - Added `CJK_PATTERN`, `WHITESPACE_PATTERN`, `HTML_TAG_PATTERN`, `PUNCTUATION_PATTERN`, `HTML_TAG_FALLBACK_PATTERN`
  - `app/utils/url_validator.py` - Added `FOLDER_NAME_PATTERN`
  - `app/utils/language_normalizer.py` - Added `LANGUAGE_PATTERNS` list with precompiled patterns

- [x] **Add missing database constraints**
  - ✅ COMPLETED - Migration `20251102_180009_6af6f682f204_add_additional_check_constraints.py` created
  - Added CHECK constraint on `feeds.language` for valid ISO 639-1 codes (2 letter format)
  - Added CHECK constraint on `feeds.adaptive_fetch_interval_minutes` (range: 5-10080 minutes)
  - Added CHECK constraint on `clipped_articles.priority` (values: low, medium, high)
  - Added CHECK constraint on `profiles.role` (values: basic, pro, admin)

- [x] **Add unique constraint on Profile.email**
  - ✅ COMPLETED - Added in migration `20251102_180009_6af6f682f204_add_additional_check_constraints.py`
  - Includes duplicate cleanup logic before constraint addition

- [x] **Reduce column sizes** for optimization
  - ✅ COMPLETED - Column sizes optimized in migrations
  - `feeds.last_error_message` reduced from TEXT to VARCHAR(2000)
  - `article_contents.description` reduced from VARCHAR(5000) to VARCHAR(2000)
  - Already done in previous migration: `feeds.description` to VARCHAR(2000), `article_contents.title` to VARCHAR(500)

### Error Handling Improvements

- [x] **Fix exception mapping inconsistencies**
  - ✅ COMPLETED - Fixed `FeedSubscriptionError` to map to 409 (HTTP_CONFLICT) instead of 400
  - Organized exception mappings with comments grouping client errors (4xx) and server errors (5xx)
  - All custom exceptions now properly mapped in `EXCEPTION_STATUS_MAP`

- [x] **Add structured error responses**
  - ✅ COMPLETED - Enhanced `ReadspaceException` base class with structured error support
  - Added `error_code` parameter for machine-readable error codes
  - Added `field_errors` parameter for field-specific validation errors
  - Added `to_dict()` method to convert exceptions to structured error dictionaries
  - Updated `to_http_exception()` to use structured error responses

- [ ] **Improve error categorization** in OPML import
  - `app/services/opml_import.py:193-261` - Error categorization should be extracted
  - **Solution**: Create `app/utils/error_classifier.py` with reusable categorization

### Configuration & Architecture

- [ ] **Make production configs fail-fast**
  - `app/core/config.py:33,36-37` - Redis and Celery default to localhost
  - **Solution**: Remove defaults, require env vars in production via validators

- [ ] **Add cache key versioning**
  - `app/core/cache.py:42` - No version in cache key generation
  - **Solution**: Include schema version in cache key to auto-invalidate on changes

- [ ] **Implement cache invalidation helpers**
  - `app/core/redis_cache.py:145-178` - No pattern-based invalidation
  - **Solution**: Add `delete_pattern()`, `invalidate_related()` methods

- [ ] **Add dependency injection factory pattern**
  - `app/core/dependencies.py:43-45` - Import inside function indicates architectural issue
  - `app/core/dependencies.py:38-54` - Service factories duplicate logic
  - **Solution**: Create generic service factory with dependency resolution

### Type Safety

- [x] **Fix type detection in transformer**
  - ✅ COMPLETED - Replaced `hasattr()` checks with proper `isinstance()` type checking
  - Updated `to_unified()` method signature with proper Union type hints
  - Added proper error handling with `TypeError` for unsupported types
  - File: `app/crud/article/article_transformer.py`

- [x] **Remove dead parameters**
  - ✅ VERIFIED - Parameter `subscription_ids` in `app/crud/article/user_article_state.py:154` is actually used
  - Parameter is used on line 165 for filtering subscriptions
  - No action needed - initial report was incorrect

- [ ] **Use TypeGuard for runtime validation**
  - `app/crud/base.py:11-14` - `HasId` protocol not enforced at runtime
  - **Solution**: Add TypeGuard or runtime type checking

### Logging & Monitoring

- [x] **Standardize logging format**
  - ✅ COMPLETED - Converted f-string logging to structured logging format
  - Updated `app/services/feeds/enrichment/popularity_scorer.py` to use structured logging
  - Changed from `logger.debug(f"...")` to `logger.debug("message", param=value)` format

- [ ] **Add authentication event logging**
  - `app/services/auth.py` - No audit trail for auth events
  - **Solution**: Log all auth attempts, failures, token validations

- [ ] **Add performance metrics**
  - No metrics for database query times, cache hit rates, task durations
  - **Solution**: Use `prometheus_client` for metrics collection

---

## 📊 PERFORMANCE OPTIMIZATIONS

### Database-Level

- [ ] **Create migration for all missing indexes**
  - Run `alembic revision -m "add_performance_indexes"`
  - Add all indexes listed in HIGH PRIORITY section
  - Test query performance before/after with `EXPLAIN ANALYZE`

- [ ] **Implement connection pooling optimization**
  - Review `app/db/session.py` pool size settings
  - Add pool pre-ping for connection health checks
  - Configure pool recycle time

- [ ] **Add database query logging** in development
  - Enable SQLAlchemy echo for slow query detection
  - Add query performance warnings for queries >100ms

### Application-Level

- [ ] **Implement read replicas** for heavy read operations
  - Separate read/write database connections
  - Route article list queries to read replica
  - Route feed searches to read replica

- [ ] **Add response compression**
  - Enable gzip compression in FastAPI middleware
  - Compress JSON responses for list endpoints

- [ ] **Implement cursor-based pagination** for large datasets
  - Replace offset-based pagination with cursor pagination
  - Use `article_id` as cursor for better performance

- [ ] **Add HTTP caching headers**
  - Add `Cache-Control` headers for static feed data
  - Use `ETag` for conditional requests on article lists
  - Implement `Last-Modified` headers for feed metadata

### Celery Optimization

- [ ] **Implement task prioritization**
  - High priority: User-initiated refreshes
  - Medium priority: Scheduled refreshes for popular feeds
  - Low priority: Background enrichment tasks

- [ ] **Add task result expiration**
  - Set shorter expiration for completed tasks
  - Prevent Redis from accumulating stale results

- [ ] **Implement worker auto-scaling**
  - Use Celery autoscale: `--autoscale=10,3`
  - Add metrics for queue depth monitoring

---

## 🔒 SECURITY HARDENING

### Authentication & Authorization

- [ ] **Implement token revocation list**
  - Use Redis-based token blacklist
  - Add endpoint for token invalidation
  - Check blacklist on every authenticated request

- [ ] **Add refresh token rotation**
  - Implement refresh token mechanism
  - Rotate tokens on each refresh
  - Detect token replay attacks

- [ ] **Add failed authentication tracking**
  - Track failed login attempts per user
  - Implement account lockout after 5 failures
  - Add CAPTCHA after 3 failures

- [ ] **Implement proper RBAC system**
  - Replace string-based role checks with permission system
  - Use role hierarchy (admin > pro > basic)
  - Add fine-grained permissions for resources

### Input Sanitization

- [ ] **Add HTML sanitization** for user-generated content
  - Sanitize article notes, feed custom titles
  - Use `bleach` library for safe HTML
  - Strip JavaScript and dangerous tags

- [ ] **Implement SQL injection prevention audit**
  - Review all raw SQL queries
  - Ensure all use parameterized queries
  - Add SQLMap testing to CI/CD

- [ ] **Add CSRF protection**
  - Enable CSRF tokens for state-changing operations
  - Use SameSite cookie attributes
  - Validate origin headers

### API Security

- [ ] **Add request signing** for sensitive operations
  - Implement HMAC signing for admin operations
  - Validate signatures before processing
  - Add replay attack prevention

- [ ] **Implement IP whitelisting** for admin endpoints
  - Restrict admin endpoints to specific IP ranges
  - Log all admin access attempts
  - Add 2FA requirement for admin operations

- [ ] **Add security headers**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Content-Security-Policy` for XSS protection
  - `Strict-Transport-Security` for HTTPS enforcement

---

## 📈 MONITORING & OBSERVABILITY

### Metrics

- [ ] **Add Prometheus metrics** for:
  - Request latency (p50, p95, p99)
  - Error rates by endpoint
  - Database query duration
  - Cache hit/miss rates
  - Celery task success/failure rates
  - Feed fetch success rates

### Logging

- [ ] **Implement centralized logging**
  - Ship logs to centralized system (ELK, Loki, etc.)
  - Add correlation IDs to trace requests
  - Include user_id, feed_id in all relevant logs

- [ ] **Add audit logging** for:
  - All authentication events
  - Feed subscription changes
  - Admin operations
  - Bulk operations

### Alerting

- [ ] **Set up alerts** for:
  - Error rate > 5%
  - p95 latency > 1 second
  - Database connection pool exhaustion
  - Celery queue depth > 1000
  - Failed feed fetch rate > 20%
  - Disk space < 20%

### Tracing

- [ ] **Implement distributed tracing**
  - Add OpenTelemetry spans for all operations
  - Trace database queries
  - Trace external API calls
  - Trace Celery task execution

---

## 🧪 TESTING IMPROVEMENTS

### Unit Tests

- [ ] **Increase test coverage** to >80%
  - Add tests for all CRUD operations
  - Add tests for all service methods
  - Add tests for utility functions

- [ ] **Add property-based tests** with Hypothesis
  - Test URL normalization with random URLs
  - Test date filtering with random dates
  - Test pagination with random page sizes

### Integration Tests

- [ ] **Add database integration tests**
  - Test all indexes are being used
  - Test query performance benchmarks
  - Test transaction rollback scenarios

- [ ] **Add API integration tests**
  - Test complete user workflows
  - Test error scenarios
  - Test rate limiting

### Performance Tests

- [ ] **Add load testing** with Locust
  - Test feed refresh at scale (1000+ concurrent)
  - Test article list performance with 1M+ articles
  - Test search performance with large catalog

- [ ] **Add benchmark tests**
  - Benchmark critical queries
  - Track performance regression
  - Add CI/CD performance gates

---

## 📝 DOCUMENTATION

- [ ] **Document all environment variables**
  - Create `.env.example` with all required vars
  - Document production vs development differences
  - Add validation rules for each variable

- [ ] **Create architecture decision records (ADRs)**
  - Document why specific patterns were chosen
  - Document trade-offs made
  - Add context for future developers

- [ ] **Add API documentation improvements**
  - Add more request/response examples
  - Document rate limits in OpenAPI spec
  - Add error code reference guide

- [ ] **Create performance tuning guide**
  - Document all indexes and why they exist
  - Document caching strategy
  - Document Celery configuration

---

## 🎯 PRIORITY EXECUTION ORDER

### Week 1: Critical Security & Performance
1. Fix SSRF vulnerabilities (1 day)
2. Enable JWT audience verification (2 hours)
3. Add XXE protection to OPML parser (4 hours)
4. Fix import errors (2 hours)
5. Remove N+1 queries (1 day)
6. Make file I/O and HTTP calls async (1 day)

### Week 2: Rate Limiting & Indexes
1. Implement rate limiting for all endpoints (2 days)
2. Create migration with all performance indexes (1 day)
3. Test index performance improvements (1 day)
4. Add caching for expensive operations (1 day)

### Week 3: Code Quality & Optimization
1. Extract duplicated code to utilities (2 days)
2. Implement batch operations (2 days)
3. Fix service layer coupling (1 day)

### Week 4: Celery & Background Tasks
1. Implement exponential backoff (1 day)
2. Add circuit breaker pattern (1 day)
3. Add task deduplication (1 day)
4. Optimize task dispatching (1 day)

### Month 2: Polish & Documentation
1. Implement all LOW priority items
2. Add comprehensive testing
3. Set up monitoring and alerting
4. Complete documentation

---

## 📊 SUCCESS METRICS

Track these metrics to measure improvement:

- **Performance**:
  - p95 API response time < 200ms
  - Database query time p95 < 50ms
  - Feed fetch success rate > 95%
  - Cache hit rate > 80%

- **Scalability**:
  - Support 100K+ feeds
  - Support 10M+ articles
  - Handle 1000+ concurrent users
  - Process 10K+ feed refreshes/hour

- **Code Quality**:
  - Test coverage > 80%
  - Zero critical security vulnerabilities
  - Zero blocking operations in async code
  - All regex patterns precompiled

- **Reliability**:
  - API uptime > 99.9%
  - Zero data loss incidents
  - Mean time to recovery < 5 minutes
  - Error rate < 0.1%

---

## 🎓 LESSONS LEARNED

### What Went Well
- Good separation of concerns (CRUD, services, routers)
- Comprehensive async/await usage
- Structured logging throughout
- Good use of Pydantic for validation
- Celery integration for background tasks

### What Needs Improvement
- Service-to-service dependencies too tight
- Missing rate limiting and security controls
- Some blocking operations in async code
- Inconsistent error handling
- Need more comprehensive testing

### Architectural Decisions to Revisit
- Consider event-driven architecture for feed updates
- Consider CQRS pattern for read-heavy operations
- Consider GraphQL for flexible data fetching
- Consider implementing CDC (Change Data Capture) for cache invalidation

---

**Last Updated**: 2025-11-02
**Next Review**: After Week 1 critical fixes completed
