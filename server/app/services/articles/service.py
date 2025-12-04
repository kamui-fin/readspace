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
from app.crud.article import reader
from app.services.articles import scrape
from app.services.feeds.service import SessionFactory
from app.typing.entries import EntryDetail
from app.utils.text import is_content_complete

logger = structlog.get_logger(__name__)


async def _enrich_with_auto_extract(article: EntryDetail) -> EntryDetail:
    """
    Business Logic: Checks if content is short/incomplete and attempts
    to fetch full content from the source URL. Returns enriched response.
    """
    if not is_content_complete(article.content, threshold=MIN_CONTENT_LENGTH):
        if article.link:
            logger.info("Auto-extracting content", article_id=article.id)

            extracted, error = await scrape.extract_full_content(
                str(article.link), article.title
            )

            if extracted and not error:
                # Return new object with updates
                return article.model_copy(
                    update={
                        "extracted_content": extracted,
                    }
                )
            else:
                logger.warning("Auto-extraction failed", error=error)

    return article


async def get_article_details(
    db_factory: SessionFactory,
    article_id: UUID,
    user_id: UUID,
    allow_preview: bool = False,
    is_clipped: bool = False,
) -> EntryDetail | None:
    """
    Get single article with business logic (Auto-Extraction).
    """
    # 1. Call CRUD
    async with db_factory() as db:
        if is_clipped:
            row = await reader.get_clipped_article_by_id(
                db,
                article_id=article_id,
                user_id=user_id,
            )
        else:
            row = await reader.get_article_by_id(
                db,
                article_id=article_id,
                user_id=user_id,
                load_full_content=True,
                allow_preview=allow_preview,
            )

    if not row:
        return None

    # 2. Transform directly to Pydantic
    transformer = reader.ArticleTransformer()
    if is_clipped:
        content, user_entry = row  # type: ignore
        response = transformer.clipped_to_entry_detail(content, user_entry)
    else:
        feed_article, user_entry = row  # type: ignore
        response = transformer.to_entry_detail(feed_article, user_entry)

    # 3. Apply Business Logic (Auto Extract)
    if AUTO_EXTRACT_ON_FETCH:
        response = await _enrich_with_auto_extract(response)

    return response
