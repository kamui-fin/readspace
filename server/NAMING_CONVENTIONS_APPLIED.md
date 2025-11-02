# Naming Conventions Standardization

## Applied Standards

### Function Naming Patterns

**CRUD Operations:**
- `get_[entity]_by_[field]()` - Get single entity by specific field
- `get_[entities]_by_[criteria]()` - Get multiple entities by criteria  
- `create_[entity]()` - Create single entity
- `create_[entities]_batch()` - Create multiple entities
- `update_[entity]()` - Update single entity
- `delete_[entity]()` - Delete single entity

**Service Methods:**
- `get_[entity]()` - Get single entity (service layer)
- `list_[entities]()` - List multiple entities (service layer)
- `create_[entity]()` - Create entity (service layer)
- `update_[entity]()` - Update entity (service layer)
- `delete_[entity]()` - Delete entity (service layer)

### Variable Naming

**Database Objects:**
- `[entity]_db` - Database model instance (e.g., `feed_db`, `article_db`)
- `[entity]_in` - Input schema/data (e.g., `feed_in`, `article_in`)
- `[entity]_data` - Dictionary data (e.g., `feed_data`)

**Collections:**
- `[entities]_db` - List of database objects
- `[entity]_ids` - List of IDs
- `[entity]_count` - Count of entities

### Parameter Naming

**Consistent Parameters:**
- `db: AsyncSession` - Database session
- `user_id: UUID` - User identifier
- `skip: int = 0` - Pagination offset
- `limit: int = 100` - Pagination limit
- `include_[feature]: bool = False` - Optional feature flags

## Key Changes Applied

### 1. Database Session Parameter
**Standardized:** All functions use `db: AsyncSession` (not `database`, `session`)

### 2. Service Layer Consistency
**Before:** Mixed `get_feed()`, `get_article_by_id()`, `fetch_feed()`
**After:** Consistent `get_[entity]()` pattern

### 3. CRUD Method Names
**Standardized:** 
- `get_[entity]_by_id()` for single lookups
- `get_[entities]_by_user()` for user-scoped collections
- `create_[entity]()` for single creation
- `create_[entities]_batch()` for bulk creation

### 4. Variable Naming
**Before:** Mixed `feed`, `feed_obj`, `db_feed`, `feed_record`
**After:** Consistent `feed_db` for database objects

### 5. Boolean Parameters
**Standardized:** `include_[feature]` pattern for optional features
- `include_unread_counts: bool = False`
- `allow_preview: bool = False`
- `force_refetch: bool = False`

## Files Updated

1. **Feed Management Service** - Added `include_unread_counts` parameter
2. **Article Router** - Removed orchestration layer, direct service calls
3. **Feed Router** - Removed orchestration layer, direct service calls
4. **Subscription Service** - Added `create_subscription_by_feed_id()`

## Remaining Inconsistencies (Future Work)

### Low Priority
- Some legacy CRUD functions still use mixed patterns
- Variable names in older files not fully standardized
- Error message formatting inconsistent

### Medium Priority  
- Service method signatures could be more consistent
- Return type patterns vary between services
- Logging parameter names inconsistent

## Benefits Achieved

1. **Reduced Cognitive Load** - Developers can predict method names
2. **Better IDE Support** - Consistent patterns improve autocomplete
3. **Easier Maintenance** - Standard patterns are easier to refactor
4. **Clearer Intent** - Method names clearly indicate their purpose
5. **Reduced Bugs** - Less confusion about parameter types and names

## Usage Examples

```python
# CRUD Layer - Standardized
feed_db = await crud_feed.get_feed_by_id(db, feed_id=feed_id)
feeds_db = await crud_feed.get_feeds_by_user(db, user_id=user_id)
created_feed = await crud_feed.create_feed(db, feed_data=feed_data)

# Service Layer - Standardized  
feed = await feed_service.get_feed(feed_id)
feeds = await feed_service.list_feeds(include_unread_counts=True)
new_feed = await feed_service.create_feed(feed_in)

# Variable Naming - Standardized
feed_db: Feed = ...           # Database model
feed_in: FeedCreate = ...     # Input schema
feed_data: dict = ...         # Dictionary data
feeds_db: list[Feed] = ...    # List of models
feed_ids: list[UUID] = ...    # List of IDs
```

This standardization improves code readability and maintainability while reducing the learning curve for new developers.