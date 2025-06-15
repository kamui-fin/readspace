from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import UUID

from sqlalchemy import asc, desc, func, or_, select, update, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.base import CRUDBase
from app.models.rss_models import Article, ArticleContent, FeedArticle, ClippedArticle, Feed
from app.schemas.rss_schemas import (
    ArticleContentCreate, ArticleContentResponse,
    FeedArticleCreate, FeedArticleUpdate, FeedArticleResponse,
    ClippedArticleCreate, ClippedArticleUpdate, ClippedArticleResponse,
    ArticleCreate, ArticleUpdate, ArticleResponse
)


async def get_article(db: AsyncSession, *, article_id: UUID, user_id: UUID) -> Optional[Article]:
    """Get a specific article by its ID, ensuring it belongs to the user."""
    result = await db.execute(
        select(Article)
        .options(selectinload(Article.feed))
        .filter(Article.id == article_id, Article.user_id == user_id)
    )
    return result.scalars().first()


async def get_article_by_guid(db: AsyncSession, *, feed_id: UUID, guid: str) -> Optional[Article]:
    """Get a specific article by its GUID for a given feed_id to check for existence."""
    result = await db.execute(
        select(Article).filter(Article.feed_id == feed_id, Article.guid == guid)
    )
    return result.scalars().first()


async def get_articles_by_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    feed_ids: Optional[List[UUID]] = None,
    folder_id: Optional[UUID] = None,
    is_read: Optional[bool] = None,
    is_read_later: Optional[bool] = None,
    is_favorite: Optional[bool] = None,
    feed_is_favorite: Optional[bool] = None,
    published_since: Optional[datetime] = None,
    published_until: Optional[datetime] = None,
    search_query: Optional[str] = None,
    sort_by: str = "published_at",
    sort_order: str = "desc",
    skip: int = 0,
    limit: int = 100,
) -> Tuple[List[Article], int]:
    """Get articles for a user with comprehensive filtering and sorting."""
    # Join with ArticleContent to access published_at, title, description
    stmt = (
        select(Article)
        .options(selectinload(Article.feed), selectinload(Article.content))
        .join(ArticleContent, Article.content_id == ArticleContent.id)
        .filter(Article.user_id == user_id)
    )
    count_stmt = (
        select(func.count(Article.id))
        .join(ArticleContent, Article.content_id == ArticleContent.id)
        .filter(Article.user_id == user_id)
    )

    if feed_ids:
        stmt = stmt.filter(Article.feed_id.in_(feed_ids))
        count_stmt = count_stmt.filter(Article.feed_id.in_(feed_ids))
    
    if folder_id:
        stmt = stmt.join(Feed, Article.feed_id == Feed.id).filter(Feed.folder_id == folder_id)
        count_stmt = count_stmt.join(Feed, Article.feed_id == Feed.id).filter(Feed.folder_id == folder_id)

    if is_read is not None:
        stmt = stmt.filter(Article.is_read == is_read)
        count_stmt = count_stmt.filter(Article.is_read == is_read)

    if is_read_later is not None:
        stmt = stmt.filter(Article.is_read_later == is_read_later)
        count_stmt = count_stmt.filter(Article.is_read_later == is_read_later)

    if is_favorite is not None:
        stmt = stmt.filter(Article.is_favorite == is_favorite)
        count_stmt = count_stmt.filter(Article.is_favorite == is_favorite)

    if feed_is_favorite is not None:
        if not folder_id:  # Only join Feed if we haven't already
            stmt = stmt.join(Feed, Article.feed_id == Feed.id)
            count_stmt = count_stmt.join(Feed, Article.feed_id == Feed.id)
        stmt = stmt.filter(Feed.is_favorite == feed_is_favorite)
        count_stmt = count_stmt.filter(Feed.is_favorite == feed_is_favorite)

    if published_since:
        stmt = stmt.filter(ArticleContent.published_at >= published_since)
        count_stmt = count_stmt.filter(ArticleContent.published_at >= published_since)
    
    if published_until:
        stmt = stmt.filter(ArticleContent.published_at <= published_until)
        count_stmt = count_stmt.filter(ArticleContent.published_at <= published_until)

    if search_query:
        search_filter = or_(
            ArticleContent.title.ilike(f"%{search_query}%"),
            ArticleContent.description.ilike(f"%{search_query}%"),
        )
        stmt = stmt.filter(search_filter)
        count_stmt = count_stmt.filter(search_filter)

    # Handle sorting - map sort_by to correct table columns
    if sort_by == "published_at":
        sort_column = ArticleContent.published_at
    elif sort_by == "created_at":
        sort_column = Article.created_at
    elif sort_by == "read_at":
        sort_column = Article.read_at
    elif sort_by == "title":
        sort_column = ArticleContent.title
    else:
        # Default to published_at if sort_by is invalid
        sort_column = ArticleContent.published_at

    if sort_order.lower() == "asc":
        if sort_by == "read_at":
            stmt = stmt.order_by(asc(sort_column).nulls_last())
        else:
            stmt = stmt.order_by(asc(sort_column))
    else:
        if sort_by == "read_at":
            stmt = stmt.order_by(desc(sort_column).nulls_first())
        else:
            stmt = stmt.order_by(desc(sort_column))
    
    total_count_result = await db.execute(count_stmt)
    total_count = total_count_result.scalar_one_or_none() or 0
    
    articles_result = await db.execute(stmt.offset(skip).limit(limit))
    articles = articles_result.scalars().all()
    return articles, total_count


async def create_articles_batch(db: AsyncSession, *, articles_in: List[ArticleCreate]) -> List[Article]:
    if not articles_in:
        return []

    existing_guids_by_feed: Dict[UUID, Set[str]] = {}
    feed_ids_to_check = {article.feed_id for article in articles_in}
    guids_to_check = {article.guid for article in articles_in}

    if feed_ids_to_check and guids_to_check:
        existing_articles_stmt = select(Article.feed_id, Article.guid).filter(
            Article.feed_id.in_(list(feed_ids_to_check)),
            Article.guid.in_(list(guids_to_check))
        )
        existing_article_identifiers_result = await db.execute(existing_articles_stmt)
        for feed_id, guid in existing_article_identifiers_result.all():
            if feed_id not in existing_guids_by_feed:
                existing_guids_by_feed[feed_id] = set()
            existing_guids_by_feed[feed_id].add(guid)

    new_articles_to_create: List[Article] = []
    for article_data in articles_in:
        if (article_data.feed_id in existing_guids_by_feed and 
            article_data.guid in existing_guids_by_feed[article_data.feed_id]):
            continue
        # Ensure link and image_url are str
        article_dict = article_data.model_dump()
        if article_dict.get("link") is not None:
            article_dict["link"] = str(article_dict["link"])
        if article_dict.get("image_url") is not None:
            article_dict["image_url"] = str(article_dict["image_url"])
        new_articles_to_create.append(Article(**article_dict))

    if not new_articles_to_create:
        return []

    db.add_all(new_articles_to_create)
    await db.commit() 
    for article in new_articles_to_create:
        await db.refresh(article)
    return new_articles_to_create


async def update_article(
    db: AsyncSession, *, article_db: Article, article_in: ArticleUpdate
) -> Article:
    update_data = article_in.model_dump(exclude_unset=True)

    if "is_read" in update_data and update_data["is_read"] and not article_db.is_read:
        article_db.read_at = datetime.now(timezone.utc)
    elif "is_read" in update_data and not update_data["is_read"]:
        article_db.read_at = None
    
    if "read_at" in update_data:
         article_db.read_at = update_data["read_at"]

    for field, value in update_data.items():
        if field != "read_at":
            setattr(article_db, field, value)
    
    db.add(article_db)
    await db.commit()
    await db.refresh(article_db)
    return article_db


async def bulk_update_articles_status(
    db: AsyncSession, *, article_ids: List[UUID], user_id: UUID, updates: Dict[str, Any]
) -> int:
    if not article_ids or not updates:
        return 0

    values_to_update = {}
    if "is_read" in updates and updates["is_read"]:
        values_to_update["is_read"] = True
        if "read_at" not in updates:
            values_to_update["read_at"] = datetime.now(timezone.utc)
    elif "is_read" in updates and not updates["is_read"]:
        values_to_update["is_read"] = False
        values_to_update["read_at"] = None
    
    if "read_at" in updates:
        values_to_update["read_at"] = updates["read_at"]

    if "is_read_later" in updates:
        values_to_update["is_read_later"] = updates["is_read_later"]
    
    if "is_favorite" in updates:
        values_to_update["is_favorite"] = updates["is_favorite"]

    if not values_to_update:
        return 0

    values_to_update["updated_at"] = datetime.now(timezone.utc)

    stmt = (
        update(Article)
        .where(Article.id.in_(article_ids), Article.user_id == user_id)
        .values(**values_to_update)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount


async def mark_articles_as_read_for_feed(db: AsyncSession, *, user_id: UUID, feed_id: UUID) -> int:
    """Marks all unread articles for a specific feed as read for the user."""
    now = datetime.now(timezone.utc)
    stmt = (
        update(Article)
        .where(
            Article.user_id == user_id,
            Article.feed_id == feed_id,
            Article.is_read == False,
        )
        .values(is_read=True, read_at=now, updated_at=now)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount


async def mark_articles_as_read_for_folder(db: AsyncSession, *, user_id: UUID, folder_id: UUID) -> int:
    """Marks all unread articles in a specific folder as read for the user."""
    now = datetime.now(timezone.utc)
    stmt = (
        update(Article)
        .where(
            Article.user_id == user_id,
            Article.feed_id.in_(select(Feed.id).where(Feed.folder_id == folder_id)), # Select feeds in the folder
            Article.is_read == False,
        )
        .values(is_read=True, read_at=now, updated_at=now)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount


async def get_recently_read_articles(
    db: AsyncSession, *, user_id: UUID, skip: int = 0, limit: int = 20
) -> Tuple[List[Article], int]:
    """Get the most recently read articles for a user."""
    return await get_articles_by_user(
        db, user_id=user_id, is_read=True, sort_by="read_at", skip=skip, limit=limit
    )


async def get_read_later_articles(
    db: AsyncSession, *, user_id: UUID, skip: int = 0, limit: int = 100
) -> Tuple[List[ArticleResponse], int]:
    """Get all articles for a user marked as read later, unified from feeds and clips."""
    
    # 1. Get read_later feed articles
    feed_articles_query = (
        select(FeedArticle)
        .options(selectinload(FeedArticle.content), selectinload(FeedArticle.feed))
        .filter(and_(FeedArticle.user_id == user_id, FeedArticle.is_read_later == True))
    )
    
    feed_articles_result = await db.execute(feed_articles_query)
    feed_articles = feed_articles_result.scalars().all()
    
    # 2. Get ALL clipped articles (they're all inherently "read later")
    clipped_articles_query = (
        select(ClippedArticle)
        .options(selectinload(ClippedArticle.content))
        .filter(ClippedArticle.user_id == user_id)
    )
    clipped_articles_result = await db.execute(clipped_articles_query)
    clipped_articles = clipped_articles_result.scalars().all()

    # 3. Convert to unified response
    unified_articles = [
        crud_article._convert_feed_article_to_unified(fa) for fa in feed_articles
    ] + [
        crud_article._convert_clipped_article_to_unified(ca) for ca in clipped_articles
    ]
    
    # 4. Sort by when they were created
    unified_articles.sort(key=lambda x: x.created_at, reverse=True)
    
    # 5. Paginate
    total_count = len(unified_articles)
    paginated_articles = unified_articles[skip : skip + limit]
    
    return paginated_articles, total_count


async def count_unread_articles(db: AsyncSession, *, user_id: UUID, feed_id: Optional[UUID] = None, folder_id: Optional[UUID] = None) -> int:
    """Counts the number of unread articles for a user, optionally filtered by feed or folder."""
    stmt = select(func.count(Article.id)).filter(Article.user_id == user_id, Article.is_read == False)
    if feed_id:
        stmt = stmt.filter(Article.feed_id == feed_id)
    if folder_id:
        stmt = stmt.join(Article.feed).filter(Feed.folder_id == folder_id)
    
    result = await db.execute(stmt)
    count = result.scalar_one_or_none() or 0
    return count


async def get_unread_counts_by_folder(db: AsyncSession, *, user_id: UUID) -> Dict[UUID, int]:
    """Gets unread article counts grouped by folder_id for a user."""
    stmt = (
        select(Feed.folder_id, func.count(Article.id).label("unread_count"))
        .join(Article.feed) # Join Article to Feed
        .filter(Article.user_id == user_id, Article.is_read == False)
        .filter(Feed.folder_id is not None) # Ensure folder_id is not null
        .group_by(Feed.folder_id)
    )
    result = await db.execute(stmt)
    # Convert list of (folder_id, count) tuples to a dict
    return {folder_id: unread_count for folder_id, unread_count in result.all()} 


class CRUDArticleContent(CRUDBase[ArticleContent, ArticleContentCreate, ArticleContentCreate]):
    """CRUD operations for ArticleContent."""

    async def create(self, db: AsyncSession, *, obj_in: ArticleContentCreate) -> ArticleContent:
        obj_in_data = obj_in.model_dump()
        # Manually convert HttpUrl to string for link and image_url
        if obj_in_data.get("link"):
            obj_in_data["link"] = str(obj_in_data["link"])
        if obj_in_data.get("image_url"):
            obj_in_data["image_url"] = str(obj_in_data["image_url"])
        
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def get_by_link(self, db: AsyncSession, *, link: str) -> Optional[ArticleContent]:
        """Get an article content by its original URL."""
        result = await db.execute(select(self.model).filter(self.model.link == link))
        return result.scalars().first()


class CRUDFeedArticle(CRUDBase[FeedArticle, FeedArticleCreate, FeedArticleUpdate]):
    """CRUD operations for RSS feed articles"""
    
    async def get_by_feed_and_guid(
        self, db: AsyncSession, *, feed_id: UUID, guid: str
    ) -> Optional[FeedArticle]:
        """Get feed article by feed ID and GUID"""
        result = await db.execute(
            select(FeedArticle)
            .options(selectinload(FeedArticle.content))
            .where(and_(FeedArticle.feed_id == feed_id, FeedArticle.guid == guid))
        )
        return result.scalar_one_or_none()
    
    async def get_with_content(self, db: AsyncSession, *, article_id: UUID) -> Optional[FeedArticle]:
        """Get feed article with content and feed"""
        result = await db.execute(
            select(FeedArticle)
            .options(selectinload(FeedArticle.content), selectinload(FeedArticle.feed))
            .where(FeedArticle.id == article_id)
        )
        return result.scalar_one_or_none()


class CRUDClippedArticle(CRUDBase[ClippedArticle, ClippedArticleCreate, ClippedArticleUpdate]):
    """CRUD operations for manually saved web articles"""
    
    async def get_by_user_and_content(
        self, db: AsyncSession, *, user_id: UUID, content_id: UUID
    ) -> Optional[ClippedArticle]:
        """Check if user already has this content clipped"""
        result = await db.execute(
            select(ClippedArticle)
            .options(selectinload(ClippedArticle.content))
            .where(and_(ClippedArticle.user_id == user_id, ClippedArticle.content_id == content_id))
        )
        return result.scalar_one_or_none()
    
    async def get_with_content(self, db: AsyncSession, *, article_id: UUID) -> Optional[ClippedArticle]:
        """Get clipped article with content"""
        result = await db.execute(
            select(ClippedArticle)
            .options(selectinload(ClippedArticle.content))
            .where(ClippedArticle.id == article_id)
        )
        return result.scalar_one_or_none()


class CRUDArticleUnified:
    """Unified CRUD operations that work with both feed and clipped articles"""
    
    def __init__(self):
        self.content = CRUDArticleContent(ArticleContent)
        self.feed_article = CRUDFeedArticle(FeedArticle)
        self.clipped_article = CRUDClippedArticle(ClippedArticle)
    
    async def create_from_legacy_schema(
        self, db: AsyncSession, *, obj_in: ArticleCreate
    ) -> FeedArticleResponse:
        """Create feed article using legacy ArticleCreate schema (for RSS system compatibility)"""
        
        # Create article content first
        content_data = ArticleContentCreate(
            title=obj_in.title,
            link=obj_in.link,
            description=obj_in.description,
            content=obj_in.content,
            author=obj_in.author,
            image_url=obj_in.image_url,
            published_at=obj_in.published_at,
            estimated_read_time_minutes=obj_in.estimated_read_time_minutes,
            custom_metadata=obj_in.custom_metadata
        )
        content = await self.content.create(db, obj_in=content_data)
        
        # Create feed article
        feed_article_data = FeedArticleCreate(
            feed_id=obj_in.feed_id,
            user_id=obj_in.user_id,
            content_id=content.id,
            guid=obj_in.guid,
            is_read=obj_in.is_read,
            is_read_later=obj_in.is_read_later,
            is_favorite=obj_in.is_favorite
        )
        feed_article = await self.feed_article.create(db, obj_in=feed_article_data)
        
        # Load with content for response
        feed_article_with_content = await self.feed_article.get_with_content(db, article_id=feed_article.id)
        return FeedArticleResponse.model_validate(feed_article_with_content)
    
    async def get_unified_article(
        self, db: AsyncSession, *, article_id: UUID, user_id: UUID
    ) -> Optional[ArticleResponse]:
        """Get either feed or clipped article as unified response"""
        
        # Try to get as feed article first
        feed_article = await self.feed_article.get_with_content(db, article_id=article_id)
        if feed_article and feed_article.user_id == user_id:
            return self._convert_feed_article_to_unified(feed_article)
        
        # Try to get as clipped article
        clipped_article = await self.clipped_article.get_with_content(db, article_id=article_id)
        if clipped_article and clipped_article.user_id == user_id:
            return self._convert_clipped_article_to_unified(clipped_article)
        
        return None
    
    async def update_article_status(
        self, db: AsyncSession, *, article_id: UUID, user_id: UUID, article_in: ArticleUpdate
    ) -> Optional[ArticleResponse]:
        """Update either feed or clipped article status"""
        
        # Try to update as feed article first
        feed_article = await db.execute(
            select(FeedArticle).where(and_(FeedArticle.id == article_id, FeedArticle.user_id == user_id))
        )
        feed_article = feed_article.scalar_one_or_none()
        
        if feed_article:
            update_data = article_in.model_dump(exclude_unset=True)
            if update_data.get('is_read'):
                update_data['read_at'] = datetime.now(timezone.utc)
            elif 'is_read' in update_data and not update_data['is_read']:
                update_data['read_at'] = None
            
            for field, value in update_data.items():
                setattr(feed_article, field, value)
            
            db.add(feed_article)
            await db.commit()
            await db.refresh(feed_article)
            
            feed_article_with_content = await self.feed_article.get_with_content(db, article_id=article_id)
            return self._convert_feed_article_to_unified(feed_article_with_content)
        
        # Try to update as clipped article
        clipped_article = await db.execute(
            select(ClippedArticle).where(and_(ClippedArticle.id == article_id, ClippedArticle.user_id == user_id))
        )
        clipped_article = clipped_article.scalar_one_or_none()
        
        if clipped_article:
            update_data = article_in.model_dump(exclude_unset=True)
            if update_data.get('is_read'):
                update_data['read_at'] = datetime.now(timezone.utc)
            elif 'is_read' in update_data and not update_data['is_read']:
                update_data['read_at'] = None
            
            for field, value in update_data.items():
                setattr(clipped_article, field, value)
            
            db.add(clipped_article)
            await db.commit()
            await db.refresh(clipped_article)
            
            clipped_article_with_content = await self.clipped_article.get_with_content(db, article_id=article_id)
            return self._convert_clipped_article_to_unified(clipped_article_with_content)
        
        return None
    
    def _convert_feed_article_to_unified(self, feed_article: FeedArticle) -> ArticleResponse:
        """Convert FeedArticle to unified ArticleResponse"""
        # Include feed information in a nested structure
        feed_info = None
        if feed_article.feed:
            feed_info = {
                "id": str(feed_article.feed.id),
                "title": feed_article.feed.title,
                "image_url": feed_article.feed.image_url,
                "url": feed_article.feed.url
            }
        
        return ArticleResponse(
            id=feed_article.id,
            # Content fields
            title=feed_article.content.title,
            link=feed_article.content.link,
            description=feed_article.content.description,
            content=feed_article.content.content,
            image_url=feed_article.content.image_url,
            author=feed_article.content.author,
            published_at=feed_article.content.published_at,
            estimated_read_time_minutes=feed_article.content.estimated_read_time_minutes,
            # User interaction state
            is_read=feed_article.is_read,
            is_read_later=feed_article.is_read_later,
            is_favorite=feed_article.is_favorite,
            read_at=feed_article.read_at,
            # Feed specific
            feed_id=feed_article.feed_id,
            guid=feed_article.guid,
            feed=feed_info,
            # Timestamps
            created_at=feed_article.created_at,
            updated_at=feed_article.updated_at,
            article_type="feed"
        )
    
    def _convert_clipped_article_to_unified(self, clipped_article: ClippedArticle) -> ArticleResponse:
        """Convert ClippedArticle to unified ArticleResponse"""
        # Extract domain from link for source display
        source_domain = None
        if clipped_article.content.link:
            try:
                from urllib.parse import urlparse
                parsed_url = urlparse(clipped_article.content.link)
                source_domain = parsed_url.netloc
                # Remove 'www.' prefix if present
                if source_domain and source_domain.startswith('www.'):
                    source_domain = source_domain[4:]
            except Exception:
                pass
        
        return ArticleResponse(
            id=clipped_article.id,
            # Content fields
            title=clipped_article.content.title,
            link=clipped_article.content.link,
            description=clipped_article.content.description,
            content=clipped_article.content.content,
            image_url=clipped_article.content.image_url,
            author=clipped_article.content.author,
            published_at=clipped_article.content.published_at,
            estimated_read_time_minutes=clipped_article.content.estimated_read_time_minutes,
            # User interaction state
            is_read=clipped_article.is_read,
            is_read_later=True,  # All clipped articles are inherently "read later"
            is_favorite=clipped_article.is_favorite,
            read_at=clipped_article.read_at,
            # Clipped specific
            priority=clipped_article.priority,
            note=clipped_article.note,
            # Add source domain as a synthetic feed-like object for display consistency
            feed={"id": None, "title": source_domain or "Web Article", "image_url": None, "url": None} if source_domain else None,
            # Timestamps
            created_at=clipped_article.created_at,
            updated_at=clipped_article.created_at,  # Use created_at for updated_at
            article_type="clipped"
        )

    async def get_unified_articles_by_user(
        self,
        db: AsyncSession,
        *,
        user_id: UUID,
        feed_ids: Optional[List[UUID]] = None,
        folder_id: Optional[UUID] = None,
        is_read: Optional[bool] = None,
        is_read_later: Optional[bool] = None,
        is_favorite: Optional[bool] = None,
        feed_is_favorite: Optional[bool] = None,
        published_since: Optional[datetime] = None,
        published_until: Optional[datetime] = None,
        search_query: Optional[str] = None,
        sort_by: str = "published_at",
        sort_order: str = "desc",
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[ArticleResponse], int]:
        """Get unified articles (both feed and clipped) for a user with filtering and sorting."""
        
        # Build query for feed articles
        feed_articles_query = (
            select(FeedArticle)
            .options(selectinload(FeedArticle.content), selectinload(FeedArticle.feed))
            .filter(FeedArticle.user_id == user_id)
        )
        
        if feed_ids:
            feed_articles_query = feed_articles_query.filter(FeedArticle.feed_id.in_(feed_ids))
        
        if folder_id:
            feed_articles_query = feed_articles_query.join(FeedArticle.feed).filter(Feed.folder_id == folder_id)
        
        if is_read is not None:
            feed_articles_query = feed_articles_query.filter(FeedArticle.is_read == is_read)
        
        if is_read_later is not None:
            feed_articles_query = feed_articles_query.filter(FeedArticle.is_read_later == is_read_later)
        
        if is_favorite is not None:
            feed_articles_query = feed_articles_query.filter(FeedArticle.is_favorite == is_favorite)
        
        if feed_is_favorite is not None:
            if folder_id is None:  # Only join if not already joined
                feed_articles_query = feed_articles_query.join(FeedArticle.feed)
            feed_articles_query = feed_articles_query.filter(Feed.is_favorite == feed_is_favorite)
        
        if published_since or published_until or search_query:
            feed_articles_query = feed_articles_query.join(FeedArticle.content)
            
            if published_since:
                feed_articles_query = feed_articles_query.filter(ArticleContent.published_at >= published_since)
            
            if published_until:
                feed_articles_query = feed_articles_query.filter(ArticleContent.published_at <= published_until)
            
            if search_query:
                search_filter = or_(
                    ArticleContent.title.ilike(f"%{search_query}%"),
                    ArticleContent.description.ilike(f"%{search_query}%"),
                )
                feed_articles_query = feed_articles_query.filter(search_filter)
        
        # Execute feed articles query
        feed_articles_result = await db.execute(feed_articles_query)
        feed_articles = feed_articles_result.scalars().all()
        
        # Build query for clipped articles (only if not filtering by feed-specific criteria)
        clipped_articles = []
        if not feed_ids and not folder_id and not feed_is_favorite:
            clipped_articles_query = (
                select(ClippedArticle)
                .options(selectinload(ClippedArticle.content))
                .filter(ClippedArticle.user_id == user_id)
            )
            
            if is_read is not None:
                clipped_articles_query = clipped_articles_query.filter(ClippedArticle.is_read == is_read)
            
            if is_favorite is not None:
                clipped_articles_query = clipped_articles_query.filter(ClippedArticle.is_favorite == is_favorite)
            
            # Note: Clipped articles are inherently "read later" so we don't filter by is_read_later
            
            if published_since or published_until or search_query:
                clipped_articles_query = clipped_articles_query.join(ClippedArticle.content)
                
                if published_since:
                    clipped_articles_query = clipped_articles_query.filter(ArticleContent.published_at >= published_since)
                
                if published_until:
                    clipped_articles_query = clipped_articles_query.filter(ArticleContent.published_at <= published_until)
                
                if search_query:
                    search_filter = or_(
                        ArticleContent.title.ilike(f"%{search_query}%"),
                        ArticleContent.description.ilike(f"%{search_query}%"),
                    )
                    clipped_articles_query = clipped_articles_query.filter(search_filter)
            
            clipped_articles_result = await db.execute(clipped_articles_query)
            clipped_articles = clipped_articles_result.scalars().all()
        
        # Convert to unified responses
        unified_articles = [
            self._convert_feed_article_to_unified(fa) for fa in feed_articles
        ] + [
            self._convert_clipped_article_to_unified(ca) for ca in clipped_articles
        ]
        
        # Sort the unified articles
        if sort_by == "published_at":
            unified_articles.sort(
                key=lambda x: x.published_at or datetime.min.replace(tzinfo=timezone.utc),
                reverse=(sort_order.lower() == "desc")
            )
        elif sort_by == "created_at":
            unified_articles.sort(
                key=lambda x: x.created_at,
                reverse=(sort_order.lower() == "desc")
            )
        elif sort_by == "read_at":
            unified_articles.sort(
                key=lambda x: x.read_at or (datetime.min.replace(tzinfo=timezone.utc) if sort_order.lower() == "desc" else datetime.max.replace(tzinfo=timezone.utc)),
                reverse=(sort_order.lower() == "desc")
            )
        # Add other sort fields as needed
        
        # Paginate
        total_count = len(unified_articles)
        paginated_articles = unified_articles[skip : skip + limit]
        
        return paginated_articles, total_count


# Create instances
crud_article_content = CRUDArticleContent(ArticleContent)
crud_feed_article = CRUDFeedArticle(FeedArticle)
crud_clipped_article = CRUDClippedArticle(ClippedArticle)
crud_article = CRUDArticleUnified()

# Backward compatibility
create = crud_article.create_from_legacy_schema
get = crud_article.get_unified_article
update = crud_article.update_article_status 