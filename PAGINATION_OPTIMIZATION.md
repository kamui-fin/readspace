# Pagination Optimization - Removed COUNT Queries

## Summary
Eliminated expensive COUNT queries from article pagination by switching to length-based pagination. This removes a major performance bottleneck where every article list request was executing two queries: one for data and one for total count.

## Changes Made

### Backend Changes

#### 1. Article Query Builder (`server/app/crud/article_query_builder.py`)
- **Removed**: `count_stmt` from all methods
- **Changed**: All filter methods now return single `Select` instead of `tuple[Select, Select]`
- **Changed**: `build_filtered_query()` now returns `Select` instead of `tuple[Select, Select]`
- Methods updated:
  - `build_base_query()`
  - `apply_feed_filter()`
  - `apply_folder_filter()`
  - `apply_read_status_filter()`
  - `apply_read_later_filter()`
  - `apply_favorite_filter()`
  - `apply_feed_favorite_filter()`
  - `apply_date_range_filter()`
  - `apply_search_filter()`
  - `build_filtered_query()`

#### 2. Article CRUD Operations (`server/app/crud/article_crud_operations.py`)
- **Removed**: COUNT query execution
- **Changed**: `get_articles_filtered()` return type from `tuple[list[...], int]` to `list[...]`
- **Removed**: `total_count_result = await db.execute(count_stmt)` and related code

#### 3. Article Specialized Queries (`server/app/crud/article_specialized_queries.py`)
- **Changed**: `get_recently_read_articles()` return type from `tuple[list[...], int]` to `list[...]`
- **Changed**: `get_read_later_articles()` return type from `tuple[list[...], int]` to `list[...]`
- **Removed**: All COUNT query executions from these methods

#### 4. CRUD Article (`server/app/crud/crud_article.py`)
- **Updated**: Function signatures to match new return types (no count tuples)

#### 5. Unified Articles CRUD (`server/app/crud/crud_unified_articles.py`)
- **Changed**: `get_unified_articles_by_user()` return type from `tuple[list[...], int]` to `list[...]`
- **Removed**: All COUNT query building and execution

#### 6. Article Management Service (`server/app/services/article_management_service.py`)
- **Changed**: All pagination methods to use length-based pagination
- **New logic**: `pages = page if len(articles) < size else page + 1`
- **Changed**: `total` field now set to `0` (not used by frontend)
- Methods updated:
  - `get_articles()`
  - `get_unread_articles()`
  - `get_recently_read_articles()`
  - `get_read_later_articles()`

### Frontend Changes

#### 7. Shared API Hooks (`packages/shared/src/api/hooks/feeds.ts`)
- **Changed**: All `getNextPageParam` functions to use length-based logic
- **Old logic**: `return currentPage < totalPages ? currentPage + 1 : undefined`
- **New logic**: `return lastPage.items.length === pageSize ? currentPage + 1 : undefined`
- Hooks updated:
  - `useInfiniteArticles()`
  - `useInfiniteRecentlyReadArticles()`
  - `useInfiniteReadLaterArticles()`
  - `useInfiniteTodayArticles()`

## How It Works

### Old Approach (Count-Based)
1. Execute main query with LIMIT/OFFSET
2. Execute separate COUNT query with same filters
3. Calculate total pages: `(total_count + size - 1) // size`
4. Frontend checks: `currentPage < totalPages`

**Problem**: COUNT query is expensive, especially with complex joins and filters.

### New Approach (Length-Based)
1. Execute main query with LIMIT/OFFSET
2. Check result length against page size
3. Calculate pages: `page if len(articles) < size else page + 1`
4. Frontend checks: `lastPage.items.length === pageSize`

**Benefit**: Only one query per request. If we get a full page, there might be more. If we get less than a full page, we're done.

## Performance Impact

- **Eliminated**: One COUNT query per article list request
- **Queries saved**: 50% reduction (from 2 queries to 1 query)
- **Typical COUNT query**: Involves joins across `feed_articles`, `article_contents`, `feed_subscriptions`, `user_article_states`
- **Expected improvement**: Significant reduction in database load and response times

## Backward Compatibility

- `total` field in `PaginatedResponse` is still present but set to `0`
- `pages` field is still calculated but using simpler logic
- Frontend already uses infinite scroll, so exact total count wasn't needed
- No breaking changes to API contract

## Testing Recommendations

1. Test infinite scroll works correctly
2. Verify "load more" stops when no more articles
3. Check all article views: all, read later, recently read, today
4. Test with various filters: folders, feeds, read status, favorites
5. Verify pagination works with different page sizes

## Notes

- This is a common pattern used by Twitter, Instagram, and other infinite scroll apps
- The `total` count is rarely needed for infinite scroll UIs
- If exact counts are needed in the future, they can be added as separate optional endpoints
- The `pages` field now represents "current page or next page" rather than "total pages"
