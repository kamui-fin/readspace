# Database Optimization Recommendations

This document contains recommended database indexes and optimizations for improving query performance in the Readspace application.

## Recommended Indexes

### Feed Articles Table
The following indexes should be added to optimize article queries:

```sql
-- Index for user article queries with common filters
CREATE INDEX CONCURRENTLY idx_feed_articles_user_queries
ON feed_articles (user_id, published_at DESC)
INCLUDE (feed_id, is_read, is_read_later, is_favorite);

-- Index for feed-specific article queries
CREATE INDEX CONCURRENTLY idx_feed_articles_feed_queries
ON feed_articles (feed_id, published_at DESC)
INCLUDE (user_id, is_read, is_read_later, is_favorite);

-- Index for read status queries
CREATE INDEX CONCURRENTLY idx_feed_articles_read_status
ON feed_articles (user_id, is_read, published_at DESC);

-- Index for favorites queries
CREATE INDEX CONCURRENTLY idx_feed_articles_favorites
ON feed_articles (user_id, is_favorite, published_at DESC);

-- Index for read later queries
CREATE INDEX CONCURRENTLY idx_feed_articles_read_later
ON feed_articles (user_id, is_read_later, published_at DESC);

-- Index for article content search (if using full-text search)
CREATE INDEX CONCURRENTLY idx_feed_articles_content_search
ON feed_articles USING gin(to_tsvector('english', title || ' ' || description));
```

### User Article State Table
```sql
-- Index for user state lookups
CREATE INDEX CONCURRENTLY idx_user_article_state_user_article
ON user_article_state (user_id, article_id);

-- Index for read status queries
CREATE INDEX CONCURRENTLY idx_user_article_state_read
ON user_article_state (user_id, is_read, read_at DESC);
```

### Subscriptions Table
```sql
-- Index for user subscription queries
CREATE INDEX CONCURRENTLY idx_subscriptions_user_folder
ON subscriptions (user_id, folder_id)
INCLUDE (feed_id, is_favorite);
```

## Query Optimization Tips

1. **Use LIMIT and OFFSET appropriately**: The current pagination implementation is efficient
2. **Eager load relationships**: Consider using `selectinload()` or `joinedload()` for feed relationships
3. **Use database-level filtering**: Push as much filtering to the database level as possible
4. **Cache frequently accessed data**: The Redis caching implemented should help with performance

## Monitoring Queries

Use these queries to monitor performance:

```sql
-- Check slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
WHERE query LIKE '%feed_articles%'
ORDER BY mean_time DESC
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'feed_articles'
ORDER BY idx_scan DESC;
```

## Notes

- Use `CONCURRENTLY` when creating indexes in production to avoid blocking
- Monitor index size and usage after implementation
- Consider partitioning the feed_articles table by date if it grows very large
- The caching layer implemented in the application should reduce database load significantly