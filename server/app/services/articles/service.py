"""
Article Service Layer.

Handles business logic that sits on top of CRUD:
1. Response transformation (DB Models -> Pydantic).
2. Auto-extraction of content for incomplete articles.
"""

from uuid import UUID

import structlog

from app.core.constants import AUTO_EXTRACT_ON_FETCH, MIN_CONTENT_LENGTH
from app.crud.article import reader
from app.services.articles import scrape
from app.services.feeds.service import SessionFactory
from app.services.user.resource_limits import check_daily_scrape_limit
from app.typing.entries import EntryDetail
from app.utils.text import is_content_complete

logger = structlog.get_logger(__name__)


async def _enrich_with_auto_extract(db_factory: SessionFactory, article: EntryDetail, user_id: UUID) -> EntryDetail:
    """
    Business Logic: Checks if content is short/incomplete and attempts
    to fetch full content from the source URL. Returns enriched response.

    Respects the user's daily scrape quota (free tier: 5/day). When the quota is
    exhausted the extraction is skipped and the article is returned unchanged
    (no error) so plain reading of the cached content still works.
    """
    if article.link and str(article.link).startswith("newsletter://"):
        return article

    if not is_content_complete(article.content, threshold=MIN_CONTENT_LENGTH):
        if article.link:
            async with db_factory() as db:
                allowed = await check_daily_scrape_limit(db, user_id)
            if not allowed:
                logger.info(
                    "Skipping auto-extract: daily scrape quota reached",
                    article_id=article.id,
                    user_id=str(user_id),
                )
                return article

            logger.info("Auto-extracting content", article_id=article.id)

            extracted, error = await scrape.extract_full_content(str(article.link), article.title)

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
    auto_extract: bool = True,
) -> EntryDetail | None:
    """
    Get single article with business logic (Auto-Extraction).

    Set ``auto_extract=False`` when the caller only needs the stored article
    metadata (e.g. an enhancement endpoint that runs its own quota-checked
    extraction) so the implicit scrape does not run or consume the daily quota.
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
        feed_article, user_entry, subscription = row  # type: ignore
        response = transformer.to_entry_detail(feed_article, user_entry, subscription=subscription)

    # 3. Apply Business Logic (Auto Extract)
    if auto_extract and AUTO_EXTRACT_ON_FETCH:
        response = await _enrich_with_auto_extract(db_factory, response, user_id)

    return response
