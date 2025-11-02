# REST API Naming Convention Standard

## Overview
This document defines the REST API naming conventions for the Readspace backend to ensure consistency, maintainability, and adherence to REST best practices.

## Core Principles

### 1. Use Nouns, Not Verbs
- ❌ `/articles/save` - uses verb in URL
- ✅ `/articles` with POST method - resource-oriented
- ❌ `/feeds/refresh_all` - uses verb
- ✅ `/feeds/refresh` with POST method - action as sub-resource

### 2. Use Hyphens for Multi-Word Resources
- ❌ `refresh_all`, `recently_read`, `read_later`, `unread_counts` - snake_case
- ✅ `refresh-all`, `recently-read`, `read-later`, `unread-counts` - kebab-case

### 3. Use Plural Nouns for Collections
- ✅ `/feeds` - collection of feeds
- ✅ `/articles` - collection of articles
- ✅ `/folders` - collection of folders

### 4. Use Nested Resources for Relationships
- ✅ `/feeds/{feed_id}/subscribe` - action on specific feed
- ✅ `/feeds/{feed_id}/refresh` - action on specific feed
- ✅ `/articles/{article_id}` - specific article

### 5. Use HTTP Methods Correctly
- GET - Retrieve resources
- POST - Create new resources or trigger actions
- PUT - Update entire resources
- PATCH - Partial updates (not currently used)
- DELETE - Remove resources

## Standardized Naming Patterns

### Collections and Resources
```
GET    /resources              - List all resources
POST   /resources              - Create new resource
GET    /resources/{id}         - Get specific resource
PUT    /resources/{id}         - Update specific resource
DELETE /resources/{id}         - Delete specific resource
```

### Sub-resources and Actions
```
POST   /resources/{id}/action  - Trigger action on resource
GET    /resources/{id}/status  - Get status of resource
```

### Special Views/Filters
```
GET    /resources/filter-name  - Special filtered view
Example: /articles/today, /articles/recently-read
```

## Identified Inconsistencies

### Feeds Router (`/feeds`)

| Current | Issue | Standard | Change Type |
|---------|-------|----------|-------------|
| `POST /{feed_id}/subscribe` | Verb in path | `POST /subscriptions` with `{feed_id: ...}` | Major - semantic change |
| `POST /` | Dual purpose (create feed + subscribe) | Keep as is, consider splitting | Design decision |
| `POST /refresh_all` | Underscore, verb | `POST /refresh` or `/feeds/refresh` | Minor |
| `POST /{feed_id}/refresh` | Acceptable | Keep as is | - |
| `GET /refresh_status/{task_id}` | Underscore | `GET /refresh-status/{task_id}` | Minor |
| `POST /bulk-delete` | Verb in path | `DELETE /` with `{feed_ids: [...]}` | Major |
| `POST /bulk-update-folder` | Verb in path | `PUT /folder` with `{feed_ids: [...], folder_id: ...}` | Major |

### Articles Router (`/articles`)

| Current | Issue | Standard | Change Type |
|---------|-------|----------|-------------|
| `POST /save` | Verb in path | `POST /` | Major |
| `GET /recently_read` | Underscore | `GET /recently-read` | Minor |
| `GET /read_later` | Underscore | `GET /read-later` | Minor |
| `GET /unread_counts` | Underscore | `GET /unread-counts` | Minor |
| `GET /check-saved` | Verb in path | `GET /by-url?url=...` or keep | Design decision |

### Other Routers
- Folders router: Already follows conventions
- OPML router: Mostly follows conventions
- Discover router: Mostly follows conventions

## Migration Strategy

### Phase 1: Low-Risk Changes (Hyphenation)
Changes that only affect path casing (snake_case to kebab-case):
1. `refresh_all` → `refresh-all`
2. `refresh_status` → `refresh-status`
3. `recently_read` → `recently-read`
4. `read_later` → `read-later`
5. `unread_counts` → `unread-counts`
6. `check-saved` → already uses hyphens ✓

### Phase 2: Moderate Changes (Path Restructuring)
Changes that restructure paths but maintain semantics:
1. `/articles/save` → `/articles` (POST)

### Phase 3: Major Changes (Semantic Changes)
Changes that alter the resource model:
1. `POST /{feed_id}/subscribe` → `POST /subscriptions`
2. `POST /bulk-delete` → `DELETE /feeds` with body
3. `POST /bulk-update-folder` → `PATCH /feeds` with body

## Backward Compatibility Approach

### Option 1: Immediate Breaking Change
- Update all endpoints at once
- Update frontend immediately
- Version bump (v2 API)
- Document in changelog

### Option 2: Deprecation Period
- Support both old and new endpoints
- Add deprecation warnings to old endpoints
- Give 3-6 month notice
- Remove old endpoints in next major version

### Option 3: Gradual Migration
- Implement new endpoints
- Keep old endpoints as aliases
- Update frontend incrementally
- Eventually remove old endpoints

## Recommended Approach: Option 1 (Immediate Change)

**Rationale:**
- API is not yet public/stable
- Easier to maintain one set of endpoints
- Clean break, no technical debt
- Frontend and backend in same monorepo

## Implementation Plan

### Step 1: Update Backend Endpoints
```python
# feeds.py changes
@router.post("/refresh")  # was /refresh_all
@router.get("/refresh-status/{task_id}")  # was /refresh_status/{task_id}
@router.delete("/")  # was POST /bulk-delete, now DELETE with body
@router.patch("/folder")  # was POST /bulk-update-folder

# articles.py changes
@router.post("/")  # was /save
@router.get("/recently-read")  # was /recently_read
@router.get("/read-later")  # was /read_later
@router.get("/unread-counts")  # was /unread_counts (keep for now)
```

### Step 2: Update API Client
Update `/packages/shared/src/api/client.ts`:
```typescript
// Old
saveArticle: (data) => this.post("/api/rss/articles/save", data)
refreshAllFeeds: () => this.post("/api/rss/feeds/refresh_all")

// New
saveArticle: (data) => this.post("/api/rss/articles", data)
refreshAllFeeds: () => this.post("/api/rss/feeds/refresh")
```

### Step 3: Update Tests
- Find all tests using old endpoint names
- Update test URLs
- Verify all tests pass

### Step 4: Update Documentation
- Update OpenAPI/Swagger docs
- Update README examples
- Update any API documentation

## Response Model Consistency

### Issue: Dual Response Models
Current state:
- `LegacyFeedResponse` - used for POST /feeds/
- `FeedResponse` - used for other endpoints
- `SubscriptionResponse` - used for POST /{feed_id}/subscribe

**Resolution:**
- Standardize on `FeedResponse` for all feed endpoints
- Remove `LegacyFeedResponse` after migration
- Use `SubscriptionResponse` only for subscription-specific endpoints

## Final Endpoint Structure

### Feeds
```
POST   /feeds                      - Create feed + subscribe (returns FeedResponse)
GET    /feeds                      - List user's subscribed feeds
GET    /feeds/trending             - Get trending feeds
GET    /feeds/{feed_id}            - Get specific feed
PUT    /feeds/{feed_id}            - Update feed settings
DELETE /feeds/{feed_id}            - Unsubscribe from feed
POST   /feeds/{feed_id}/refresh    - Refresh specific feed
POST   /feeds/{feed_id}/subscribe  - Subscribe to existing feed
POST   /feeds/refresh              - Refresh all user's feeds
GET    /feeds/refresh-status/{id}  - Get refresh task status
DELETE /feeds                      - Bulk unsubscribe (body: feed_ids)
PATCH  /feeds/folder               - Bulk move to folder (body: feed_ids, folder_id)
PUT    /feeds/{feed_id}/admin      - Admin: Update global feed
DELETE /feeds/{feed_id}/admin      - Admin: Delete global feed
```

### Articles
```
POST   /articles                   - Save web article
GET    /articles                   - List articles with filters
GET    /articles/today             - Today's articles
GET    /articles/recently-read     - Recently read articles
GET    /articles/read-later        - Read later articles
GET    /articles/unread-counts     - Get unread counts
GET    /articles/check-saved       - Check if URL is saved
GET    /articles/{article_id}      - Get specific article
PUT    /articles/{article_id}      - Update article status
```

### Folders
```
POST   /folders                    - Create folder
GET    /folders                    - List folders
GET    /folders/{folder_id}        - Get specific folder
PUT    /folders/{folder_id}        - Update folder
DELETE /folders/{folder_id}        - Delete folder
```

## Summary of Changes

### Minor Changes (URL only)
- 5 endpoints need hyphenation fixes

### Major Changes (Semantics)
- 3 endpoints need restructuring for proper REST compliance

### Total Affected Files
- Backend: 2 router files (feeds.py, articles.py)
- Frontend: 1 API client file (client.ts)
- Frontend: 1 hooks file (feeds.ts)
- Tests: ~15-20 test files

### Estimated Effort
- Backend changes: 2-3 hours
- Frontend changes: 1-2 hours
- Testing: 2-3 hours
- Total: 5-8 hours
