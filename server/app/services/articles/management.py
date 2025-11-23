"""Service for article management operations."""

from datetime import datetime
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AUTO_EXTRACT_ON_FETCH, MIN_CONTENT_LENGTH
from app.crud.article import (
    ArticleTransformer,
    count_articles_filtered,
    count_read_later_articles,
    count_today_articles,
    count_unread_articles,
    get_all_unread_counts,
    get_article_by_id,
    get_articles_filtered,
    get_recently_read_articles,
    update_article_status,
)
from app.models import ClippedArticle, FeedArticle
from app.schemas import (
    ArticleResponse,
    ArticleUpdate,
    PaginatedResponse,
)
from app.services.articles.scrape import ContentExtractionService
from app.utils.content_detector import is_content_complete

logger = structlog.get_logger(__name__)


class ArticleManagementService:
    """Service for managing articles."""

    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id
        self.transformer = ArticleTransformer()
        self.extraction_service = ContentExtractionService()

    async def get_articles(
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
        page: int = 1,
        size: int = 50,
        allow_preview: bool = False,
    ) -> PaginatedResponse[ArticleResponse]:
        """Get articles with filtering and pagination."""
        skip = (page - 1) * size

        # Get total count for pagination (separate COUNT query with same filters)
        total = await count_articles_filtered(
            db=self.db,
            user_id=self.user_id,
            feed_ids=feed_ids,
            folder_id=folder_id,
            is_read=is_read,
            is_read_later=is_read_later,
            is_favorite=is_favorite,
            feed_is_favorite=feed_is_favorite,
            published_since=published_since,
            published_until=published_until,
            allow_preview=allow_preview,
        )

        articles_db = await get_articles_filtered(
            db=self.db,
            user_id=self.user_id,
            feed_ids=feed_ids,
            folder_id=folder_id,
            is_read=is_read,
            is_read_later=is_read_later,
            is_favorite=is_favorite,
            feed_is_favorite=feed_is_favorite,
            published_since=published_since,
            published_until=published_until,
            sort_by=sort_by,
            sort_order=sort_order,
            skip=skip,
            limit=size,
            allow_preview=allow_preview,
        )

        articles = [self.transformer.feed_to_unified(article) for article in articles_db]

        # Calculate total pages based on total count
        pages = (total + size - 1) // size if total > 0 else 0

        result = PaginatedResponse(
            items=articles,
            total=total,
            page=page,
            size=size,
            pages=pages,
        )

        return result

    async def get_article(self, article_id: UUID, allow_preview: bool = False) -> ArticleResponse | None:
        """Get a single article by its ID with automatic content extraction."""
        logger.info(
            "Getting article",
            article_id=article_id,
            user_id=self.user_id,
            allow_preview=allow_preview,
        )

        article = await get_article_by_id(
            db=self.db,
            article_id=article_id,
            user_id=self.user_id,
            allow_preview=allow_preview,
        )

        if article:
            # Handle both FeedArticle tuples and ClippedArticle types
            # Transform article to unified response
            article_response: ArticleResponse | None = None
            if isinstance(article, ClippedArticle):
                article_response = self.transformer.clipped_to_unified(article)
            elif isinstance(article, tuple):
                # This is a (FeedArticle, UserArticleState) tuple
                article_response = self.transformer.feed_to_unified(article)
            elif isinstance(article, FeedArticle):
                # Legacy single FeedArticle (shouldn't happen with new schema but kept for safety)
                article_response = self.transformer.feed_to_unified(article)

            # Attempt automatic content extraction if enabled
            if article_response and AUTO_EXTRACT_ON_FETCH:
                await self._auto_extract_content(article_response)

            return article_response
        return None

    async def _auto_extract_content(self, article: ArticleResponse) -> None:
        """
        Automatically extract full content if article content is incomplete.

        This method checks if the article's content is complete, and if not,
        attempts to extract the full content from the article's URL.

        Args:
            article: The article response object to potentially enrich with extracted content
        """
        # Check if content appears incomplete
        if not is_content_complete(article.content, threshold=MIN_CONTENT_LENGTH):
            # Check if article has a valid link to extract from
            if article.link:
                try:
                    logger.info(
                        "Auto-extracting content for incomplete article",
                        article_id=article.id,
                        content_length=len(article.content or ""),
                        link=str(article.link),
                    )

                    # Extract full content, passing title to remove duplicate headings
                    extracted_content, extracted_read_time, error = await self.extraction_service.extract_full_content(
                        str(article.link), article.title
                    )

                    if extracted_content and not error:
                        # Update article response with extracted content
                        article.extracted_content = extracted_content
                        article.extracted_read_time = extracted_read_time

                        logger.info(
                            "Successfully auto-extracted content",
                            article_id=article.id,
                            extracted_length=len(extracted_content),
                            extracted_read_time=extracted_read_time,
                        )
                    else:
                        logger.warning(
                            "Auto-extraction failed",
                            article_id=article.id,
                            error=error,
                        )
                except Exception as e:
                    # Log error but don't fail the request - graceful degradation
                    logger.error(
                        "Exception during auto-extraction",
                        article_id=article.id,
                        error=str(e),
                        exc_info=True,
                    )

    async def get_unread_articles(
        self,
        folder_id: UUID | None = None,
        feed_id: UUID | None = None,
        tag_names: list[str] | None = None,
        search_query: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> PaginatedResponse[ArticleResponse]:
        """Get unread articles with filtering."""
        articles_db = await get_articles_filtered(
            db=self.db,
            user_id=self.user_id,
            folder_id=folder_id,
            feed_ids=[feed_id] if feed_id else None,
            is_read=False,
            search_query=search_query,
            skip=skip,
            limit=limit,
        )

        articles = [self.transformer.feed_to_unified(article) for article in articles_db]

        page = skip // limit + 1
        pages = page if len(articles) < limit else page + 1

        return PaginatedResponse(
            items=articles,
            total=0,
            page=page,
            size=limit,
            pages=pages,
        )

    async def get_read_later_articles(
        self,
        skip: int = 0,
        limit: int = 50,
    ) -> PaginatedResponse[ArticleResponse]:
        """Get articles marked as read later (includes both RSS feed and clipped articles)."""
        # Get read later articles using the same filtering as other methods
        articles_db = await get_articles_filtered(
            db=self.db,
            user_id=self.user_id,
            is_read_later=True,
            skip=skip,
            limit=limit,
            sort_by="published_at",
            sort_order="desc",
        )

        articles = [self.transformer.feed_to_unified(article) for article in articles_db]

        page = skip // limit + 1
        pages = page if len(articles) < limit else page + 1

        return PaginatedResponse(
            items=articles,
            total=0,
            page=page,
            size=limit,
            pages=pages,
        )

    async def get_recently_read_articles(
        self,
        skip: int = 0,
        limit: int = 50,
    ) -> PaginatedResponse[ArticleResponse]:
        """Get recently read articles."""
        articles_db = await get_recently_read_articles(
            db=self.db,
            user_id=self.user_id,
            skip=skip,
            limit=limit,
        )

        # Transform tuples of (FeedArticle, UserArticleState) to ArticleResponse
        # articles_db contains Row objects, so we need to unpack them
        articles = [
            self.transformer.feed_to_unified((row[0], row[1]))  # row[0] = FeedArticle, row[1] = UserArticleState
            for row in articles_db
        ]

        page = skip // limit + 1
        pages = page if len(articles) < limit else page + 1

        return PaginatedResponse(
            items=articles,
            total=0,
            page=page,
            size=limit,
            pages=pages,
        )

    async def update_article(
        self, article_id: UUID, article_in: ArticleUpdate, article_type: str = "feed"
    ) -> ArticleResponse | None:
        """Update an article (mark as read/unread, favorite, etc.)."""
        logger.info(
            "Updating article",
            article_id=article_id,
            user_id=self.user_id,
            article_type=article_type,
        )

        updated_article = await update_article_status(
            db=self.db,
            article_id=article_id,
            article_in=article_in,
            user_id=self.user_id,
            article_type=article_type,
        )

        if updated_article:
            return self.transformer.to_unified(updated_article)
        return None

    async def get_total_unread_count(self) -> int:
        """Get total count of unread articles for the user."""
        return await count_unread_articles(db=self.db, user_id=self.user_id)

    async def get_read_later_count(self) -> int:
        """Get total count of read later articles for the user."""
        return await count_read_later_articles(db=self.db, user_id=self.user_id)

    async def get_today_count(self) -> int:
        """Get total count of articles published today for the user."""
        return await count_today_articles(db=self.db, user_id=self.user_id)

    async def get_all_unread_counts(self) -> dict[str, int]:
        """Get all unread counts in a single optimized query.

        Returns:
            dict with keys: total_unread, read_later_count, today_count
        """
        return await get_all_unread_counts(db=self.db, user_id=self.user_id)
