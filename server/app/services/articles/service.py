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


async def _enrich_with_auto_extract(article: ArticleResponse) -> None:
    """
    Business Logic: Checks if content is short/incomplete and attempts
    to fetch full content from the source URL. Mutates the response object.
    """
    if not is_content_complete(article.content, threshold=MIN_CONTENT_LENGTH):
        if article.link:
            logger.info("Auto-extracting content", article_id=article.id)

            extracted, read_time, error = await scrape.extract_full_content(str(article.link), article.title)

            if extracted and not error:
                article.extracted_content = extracted
                article.extracted_read_time = read_time
                article.content = extracted  # Optionally replace the main content for display
            else:
                logger.warning("Auto-extraction failed", error=error)


async def get_articles_with_cursor(
    db: AsyncSession, user_id: UUID, params: reader.CursorPaginationParams, **filters
) -> reader.CursorPaginationResult:
    """
    Get articles using the new cursor-based CRUD.

    This function exists primarily to handle the transformation of
    SQLAlchemy rows into your unified `ArticleResponse` Pydantic models
    before returning them to the API.
    """
    # 1. Call CRUD
    result = await reader.get_articles(db, user_id, params, **filters)

    # 2. Transform Items
    transformer = reader.ArticleTransformer()
    transformed_items = []

    for row in result.items:
        # row is typically a tuple from the query (FeedArticle, UserEntry, ...)
        # The reader.py transformer handles rows or objects
        transformed_items.append(transformer.raw_row_to_response(row))

    # 3. Return generic result with transformed items
    # We construct a new model because result.items was SQLAlchemy objects
    return CursorPaginationResult(items=transformed_items, next_cursor=result.next_cursor, has_more=result.has_more)


async def get_article_details(
    db: AsyncSession, article_id: UUID, user_id: UUID, allow_preview: bool = False
) -> ArticleResponse | None:
    """
    Get single article with business logic (Auto-Extraction).
    """
    # 1. Call CRUD
    row = await reader.get_article_by_id(db, article_id=article_id, user_id=user_id, load_full_content=True)

    if not row:
        return None

    # 2. Transform
    transformer = reader.ArticleTransformer()
    response = transformer.to_response(row)

    # Cast dict to Pydantic if to_response returns dict (based on your reader.py)
    if isinstance(response, dict):
        response = ArticleResponse(**response)

    # 3. Apply Business Logic (Auto Extract)
    if AUTO_EXTRACT_ON_FETCH:
        await _enrich_with_auto_extract(response)

    return response


async def update_article_state(
    db: AsyncSession, article_id: UUID, user_id: UUID, update_data: ArticleUpdate
) -> ArticleResponse | None:
    """
    Update article state and return the formatted response.
    """
    result = await actions.update_article_status(db, article_id=article_id, article_in=update_data, user_id=user_id)

    if not result:
        return None

    # Transform result (FeedArticle, UserEntry) -> Response
    transformer = reader.ArticleTransformer()
    response_dict = transformer.to_response(result)
    return ArticleResponse(**response_dict)
