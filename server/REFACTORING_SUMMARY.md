# Feed and Subscription Query Refactoring Summary

## Changes Made

### 1. Separated Concerns in CRUD Layer

**Before:** `crud/feed/core.py` mixed database operations with Redis caching and Meilisearch syncing.

**After:** 
- `crud/feed/core.py` - Pure SQL operations only
- `services/feeds/feed_cache_service.py` - New service layer handling caching and search syncing

### 2. Simplified CRUD Functions

#### `crud/feed/core.py`
- `get_feed_by_url()` - Now takes `normalized_url` parameter. Caller must normalize URLs.
- `create_feed()` - No longer handles existence checks, caching, or search syncing.
- `update_feed()` - New function for updating feeds.

#### `crud/feed/subscription.py`
- `get_subscription_by_feed_url()` - Simplified to single strict lookup. No nested functions or protocol variations.
- `get_subscriptions_by_user()` - Now serves as the unified query (replaces `get_feeds_by_user` from core.py).
- `get_initial_cutoff_timestamp()` - Added TODO comment for future optimization with denormalized `published_at` column.

### 3. New Service Layer

#### `services/feeds/feed_cache_service.py`
New `FeedCacheService` class handles:
- Redis caching for feed URL lookups
- Protocol variation handling (http vs https)
- Meilisearch syncing (fire-and-forget)
- URL normalization
- Feed URL migrations (redirects)

**Key Methods:**
- `get_feed_by_url(url)` - Get feed with caching and protocol variation handling
- `get_or_create_feed(url, feed_data)` - Get or create with full caching/search integration
- `update_feed_url(feed, new_url)` - Update URL with cache invalidation
- `invalidate_cache(url)` - Manual cache invalidation

### 4. Updated URL Handling

#### `crud/feed/url_handling.py`
- `get_or_migrate_feed()` - Now uses `FeedCacheService` instead of direct CRUD calls
- Removed Redis and Meilisearch imports (handled by service layer)

## Migration Guide for Existing Code

### If you were calling `crud_feed.get_feed_by_url()`:

**Old way (with caching):**
```python
from app.crud import crud_feed
feed = await crud_feed.get_feed_by_url(db, url=user_provided_url)
```

**New way (with caching):**
```python
from app.services.feeds.feed_cache_service import FeedCacheService

feed_service = FeedCacheService(db)
feed = await feed_service.get_feed_by_url(user_provided_url)
```

**New way (without caching - pure SQL):**
```python
from app.crud.feed.core import get_feed_by_url
from app.crud.feed.url_handling import normalize_feed_url

normalized_url = normalize_feed_url(user_provided_url)
feed = await get_feed_by_url(db, normalized_url=normalized_url)
```

### If you were calling `crud_feed.create_feed()`:

**Old way:**
```python
from app.crud import crud_feed
feed = await crud_feed.create_feed(db, feed_data=feed_base)
```

**New way (with caching and search syncing):**
```python
from app.services.feeds.feed_cache_service import FeedCacheService

feed_service = FeedCacheService(db)
feed = await feed_service.get_or_create_feed(url, feed_data=feed_base)
```

**New way (pure SQL, no caching):**
```python
from app.crud.feed.core import create_feed

feed = await create_feed(db, feed_data=feed_base)
```

### If you were calling `get_feeds_by_user()`:

**Old way:**
```python
from app.crud import crud_feed
feeds = await crud_feed.get_feeds_by_user(db, user_id=user_id, folder_id=folder_id)
# Returns: list[tuple[Feed, FeedSubscription]]
```

**New way:**
```python
from app.crud.feed.subscription import get_subscriptions_by_user

subscriptions = await get_subscriptions_by_user(db, user_id=user_id, folder_id=folder_id)
# Returns: list[FeedSubscription]
# Access feed via: subscription.feed
```

## Benefits

1. **Single Responsibility**: CRUD functions only handle SQL, services handle business logic
2. **Testability**: Can test SQL operations without mocking Redis/Meilisearch
3. **Flexibility**: Can choose to use caching or not depending on use case
4. **Performance**: Unified subscription query is more efficient
5. **Maintainability**: Clear separation of concerns

## Future Optimizations

### Denormalize `published_at` in `feed_articles` table
Currently `get_initial_cutoff_timestamp()` joins `ArticleContent` to get `published_at`. 
Adding this column to `feed_articles` would make this an index-only scan (100x faster for large feeds).

**Migration:**
```sql
ALTER TABLE feed_articles ADD COLUMN published_at TIMESTAMP WITH TIME ZONE;
UPDATE feed_articles fa 
SET published_at = ac.published_at 
FROM article_contents ac 
WHERE fa.content_id = ac.id;
CREATE INDEX idx_feed_articles_published_at ON feed_articles(feed_id, published_at DESC);
```

**Updated query:**
```python
result = await db.execute(
    select(FeedArticle.published_at)
    .where(FeedArticle.feed_id == feed_id)
    .order_by(FeedArticle.published_at.desc())
    .offset(initial_unread_count)
    .limit(1)
)
```

## Files Modified

- `server/app/crud/feed/core.py` - Stripped to pure SQL
- `server/app/crud/feed/subscription.py` - Simplified URL lookups, unified queries
- `server/app/crud/feed/url_handling.py` - Now uses service layer
- `server/app/services/feeds/feed_cache_service.py` - NEW: Service layer for caching/search
- `server/app/crud/feed/__init__.py` - Kept empty (no re-exports)

## Breaking Changes

None for existing API endpoints. All changes are internal to CRUD/service layers.
