"""Query builder for article queries."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import asc, desc, or_, select
from sqlalchemy.orm import InstrumentedAttribute, selectinload
from sqlalchemy.sql import Select
from sqlalchemy.sql.elements import ColumnElement

from app.models.rss_models import (
    ArticleContent,
    Feed,
    FeedArticle,
    FeedSubscription,
    UserArticleState,
)


class ArticleQueryBuilder:
    """Builds SQLAlchemy queries for article filtering and sorting."""

    def __init__(self, user_id: UUID, allow_preview: bool = False):
        self.user_id = user_id
        self.allow_preview = allow_preview

    def build_base_query(self) -> Select:
        """Build the base query with optimized eager loading to prevent N+1 queries."""
        stmt = (
            select(FeedArticle, UserArticleState)
            # Fix N+1 query: Eagerly load feed with its subscriptions in one query
            .options(
                selectinload(FeedArticle.feed).selectinload(Feed.subscriptions),
                selectinload(FeedArticle.content),
            )
            .join(ArticleContent, FeedArticle.content_id == ArticleContent.id)
            .outerjoin(
                UserArticleState,
                (UserArticleState.article_id == FeedArticle.id) & (UserArticleState.user_id == self.user_id),
            )
        )

        # Only join with FeedSubscription and filter by user_id if not allowing preview
        if not self.allow_preview:
            stmt = stmt.join(FeedSubscription, FeedArticle.feed_id == FeedSubscription.feed_id).filter(
                FeedSubscription.user_id == self.user_id
            )

        return stmt

    def apply_feed_filter(self, stmt: Select, feed_ids: list[UUID]) -> Select:
        """Apply feed ID filter to query."""
        stmt = stmt.filter(FeedArticle.feed_id.in_(feed_ids))
        return stmt

    def apply_folder_filter(self, stmt: Select, folder_id: UUID) -> Select:
        """Apply folder filter to query."""
        # FeedSubscription join is already done in build_base_query, just add filter
        stmt = stmt.filter(FeedSubscription.folder_id == folder_id)
        return stmt

    def apply_read_status_filter(self, stmt: Select, is_read: bool) -> Select:
        """Apply read status filter to query."""
        if is_read:
            # Only show articles that are explicitly marked as read
            stmt = stmt.filter(UserArticleState.is_read.is_(True))
        else:
            # Show articles that are either not tracked (NULL) or explicitly unread
            stmt = stmt.filter(
                or_(
                    UserArticleState.is_read.is_(None),
                    UserArticleState.is_read.is_(False),
                )
            )
        return stmt

    def apply_read_later_filter(self, stmt: Select, is_read_later: bool) -> Select:
        """Apply read later filter to query."""
        if is_read_later:
            # Only show articles that are explicitly marked as read later
            stmt = stmt.filter(UserArticleState.is_read_later.is_(True))
        else:
            # Show articles that are either not tracked (NULL) or explicitly not read later
            stmt = stmt.filter(
                or_(
                    UserArticleState.is_read_later.is_(None),
                    UserArticleState.is_read_later.is_(False),
                )
            )
        return stmt

    def apply_favorite_filter(self, stmt: Select, is_favorite: bool) -> Select:
        """Apply favorite filter to query."""
        if is_favorite:
            # Only show articles that are explicitly marked as favorite
            stmt = stmt.filter(UserArticleState.is_favorite.is_(True))
        else:
            # Show articles that are either not tracked (NULL) or explicitly not favorite
            stmt = stmt.filter(
                or_(
                    UserArticleState.is_favorite.is_(None),
                    UserArticleState.is_favorite.is_(False),
                )
            )
        return stmt

    def apply_feed_favorite_filter(
        self,
        stmt: Select,
        feed_is_favorite: bool,
        folder_joined: bool = False,
    ) -> Select:
        """Apply feed favorite filter to query."""
        # FeedSubscription join is already done in build_base_query, just add filter
        stmt = stmt.filter(FeedSubscription.is_favorite == feed_is_favorite)
        return stmt

    def apply_date_range_filter(
        self,
        stmt: Select,
        published_since: datetime | None = None,
        published_until: datetime | None = None,
    ) -> Select:
        """Apply date range filter to query."""
        if published_since:
            stmt = stmt.filter(ArticleContent.published_at >= published_since)
        if published_until:
            stmt = stmt.filter(ArticleContent.published_at <= published_until)
        return stmt

    def apply_search_filter(self, stmt: Select, search_query: str) -> Select:
        """Apply search filter to query."""
        search_filter = or_(
            ArticleContent.title.ilike(f"%{search_query}%"),
            ArticleContent.description.ilike(f"%{search_query}%"),
        )
        stmt = stmt.filter(search_filter)
        return stmt

    def apply_sorting(self, stmt: Select, sort_by: str = "published_at", sort_order: str = "desc") -> Select:
        """Apply sorting to query."""
        # Map sort_by to correct table columns
        sort_column: ColumnElement[Any] | InstrumentedAttribute[Any]
        if sort_by == "published_at":
            sort_column = ArticleContent.published_at
        elif sort_by == "created_at":
            sort_column = FeedArticle.created_at
        elif sort_by == "read_at":
            sort_column = UserArticleState.read_at
        elif sort_by == "title":
            sort_column = ArticleContent.title
        else:
            # Default to published_at if sort_by is invalid
            sort_column = ArticleContent.published_at

        if sort_order.lower() == "asc":
            if sort_by in ["read_at", "published_at"]:
                stmt = stmt.order_by(asc(sort_column).nulls_last())
            else:
                stmt = stmt.order_by(asc(sort_column))
        else:
            if sort_by in ["read_at", "published_at"]:
                stmt = stmt.order_by(desc(sort_column).nulls_last())
            else:
                stmt = stmt.order_by(desc(sort_column))

        return stmt

    def build_filtered_query(
        self,
        feed_ids: list[UUID] | None = None,
        folder_id: UUID | None = None,
        is_read: bool | None = None,
        is_read_later: bool | None = None,
        is_favorite: bool | None = None,
        feed_is_favorite: bool | None = None,
        published_since: datetime | None = None,
        published_until: datetime | None = None,
        search_query: str | None = None,
        sort_by: str = "published_at",
        sort_order: str = "desc",
        skip: int = 0,
        limit: int = 100,
    ) -> Select:
        """Build a complete filtered and sorted query."""
        stmt = self.build_base_query()

        folder_joined = False

        if feed_ids:
            stmt = self.apply_feed_filter(stmt, feed_ids)

        if folder_id:
            stmt = self.apply_folder_filter(stmt, folder_id)
            folder_joined = True

        if is_read is not None:
            stmt = self.apply_read_status_filter(stmt, is_read)

        if is_read_later is not None:
            stmt = self.apply_read_later_filter(stmt, is_read_later)

        if is_favorite is not None:
            stmt = self.apply_favorite_filter(stmt, is_favorite)

        if feed_is_favorite is not None:
            stmt = self.apply_feed_favorite_filter(stmt, feed_is_favorite, folder_joined)

        if published_since or published_until:
            stmt = self.apply_date_range_filter(stmt, published_since, published_until)

        if search_query:
            stmt = self.apply_search_filter(stmt, search_query)

        stmt = self.apply_sorting(stmt, sort_by, sort_order)
        stmt = stmt.offset(skip).limit(limit)

        return stmt
