# Code Changes Checklist for Schema Migration

This checklist covers all code changes needed after running the schema migration.

## ✅ Files to Update

### 1. Models (`server/app/models/article.py`)

#### Remove These Classes:
```python
# DELETE entire class definitions:
class ClippedArticle(Base):
    ...

class UserArticleState(Base):
    ...
```

#### Add New Class:
```python
class UserEntry(Base):
    """Unified table for all user-article interactions."""
    __tablename__ = "user_entries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    content_id = Column(UUID(as_uuid=True), ForeignKey("article_contents.id", ondelete="CASCADE"), nullable=False)
    feed_article_id = Column(UUID(as_uuid=True), ForeignKey("feed_articles.id", ondelete="CASCADE"), nullable=True)
    
    is_read = Column(Boolean, nullable=False, server_default="false")
    is_read_later = Column(Boolean, nullable=False, server_default="false")
    is_favorite = Column(Boolean, nullable=False, server_default="false")
    is_archived = Column(Boolean, nullable=False, server_default="false")
    
    read_at = Column(TIMESTAMP(timezone=True), nullable=True)
    user_note = Column(Text, nullable=True)
    user_tags = Column(ARRAY(String), nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"), nullable=False)
```

#### Update ArticleContent:
```python
class ArticleContent(Base):
    __tablename__ = "article_contents"
    
    # ADD this field:
    content_hash = Column(CHAR(64), nullable=False, unique=True, index=True)
    
    # REMOVE this field:
    # updated_at = Column(...)  ← DELETE THIS LINE
```

#### Update FeedArticle:
```python
class FeedArticle(Base):
    __tablename__ = "feed_articles"
    
    # ADD these fields:
    published_at = Column(TIMESTAMP(timezone=True), nullable=False, index=True)
    guid_hash = Column(CHAR(64), nullable=False)
    
    # REMOVE this field:
    # updated_at = Column(...)  ← DELETE THIS LINE
```

### 2. Hash Utilities (`server/app/utils/content_hash.py`)

✅ Already updated with:
- `get_content_hash(url: str) -> str`
- `get_guid_hash(guid: str, fallback_link: str | None) -> str`

### 3. CRUD Operations

#### Article Creation (`server/app/crud/article/*.py`)

**Before:**
```python
def create_article(db: Session, link: str, **kwargs):
    # Check existing by link
    existing = db.query(ArticleContent).filter_by(link=link).first()
    if existing:
        return existing
    
    article = ArticleContent(link=link, **kwargs)
    db.add(article)
    return article
```

**After:**
```python
from app.utils.content_hash import get_content_hash

def create_article(db: Session, link: str, **kwargs):
    content_hash = get_content_hash(link)
    
    # Check existing by hash (faster!)
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
```

#### Feed Article Creation

**Before:**
```python
def create_feed_article(db: Session, feed_id: UUID, guid: str, content_id: UUID):
    article = FeedArticle(
        feed_id=feed_id,
        content_id=content_id,
        guid=guid
    )
    db.add(article)
    return article
```

**After:**
```python
from app.utils.content_hash import get_guid_hash
from datetime import datetime

def create_feed_article(
    db: Session, 
    feed_id: UUID, 
    guid: str, 
    content_id: UUID,
    published_at: datetime,  # NEW: Required parameter
    link: str  # NEW: For fallback
):
    guid_hash = get_guid_hash(guid, fallback_link=link)
    
    article = FeedArticle(
        feed_id=feed_id,
        content_id=content_id,
        guid=guid,
        guid_hash=guid_hash,  # NEW
        published_at=published_at  # NEW
    )
    db.add(article)
    return article
```

### 4. Query Builders

#### Feed Article Queries

**Before (slow - requires join):**
```python
def get_feed_articles(db: Session, feed_id: UUID, limit: int = 20):
    return (
        db.query(FeedArticle)
        .join(ArticleContent)  # ← Expensive join!
        .filter(FeedArticle.feed_id == feed_id)
        .order_by(ArticleContent.published_at.desc())  # ← Join required
        .limit(limit)
        .all()
    )
```

**After (fast - no join needed):**
```python
def get_feed_articles(db: Session, feed_id: UUID, limit: int = 20):
    return (
        db.query(FeedArticle)
        # No join needed!
        .filter(FeedArticle.feed_id == feed_id)
        .order_by(FeedArticle.published_at.desc())  # ← Direct column access
        .limit(limit)
        .all()
    )
```

### 5. User State Operations

#### Replace All Clipped/State Queries

**Before:**
```python
# Clipped articles
clipped = db.query(ClippedArticle).filter_by(user_id=user_id).all()

# User states
states = db.query(UserArticleState).filter_by(user_id=user_id).all()

# Combined query (complex!)
from app.crud.article.unified_query_builder import get_unified_articles
articles = get_unified_articles(db, user_id)
```

**After:**
```python
# Single unified query
entries = db.query(UserEntry).filter_by(user_id=user_id).all()

# Read later
read_later = (
    db.query(UserEntry)
    .filter(UserEntry.user_id == user_id, UserEntry.is_read_later == True)
    .all()
)

# Favorites
favorites = (
    db.query(UserEntry)
    .filter(UserEntry.user_id == user_id, UserEntry.is_favorite == True)
    .all()
)
```

#### Mark as Read

**Before:**
```python
state = db.query(UserArticleState).filter_by(
    user_id=user_id,
    article_id=article_id
).first()

if state:
    state.is_read = True
    state.read_at = datetime.utcnow()
else:
    state = UserArticleState(
        user_id=user_id,
        article_id=article_id,
        is_read=True,
        read_at=datetime.utcnow()
    )
    db.add(state)
```

**After:**
```python
entry = db.query(UserEntry).filter_by(
    user_id=user_id,
    content_id=content_id  # Note: content_id, not article_id
).first()

if entry:
    entry.is_read = True
    entry.read_at = datetime.utcnow()
else:
    entry = UserEntry(
        user_id=user_id,
        content_id=content_id,
        feed_article_id=feed_article_id,  # Optional: link to feed article
        is_read=True,
        read_at=datetime.utcnow()
    )
    db.add(entry)
```

### 6. Files to Delete

```bash
# Delete these files entirely:
rm server/app/crud/article/unified_query_builder.py
rm server/app/crud/article/clipped_articles.py  # If exists
rm server/app/crud/article/user_article_states.py  # If exists
```

### 7. Schema Exports (Pydantic)

Update `server/app/schemas/articles.py`:

**Remove:**
```python
class ClippedArticleResponse(BaseModel):
    ...

class UserArticleStateResponse(BaseModel):
    ...
```

**Add:**
```python
class UserEntryResponse(BaseModel):
    id: UUID
    user_id: UUID
    content_id: UUID
    feed_article_id: UUID | None
    
    is_read: bool
    is_read_later: bool
    is_favorite: bool
    is_archived: bool
    
    read_at: datetime | None
    user_note: str | None
    user_tags: list[str] | None
    
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
```

### 8. API Endpoints

Update any endpoints that reference old models:

**Before:**
```python
@router.post("/articles/{article_id}/clip")
def clip_article(article_id: UUID, db: Session = Depends(get_db)):
    clipped = ClippedArticle(...)
    db.add(clipped)
    return clipped
```

**After:**
```python
@router.post("/articles/{article_id}/clip")
def clip_article(article_id: UUID, db: Session = Depends(get_db)):
    # Get content_id from article_id
    article = db.query(FeedArticle).filter_by(id=article_id).first()
    
    entry = UserEntry(
        user_id=current_user.id,
        content_id=article.content_id,
        feed_article_id=article_id,
        is_read_later=True
    )
    db.add(entry)
    return entry
```

## 🔍 Search & Replace Patterns

Use these patterns to find code that needs updating:

```bash
# Find ClippedArticle references
grep -r "ClippedArticle" server/app/

# Find UserArticleState references
grep -r "UserArticleState" server/app/

# Find updated_at on article tables
grep -r "ArticleContent.*updated_at" server/app/
grep -r "FeedArticle.*updated_at" server/app/

# Find direct link comparisons (should use hash)
grep -r "filter.*link.*=" server/app/crud/article/
```

## ✅ Testing Checklist

After making changes, test:

- [ ] Article creation (deduplication works)
- [ ] Feed refresh (no duplicate articles)
- [ ] Mark as read
- [ ] Mark as read later
- [ ] Mark as favorite
- [ ] Get user's read later list
- [ ] Get user's favorites
- [ ] Feed article listing (performance)
- [ ] Unread count calculation

## 🚀 Deployment Order

1. Run migration (downtime starts)
2. Deploy updated code
3. Restart services (downtime ends)
4. Run smoke tests
5. Monitor logs for errors

**Total downtime**: ~5-10 minutes for typical deployments
