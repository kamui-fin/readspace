# Union Query Optimization Analysis

## File: `app/crud/article/unified_article_query_builder.py`

## Current Implementation

### Overview
The `UnifiedArticleQueryBuilder` combines two different article types (feed articles and clipped articles) into a unified view using `UNION ALL`.

### Problem: Excessive NULL Columns

The current implementation uses many placeholder NULL columns to make the schemas compatible:

**Feed Articles** have these placeholders:
- `clipped_article_id`: `literal(None, PGUUID)` - always NULL
- `priority`: `literal(None, String)` - always NULL

**Clipped Articles** have these placeholders:
- `feed_id`: `literal(None, PGUUID)` - always NULL
- `feed_title`: `literal(None, String)` - always NULL
- `feed_link`: `literal(None, String)` - always NULL
- `feed_image_url`: `literal(None, String)` - always NULL

### Performance Impact

#### Current Query Pattern
```sql
SELECT
    article_id, user_id, title, ...,
    feed_id, NULL as clipped_article_id,  -- Feed articles
    feed_title, feed_link, feed_image_url,
    'feed' as article_type, ...
FROM feed_articles_subquery
UNION ALL
SELECT
    id, user_id, title, ...,
    NULL as feed_id, clipped_article_id,  -- Clipped articles
    NULL as feed_title, NULL as feed_link, NULL as feed_image_url,
    'clipped' as article_type, ...
FROM clipped_articles_subquery
ORDER BY published_at DESC
LIMIT 100;
```

#### Performance Characteristics

**Memory Overhead:**
- Each NULL literal consumes minimal memory (pointer-sized, ~8 bytes)
- For 100 results with 6 NULL columns each: ~4.8KB additional memory
- **Verdict**: Negligible for typical result sets (<1000 rows)

**Query Planner Impact:**
- NULL literals are computed once during planning, not per-row
- UNION ALL does not deduplicate (unlike UNION)
- Column count: 20 columns total (6 of which are conditionally NULL)
- **Verdict**: Minimal planner overhead

**Sorting Performance:**
- Sorting happens on the unified result set (after UNION ALL)
- Single sort operation on `published_at` column
- NULL columns don't participate in sort
- **Verdict**: No impact on sort performance

#### Comparison to Alternatives

**Option 1: Separate Queries (Current Alternative)**
```python
feed_articles = get_feed_articles(user_id, filters)
clipped_articles = get_clipped_articles(user_id, filters)
# Application-level merge and sort
all_articles = sorted(feed_articles + clipped_articles,
                     key=lambda x: x.published_at,
                     reverse=True)[:limit]
```

**Pros:**
- No NULL columns
- Simpler individual queries
- Can be parallelized

**Cons:**
- Sorting happens in Python (slower than PostgreSQL)
- Pagination is complex (need to fetch more than limit to ensure correct results)
- Two database round-trips
- Cannot leverage database indexes for final sort
- Memory overhead of loading both result sets

**Option 2: Materialized View**
```sql
CREATE MATERIALIZED VIEW unified_articles AS
SELECT ... FROM feed_articles
UNION ALL
SELECT ... FROM clipped_articles;

CREATE INDEX idx_unified_articles_user_published
ON unified_articles(user_id, published_at DESC);
```

**Pros:**
- Pre-computed unified view
- Can have dedicated indexes
- Very fast queries

**Cons:**
- Stale data (needs refresh)
- Storage overhead (duplicate data)
- Refresh complexity and timing
- Not suitable for real-time updates
- Much higher maintenance burden

**Option 3: PostgreSQL Inheritance/Partitioning**
```sql
CREATE TABLE articles (
    id UUID PRIMARY KEY,
    user_id UUID,
    content_id UUID,
    article_type VARCHAR(20),
    ...
) PARTITION BY LIST (article_type);

CREATE TABLE feed_articles PARTITION OF articles
FOR VALUES IN ('feed');

CREATE TABLE clipped_articles PARTITION OF articles
FOR VALUES IN ('clipped');
```

**Pros:**
- Native PostgreSQL feature
- Single table view
- Good query performance

**Cons:**
- Requires schema migration
- Complex to maintain with different column sets
- NULL columns still needed for incompatible schemas
- Not all columns can be partitioned easily

## Recommendation: Keep Current Implementation

### Reasoning

1. **Performance is already optimal** for the use case:
   - UNION ALL is efficient (no deduplication overhead)
   - Database-level sorting is faster than application sorting
   - Single query = single round-trip
   - Proper indexes on individual tables handle filtering

2. **NULL column overhead is minimal**:
   - ~5KB extra for typical 100-row result set
   - Zero impact on sort performance
   - Query planner handles NULLs efficiently

3. **Alternatives have significant downsides**:
   - Separate queries: slower Python sorting, pagination complexity
   - Materialized views: stale data, refresh overhead
   - Partitioning: major schema refactor with unclear benefits

4. **Code clarity**:
   - Current approach is straightforward and maintainable
   - Type-safe with SQLAlchemy ORM
   - Easy to understand the data flow

### Potential Optimizations (If Needed)

If query performance becomes an issue (>500ms for typical queries), consider:

1. **Add composite indexes** on filtered columns:
   ```sql
   CREATE INDEX idx_feed_articles_user_filter
   ON feed_articles(user_id, created_at DESC)
   WHERE content_id IS NOT NULL;

   CREATE INDEX idx_clipped_articles_user_created
   ON clipped_articles(user_id, created_at DESC);
   ```

2. **Use CTE for common filters** (already done):
   - Current implementation properly uses subqueries
   - Filters are applied before UNION ALL

3. **Implement query result caching**:
   - Cache unified results for common filter combinations
   - TTL: 30-60 seconds for user-specific queries
   - Invalidate on article creation/update

4. **Add EXPLAIN ANALYZE monitoring**:
   ```python
   # Add to query builder for performance tracking
   if settings.ENABLE_QUERY_PROFILING:
       explain_result = await db.execute(
           f"EXPLAIN ANALYZE {query}"
       )
       logger.info("Query plan", explain=explain_result)
   ```

## Conclusion

The current UNION query implementation is **well-optimized** and represents best practices for this use case. The NULL placeholder columns have negligible performance impact and provide clear code semantics. No refactoring is recommended unless specific performance issues are identified through production monitoring.

### Performance Baseline (for future reference)

Expected query times on modern PostgreSQL:
- **< 10ms**: Queries with user_id filter and proper indexes
- **< 50ms**: Queries with complex filters (date ranges, search)
- **< 100ms**: Full-text search across content fields

If query times exceed these baselines consistently, investigate:
1. Missing indexes
2. Table statistics (run ANALYZE)
3. Connection pooling issues
4. Lock contention

## Code Quality Assessment

The current implementation demonstrates:
- ✅ **Type safety**: Proper SQLAlchemy typing
- ✅ **Separation of concerns**: Query building separate from execution
- ✅ **Flexibility**: Easy to add new filters
- ✅ **Maintainability**: Clear method names and structure
- ✅ **Performance**: Optimal for the use case

**No changes recommended.**
