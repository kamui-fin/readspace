"""Query builder for article-related database operations."""

from uuid import UUID

from sqlalchemy import String, asc, desc, func, or_, select, union_all
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import selectinload

from app.models.rss_models import (
    ArticleContent,
    ClippedArticle,
    Feed,
    FeedArticle,
)


class ArticleQueryBuilder:
    """Builder for complex article queries with filtering and sorting."""

    def build_feed_article_query(self, user_id: UUID, filters: dict) -> select:
        """Build query for feed articles with filters."""
        query = (
            select(FeedArticle)
            .options(
                selectinload(FeedArticle.content),
                selectinload(FeedArticle.feed),
            )
            .filter(FeedArticle.user_id == user_id)
        )

        return self._apply_feed_article_filters(query, filters)

    def build_clipped_article_query(self, user_id: UUID, filters: dict) -> select:
        """Build query for clipped articles with filters."""
        query = select(ClippedArticle).filter(ClippedArticle.user_id == user_id)

        return self._apply_clipped_article_filters(query, filters)

    def build_union_query(
        self,
        feed_query: select,
        clipped_query: select,
        sort_by: str = "published_at",
        sort_order: str = "desc",
        skip: int = 0,
        limit: int = 100,
    ) -> select:
        """Build union query combining feed and clipped articles."""
        # Create subqueries with common fields for union
        feed_subquery = self._normalize_feed_article_query(feed_query)
        clipped_subquery = self._normalize_clipped_article_query(clipped_query)

        # Union the queries
        union_query = union_all(feed_subquery, clipped_subquery)

        # Create alias for the union
        unified_articles = union_query.alias("unified_articles")

        # Create final query with sorting and pagination
        final_query = select(unified_articles)

        # Sort the results
        sort_column = self._get_sort_column(unified_articles, sort_by)
        if sort_order.lower() == "desc":
            final_query = final_query.order_by(desc(sort_column))
        else:
            final_query = final_query.order_by(asc(sort_column))

        # Apply pagination
        if skip:
            final_query = final_query.offset(skip)
        if limit:
            final_query = final_query.limit(limit)

        return final_query

    def _apply_feed_article_filters(self, query: select, filters: dict) -> select:
        """Apply filters to feed article query."""
        feed_ids = filters.get("feed_ids")
        if feed_ids:
            query = query.filter(FeedArticle.feed_id.in_(feed_ids))

        folder_id = filters.get("folder_id")
        if folder_id:
            query = query.join(Feed, FeedArticle.feed_id == Feed.id).filter(
                Feed.folder_id == folder_id
            )

        is_read = filters.get("is_read")
        if is_read is not None:
            query = query.filter(FeedArticle.is_read == is_read)

        is_read_later = filters.get("is_read_later")
        if is_read_later is not None:
            query = query.filter(FeedArticle.is_read_later == is_read_later)

        is_favorite = filters.get("is_favorite")
        if is_favorite is not None:
            query = query.filter(FeedArticle.is_favorite == is_favorite)

        feed_is_favorite = filters.get("feed_is_favorite")
        if feed_is_favorite is not None:
            if not folder_id:  # Only join if not already joined
                query = query.join(Feed, FeedArticle.feed_id == Feed.id)
            query = query.filter(Feed.is_favorite == feed_is_favorite)

        # Date range filters
        published_since = filters.get("published_since")
        published_until = filters.get("published_until")
        if published_since or published_until:
            query = query.join(
                ArticleContent, FeedArticle.content_id == ArticleContent.id
            )
            if published_since:
                query = query.filter(ArticleContent.published_at >= published_since)
            if published_until:
                query = query.filter(ArticleContent.published_at <= published_until)

        # Search query
        search_query = filters.get("search_query")
        if search_query:
            if not (published_since or published_until):  # Join if not already joined
                query = query.join(
                    ArticleContent, FeedArticle.content_id == ArticleContent.id
                )
            search_condition = or_(
                ArticleContent.title.ilike(f"%{search_query}%"),
                ArticleContent.description.ilike(f"%{search_query}%"),
                ArticleContent.content.ilike(f"%{search_query}%"),
            )
            query = query.filter(search_condition)

        return query

    def _apply_clipped_article_filters(self, query: select, filters: dict) -> select:
        """Apply filters to clipped article query."""
        is_read = filters.get("is_read")
        if is_read is not None:
            query = query.filter(ClippedArticle.is_read == is_read)

        is_read_later = filters.get("is_read_later")
        if is_read_later is not None:
            query = query.filter(ClippedArticle.is_read_later == is_read_later)

        is_favorite = filters.get("is_favorite")
        if is_favorite is not None:
            query = query.filter(ClippedArticle.is_favorite == is_favorite)

        # Date range filters
        published_since = filters.get("published_since")
        if published_since:
            query = query.filter(ClippedArticle.created_at >= published_since)

        published_until = filters.get("published_until")
        if published_until:
            query = query.filter(ClippedArticle.created_at <= published_until)

        # Search query
        search_query = filters.get("search_query")
        if search_query:
            query = query.join(
                ArticleContent, ClippedArticle.content_id == ArticleContent.id
            )
            search_condition = or_(
                ArticleContent.title.ilike(f"%{search_query}%"),
                ArticleContent.description.ilike(f"%{search_query}%"),
                ArticleContent.content.ilike(f"%{search_query}%"),
            )
            query = query.filter(search_condition)

        return query

    def _normalize_feed_article_query(self, query: select) -> select:
        """Normalize feed article query for union compatibility."""
        # Create a subquery and join the necessary tables
        subq = query.subquery()

        # Select common fields that exist in both article types
        return select(
            subq.c.id,
            subq.c.user_id,
            ArticleContent.title,
            ArticleContent.link,
            ArticleContent.description,
            ArticleContent.content,
            ArticleContent.published_at,
            ArticleContent.image_url,
            ArticleContent.estimated_read_time_minutes.label("read_time"),
            subq.c.is_read,
            subq.c.is_read_later,
            subq.c.is_favorite,
            subq.c.feed_id,
            func.cast(None, PGUUID(as_uuid=True)).label(
                "clipped_article_id"
            ),  # Placeholder
            Feed.title.label("feed_title"),
            Feed.link.label("feed_link"),
            func.literal("feed").label("article_type"),
        ).select_from(
            subq.join(ArticleContent, subq.c.content_id == ArticleContent.id).join(
                Feed, subq.c.feed_id == Feed.id
            )
        )

    def _normalize_clipped_article_query(self, query: select) -> select:
        """Normalize clipped article query for union compatibility."""
        # Create a subquery and join the necessary tables
        subq = query.subquery()

        return select(
            subq.c.id,
            subq.c.user_id,
            ArticleContent.title,
            ArticleContent.link,
            ArticleContent.description,
            ArticleContent.content,
            subq.c.created_at.label("published_at"),  # Use created_at as published_at
            ArticleContent.image_url,
            ArticleContent.estimated_read_time_minutes.label("read_time"),
            subq.c.is_read,
            subq.c.is_read_later,
            subq.c.is_favorite,
            func.cast(None, PGUUID(as_uuid=True)).label("feed_id"),  # Placeholder
            subq.c.id.label("clipped_article_id"),
            func.cast(None, String).label("feed_title"),  # Placeholder
            func.cast(None, String).label("feed_link"),  # Placeholder
            func.literal("clipped").label("article_type"),
        ).select_from(subq.join(ArticleContent, subq.c.content_id == ArticleContent.id))

    def _get_sort_column(self, table, sort_by: str):
        """Get sort column based on sort_by parameter."""
        sort_columns = {
            "published_at": table.c.published_at,
            "title": table.c.title,
            "created_at": table.c.published_at,  # Map to published_at in unified view
        }
        return sort_columns.get(sort_by, table.c.published_at)

    def build_count_query(self, base_query: select) -> select:
        """Build count query from base query."""
        # Extract the filter conditions from the base query
        return select(func.count()).select_from(base_query.subquery())
