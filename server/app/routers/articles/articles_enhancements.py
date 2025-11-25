"""Article enhancement endpoints for AI-powered features."""

from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.ai.service import generate_summary, translate_content
from app.services.articles.scrape import extract_full_content
from app.services.articles.service import get_article_details
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


@router.post("/{article_id}/extract-full-text", response_model=ExtractionResponse)
async def extract_full_text(
    article_id: UUID,
    user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExtractionResponse:
    """
    Extract full text content from the article's original URL using trafilatura.

    This endpoint fetches the complete article content from the source URL,
    which is useful when the RSS feed only provides a summary or excerpt.
    This is the manual extraction endpoint - automatic extraction happens
    during article fetch if content is detected as incomplete.

    Args:
        article_id: UUID of the article to extract content for
        user: Authenticated user token data
        db: Database session dependency

    Returns:
        ExtractionResponse: Extracted content and read time estimate

    Raises:
        HTTPException:
            - 404: Article not found
            - 400: Article has no source URL
    """
    logger.info(
        "Extracting full text for article",
        article_id=str(article_id),
        user_id=user.sub,
    )

    # Get the article to verify ownership and get URL
    article = await get_article_details(db=db, article_id=article_id, user_id=UUID(user.sub), allow_preview=False)

    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    if not article.link:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Article has no source URL available",
        )

    # Extract content using the scrape service
    content, read_time, error = await extract_full_content(str(article.link), article.title)

    if content and not error:
        return ExtractionResponse(content=content, estimated_read_time_minutes=read_time)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error or "Failed to extract content",
        )


@router.post("/{article_id}/summarize", response_model=SummarizeResponse)
async def summarize_article(
    article_id: UUID,
    request: SummarizeRequest = Body(default_factory=lambda: SummarizeRequest()),
    user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SummarizeResponse:
    """
    Generate an AI summary of the article content.

    This endpoint creates a concise, high-quality summary that captures
    the main points and key insights of the article.

    Args:
        article_id: UUID of the article to summarize
        request: Optional content override
        user: Authenticated user token data
        db: Database session dependency

    Returns:
        SummarizeResponse: Generated summary

    Raises:
        HTTPException:
            - 404: Article not found
            - 400: No content available to summarize
    """
    logger.info(
        "Generating summary for article",
        article_id=str(article_id),
        user_id=user.sub,
    )

    # Get the article to verify ownership and get content
    article = await get_article_details(db=db, article_id=article_id, user_id=UUID(user.sub), allow_preview=False)

    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    # Use provided content if available, otherwise fall back to article content
    content_to_summarize = request.content or article.content or article.description
    if not content_to_summarize:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No content available to summarize",
        )

    # Generate summary using AI service
    summary = await generate_summary(title=article.title or "", content=content_to_summarize)

    if not summary:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service unavailable or failed to generate summary",
        )

    logger.info(
        "Successfully generated summary",
        article_id=str(article_id),
        summary_length=len(summary),
    )

    return SummarizeResponse(summary=summary)


@router.post("/{article_id}/translate", response_model=TranslateResponse)
async def translate_article(
    article_id: UUID,
    request: TranslateRequest = Body(...),
    user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TranslateResponse:
    """
    Translate the article content to a target language.

    This endpoint translates the article content while preserving
    formatting and maintaining the original meaning and tone.

    Args:
        article_id: UUID of the article to translate
        request: Translation request with target language and optional content override
        user: Authenticated user token data
        db: Database session dependency

    Returns:
        TranslateResponse: Translated content and target language

    Raises:
        HTTPException:
            - 404: Article not found
            - 400: No content available to translate
            - 503: AI service unavailable
    """
    logger.info(
        "Translating article",
        article_id=str(article_id),
        target_language=request.target_language,
        user_id=user.sub,
    )

    # Get the article to verify ownership and get content
    article = await get_article_details(db=db, article_id=article_id, user_id=UUID(user.sub), allow_preview=False)

    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    # Use provided content if available, otherwise fall back to article content
    content_to_translate = request.content or article.content or article.description
    if not content_to_translate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No content available to translate",
        )

    # Generate translation using AI service
    translated_content = await translate_content(
        content=content_to_translate,
        target_lang_code=request.target_language.value
        if hasattr(request.target_language, "value")
        else str(request.target_language),
    )

    if not translated_content:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service unavailable or failed to generate translation",
        )

    logger.info(
        "Successfully translated article",
        article_id=str(article_id),
        target_language=request.target_language,
    )

    return TranslateResponse(
        translated_content=translated_content,
        target_language=request.target_language,
    )
