"""
Article Service Layer.

Handles business logic that sits on top of CRUD:
1. Response transformation (DB Models -> Pydantic).
2. Full-text extraction for articles whose feed only supplied a teaser.
"""

from uuid import UUID

import structlog

from app.core.constants import (
    AUTO_EXTRACT_ON_FETCH,
    EXTRACTION_MIN_GAIN_RATIO,
    MIN_CONTENT_LENGTH,
    NEWSLETTER_URL_SCHEME,
)
from app.crud.article import actions, reader
from app.services.articles import scrape
from app.services.feeds.service import SessionFactory
from app.services.user.resource_limits import check_daily_scrape_limit
from app.typing.entries import EntryDetail
from app.utils.text import is_content_complete, visible_text_length

logger = structlog.get_logger(__name__)


def is_extraction_worthwhile(extracted: str | None, existing_content: str | None) -> bool:
    """
    Decide whether extracted text is a real improvement on what the feed already gave us.

    A scrape that comes back no longer than the feed's own content is usually a paywall
    stub, a cookie wall, or the same teaser again — storing it would swap good content for
    worse and show the reader an empty "Full Text" view.
    """
    extracted_length = visible_text_length(extracted)
    if not extracted_length:
        return False
    return extracted_length >= visible_text_length(existing_content) * EXTRACTION_MIN_GAIN_RATIO


def should_attempt_extraction(article: EntryDetail) -> bool:
    """
    Whether this article is a candidate for a full-text scrape.

    Extraction is skipped when the article has no source URL to scrape, when it is a
    newsletter (the email *is* the full content), when the feed already published the
    whole article, and when a previous attempt already ran — ``extracted_at`` is stamped
    even on failure, so paywalled articles are not retried on every open.
    """
    if not article.link or str(article.link).startswith(NEWSLETTER_URL_SCHEME):
        return False
    if article.extracted_content or article.extraction_attempted:
        return False
    return not is_content_complete(article.content, threshold=MIN_CONTENT_LENGTH)


async def extract_and_store(
    db_factory: SessionFactory,
    article: EntryDetail,
    user_id: UUID,
) -> EntryDetail:
    """
    Scrape the article's source URL and persist the result against the shared content row.

    The daily scrape quota is only charged when a scrape actually runs — articles served
    from the stored column cost the user nothing. When the quota is exhausted the article
    is returned unchanged (no error), so reading the feed's own content still works.
    """
    async with db_factory() as db:
        allowed = await check_daily_scrape_limit(db, user_id)

    if not allowed:
        logger.info(
            "Skipping extraction: daily scrape quota reached",
            article_id=str(article.id),
            user_id=str(user_id),
        )
        return article

    logger.info("Extracting full text", article_id=str(article.id), link=str(article.link))
    extracted, error = await scrape.extract_full_content(str(article.link), article.title)

    if error:
        logger.warning("Extraction failed", article_id=str(article.id), error=error)

    worthwhile = not error and is_extraction_worthwhile(extracted, article.content)
    if extracted and not worthwhile:
        logger.info(
            "Discarding extraction: no meaningful gain over feed content",
            article_id=str(article.id),
        )

    stored = extracted if worthwhile else None

    # Stamp the attempt either way so a failed or unhelpful scrape isn't retried on
    # every subsequent open of this article.
    if article.content_id:
        async with db_factory() as db:
            await actions.store_extracted_content(db, content_id=article.content_id, extracted_content=stored)

    if not stored:
        return article

    return article.model_copy(update={"extracted_content": stored})


async def get_article_details(
    db_factory: SessionFactory,
    article_id: UUID,
    user_id: UUID,
    allow_preview: bool = False,
    is_clipped: bool = False,
    auto_extract: bool = True,
) -> EntryDetail | None:
    """
    Get single article with business logic (full-text extraction).

    Articles that already have stored extracted content are served straight from the
    database. A scrape only runs the first time an article with teaser-only content is
    opened; the result is shared by every user who opens the same article afterwards.

    Set ``auto_extract=False`` when the caller only needs the stored article metadata
    (e.g. an enhancement endpoint running its own quota-checked extraction) so no
    implicit scrape runs or consumes the daily quota.
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

    # 3. Extract on a genuine miss only
    if auto_extract and AUTO_EXTRACT_ON_FETCH and should_attempt_extraction(response):
        response = await extract_and_store(db_factory, response, user_id)

    return response
