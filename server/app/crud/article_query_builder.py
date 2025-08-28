"""Query builder for article queries."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import Select

from app.models.rss_models import (
    ArticleContent,
    Feed,
    FeedArticle,
    FeedSubscription,
    UserArticleState,
)


class ArticleQueryBuilder:
    """Builds SQLAlchemy queries for article filtering and sorting."""

    def __init__(self, user_id: UUID):
        self.user_id = user_id

    def build_base_query(self) -> tuple[Select, Select]:
        """Build the base query and count query."""
        stmt = (
            select(FeedArticle, UserArticleState)
            .options(selectinload(FeedArticle.feed), selectinload(FeedArticle.content))
            .join(ArticleContent, FeedArticle.content_id == ArticleContent.id)
            .outerjoin(
                UserArticleState,
                (UserArticleState.article_id == FeedArticle.id)
                & (UserArticleState.user_id == self.user_id),
            )
        )
        count_stmt = (
            select(func.count(FeedArticle.id))
            .join(ArticleContent, FeedArticle.content_id == ArticleContent.id)
            .outerjoin(
                UserArticleState,
                (UserArticleState.article_id == FeedArticle.id)
                & (UserArticleState.user_id == self.user_id),
            )
        )
        return stmt, count_stmt

    def apply_feed_filter(
        self, stmt: Select, count_stmt: Select, feed_ids: list[UUID]
    ) -> tuple[Select, Select]:
        """Apply feed ID filter to queries."""
        stmt = stmt.filter(FeedArticle.feed_id.in_(feed_ids))
        count_stmt = count_stmt.filter(FeedArticle.feed_id.in_(feed_ids))
        return stmt, count_stmt

    def apply_folder_filter(
        self, stmt: Select, count_stmt: Select, folder_id: UUID
    ) -> tuple[Select, Select]:
        """Apply folder filter to queries."""
        stmt = (
            stmt.join(Feed, FeedArticle.feed_id == Feed.id)
            .join(
                FeedSubscription,
                (FeedSubscription.feed_id == Feed.id)
                & (FeedSubscription.user_id == self.user_id),
            )
            .filter(FeedSubscription.folder_id == folder_id)
        )

        count_stmt = (
            count_stmt.join(Feed, FeedArticle.feed_id == Feed.id)
            .join(
                FeedSubscription,
                (FeedSubscription.feed_id == Feed.id)
                & (FeedSubscription.user_id == self.user_id),
            )
            .filter(FeedSubscription.folder_id == folder_id)
        )
        return stmt, count_stmt

    def apply_read_status_filter(
        self, stmt: Select, count_stmt: Select, is_read: bool
    ) -> tuple[Select, Select]:
        """Apply read status filter to queries."""
        if is_read:
            # Only show articles that are explicitly marked as read
            stmt = stmt.filter(UserArticleState.is_read == True)
            count_stmt = count_stmt.filter(UserArticleState.is_read == True)
        else:
            # Show articles that are either not tracked (NULL) or explicitly unread
            stmt = stmt.filter(
                or_(
                    UserArticleState.is_read.is_(None),
                    UserArticleState.is_read == False,
                )
            )
            count_stmt = count_stmt.filter(
                or_(
                    UserArticleState.is_read.is_(None),
                    UserArticleState.is_read == False,
                )
            )
        return stmt, count_stmt

    def apply_read_later_filter(
        self, stmt: Select, count_stmt: Select, is_read_later: bool
    ) -> tuple[Select, Select]:
        """Apply read later filter to queries."""
        if is_read_later:
            # Only show articles that are explicitly marked as read later
            stmt = stmt.filter(UserArticleState.is_read_later == True)
            count_stmt = count_stmt.filter(UserArticleState.is_read_later == True)
        else:
            # Show articles that are either not tracked (NULL) or explicitly not read later
            stmt = stmt.filter(
                or_(
                    UserArticleState.is_read_later.is_(None),
                    UserArticleState.is_read_later == False,
                )
            )
            count_stmt = count_stmt.filter(
                or_(
                    UserArticleState.is_read_later.is_(None),
                    UserArticleState.is_read_later == False,
                )
            )
        return stmt, count_stmt

    def apply_favorite_filter(
        self, stmt: Select, count_stmt: Select, is_favorite: bool
    ) -> tuple[Select, Select]:
        """Apply favorite filter to queries."""
        if is_favorite:
            # Only show articles that are explicitly marked as favorite
            stmt = stmt.filter(UserArticleState.is_favorite == True)
            count_stmt = count_stmt.filter(UserArticleState.is_favorite == True)
        else:
            # Show articles that are either not tracked (NULL) or explicitly not favorite
            stmt = stmt.filter(
                or_(
                    UserArticleState.is_favorite.is_(None),
                    UserArticleState.is_favorite == False,
                )
            )
            count_stmt = count_stmt.filter(
                or_(
                    UserArticleState.is_favorite.is_(None),
                    UserArticleState.is_favorite == False,
                )
            )
        return stmt, count_stmt

    def apply_feed_favorite_filter(
        self,
        stmt: Select,
        count_stmt: Select,
        feed_is_favorite: bool,
        folder_joined: bool = False,
    ) -> tuple[Select, Select]:
        """Apply feed favorite filter to queries."""
        if not folder_joined:  # Only join FeedSubscription if we haven't already
            stmt = stmt.join(Feed, FeedArticle.feed_id == Feed.id).join(
                FeedSubscription,
                (FeedSubscription.feed_id == Feed.id)
                & (FeedSubscription.user_id == self.user_id),
            )
            count_stmt = count_stmt.join(Feed, FeedArticle.feed_id == Feed.id).join(
                FeedSubscription,
                (FeedSubscription.feed_id == Feed.id)
                & (FeedSubscription.user_id == self.user_id),
            )
        stmt = stmt.filter(FeedSubscription.is_favorite == feed_is_favorite)
        count_stmt = count_stmt.filter(FeedSubscription.is_favorite == feed_is_favorite)
        return stmt, count_stmt

    def apply_date_range_filter(
        self,
        stmt: Select,
        count_stmt: Select,
        published_since: datetime = None,
        published_until: datetime = None,
    ) -> tuple[Select, Select]:
        """Apply date range filter to queries."""
        if published_since:
            stmt = stmt.filter(ArticleContent.published_at >= published_since)
            count_stmt = count_stmt.filter(
                ArticleContent.published_at >= published_since
            )
        if published_until:
            stmt = stmt.filter(ArticleContent.published_at <= published_until)
            count_stmt = count_stmt.filter(
                ArticleContent.published_at <= published_until
            )
        return stmt, count_stmt

    def apply_search_filter(
        self, stmt: Select, count_stmt: Select, search_query: str
    ) -> tuple[Select, Select]:
        """Apply search filter to queries."""
        search_filter = or_(
            ArticleContent.title.ilike(f"%{search_query}%"),
            ArticleContent.description.ilike(f"%{search_query}%"),
        )
        stmt = stmt.filter(search_filter)
        count_stmt = count_stmt.filter(search_filter)
        return stmt, count_stmt

    def apply_sorting(
        self, stmt: Select, sort_by: str = "published_at", sort_order: str = "desc"
    ) -> Select:
        """Apply sorting to query."""
        # Map sort_by to correct table columns
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
            if sort_by == "read_at":
                stmt = stmt.order_by(asc(sort_column).nulls_last())
            else:
                stmt = stmt.order_by(asc(sort_column))
        else:
            if sort_by == "read_at":
                stmt = stmt.order_by(desc(sort_column).nulls_first())
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
    ) -> tuple[Select, Select]:
        """Build a complete filtered and sorted query."""
        stmt, count_stmt = self.build_base_query()

        folder_joined = False

        if feed_ids:
            stmt, count_stmt = self.apply_feed_filter(stmt, count_stmt, feed_ids)

        if folder_id:
            stmt, count_stmt = self.apply_folder_filter(stmt, count_stmt, folder_id)
            folder_joined = True

        if is_read is not None:
            stmt, count_stmt = self.apply_read_status_filter(stmt, count_stmt, is_read)

        if is_read_later is not None:
            stmt, count_stmt = self.apply_read_later_filter(
                stmt, count_stmt, is_read_later
            )

        if is_favorite is not None:
            stmt, count_stmt = self.apply_favorite_filter(stmt, count_stmt, is_favorite)

        if feed_is_favorite is not None:
            stmt, count_stmt = self.apply_feed_favorite_filter(
                stmt, count_stmt, feed_is_favorite, folder_joined
            )

        if published_since or published_until:
            stmt, count_stmt = self.apply_date_range_filter(
                stmt, count_stmt, published_since, published_until
            )

        if search_query:
            stmt, count_stmt = self.apply_search_filter(stmt, count_stmt, search_query)

        stmt = self.apply_sorting(stmt, sort_by, sort_order)
        stmt = stmt.offset(skip).limit(limit)

        return stmt, count_stmt
