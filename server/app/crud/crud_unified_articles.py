"""Unified CRUD operations for both feed and clipped articles."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.query_builders.article_query_builder import ArticleQueryBuilder
from app.crud.transformers.article_transformer import ArticleTransformer
from app.schemas.rss_schemas import ArticleResponse


class CRUDUnifiedArticles:
    """CRUD operations for unified article views combining feed and clipped articles."""

    def __init__(self) -> None:
        self.query_builder = ArticleQueryBuilder()
        self.transformer = ArticleTransformer()

    async def get_unified_articles_by_user(
        self,
        db: AsyncSession,
        user_id: UUID,
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
        include_feed_articles: bool = True,
        include_clipped_articles: bool = True,
    ) -> list[ArticleResponse]:
        """Get unified articles combining feed and clipped articles with filtering."""

        # Prepare filters
        filters = {
            "feed_ids": feed_ids,
            "folder_id": folder_id,
            "is_read": is_read,
            "is_read_later": is_read_later,
            "is_favorite": is_favorite,
            "feed_is_favorite": feed_is_favorite,
            "published_since": published_since,
            "published_until": published_until,
            "search_query": search_query,
        }

        articles = []

        if include_feed_articles and include_clipped_articles:
            # Build union query
            feed_query = self.query_builder.build_feed_article_query(user_id, filters)
            clipped_query = self.query_builder.build_clipped_article_query(user_id, filters)

            union_query = self.query_builder.build_union_query(
                feed_query, clipped_query, sort_by, sort_order, skip, limit
            )

            # Execute query
            result = await db.execute(union_query)
            rows = result.fetchall()

            # Transform to response objects
            articles = [self.transformer.raw_row_to_unified(row) for row in rows]

        elif include_feed_articles:
            # Only feed articles
            feed_query = self.query_builder.build_feed_article_query(user_id, filters)

            # Apply sorting and pagination
            feed_query = self._apply_sorting_and_pagination(feed_query, sort_by, sort_order, skip, limit)

            result = await db.execute(feed_query)
            feed_articles = result.scalars().all()

            articles = [self.transformer.feed_to_unified(fa) for fa in feed_articles]

        elif include_clipped_articles:
            # Only clipped articles
            clipped_query = self.query_builder.build_clipped_article_query(user_id, filters)

            # Apply sorting and pagination
            clipped_query = self._apply_sorting_and_pagination(clipped_query, sort_by, sort_order, skip, limit)

            result = await db.execute(clipped_query)
            clipped_articles = result.scalars().all()

            articles = [self.transformer.clipped_to_unified(ca) for ca in clipped_articles]

        return articles

    def _apply_sorting_and_pagination(self, query: Any, sort_by: str, sort_order: str, skip: int, limit: int) -> Any:
        """Apply sorting and pagination to a query."""
        from sqlalchemy import asc, desc

        # Apply sorting
        sort_column = None
        try:
            if (
                hasattr(query, "column_descriptions")
                and query.column_descriptions
                and len(query.column_descriptions) > 0
                and "type" in query.column_descriptions[0]
            ):
                model_type = query.column_descriptions[0]["type"]

                if sort_by == "published_at":
                    # Handle different models
                    if hasattr(model_type, "published_at"):
                        sort_column = model_type.published_at
                    elif hasattr(model_type, "created_at"):
                        sort_column = model_type.created_at
                elif sort_by == "title":
                    if hasattr(model_type, "title"):
                        sort_column = model_type.title
        except (AttributeError, IndexError, TypeError, KeyError):
            sort_column = None

        if sort_column is not None:
            if sort_order.lower() == "desc":
                query = query.order_by(desc(sort_column))
            else:
                query = query.order_by(asc(sort_column))

        # Apply pagination
        if skip:
            query = query.offset(skip)
        if limit:
            query = query.limit(limit)

        return query


# Create instance for importing
crud_unified_articles = CRUDUnifiedArticles()
