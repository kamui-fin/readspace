# API Performance Optimization Plan

## Executive Summary

Based on benchmark results showing average response times of 86-286ms, this document outlines specific optimizations to improve API performance. The slowest endpoints are:

1. **GET /api/rss/discover/search** - 286ms (search with filters)
2. **GET /api/rss/articles/unread_counts** - 209ms (aggregation query)
3. **GET /api/rss/feeds/** - 206ms (list with 200 items)
4. **GET /api/rss/articles/** - 152ms (paginated list)

## Root Cause Analysis

### 1. Missing Database Indexes

**Current State:**
- Basic indexes exist on `user_article_states` (user_id, article_id)
- No composite indexes for common query patterns
- No indexes on `feed_subscriptions` for feed_id lookups
- Missing indexes for filtering operations (is_read, is_read_later, is_favorite)

**Impact:** Sequential scans on large tables, especially for unread counts and article filtering.

### 2. N+1 Query Problems

**Current State:**
- Article queries use `selectinload()` for feeds and content
- Unread counts query joins multiple tables without optimization
- Feed listing calculates unread counts per feed in a loop

**Impact:** Multiple round trips to database for related data.

### 3. Inefficient Aggregation Queries

**Current State:**
- `get_all_unread_counts()` performs complex joins with conditional aggregation
- Separate query for clipped articles read_later count
- No caching of frequently accessed counts

**Impact:** Slow response times for unread_counts endpoint (209ms average).

### 4. Search Query Optimization

**Current State:**
- Hybrid search uses complex CTE queries with vector similarity
- Full table scans for text search without proper FTS indexes
- Multiple subqueries in single request

**Impact:** Slowest endpoint at 286ms for search operations.

## Optimization Strategy

### Phase 1: Critical Database Indexes (Immediate Impact)

#### 1.1 User Article States Indexes

```sql
-- Composite index for unread article queries (most common pattern)
CREATE INDEX CONCURRENTLY idx_user_states_unread_lookup 
ON user_article_states (user_id, is_read, is_read_later) 
WHERE is_read = FALSE OR is_read IS NULL;

-- Index for read_later queries
CREATE INDEX CONCURRENTLY idx_user_states_read_later 
ON user_article_states (user_id, is_read_later) 
WHERE is_read_later = TRUE;

-- Index for favorite queries
CREATE INDEX CONCURRENTLY idx_user_states_favorites 
ON user_article_states (user_id, is_favorite) 
WHERE is_favorite = TRUE;
```

**Expected Impact:** 40-60% reduction in unread_counts query time (209ms → 80-120ms)

#### 1.2 Feed Subscriptions Indexes

```sql
-- Index for feed lookups by user
CREATE INDEX CONCURRENTLY idx_feed_subs_user_feed 
ON feed_subscriptions (user_id, feed_id);

-- Index for folder-based queries (already exists but verify)
-- idx_feed_subscriptions_user_folder already created in migration

-- Index for favorite feeds
CREATE INDEX CONCURRENTLY idx_feed_subs_favorites 
ON feed_subscriptions (user_id, is_favorite) 
WHERE is_favorite = TRUE;
```

**Expected Impact:** 30-40% reduction in feed listing time (206ms → 120-145ms)

#### 1.3 Feed Articles Indexes

```sql
-- Composite index for article queries with feed and content joins
CREATE INDEX CONCURRENTLY idx_feed_articles_queries 
ON feed_articles (feed_id, content_id, created_at DESC);

-- Index for article lookups by content
CREATE INDEX CONCURRENTLY idx_feed_articles_content 
ON feed_articles (content_id);
```

**Expected Impact:** 20-30% reduction in article listing time (152ms → 106-122ms)

#### 1.4 Article Content Indexes

```sql
-- Full-text search index for title and description
CREATE INDEX CONCURRENTLY idx_article_content_fts 
ON article_contents USING gin(
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
);

-- Index for published date range queries
-- (already exists: ix_article_contents_published_at)

-- Index for recent articles (common pattern)
CREATE INDEX CONCURRENTLY idx_article_content_recent 
ON article_contents (published_at DESC NULLS LAST) 
WHERE published_at >= NOW() - INTERVAL '30 days';
```

**Expected Impact:** 50-70% reduction in search query time (286ms → 85-143ms)

### Phase 2: Query Optimization (Medium Impact)

#### 2.1 Optimize Unread Counts Query

**Current Implementation:**
```python
# Uses complex joins with conditional aggregation
# Separate query for clipped articles
```

**Optimized Approach:**
```python
# Use materialized CTE for better query planning
# Combine feed and clipped articles in single query
# Add query hints for index usage
```

**Implementation:**
```sql
WITH unread_articles AS (
    SELECT 
        fs.folder_id,
        COUNT(*) as unread_count,
        SUM(CASE WHEN uas.is_read_later = TRUE THEN 1 ELSE 0 END) as read_later_count,
        SUM(CASE WHEN ac.published_at >= :twenty_four_hours_ago THEN 1 ELSE 0 END) as today_count
    FROM feed_articles fa
    INNER JOIN feed_subscriptions fs ON fa.feed_id = fs.feed_id
    INNER JOIN article_contents ac ON fa.content_id = ac.id
    LEFT JOIN user_article_states uas ON uas.article_id = fa.id AND uas.user_id = :user_id
    WHERE fs.user_id = :user_id
      AND (uas.is_read IS NULL OR uas.is_read = FALSE)
    GROUP BY fs.folder_id
)
SELECT * FROM unread_articles;
```

**Expected Impact:** 50-60% reduction (209ms → 80-100ms)

#### 2.2 Optimize Feed Listing with Unread Counts

**Current Implementation:**
```python
# Separate query for unread counts per feed
# Loop through feeds to attach counts
```

**Optimized Approach:**
```python
# Single query with LEFT JOIN for counts
# Use window functions for aggregation
```

**Implementation:**
```sql
SELECT 
    f.*,
    fs.*,
    COUNT(fa.id) FILTER (WHERE uas.is_read IS NULL OR uas.is_read = FALSE) as unread_count
FROM feeds f
INNER JOIN feed_subscriptions fs ON f.id = fs.feed_id
LEFT JOIN feed_articles fa ON fa.feed_id = f.id
LEFT JOIN user_article_states uas ON uas.article_id = fa.id AND uas.user_id = :user_id
WHERE fs.user_id = :user_id
GROUP BY f.id, fs.id
ORDER BY fs.created_at DESC
LIMIT :limit OFFSET :skip;
```

**Expected Impact:** 40-50% reduction (206ms → 103-124ms)

#### 2.3 Optimize Article Listing Query

**Current Implementation:**
```python
# Uses selectinload for relationships
# Multiple queries for feed and content data
```

**Optimized Approach:**
```python
# Use joinedload for small result sets
# Eager load only required fields
# Add query result caching for common filters
```

**Expected Impact:** 25-35% reduction (152ms → 99-114ms)

### Phase 3: Application-Level Optimizations (Long-term)

#### 3.1 Implement Redis Caching

**Cache Strategy:**
```python
# Cache unread counts with 5-minute TTL
cache_key = f"unread_counts:{user_id}"
ttl = 300  # 5 minutes

# Cache feed list with 10-minute TTL
cache_key = f"feeds:{user_id}:{folder_id}"
ttl = 600  # 10 minutes

# Invalidate on article state changes
```

**Expected Impact:** 80-90% reduction for cached requests

#### 3.2 Implement Query Result Pagination Optimization

**Current Implementation:**
```python
# Uses OFFSET/LIMIT pagination
# Recalculates total count on each request
```

**Optimized Approach:**
```python
# Use cursor-based pagination for large datasets
# Remove total count calculation (not needed for infinite scroll)
# Already implemented: pages = page if len(articles) < size else page + 1
```

**Expected Impact:** 15-20% reduction for large offsets

#### 3.3 Add Database Connection Pooling Tuning

**Current Configuration:**
```python
# Review and optimize:
# - pool_size
# - max_overflow
# - pool_pre_ping
# - pool_recycle
```

**Expected Impact:** 5-10% reduction in connection overhead

### Phase 4: Search Optimization (Specialized)

#### 4.1 Optimize Hybrid Search Query

**Current Implementation:**
```python
# Complex CTE with FTS and vector search
# Multiple subqueries and unions
```

**Optimized Approach:**
```python
# Separate FTS and vector search paths
# Use EXPLAIN ANALYZE to identify bottlenecks
# Consider search result caching for popular queries
# Add query timeout to prevent long-running searches
```

**Implementation Changes:**
```python
# Add search result caching
@cache(ttl=3600)  # 1 hour for search results
async def search_feeds(query, category, language, limit):
    # ... existing implementation
    pass

# Add query timeout
stmt = stmt.execution_options(timeout=5.0)  # 5 second timeout
```

**Expected Impact:** 40-50% reduction (286ms → 143-172ms)

#### 4.2 Optimize Feed Discovery

**Current Implementation:**
```python
# Multiple database queries for category browsing
# No caching of popular feeds
```

**Optimized Approach:**
```python
# Cache popular feeds by category
# Pre-compute trending feeds
# Use materialized views for category counts
```

**Expected Impact:** 60-70% reduction for cached categories

## Implementation Plan

### Week 1: Critical Indexes
- [ ] Create all Phase 1 indexes using CONCURRENTLY
- [ ] Monitor index creation progress
- [ ] Verify index usage with EXPLAIN ANALYZE
- [ ] Measure performance improvements

### Week 2: Query Optimization
- [ ] Implement optimized unread_counts query
- [ ] Optimize feed listing query
- [ ] Add query result caching for common patterns
- [ ] Update article listing query

### Week 3: Application Optimizations
- [ ] Implement Redis caching layer
- [ ] Add cache invalidation logic
- [ ] Optimize connection pooling
- [ ] Add query timeouts

### Week 4: Search & Testing
- [ ] Optimize hybrid search query
- [ ] Add search result caching
- [ ] Comprehensive performance testing
- [ ] Production deployment

## Monitoring & Validation

### Key Metrics to Track

```sql
-- Query performance monitoring
SELECT 
    query,
    calls,
    mean_exec_time,
    max_exec_time,
    stddev_exec_time
FROM pg_stat_statements
WHERE query LIKE '%user_article_states%'
   OR query LIKE '%feed_articles%'
   OR query LIKE '%feed_subscriptions%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Index usage monitoring
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Cache hit ratio
SELECT 
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit) as heap_hit,
    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;
```

### Success Criteria

| Endpoint | Current Avg | Target Avg | Improvement |
|----------|-------------|------------|-------------|
| GET /api/rss/discover/search | 286ms | <100ms | 65% |
| GET /api/rss/articles/unread_counts | 209ms | <80ms | 62% |
| GET /api/rss/feeds/ | 206ms | <100ms | 51% |
| GET /api/rss/articles/ | 152ms | <80ms | 47% |
| Overall Average | 86ms | <50ms | 42% |

## Risk Mitigation

### Index Creation Risks
- **Risk:** Index creation locks table
- **Mitigation:** Use CONCURRENTLY option, schedule during low-traffic periods

### Query Changes Risks
- **Risk:** New queries may have unexpected performance characteristics
- **Mitigation:** Test with EXPLAIN ANALYZE, gradual rollout with feature flags

### Caching Risks
- **Risk:** Stale data served to users
- **Mitigation:** Short TTLs, proper cache invalidation, cache warming

## Rollback Plan

1. **Index Rollback:** Drop indexes if performance degrades
2. **Query Rollback:** Feature flag to revert to old queries
3. **Cache Rollback:** Disable caching layer if issues arise

## Conclusion

Implementing these optimizations should reduce average API response times by 40-65%, with the most significant improvements in:
- Search queries: 65% faster
- Unread counts: 62% faster  
- Feed listing: 51% faster
- Article listing: 47% faster

The optimizations are prioritized by impact and implementation complexity, allowing for incremental improvements and validation at each phase.
