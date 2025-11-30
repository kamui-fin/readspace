"""Article enhancement endpoints for AI-powered features."""

from typing import Annotated, Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends

from app.core.custom_exceptions import NotFoundError, ValidationError
from app.db.session import get_db_factory
from app.services.ai.service import generate_summary, translate_content
from app.services.articles.scrape import extract_full_content
from app.services.articles.service import get_article_details
from app.services.feeds.service import SessionFactory
from app.services.user.auth import get_current_user
from app.typing.enhancements import (
    ExtractionResponse,
    SummarizeRequest,
    SummarizeResponse,
    TranslateRequest,
    TranslateResponse,
)
from app.typing.user import TokenData

logger = structlog.get_logger(__name__)
router = APIRouter()


# --- Helpers ---
async def get_article_or_404(db_factory: SessionFactory, article_id: UUID, user_id: UUID) -> Any:
    """Retrieves article details or raises NotFoundError."""
    article = await get_article_details(
        db_factory=db_factory, article_id=article_id, user_id=user_id, allow_preview=False
    )
    if not article:
        raise NotFoundError(message="Article not found")
    return article


def resolve_content(request_content: str | None, article: Any) -> str:
    """
    Resolves content source priority: Request Body > Article Content > Description.
    Raises ValidationError if no content is found.
    """
    content = request_content or article.content or article.description
    if not content:
        raise ValidationError(message="No content available to process")
    return content


# --- Routes ---
@router.post(
    "/{article_id}/extract-full-text", response_model=ExtractionResponse, summary="Extract full text from source URL"
)
async def extract_full_text(
    article_id: UUID,
    user: Annotated[TokenData, Depends(get_current_user)],
    db_factory: Annotated[SessionFactory, Depends(get_db_factory)],
) -> ExtractionResponse:
    """
    Manually trigger full-text extraction for an article.
    """
    logger.bind(article_id=str(article_id), user_id=user.sub)

    # 1. Verify Article
    article = await get_article_or_404(db_factory, article_id, UUID(user.sub))

    if not article.link:
        raise ValidationError(message="Article has no source URL available")

    # 2. Extract (Service handles errors/exceptions)
    content, read_time, error = await extract_full_content(str(article.link), article.title)

    if error:
        # Mapping extraction specific logic error to HTTP 400
        raise ValidationError(message=error)

    return ExtractionResponse(content=content, estimated_read_time_minutes=read_time)


@router.post("/{article_id}/summarize", response_model=SummarizeResponse, summary="Generate AI summary")
async def summarize_article(
    article_id: UUID,
    user: Annotated[TokenData, Depends(get_current_user)],
    db_factory: Annotated[SessionFactory, Depends(get_db_factory)],
    request: SummarizeRequest = Body(default_factory=lambda: SummarizeRequest()),
) -> SummarizeResponse:
    """
    Generate an AI summary of the article.
    """
    logger.bind(article_id=str(article_id), user_id=user.sub)

    # 1. Fetch & Resolve Content
    article = await get_article_or_404(db_factory, article_id, UUID(user.sub))
    content_to_use = resolve_content(request.content, article)

    # 2. Generate Summary
    summary = await generate_summary(title=article.title or "", content=content_to_use)

    if not summary:
        raise ValidationError(message="Failed to generate summary")

    logger.info("Successfully generated summary", summary_length=len(summary))
    return SummarizeResponse(summary=summary)


@router.post("/{article_id}/translate", response_model=TranslateResponse, summary="Translate article content")
async def translate_article(
    article_id: UUID,
    request: Annotated[TranslateRequest, Body(...)],
    user: Annotated[TokenData, Depends(get_current_user)],
    db_factory: Annotated[SessionFactory, Depends(get_db_factory)],
) -> TranslateResponse:
    """
    Translate the article content to a target language.
    """
    logger.bind(article_id=str(article_id), user_id=user.sub, target_lang=str(request.target_language))

    # 1. Fetch & Resolve Content
    article = await get_article_or_404(db_factory, article_id, UUID(user.sub))
    content_to_use = resolve_content(request.content, article)

    # 2. Translate
    target_lang_str = (
        request.target_language.value if hasattr(request.target_language, "value") else str(request.target_language)
    )

    translated_content = await translate_content(
        content=content_to_use,
        target_lang_code=target_lang_str,
    )

    if not translated_content:
        raise ValidationError(message="Failed to translate content")

    logger.info("Successfully translated article")
    return TranslateResponse(
        translated_content=translated_content,
        target_language=request.target_language,
    )
