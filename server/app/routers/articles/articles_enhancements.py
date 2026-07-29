"""Article enhancement endpoints for AI-powered features."""

import asyncio
from typing import Annotated, Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, Query

from app.core.custom_exceptions import NotFoundError, ValidationError
from app.db.session import get_db_factory
from app.services.ai.service import generate_summary, translate_content, translate_metadata
from app.services.articles.scrape import extract_full_content
from app.services.articles.service import get_article_details
from app.services.feeds.service import SessionFactory
from app.services.user.auth import get_current_user
from app.services.user.resource_limits import enforce_daily_ai_limit
from app.typing.enhancements import (
    ExtractionResponse,
    SummarizeRequest,
    SummarizeResponse,
    TranslateRequest,
    TranslateResponse,
)
from app.typing.user import TokenData
from app.utils.text import is_content_complete

logger = structlog.get_logger(__name__)
router = APIRouter()


# --- Helpers ---
async def get_article_or_404(
    db_factory: SessionFactory,
    article_id: UUID,
    user_id: UUID,
    is_clipped: bool = False,
) -> Any:
    """Retrieves article details or raises NotFoundError."""
    article = await get_article_details(
        db_factory=db_factory,
        article_id=article_id,
        user_id=user_id,
        allow_preview=True,
        is_clipped=is_clipped,
    )

    # Fallback: If not found and we weren't explicitly looking for a clipped article,
    # try looking for a clipped article.
    if not article and not is_clipped:
        article = await get_article_details(
            db_factory=db_factory,
            article_id=article_id,
            user_id=user_id,
            allow_preview=True,
            is_clipped=True,
        )

    if not article:
        raise NotFoundError(message="Article not found")
    return article


def resolve_content(request_content: str | None, article: Any) -> str:
    """
    Resolves content source priority: Request Body > Extracted > Article Content > Description.
    Raises ValidationError if no content is found.
    """
    content = request_content or getattr(article, "extracted_content", None) or article.content or article.description
    if not content:
        raise ValidationError(message="No content available to process")
    return content


# --- Routes ---
@router.post(
    "/{article_id}/extract-full-text",
    response_model=ExtractionResponse,
    summary="Extract full text from source URL",
)
async def extract_full_text(
    article_id: UUID,
    user: Annotated[TokenData, Depends(get_current_user)],
    db_factory: Annotated[SessionFactory, Depends(get_db_factory)],
    clipped: bool = Query(False, description="Whether the article is a clipped article"),
) -> ExtractionResponse:
    """
    Manually trigger full-text extraction for an article.
    """
    logger.bind(article_id=str(article_id), user_id=user.sub)

    # 1. Verify Article
    article = await get_article_or_404(db_factory, article_id, UUID(user.sub), is_clipped=clipped)

    if not article.link:
        raise ValidationError(message="Article has no source URL available")

    # 2. Extract (Service handles errors/exceptions)
    content, error = await extract_full_content(str(article.link), article.title)

    if error:
        # Mapping extraction specific logic error to HTTP 400
        raise ValidationError(message=error)

    return ExtractionResponse(content=content)


@router.post(
    "/{article_id}/summarize",
    response_model=SummarizeResponse,
    summary="Generate AI summary",
)
async def summarize_article(
    article_id: UUID,
    user: Annotated[TokenData, Depends(get_current_user)],
    db_factory: Annotated[SessionFactory, Depends(get_db_factory)],
    request: SummarizeRequest = Body(default_factory=lambda: SummarizeRequest()),
    clipped: bool = Query(False, description="Whether the article is a clipped article"),
) -> SummarizeResponse:
    """
    Generate an AI summary of the article.
    """
    logger.bind(article_id=str(article_id), user_id=user.sub)

    async with db_factory() as db:
        await enforce_daily_ai_limit(db, UUID(user.sub))

    # 1. Fetch & Resolve Content
    article = await get_article_or_404(db_factory, article_id, UUID(user.sub), is_clipped=clipped)
    content_to_use = resolve_content(request.content, article)

    # 1.5. Auto-extract if content is short/incomplete
    if not is_content_complete(content_to_use) and article.link:
        logger.info("Auto-extracting for summary", article_id=str(article_id))
        extracted, error = await extract_full_content(str(article.link), article.title)
        if extracted and not error:
            content_to_use = extracted

    # 2. Generate Summary
    summary = await generate_summary(
        title=article.title or "",
        content=content_to_use,
        article_id=str(article_id),
        language_key=request.language_key or "original",
    )

    if not summary:
        raise ValidationError(message="Failed to generate summary")

    logger.info("Successfully generated summary", summary_length=len(summary))
    return SummarizeResponse(summary=summary)


@router.post(
    "/{article_id}/translate",
    response_model=TranslateResponse,
    summary="Translate article content",
)
async def translate_article(
    article_id: UUID,
    request: Annotated[TranslateRequest, Body(...)],
    user: Annotated[TokenData, Depends(get_current_user)],
    db_factory: Annotated[SessionFactory, Depends(get_db_factory)],
    clipped: bool = Query(False, description="Whether the article is a clipped article"),
) -> TranslateResponse:
    """
    Translate the article content to a target language.
    """
    logger.bind(
        article_id=str(article_id),
        user_id=user.sub,
        target_lang=str(request.target_language),
    )

    async with db_factory() as db:
        await enforce_daily_ai_limit(db, UUID(user.sub))

    # 1. Fetch & Resolve Content
    article = await get_article_or_404(db_factory, article_id, UUID(user.sub), is_clipped=clipped)
    if article.link and str(article.link).startswith("newsletter://"):
        raise ValidationError(message="Translation is not available for newsletter emails")
    content_to_use = resolve_content(request.content, article)

    # 2. Translate in parallel
    target_lang_str = (
        request.target_language.value if hasattr(request.target_language, "value") else str(request.target_language)
    )

    translated_content_task = translate_content(
        content=content_to_use,
        target_lang_code=target_lang_str,
    )

    translated_metadata_task = translate_metadata(
        title=article.title or "",
        description=article.description or "",
        tags=article.tags or [],
        target_lang_code=target_lang_str,
    )

    translated_content, translated_meta = await asyncio.gather(
        translated_content_task,
        translated_metadata_task,
    )

    if not translated_content:
        raise ValidationError(message="Failed to translate content")

    logger.info("Successfully translated article")
    return TranslateResponse(
        translated_content=translated_content,
        target_language=request.target_language,
        translated_title=translated_meta.get("title"),
        translated_description=translated_meta.get("description"),
        translated_tags=translated_meta.get("tags"),
    )
