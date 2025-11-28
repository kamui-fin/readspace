"""
Article Service Layer.

Handles business logic that sits on top of CRUD:
1. Response transformation (DB Models -> Pydantic).
2. Auto-extraction of content for incomplete articles.
"""

from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AUTO_EXTRACT_ON_FETCH, MIN_CONTENT_LENGTH
from app.crud.article import actions, reader
from app.crud.article.reader import CursorPaginationResult
from app.services.articles import scrape
from app.typing.articles import (
    ArticleResponse,
    ArticleUpdate,
)
from app.utils.text import is_content_complete

logger = structlog.get_logger(__name__)


async def _enrich_with_auto_extract(article: ArticleResponse) -> ArticleResponse:
    """
    Business Logic: Checks if content is short/incomplete and attempts
    to fetch full content from the source URL. Returns enriched response.
    """
    if not is_content_complete(article.content, threshold=MIN_CONTENT_LENGTH):
        if article.link:
            logger.info("Auto-extracting content", article_id=article.id)

            extracted, read_time, error = await scrape.extract_full_content(
                str(article.link), article.title
            )

            if extracted and not error:
                # Return new object with updates
                return article.model_copy(
                    update={
                        "extracted_content": extracted,
                        "extracted_read_time": read_time,
                    }
                )
            else:
                logger.warning("Auto-extraction failed", error=error)

    return article


async def get_article_details(
    db: AsyncSession, article_id: UUID, user_id: UUID, allow_preview: bool = False
) -> ArticleResponse | None:
    """
    Get single article with business logic (Auto-Extraction).
    """
    # 1. Call CRUD
    row = await reader.get_article_by_id(
        db, article_id=article_id, user_id=user_id, load_full_content=True
    )

    if not row:
        return None

    # 2. Transform directly to Pydantic
    feed_article, user_entry = row
    transformer = reader.ArticleTransformer()
    response = transformer.entry_to_response(
        feed_article, user_entry, include_content=True
    )

    # 3. Apply Business Logic (Auto Extract)
    if AUTO_EXTRACT_ON_FETCH:
        response = await _enrich_with_auto_extract(response)

    return response
