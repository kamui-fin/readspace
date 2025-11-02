# API Performance Optimization Plan - Quick Wins

## Executive Summary

Based on benchmark analysis, the slowest endpoints are:
1. **GET /api/rss/discover/search** - 318ms (max)
2. **GET /api/rss/articles/unread_counts** - 213ms (max)
3. **GET /api/rss/similar/{feed_id}** - 137ms (max)

This plan focuses on **quick, high-impact optimizations** that don't require complex indexing strategies.

---

## 🎯 Priority 1: Unread Counts Optimization (213ms → <50ms)

### Current Issues
The `get_all_unread_counts()` function already uses a CTE but still performs multiple queries:
1. Main CTE query for unread counts by folder
2. Separate query for clipped articles read_later count

### Quick Wins

#### 1.1 Combine Clipped Articles into Single Query
**File**: `server/app/crud/article_specialized_queries.py`
**Method**: `get_all_unread_counts()`

**Current Problem**: Two separate queries
```python
# Query 1: CTE for feed articles
WITH unread_articles AS MATERIALIZED (...)
SELECT folder_id, COUNT(*) ...

# Query 2: Separate query for clipped articles
SELECT COUNT(*) FROM clipped_articles WHERE is_read_later = TRUE
```

**Solution**: Use UNION ALL in the CTE to include clipped articles
```sql
WITH unread_articles AS MATERIALIZED (
    -- Feed articles (existing)
    SELECT 
        fs.folder_id,
        fa.id as article_id,
        COALESCE(uas.is_read_later, FALSE) as is_read_later,
        ac.published_at
    FROM feed_articles fa
    INNER JOIN feed_subscriptions fs ON fa.feed_id = fs.feed_id
    INNER JOIN article_contents ac ON fa.content_id = ac.id
    LEFT JOIN user_article_states uas ON uas.article_id = fa.id AND uas.user_id = :user_id
    WHERE fs.user_id = :user_id
      AND (uas.is_read IS NULL OR uas.is_read = FALSE)
    
    UNION ALL
    
    -- Clipped articles (new)
    SELECT 
        NULL as folder_id,  -- Clipped articles don't have folders
        ca.id as article_id,
        ca.is_read_later,
        ac.published_at
    FROM clipped_articles ca
    INNER JOIN article_contents ac ON ca.content_id = ac.id
    WHERE ca.user_id = :user_id
      AND (ca.is_read IS NULL OR ca.is_read = FALSE)
)
SELECT 
    folder_id,
    COUNT(*) as unread_count,
    SUM(CASE WHEN is_read_later = TRUE THEN 1 ELSE 0 END) as read_later_count,
    SUM(CASE WHEN published_at >= :twenty_four_hours_ago AND published_at <= :now_utc THEN 1 ELSE 0 END) as today_count
FROM unread_articles
GROUP BY folder_id
```

**Expected Impact**: 213ms → 80-100ms (50% reduction)

#### 1.2 Add Response Caching
**File**: `server/app/routers/rss_articles.py`
**Method**: `get_unread_article_counts()`

Add simple in-memory caching with 30-second TTL:
```python
from app.core.cache import cache_result

@cache_result(ttl=30)  # Cache for 30 seconds
async def get_unread_article_counts(...):
    ...
```

**Expected Impact**: 80-100ms → 5-10ms for cached requests (90% reduction on cache hits)

---

## 🎯 Priority 2: Discover Search Optimization (318ms → <150ms)

### Current Issues
The `search_feeds()` method has multiple inefficiencies:
1. Multiple sequential database queries for URL detection
2. Redundant URL normalization
3. Preview fetching blocks the response

### Quick Wins

#### 2.1 Optimize URL Detection Logic
**File**: `server/app/services/rss_search_service.py`
**Method**: `search_feeds()`

**Current Problem**: Sequential checks with multiple DB queries
```python
# Step 1: Try exact URL matches
exact_matches = await self._search_exact_url_matches(...)
if exact_matches:
    # Step 2: Fill remaining with hybrid search
    additional_results = await self._hybrid_search(...)
    
# Step 3: Try preview
if self._is_valid_url(query):
    preview_result = await self._preview_url_as_feed(query)
```

**Solution**: Simplify the flow
```python
async def search_feeds(self, query, category, language, limit):
    # Quick checks first (no DB)
    if query:
        # Subreddit check (fast regex)
        if subreddit_url := self._detect_subreddit(query):
            return [await self._preview_url_as_feed(subreddit_url)]
        
        # rsshub:// check (fast string check)
        if self._is_rsshub_url(query):
            return [await self._preview_url_as_feed(query)]
    
    # Single DB query path
    if query and (self._is_valid_url(query) or self._is_website_url(query)):
        # Try exact match first (fast B-tree lookup)
        results = await self._search_exact_url_matches(query, language, limit, category)
        if results:
            return results[:limit]
        
        # Fall back to domain search (uses pg_trgm GIN index)
        results = await self._search_by_website_url(query, language, limit, category)
        if results:
            return results[:limit]
    
    # Regular search (FTS or hybrid)
    if self.settings.ENABLE_AI and self.ai_service:
        return await self._hybrid_search(query, language, limit, category)
    else:
        return await self._simple_search(query, language, limit, category)
```

**Expected Impact**: 318ms → 180-220ms (30% reduction)

#### 2.2 Remove Preview Fetching from Search Path
**Current Problem**: Preview fetching makes HTTP requests that block the response

**Solution**: Return preview metadata without fetching
```python
if self._is_valid_url(query) and not exact_matches:
    # Don't fetch, just return a preview placeholder
    return [{
        "id": f"preview_{hash(query)}",
        "title": "Preview: " + query,
        "url": query,
        "is_preview": True,
        "preview_url": query,
        # ... minimal metadata
    }]
```

Let the frontend fetch preview details separately via `/api/rss/discover/preview/articles`

**Expected Impact**: 180-220ms → 120-150ms (additional 30% reduction)

#### 2.3 Add Query Result Caching
**File**: `server/app/services/rss_search_service.py`

Cache popular search queries:
```python
from app.core.cache import cache_result

@cache_result(ttl=300)  # 5 minutes
async def search_feeds(self, query, category, language, limit):
    ...
```

**Expected Impact**: 120-150ms → 10-20ms for cached queries (90% reduction on cache hits)

---

## 🎯 Priority 3: Similar Feeds Optimization (137ms → <80ms)

### Current Issues
The similarity query is already well-optimized with vector indexes, but has room for improvement:
1. Fetches subscribed feed IDs in a separate query
2. Builds dynamic SQL with multiple placeholders

### Quick Wins

#### 3.1 Use CTE for Subscribed Feeds
**File**: `server/app/services/feed_similarity_service.py`
**Method**: `get_similar_feeds()`

**Current Problem**: Two queries
```python
# Query 1: Get subscribed feed IDs
subscribed_feed_ids = await self._get_user_subscribed_feed_ids()

# Query 2: Similarity search with exclusion
sql_query = f"""
    WITH source_feed AS (...)
    SELECT ... WHERE f.id NOT IN ({placeholders})
"""
```

**Solution**: Single query with CTE
```python
sql_query = """
    WITH source_feed AS (
        SELECT embedding
        FROM feeds
        WHERE id = :source_feed_id
        AND embedding IS NOT NULL
    ),
    subscribed_feeds AS (
        SELECT feed_id
        FROM feed_subscriptions
        WHERE user_id = :user_id
    )
    SELECT
        f.id, f.title, f.description, f.url, f.link, f.image_url,
        f.tags, f.language, f.top_level_category, f.popularity_score,
        (1 - (f.embedding <=> (SELECT embedding FROM source_feed))) AS similarity_score
    FROM feeds f, source_feed sf
    WHERE f.id != :source_feed_id
      AND f.embedding IS NOT NULL
      AND (1 - (f.embedding <=> sf.embedding)) >= :min_similarity
      AND f.id NOT IN (SELECT feed_id FROM subscribed_feeds)
    ORDER BY f.embedding <=> sf.embedding
    LIMIT :limit
"""
```

**Expected Impact**: 137ms → 90-100ms (30% reduction)

#### 3.2 Add Response Caching
Cache similar feed results per feed:
```python
from app.core.cache import cache_result

@cache_result(ttl=3600)  # 1 hour
async def get_similar_feeds(self, feed_id, limit, min_similarity):
    ...
```

**Expected Impact**: 90-100ms → 5-10ms for cached requests (90% reduction on cache hits)

---

## 🎯 Priority 4: General Article List Optimization (150ms → <100ms)

### Current Issues
The main articles endpoint has variable performance based on filters.

### Quick Wins

#### 4.1 Remove Total Count Calculation
**File**: `server/app/services/article_management_service.py`
**Method**: `get_articles()`

**Current State**: Already optimized! ✅
```python
result = PaginatedResponse(
    items=articles,
    total=0,  # No longer calculated - not needed for infinite scroll
    page=page,
    size=size,
    pages=pages,
)
```

This is already a good optimization. No changes needed.

#### 4.2 Add Conditional Caching for Common Filters
Cache results for common filter combinations:
```python
from app.core.cache import cache_result

async def get_articles(self, ...):
    # Only cache simple, common queries
    if self._is_cacheable_query(feed_ids, folder_id, is_read, ...):
        return await self._get_articles_cached(...)
    else:
        return await self._get_articles_uncached(...)

@cache_result(ttl=60)  # 1 minute
async def _get_articles_cached(self, ...):
    return await self._get_articles_uncached(...)
```

**Expected Impact**: 150ms → 10-20ms for cached common queries

---

## 📊 Expected Overall Impact

| Endpoint | Current (Avg) | Current (Max) | After Optimization | Improvement |
|----------|---------------|---------------|-------------------|-------------|
| GET /api/rss/articles/unread_counts | 137ms | 213ms | 30-50ms | 70-85% |
| GET /api/rss/discover/search | 122ms | 318ms | 50-100ms | 60-70% |
| GET /api/rss/similar/{feed_id} | 127ms | 137ms | 40-60ms | 60-70% |
| GET /api/rss/articles/ | 110ms | 152ms | 60-90ms | 40-50% |

---

## 🚀 Implementation Order

### Phase 1: Immediate Wins (1-2 hours)
1. ✅ Add caching to unread_counts endpoint
2. ✅ Combine clipped articles query in get_all_unread_counts
3. ✅ Add caching to similar feeds endpoint

### Phase 2: Search Optimization (2-3 hours)
4. ✅ Simplify search_feeds URL detection flow
5. ✅ Remove blocking preview fetches
6. ✅ Add search result caching

### Phase 3: Polish (1 hour)
7. ✅ Add CTE for similar feeds subscribed check
8. ✅ Add conditional caching for article lists

---

## 🔧 Implementation Notes

### Caching Strategy
Use a simple in-memory cache with TTL:
```python
# server/app/core/cache.py
from functools import wraps
from datetime import datetime, timedelta

_cache = {}

def cache_result(ttl: int):
    """Cache function results for ttl seconds."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Create cache key from function name and args
            cache_key = f"{func.__name__}:{str(args)}:{str(kwargs)}"
            
            # Check cache
            if cache_key in _cache:
                result, expires_at = _cache[cache_key]
                if datetime.now() < expires_at:
                    return result
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Store in cache
            _cache[cache_key] = (result, datetime.now() + timedelta(seconds=ttl))
            
            return result
        return wrapper
    return decorator
```

### Testing Strategy
1. Run benchmarks before changes
2. Implement one optimization at a time
3. Run benchmarks after each change
4. Compare results
5. Rollback if performance degrades

---

## ⚠️ What NOT to Do

1. **Don't add complex indexes yet** - The existing indexes are good. Focus on query optimization first.
2. **Don't denormalize data** - The schema is well-designed. Keep it normalized.
3. **Don't add Redis yet** - In-memory caching is sufficient for these improvements.
4. **Don't rewrite in raw SQL** - SQLAlchemy queries are fine. The issue is query logic, not ORM overhead.

---

## 📈 Success Metrics

After implementing these optimizations:
- ✅ 95th percentile response time < 150ms for all endpoints
- ✅ Average response time < 80ms for all endpoints
- ✅ Cache hit rate > 40% for frequently accessed endpoints
- ✅ No degradation in data accuracy or consistency
