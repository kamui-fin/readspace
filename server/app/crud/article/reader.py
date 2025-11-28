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
from app.typing.articles import ArticleResponse
from app.utils.text import clean_html_text

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
    def _extract_feed_info(feed: Feed | None) -> dict[str, Any] | None:
        """Extract feed information."""
        if not feed:
            return None

        return {
            "id": feed.id,
            "title": feed.title,
            "url": feed.url,
            "link": feed.link,
            "image_url": feed.image_url,
        }

    @staticmethod
    def _truncate_description(
        description: str | None, max_length: int = 200
    ) -> str | None:
        """Truncate description to max length."""
        if not description:
            return None
        if len(description) <= max_length:
            return description
        return description[:max_length].rsplit(" ", 1)[0] + "..."

    def entry_to_response(
        self,
        feed_article: FeedArticle,
        user_entry: UserEntry | None = None,
        include_content: bool = False,
        subscription: FeedSubscription | None = None,
    ) -> ArticleResponse:
        """Convert FeedArticle + UserEntry to ArticleResponse."""
        content = feed_article.content
        feed = feed_article.feed

        # Extract user state (matching actual UserEntry model fields)
        # Check if article is read: either explicit UserEntry.is_read OR published before cutoff
        is_read = False
        if user_entry and user_entry.is_read:
            is_read = True
        elif subscription and subscription.last_read_cutoff:
            # Article is implicitly read if published before the cutoff
            is_read = feed_article.published_at <= subscription.last_read_cutoff

        is_read_later = user_entry.is_read_later if user_entry else False
        priority = (
            user_entry.priority.upper()
            if user_entry and user_entry.priority
            else "MEDIUM"
        )
        read_at = user_entry.read_at if user_entry else None
        user_note = user_entry.user_note if user_entry else None

        return ArticleResponse(
            id=feed_article.id,
            title=content.title,
            link=content.link,
            description=self._truncate_description(content.description),
            content=content.content if include_content else None,
            image_url=content.image_url,
            author=content.author,
            published_at=feed_article.published_at,
            estimated_read_time_minutes=content.estimated_read_time_minutes,
            source_domain=self._extract_source_domain(content.link),
            is_read=is_read,
            is_read_later=is_read_later,
            priority=priority,
            read_at=read_at,
            user_note=user_note,
            article_type="feed",
            created_at=feed_article.created_at,
            feed=self._extract_feed_info(feed),
        )

    def clipped_to_response(
        self,
        content: ArticleContent,
        user_entry: UserEntry,
        include_content: bool = True,
    ) -> dict[str, Any]:
        """Convert clipped article (ArticleContent + UserEntry) to ArticleResponse."""
        response_dict = ArticleResponse(
            id=user_entry.id,
            title=content.title,
            link=content.link,
            description=self._truncate_description(content.description),
            content=content.content if include_content else None,
            image_url=content.image_url,
            author=content.author,
            published_at=user_entry.created_at,  # Use created_at for clipped articles
            estimated_read_time_minutes=content.estimated_read_time_minutes,
            source_domain=self._extract_source_domain(content.link),
            is_read=user_entry.is_read,
            is_read_later=user_entry.is_read_later,
            priority=(
                user_entry.priority.upper() if user_entry.priority else "MEDIUM"
            ),  # Uppercase priority
            read_at=user_entry.read_at,
            user_note=user_entry.user_note,
            article_type="clipped",
            created_at=user_entry.created_at,
            feed=None,  # Clipped articles don't have a feed
        ).model_dump()
        # Add note field for compatibility
        response_dict["note"] = user_entry.user_note
        return response_dict

    def to_response(
        self,
        article: FeedArticle | tuple[FeedArticle, UserEntry | None],
        include_content: bool = True,
    ) -> dict[str, Any]:
        """Convert article to response - handles both single and tuple formats."""
        # Check if it's a FeedArticle instance
        if isinstance(article, FeedArticle):
            response = self.entry_to_response(
                article, None, include_content=include_content
            )
        # Otherwise try to unpack as a sequence (tuple, list, or SQLAlchemy Row)
        else:
            try:
                feed_article, user_entry = article
                response = self.entry_to_response(
                    feed_article, user_entry, include_content=include_content
                )
            except (TypeError, ValueError):
                # If unpacking fails, treat as single FeedArticle
                response = self.entry_to_response(
                    article, None, include_content=include_content
                )
        return response.model_dump()


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
    is_read_later: bool | None = None,
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
        .join(
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

    if is_read_later is not None:
        if is_read_later:
            query = query.where(UserEntry.is_read_later)
        else:
            query = query.where(
                or_(~UserEntry.is_read_later, UserEntry.is_read_later.is_(None))
            )

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
    items = [
        transformer.entry_to_response(
            row[0], row[1], include_content=load_full_content, subscription=row[2]
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
        .join(FeedSubscription, FeedArticle.feed_id == FeedSubscription.feed_id)
        .filter(FeedSubscription.user_id == user_id, FeedArticle.id == article_id)
    )

    result = await db.execute(stmt)
    row = result.first()
    if row is None:
        return None
    return cast(tuple[FeedArticle, UserEntry | None], row)


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
        .where(UserEntry.user_id == user_id, UserEntry.is_read_later)
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
            response = transformer.entry_to_response(
                entry.feed_article, entry, include_content=False
            )
            items.append(response.model_dump())
        else:
            # This is a clipped article
            response = transformer.clipped_to_response(
                entry.content, entry, include_content=False
            )
            items.append(response)

    next_cursor = None
    if entries_to_process and has_more:
        last_item = entries_to_process[-1]
        next_cursor = _create_cursor(last_item.created_at)

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
