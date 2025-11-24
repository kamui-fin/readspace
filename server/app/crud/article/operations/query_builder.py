"""Simplified query builder for feed articles using new schema."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import Select

from app.models import ArticleContent, FeedArticle, FeedSubscription, UserEntry


class FeedArticleQueryBuilder:
    """Builds optimized queries using denormalized published_at on feed_articles."""

    def __init__(self, user_id: UUID, allow_preview: bool = False, load_full_content: bool = False):
        self.user_id = user_id
        self.allow_preview = allow_preview
        self.load_full_content = load_full_content

    def build_base_query(self) -> Select:
        """Build base query - no article_contents join needed for sorting!"""
        content_options = []
        if self.load_full_content:
            content_options.append(selectinload(FeedArticle.content).undefer_group("content_details"))
        else:
            content_options.append(selectinload(FeedArticle.content))

        stmt = (
            select(FeedArticle, UserEntry)
            .options(
                selectinload(FeedArticle.feed),
                *content_options,
            )
            # LEFT JOIN user_entries on content_id (not article_id!)
            .outerjoin(
                UserEntry,
                (UserEntry.content_id == FeedArticle.content_id) & (UserEntry.user_id == self.user_id),
            )
        )

        # Only join subscriptions if not preview mode
        if not self.allow_preview:
            stmt = stmt.join(FeedSubscription, FeedArticle.feed_id == FeedSubscription.feed_id).filter(
                FeedSubscription.user_id == self.user_id
            )

        return stmt

    def apply_feed_filter(self, stmt: Select, feed_ids: list[UUID]) -> Select:
        """Filter by feed IDs."""
        return stmt.filter(FeedArticle.feed_id.in_(feed_ids))

    def apply_folder_filter(self, stmt: Select, folder_id: UUID) -> Select:
        """Filter by folder."""
        return stmt.filter(FeedSubscription.folder_id == folder_id)

    def apply_read_status_filter(self, stmt: Select, is_read: bool) -> Select:
        """Filter by read status."""
        if is_read:
            return stmt.filter(UserEntry.is_read == True)
        else:
            return stmt.filter((UserEntry.is_read == False) | (UserEntry.is_read.is_(None)))

    def apply_read_later_filter(self, stmt: Select, is_read_later: bool) -> Select:
        """Filter by read later status."""
        if is_read_later:
            return stmt.filter(UserEntry.is_read_later == True)
        else:
            return stmt.filter((UserEntry.is_read_later == False) | (UserEntry.is_read_later.is_(None)))

    def apply_favorite_filter(self, stmt: Select, is_favorite: bool) -> Select:
        """Filter by favorite status."""
        if is_favorite:
            return stmt.filter(UserEntry.is_favorite == True)
        else:
            return stmt.filter((UserEntry.is_favorite == False) | (UserEntry.is_favorite.is_(None)))

    def apply_feed_favorite_filter(self, stmt: Select, feed_is_favorite: bool) -> Select:
        """Filter by feed favorite status."""
        return stmt.filter(FeedSubscription.is_favorite == feed_is_favorite)

    def apply_date_range_filter(
        self,
        stmt: Select,
        published_since: datetime | None = None,
        published_until: datetime | None = None,
    ) -> Select:
        """Filter by date range using denormalized published_at."""
        if published_since:
            stmt = stmt.filter(FeedArticle.published_at >= published_since)
        if published_until:
            stmt = stmt.filter(FeedArticle.published_at <= published_until)
        return stmt

    def apply_sorting(self, stmt: Select, sort_by: str = "published_at", sort_order: str = "desc") -> Select:
        """Apply sorting - uses FeedArticle.published_at directly (fast!)."""
        order_func = desc if sort_order == "desc" else asc

        if sort_by == "published_at":
            return stmt.order_by(order_func(FeedArticle.published_at))
        elif sort_by == "created_at":
            return stmt.order_by(order_func(FeedArticle.created_at))
        else:
            # Fallback to published_at
            return stmt.order_by(order_func(FeedArticle.published_at))

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
        sort_by: str = "published_at",
        sort_order: str = "desc",
        skip: int = 0,
        limit: int = 100,
    ) -> Select:
        """Build complete filtered query."""
        stmt = self.build_base_query()

        if feed_ids:
            stmt = self.apply_feed_filter(stmt, feed_ids)
        if folder_id:
            stmt = self.apply_folder_filter(stmt, folder_id)
        if is_read is not None:
            stmt = self.apply_read_status_filter(stmt, is_read)
        if is_read_later is not None:
            stmt = self.apply_read_later_filter(stmt, is_read_later)
        if is_favorite is not None:
            stmt = self.apply_favorite_filter(stmt, is_favorite)
        if feed_is_favorite is not None:
            stmt = self.apply_feed_favorite_filter(stmt, feed_is_favorite)

        stmt = self.apply_date_range_filter(stmt, published_since, published_until)
        stmt = self.apply_sorting(stmt, sort_by, sort_order)

        return stmt.offset(skip).limit(limit)

    def build_count_query(
        self,
        feed_ids: list[UUID] | None = None,
        folder_id: UUID | None = None,
        is_read: bool | None = None,
        is_read_later: bool | None = None,
        is_favorite: bool | None = None,
        feed_is_favorite: bool | None = None,
        published_since: datetime | None = None,
        published_until: datetime | None = None,
    ) -> Select:
        """Build count query."""
        stmt = select(func.count(FeedArticle.id))

        # Join user_entries for filtering
        stmt = stmt.outerjoin(
            UserEntry,
            (UserEntry.content_id == FeedArticle.content_id) & (UserEntry.user_id == self.user_id),
        )

        # Join subscriptions if not preview
        if not self.allow_preview:
            stmt = stmt.join(FeedSubscription, FeedArticle.feed_id == FeedSubscription.feed_id).filter(
                FeedSubscription.user_id == self.user_id
            )

        if feed_ids:
            stmt = stmt.filter(FeedArticle.feed_id.in_(feed_ids))
        if folder_id:
            stmt = stmt.filter(FeedSubscription.folder_id == folder_id)
        if is_read is not None:
            stmt = self.apply_read_status_filter(stmt, is_read)
        if is_read_later is not None:
            stmt = self.apply_read_later_filter(stmt, is_read_later)
        if is_favorite is not None:
            stmt = self.apply_favorite_filter(stmt, is_favorite)
        if feed_is_favorite is not None:
            stmt = self.apply_feed_favorite_filter(stmt, feed_is_favorite)

        stmt = self.apply_date_range_filter(stmt, published_since, published_until)

        return stmt
