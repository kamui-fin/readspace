from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import UUID

from app.models.rss_models import Article, Feed
from app.schemas.rss_schemas import ArticleCreate, ArticleUpdate
from sqlalchemy import asc, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload


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
    stmt = select(Article).options(selectinload(Article.feed)).filter(Article.user_id == user_id)
    count_stmt = select(func.count(Article.id)).filter(Article.user_id == user_id)

    if feed_ids:
        stmt = stmt.filter(Article.feed_id.in_(feed_ids))
        count_stmt = count_stmt.filter(Article.feed_id.in_(feed_ids))
    
    if folder_id:
        stmt = stmt.join(Article.feed).filter(Feed.folder_id == folder_id)
        count_stmt = count_stmt.join(Article.feed).filter(Feed.folder_id == folder_id)

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
        if not folder_id:
            stmt = stmt.join(Article.feed)
            count_stmt = count_stmt.join(Article.feed)
        stmt = stmt.filter(Feed.is_favorite == feed_is_favorite)
        count_stmt = count_stmt.filter(Feed.is_favorite == feed_is_favorite)

    if published_since:
        stmt = stmt.filter(Article.published_at >= published_since)
        count_stmt = count_stmt.filter(Article.published_at >= published_since)
    
    if published_until:
        stmt = stmt.filter(Article.published_at <= published_until)
        count_stmt = count_stmt.filter(Article.published_at <= published_until)

    if search_query:
        search_filter = or_(
            Article.title.ilike(f"%{search_query}%"),
            Article.description.ilike(f"%{search_query}%"),
        )
        stmt = stmt.filter(search_filter)
        count_stmt = count_stmt.filter(search_filter)

    sort_column = getattr(Article, sort_by, Article.published_at)
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
    return await get_articles_by_user(
        db,
        user_id=user_id,
        is_read=True,
        sort_by="read_at",
        sort_order="desc",
        skip=skip,
        limit=limit,
    )


async def get_read_later_articles(
    db: AsyncSession, *, user_id: UUID, skip: int = 0, limit: int = 100
) -> Tuple[List[Article], int]:
    return await get_articles_by_user(
        db,
        user_id=user_id,
        is_read_later=True,
        sort_by="created_at", 
        sort_order="desc",
        skip=skip,
        limit=limit,
    )


async def count_unread_articles(db: AsyncSession, *, user_id: UUID, feed_id: Optional[UUID] = None, folder_id: Optional[UUID] = None) -> int:
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
        .filter(Feed.folder_id != None) # Ensure folder_id is not null
        .group_by(Feed.folder_id)
    )
    result = await db.execute(stmt)
    # Convert list of (folder_id, count) tuples to a dict
    return {folder_id: unread_count for folder_id, unread_count in result.all()} 