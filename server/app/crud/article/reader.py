"""Central module for reading articles - consolidates retrieval, pagination, aggregations, and transformations."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, cast
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.constants import DEFAULT_CURSOR_LIMIT, MAX_CURSOR_LIMIT
from app.models.article import ArticleContent, FeedArticle, UserEntry
from app.models.feed import Feed, FeedSubscription
from app.typing.entries import EntryDetail, EntryListItem
from app.utils.urls import extract_domain_from_url

# ============================================================================
# PAGINATION UTILITIES
# ============================================================================


@dataclass
class CursorPaginationParams:
    """Parameters for cursor-based pagination."""

    limit: int = DEFAULT_CURSOR_LIMIT
    cursor: str | None = None

    def __post_init__(self) -> None:
        """Validate and clamp limit to max value."""
        if self.limit > MAX_CURSOR_LIMIT:
            self.limit = MAX_CURSOR_LIMIT
        if self.limit < 1:
            self.limit = 1


class CursorPaginationResult(BaseModel):
    """Result of cursor-based pagination."""

    items: list[Any] = Field(description="List of items for current page")
    next_cursor: str | None = Field(
        description="Cursor for next page, None if no more pages"
    )
    has_more: bool = Field(description="Whether there are more pages available")

    class Config:
        """Pydantic configuration."""

        from_attributes = True


# ============================================================================
# TRANSFORMER
# ============================================================================


class ArticleTransformer:
    """Transform database models to API responses."""

    @staticmethod
    def _truncate_description(
        description: str | None, max_length: int = 300
    ) -> str | None:
        """Truncate description to max length."""
        if not description:
            return None
        if len(description) <= max_length:
            return description
        return description[:max_length].rsplit(" ", 1)[0] + "..."

    def to_entry_list_item(
        self,
        feed_article: FeedArticle,
        user_entry: UserEntry | None = None,
        subscription: FeedSubscription | None = None,
    ) -> EntryListItem:
        """Convert FeedArticle + UserEntry to lightweight list item."""
        content = feed_article.content
        feed = feed_article.feed

        # Compute is_read with cutoff logic
        is_read = False
        if user_entry and user_entry.is_read:
            is_read = True
        elif subscription and subscription.last_read_cutoff:
            is_read = feed_article.published_at <= subscription.last_read_cutoff

        return EntryListItem(
            id=feed_article.id,
            title=content.title,
            link=content.link,
            description=self._truncate_description(content.description, 300),
            content=None,  # Never in lists
            image_url=content.image_url,
            author=content.author,
            source_domain=extract_domain_from_url(content.link),
            is_read=is_read,
            is_saved=user_entry.is_saved if user_entry else False,
            priority=user_entry.priority if user_entry else "MEDIUM",
            user_note=user_entry.user_note if user_entry else None,
            read_at=user_entry.read_at if user_entry else None,
            feed_id=feed_article.feed_id,
            feed_title=feed.title if feed else None,
            feed_icon=feed.image_url if feed else None,
            published_at=feed_article.published_at,
            created_at=feed_article.created_at,
            article_type="feed",
            tags=content.tags,
        )

    def to_entry_detail(
        self,
        feed_article: FeedArticle,
        user_entry: UserEntry | None = None,
        subscription: FeedSubscription | None = None,
    ) -> EntryDetail:
        """Convert FeedArticle + UserEntry to full detail with content."""
        content = feed_article.content
        feed = feed_article.feed

        # Compute is_read with cutoff logic
        is_read = False
        if user_entry and user_entry.is_read:
            is_read = True
        elif subscription and subscription.last_read_cutoff:
            is_read = feed_article.published_at <= subscription.last_read_cutoff

        return EntryDetail(
            id=feed_article.id,
            title=content.title,
            link=content.link,
            description=content.description,  # Full description
            content=content.content,  # Full content
            image_url=content.image_url,
            author=content.author,
            source_domain=extract_domain_from_url(content.link),
            is_read=is_read,
            is_saved=user_entry.is_saved if user_entry else False,
            priority=user_entry.priority if user_entry else "MEDIUM",
            user_note=user_entry.user_note if user_entry else None,
            read_at=user_entry.read_at if user_entry else None,
            feed_id=feed_article.feed_id,
            feed_title=feed.title if feed else None,
            feed_icon=feed.image_url if feed else None,
            published_at=feed_article.published_at,
            created_at=feed_article.created_at,
            article_type="feed",
            tags=content.tags,
        )

    def clipped_to_entry_list_item(
        self,
        content: ArticleContent,
        user_entry: UserEntry,
    ) -> EntryListItem:
        """Convert clipped article to list item."""
        return EntryListItem(
            id=user_entry.id,
            title=content.title,
            link=content.link,
            description=self._truncate_description(content.description, 300),
            content=None,
            image_url=content.image_url,
            author=content.author,
            source_domain=extract_domain_from_url(content.link),
            is_read=user_entry.is_read,
            is_saved=user_entry.is_saved,
            priority=user_entry.priority,
            user_note=user_entry.user_note,
            read_at=user_entry.read_at,
            feed_id=None,
            feed_title=None,
            feed_icon=None,
            published_at=user_entry.created_at,
            created_at=user_entry.created_at,
            article_type="clipped",
            tags=content.tags,
        )

    def clipped_to_entry_detail(
        self,
        content: ArticleContent,
        user_entry: UserEntry,
    ) -> EntryDetail:
        """Convert clipped article to full detail."""
        return EntryDetail(
            id=user_entry.id,
            title=content.title,
            link=content.link,
            description=content.description,
            content=content.content,
            image_url=content.image_url,
            author=content.author,
            source_domain=extract_domain_from_url(content.link),
            is_read=user_entry.is_read,
            is_saved=user_entry.is_saved,
            priority=user_entry.priority,
            user_note=user_entry.user_note,
            read_at=user_entry.read_at,
            feed_id=None,
            feed_title=None,
            feed_icon=None,
            published_at=user_entry.created_at,
            created_at=user_entry.created_at,
            article_type="clipped",
            tags=content.tags,
        )


# ============================================================================
# QUERY HELPERS
# ============================================================================


def _parse_cursor(cursor: str) -> datetime | None:
    """Parse cursor string into timestamp."""
    try:
        cursor_ts = datetime.fromisoformat(cursor.replace("Z", "+00:00"))
        return cursor_ts
    except (ValueError, IndexError):
        return None


def _create_cursor(timestamp: datetime) -> str:
    """Create cursor string from timestamp."""
    return timestamp.isoformat().replace("+00:00", "Z")


# ============================================================================
# RETRIEVAL FUNCTIONS
# ============================================================================


async def get_articles(
    db: AsyncSession,
    user_id: UUID,
    params: CursorPaginationParams,
    *,
    feed_id: UUID | None = None,
    folder_id: UUID | None = None,
    is_read: bool | None = None,
    is_saved: bool | None = None,
    priority: str | None = None,
    feed_is_favorite: bool | None = None,
    published_since: datetime | None = None,
    published_until: datetime | None = None,
    load_full_content: bool = False,
) -> CursorPaginationResult:
    """
    Get articles with cursor pagination.

    Main query for feed streams with optimized read status handling.
    Accepts either a single feed_id OR a folder_id, not both.
    """
    query = (
        select(FeedArticle, UserEntry, FeedSubscription)
        .options(
            (
                selectinload(FeedArticle.content).undefer_group("content_details")
                if load_full_content
                else selectinload(FeedArticle.content).undefer(
                    ArticleContent.description
                )
            ),
            selectinload(FeedArticle.feed),
        )
        .join(Feed, Feed.id == FeedArticle.feed_id)
        .outerjoin(
            FeedSubscription,
            and_(
                FeedSubscription.feed_id == Feed.id,
                FeedSubscription.user_id == user_id,
            ),
        )
        .outerjoin(
            UserEntry,
            and_(
                UserEntry.content_id == FeedArticle.content_id,
                UserEntry.user_id == user_id,
            ),
        )
    )

    # Apply scope filter (feed or folder)
    if feed_id:
        query = query.where(FeedArticle.feed_id == feed_id)
    elif folder_id:
        query = query.where(FeedSubscription.folder_id == folder_id)
    elif is_saved:
        # If explicitly asking for saved items, allow unsubscribed feeds
        pass
    else:
        # Default: Only show subscribed feeds
        query = query.where(FeedSubscription.id.isnot(None))

    if is_saved is not None:
        if is_saved:
            query = query.where(UserEntry.is_saved)
        else:
            query = query.where(or_(~UserEntry.is_saved, UserEntry.is_saved.is_(None)))

    if priority is not None:
        query = query.where(UserEntry.priority == priority)

    if feed_is_favorite is not None:
        query = query.where(FeedSubscription.is_favorite == feed_is_favorite)

    if published_since:
        query = query.where(FeedArticle.published_at >= published_since)

    if published_until:
        query = query.where(FeedArticle.published_at <= published_until)

    # Read status filter with cutoff support
    if is_read is not None:
        if is_read:
            query = query.where(
                or_(
                    UserEntry.is_read,
                    and_(
                        FeedSubscription.last_read_cutoff.isnot(None),
                        FeedArticle.published_at <= FeedSubscription.last_read_cutoff,
                        UserEntry.is_read.is_(None),
                    ),
                )
            )
        else:
            query = query.where(
                or_(~UserEntry.is_read, UserEntry.is_read.is_(None)),
                FeedArticle.published_at > FeedSubscription.last_read_cutoff,
            )

    # Cursor pagination
    if params.cursor:
        cursor_ts = _parse_cursor(params.cursor)
        if cursor_ts:
            query = query.where(FeedArticle.published_at < cursor_ts)

    query = query.order_by(FeedArticle.published_at.desc())
    query = query.limit(params.limit + 1)

    result = await db.execute(query)
    rows = result.all()

    has_more = len(rows) > params.limit
    rows_to_process = rows[: params.limit] if has_more else rows

    # Transform rows to response dicts
    transformer = ArticleTransformer()
    if load_full_content:
        items = [
            transformer.to_entry_detail(
                row[0], row[1], subscription=row[2]
            ).model_dump()
            for row in rows_to_process
        ]
    else:
        items = [
            transformer.to_entry_list_item(
                row[0], row[1], subscription=row[2]
            ).model_dump()
            for row in rows_to_process
        ]

    next_cursor = None
    if rows_to_process and has_more:
        last_item = rows_to_process[-1][0]
        next_cursor = _create_cursor(last_item.published_at)

    return CursorPaginationResult(
        items=items, next_cursor=next_cursor, has_more=has_more
    )


async def get_article_by_id(
    db: AsyncSession,
    *,
    article_id: UUID,
    user_id: UUID,
    load_full_content: bool = True,
    allow_preview: bool = False,
) -> tuple[FeedArticle, UserEntry | None] | None:
    """Get single article by ID with user state."""
    content_options = (
        selectinload(FeedArticle.content).undefer_group("content_details")
        if load_full_content
        else selectinload(FeedArticle.content).undefer(ArticleContent.description)
    )

    stmt = (
        select(FeedArticle, UserEntry)
        .options(selectinload(FeedArticle.feed), content_options)
        .outerjoin(
            UserEntry,
            and_(
                UserEntry.content_id == FeedArticle.content_id,
                UserEntry.user_id == user_id,
            ),
        )
    )

    if allow_preview:
        stmt = stmt.outerjoin(
            FeedSubscription,
            and_(
                FeedSubscription.feed_id == FeedArticle.feed_id,
                FeedSubscription.user_id == user_id,
            ),
        )
    else:
        stmt = stmt.join(
            FeedSubscription,
            and_(
                FeedSubscription.feed_id == FeedArticle.feed_id,
                FeedSubscription.user_id == user_id,
            ),
        )

    stmt = stmt.filter(FeedArticle.id == article_id)

    result = await db.execute(stmt)
    row = result.first()
    if row is None:
        return None
    return cast(tuple[FeedArticle, UserEntry | None], row)


async def get_clipped_article_by_id(
    db: AsyncSession,
    *,
    article_id: UUID,
    user_id: UUID,
) -> tuple[ArticleContent, UserEntry] | None:
    """Get single clipped article by ID (UserEntry ID)."""
    stmt = (
        select(ArticleContent, UserEntry)
        .join(
            UserEntry,
            and_(
                UserEntry.content_id == ArticleContent.id,
                UserEntry.user_id == user_id,
            ),
        )
        .where(UserEntry.id == article_id)
    )

    result = await db.execute(stmt)
    row = result.first()
    if row is None:
        return None
    return cast(tuple[ArticleContent, UserEntry], row)


async def check_article_saved_by_url(
    db: AsyncSession, *, url: str, user_id: UUID
) -> tuple[ArticleContent, UserEntry | None] | None:
    """
    Check if an article is saved by URL.

    Returns tuple of (ArticleContent, UserEntry | None) if content exists,
    None if content doesn't exist.
    """
    result = await db.execute(
        select(ArticleContent, UserEntry)
        .outerjoin(
            UserEntry,
            (UserEntry.content_id == ArticleContent.id)
            & (UserEntry.user_id == user_id),
        )
        .where(ArticleContent.link == url)
        .order_by(
            UserEntry.updated_at.desc().nulls_last(), ArticleContent.created_at.desc()
        )
        .limit(1)
    )
    row = result.first()
    if row is None:
        return None
    return cast(tuple[ArticleContent, UserEntry | None], row)


async def get_read_later_articles(
    db: AsyncSession,
    user_id: UUID,
    params: CursorPaginationParams,
) -> CursorPaginationResult:
    """Get read later (saved) articles with cursor pagination."""
    query = (
        select(UserEntry)
        .options(
            selectinload(UserEntry.content).undefer(ArticleContent.description),
            selectinload(UserEntry.feed_article).selectinload(FeedArticle.feed),
        )
        .where(UserEntry.user_id == user_id, UserEntry.is_saved)
    )

    # Cursor pagination
    if params.cursor:
        cursor_ts = _parse_cursor(params.cursor)
        if cursor_ts:
            query = query.where(UserEntry.created_at < cursor_ts)

    query = query.order_by(UserEntry.created_at.desc())
    query = query.limit(params.limit + 1)

    result = await db.execute(query)
    user_entries = list(result.scalars().all())

    has_more = len(user_entries) > params.limit
    entries_to_process = user_entries[: params.limit] if has_more else user_entries

    # Transform UserEntry objects to response dicts
    transformer = ArticleTransformer()
    items = []
    for entry in entries_to_process:
        if entry.feed_article:
            # This is a feed article
            response = transformer.to_entry_list_item(entry.feed_article, entry)
            items.append(response.model_dump())
        else:
            # This is a clipped article
            response = transformer.clipped_to_entry_list_item(entry.content, entry)
            items.append(response.model_dump())

    next_cursor = None
    if entries_to_process and has_more:
        last_item = entries_to_process[-1]
        next_cursor = _create_cursor(last_item.created_at)

    return CursorPaginationResult(
        items=items, next_cursor=next_cursor, has_more=has_more
    )


async def get_recently_read_articles_crud(
    db: AsyncSession,
    user_id: UUID,
    params: CursorPaginationParams,
) -> CursorPaginationResult:
    """
    Get recently read articles (explicitly marked as read).

    Only returns articles where UserEntry.is_read is True.
    Does NOT include articles implicitly read via last_read_cutoff.
    Ordered by read_at desc (most recently read first).
    """
    query = (
        select(UserEntry)
        .options(
            selectinload(UserEntry.content).undefer(ArticleContent.description),
            selectinload(UserEntry.feed_article).selectinload(FeedArticle.feed),
        )
        .where(UserEntry.user_id == user_id, UserEntry.is_read)
    )

    # Cursor pagination
    if params.cursor:
        cursor_ts = _parse_cursor(params.cursor)
        if cursor_ts:
            # Use read_at for cursor since we order by it
            query = query.where(UserEntry.read_at < cursor_ts)

    # Order by read_at desc (when the user actually read it)
    # Fallback to updated_at if read_at is null (shouldn't happen for is_read=True but safe)
    query = query.order_by(
        UserEntry.read_at.desc().nulls_last(), UserEntry.updated_at.desc()
    )
    query = query.limit(params.limit + 1)

    result = await db.execute(query)
    user_entries = list(result.scalars().all())

    has_more = len(user_entries) > params.limit
    entries_to_process = user_entries[: params.limit] if has_more else user_entries

    # Transform UserEntry objects to response dicts
    transformer = ArticleTransformer()
    items = []
    for entry in entries_to_process:
        if entry.feed_article:
            # This is a feed article
            response = transformer.to_entry_list_item(entry.feed_article, entry)
            items.append(response.model_dump())
        else:
            # This is a clipped article
            response = transformer.clipped_to_entry_list_item(entry.content, entry)
            items.append(response.model_dump())

    next_cursor = None
    if entries_to_process and has_more:
        last_item = entries_to_process[-1]
        # Use read_at for cursor
        cursor_val = last_item.read_at or last_item.updated_at
        next_cursor = _create_cursor(cursor_val)

    return CursorPaginationResult(
        items=items, next_cursor=next_cursor, has_more=has_more
    )


async def fetch_recent_article_texts_for_feeds(
    db: AsyncSession,
    feed_ids: list[UUID],
    limit: int = 5,
) -> dict[UUID, list[str]]:
    """Fetch recent article texts for language detection.

    Args:
        db: Database session
        feed_ids: List of feed IDs to fetch articles for
        limit: Number of recent articles to fetch per feed

    Returns:
        Dictionary mapping feed_id to list of article text snippets
    """
    try:
        # Use window function to get top N articles per feed in one query
        subquery = (
            select(
                FeedArticle.feed_id,
                ArticleContent.title,
                ArticleContent.description,
                func.row_number()
                .over(
                    partition_by=FeedArticle.feed_id,
                    order_by=FeedArticle.published_at.desc(),
                )
                .label("rn"),
            )
            .join(FeedArticle, FeedArticle.content_id == ArticleContent.id)
            .where(FeedArticle.feed_id.in_(feed_ids))
            .subquery()
        )

        stmt = select(
            subquery.c.feed_id, subquery.c.title, subquery.c.description
        ).where(subquery.c.rn <= limit)

        result = await db.execute(stmt)
        rows = result.all()

        result_map = {}
        for feed_id, title, description in rows:
            text_parts = []
            if title:
                text_parts.append(title)
            if description:
                text_parts.append(description)

            if text_parts:
                if feed_id not in result_map:
                    result_map[feed_id] = []
                result_map[feed_id].append(" ".join(text_parts))

        return result_map

    except Exception:
        # Return empty dict on error - language detection will fall back to feed metadata
        return {}
