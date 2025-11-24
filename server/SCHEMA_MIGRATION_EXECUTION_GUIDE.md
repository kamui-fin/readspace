# Schema Migration Execution Guide

## Overview

This guide covers the execution of the comprehensive schema refactoring migration that:
- Unifies `clipped_articles` and `user_article_states` into `user_entries`
- Denormalizes `published_at` to `feed_articles` for performance
- Uses SHA-256 hashes for content and GUID deduplication
- Removes `updated_at` from immutable tables

**Migration File**: `20251123_210000_schema_unification_and_optimization.py`

## Pre-Migration Checklist

### 1. Backup Your Database
```bash
# Create a full database backup
pg_dump -h localhost -U your_user -d readspace > backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql

# Or use your cloud provider's backup tool
```

### 2. Verify Current State
```bash
# Check current migration head
cd server
alembic current

# Should show: 449f9b660af6 (optimize_unread_count_indexes)
```

### 3. Estimate Migration Time
The migration involves:
- Hash calculation for all articles and feed items
- Data migration from 2 tables to 1 new table
- Index creation

**Estimated time**: 
- 10k articles: ~30 seconds
- 100k articles: ~3-5 minutes
- 1M articles: ~20-30 minutes

### 4. Plan Downtime Window
This migration requires application downtime because:
- Table structure changes significantly
- Application code must be updated simultaneously
- No backward compatibility during transition

## Migration Steps

### Step 1: Stop Application Services
```bash
# Stop web servers
docker-compose stop web

# Stop background workers
docker-compose stop taskiq

# Verify no active connections
psql -h localhost -U your_user -d readspace -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'readspace';"
```

### Step 2: Run Migration
```bash
cd server

# Dry run (optional - shows SQL that will be executed)
alembic upgrade 7f8a9b1c2d3e --sql

# Execute migration
alembic upgrade head

# Expected output:
# INFO  [alembic.runtime.migration] Running upgrade 449f9b660af6 -> 7f8a9b1c2d3e, schema_unification_and_optimization
# Adding content_hash to article_contents...
# Adding published_at and guid_hash to feed_articles...
# Creating user_entries table...
# Migrating data from user_article_states...
# Migrating data from clipped_articles...
# Dropping legacy tables...
# Removing updated_at from immutable tables...
# Migration complete!
```

### Step 3: Verify Migration Success
```bash
# Check migration status
alembic current
# Should show: 7f8a9b1c2d3e (schema_unification_and_optimization)

# Verify new table exists
psql -h localhost -U your_user -d readspace -c "\d user_entries"

# Verify data migration
psql -h localhost -U your_user -d readspace -c "SELECT COUNT(*) FROM user_entries;"

# Verify old tables are gone
psql -h localhost -U your_user -d readspace -c "\dt" | grep -E "(clipped_articles|user_article_states)"
# Should return nothing
```

### Step 4: Update Application Code

The following code changes are REQUIRED before restarting services:

#### A. Update Model Definitions

**File**: `server/app/models/article.py`

```python
# REMOVE these classes:
# - ClippedArticle
# - UserArticleState

# ADD new class:
class UserEntry(Base):
    __tablename__ = "user_entries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    content_id = Column(UUID(as_uuid=True), ForeignKey("article_contents.id", ondelete="CASCADE"), nullable=False)
    feed_article_id = Column(UUID(as_uuid=True), ForeignKey("feed_articles.id", ondelete="CASCADE"), nullable=True)
    
    # State flags
    is_read = Column(Boolean, nullable=False, server_default="false")
    is_read_later = Column(Boolean, nullable=False, server_default="false")
    is_favorite = Column(Boolean, nullable=False, server_default="false")
    is_archived = Column(Boolean, nullable=False, server_default="false")
    
    # Metadata
    read_at = Column(TIMESTAMP(timezone=True), nullable=True)
    user_note = Column(Text, nullable=True)
    user_tags = Column(ARRAY(String), nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False)
    
    # Relationships
    user = relationship("Profile", back_populates="entries")
    content = relationship("ArticleContent", back_populates="user_entries")
    feed_article = relationship("FeedArticle", back_populates="user_entries")

# UPDATE ArticleContent model:
class ArticleContent(Base):
    __tablename__ = "article_contents"
    
    # ADD:
    content_hash = Column(CHAR(64), nullable=False, unique=True)
    
    # REMOVE:
    # updated_at = Column(...)  # Delete this line

# UPDATE FeedArticle model:
class FeedArticle(Base):
    __tablename__ = "feed_articles"
    
    # ADD:
    published_at = Column(TIMESTAMP(timezone=True), nullable=False)
    guid_hash = Column(CHAR(64), nullable=False)
    
    # REMOVE:
    # updated_at = Column(...)  # Delete this line
```

#### B. Update CRUD Operations

**File**: `server/app/crud/article/operations.py` (or similar)

```python
from app.utils.content_hash import get_content_hash, get_guid_hash

# When creating articles:
def create_article_content(db: Session, link: str, **kwargs):
    content_hash = get_content_hash(link)
    
    # Check for existing by hash
    existing = db.query(ArticleContent).filter_by(content_hash=content_hash).first()
    if existing:
        return existing
    
    article = ArticleContent(
        link=link,
        content_hash=content_hash,
        **kwargs
    )
    db.add(article)
    return article

# When creating feed articles:
def create_feed_article(db: Session, feed_id: UUID, guid: str, content_id: UUID, published_at: datetime):
    guid_hash = get_guid_hash(guid, fallback_link=None)  # Or pass link as fallback
    
    article = FeedArticle(
        feed_id=feed_id,
        content_id=content_id,
        guid=guid,
        guid_hash=guid_hash,
        published_at=published_at
    )
    db.add(article)
    return article
```

#### C. Update Query Builders

**DELETE**: `server/app/crud/article/unified_query_builder.py` (if exists)

**UPDATE**: Feed article queries to use denormalized `published_at`:

```python
# OLD (with join):
query = (
    db.query(FeedArticle)
    .join(ArticleContent)
    .order_by(ArticleContent.published_at.desc())
)

# NEW (no join needed):
query = (
    db.query(FeedArticle)
    .order_by(FeedArticle.published_at.desc())
)
```

#### D. Update User State Queries

Replace all queries to `clipped_articles` and `user_article_states` with `user_entries`:

```python
# Get user's read later articles
read_later = (
    db.query(UserEntry)
    .filter(
        UserEntry.user_id == user_id,
        UserEntry.is_read_later == True
    )
    .order_by(UserEntry.created_at.desc())
    .all()
)

# Mark article as read
entry = db.query(UserEntry).filter_by(
    user_id=user_id,
    content_id=content_id
).first()

if entry:
    entry.is_read = True
    entry.read_at = datetime.utcnow()
else:
    entry = UserEntry(
        user_id=user_id,
        content_id=content_id,
        is_read=True,
        read_at=datetime.utcnow()
    )
    db.add(entry)
```

### Step 5: Deploy Updated Code
```bash
# Build new images with updated code
docker-compose build

# Or pull updated images if using CI/CD
docker-compose pull
```

### Step 6: Restart Services
```bash
# Start services
docker-compose up -d

# Check logs for errors
docker-compose logs -f web
docker-compose logs -f taskiq

# Verify health
curl http://localhost:8000/health
```

### Step 7: Smoke Tests
```bash
# Test article listing
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/articles

# Test marking as read
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/articles/{article_id}/read

# Test read later
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/articles/read-later

# Test feed refresh
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/feeds/{feed_id}/refresh
```

## Rollback Procedure

If issues occur, you can rollback:

```bash
# Stop services
docker-compose stop

# Rollback migration
cd server
alembic downgrade 449f9b660af6

# Restore old application code
git checkout <previous-commit>
docker-compose build

# Restart services
docker-compose up -d
```

**Note**: Rollback will restore old tables, but any NEW data created after migration will be lost.

## Performance Validation

After migration, verify performance improvements:

```sql
-- Test feed article listing (should be fast, index-only scan)
EXPLAIN ANALYZE
SELECT id, guid, published_at
FROM feed_articles
WHERE feed_id = 'some-uuid'
ORDER BY published_at DESC
LIMIT 20;

-- Should show: Index Only Scan using idx_feed_articles_feed_published

-- Test content deduplication (should use hash index)
EXPLAIN ANALYZE
SELECT id FROM article_contents
WHERE content_hash = encode(digest('https://example.com', 'sha256'), 'hex');

-- Should show: Index Scan using uq_article_contents_hash
```

## Troubleshooting

### Migration Fails During Hash Generation
```bash
# Check if pgcrypto is available
psql -c "SELECT digest('test', 'sha256');"

# If not, install it manually
psql -c "CREATE EXTENSION pgcrypto;"
```

### Data Migration Fails
```bash
# Check for orphaned records
psql -c "SELECT COUNT(*) FROM user_article_states uas 
         LEFT JOIN feed_articles fa ON uas.article_id = fa.id 
         WHERE fa.id IS NULL;"

# Clean up orphans before retrying
psql -c "DELETE FROM user_article_states WHERE article_id NOT IN (SELECT id FROM feed_articles);"
```

### Application Errors After Migration
Check logs for common issues:
- `relation "clipped_articles" does not exist` → Code not updated
- `column "updated_at" does not exist` → Model definitions not updated
- `column "content_hash" does not exist` → Migration didn't complete

## Post-Migration Cleanup

After 1-2 weeks of stable operation:

```bash
# Vacuum tables to reclaim space
psql -c "VACUUM FULL article_contents;"
psql -c "VACUUM FULL feed_articles;"
psql -c "VACUUM FULL user_entries;"

# Analyze tables for query planner
psql -c "ANALYZE article_contents;"
psql -c "ANALYZE feed_articles;"
psql -c "ANALYZE user_entries;"
```

## Success Criteria

Migration is successful when:
- ✅ All tests pass
- ✅ No errors in application logs
- ✅ Feed listing queries < 50ms (for 100k articles)
- ✅ Article deduplication works correctly
- ✅ User read states preserved
- ✅ No data loss reported by users
