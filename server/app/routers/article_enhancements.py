"""Article enhancement endpoints for AI-powered features."""

from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.custom_exceptions import ServiceUnavailableError
from app.db.session import get_db
from app.schemas.auth import TokenData
from app.services.ai_service import get_ai_service
from app.services.article_management_service import ArticleManagementService
from app.services.auth import get_current_user
from app.services.content_extraction_service import ContentExtractionService

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/articles", tags=["Article Enhancements"])


class ExtractFullTextResponse(BaseModel):
    """Response for full text extraction."""

    success: bool
    content: str | None = None
    estimated_read_time_minutes: int | None = None
    error: str | None = None


class SummarizeRequest(BaseModel):
    """Request for article summarization."""

    content: str | None = Field(None, description="Optional content to summarize instead of article content")


class SummarizeResponse(BaseModel):
    """Response for article summarization."""

    success: bool
    summary: str | None = None
    error: str | None = None


class TranslateRequest(BaseModel):
    """Request for article translation."""

    target_language: str = Field(
        ...,
        min_length=2,
        max_length=10,
        description="Target language code (e.g., 'es', 'fr', 'zh')",
    )
    content: str | None = Field(None, description="Optional content to translate instead of article content")


class TranslateResponse(BaseModel):
    """Response for article translation."""

    success: bool
    translated_content: str | None = None
    target_language: str | None = None
    error: str | None = None


@router.post("/{article_id}/extract-full-text", response_model=ExtractFullTextResponse)
async def extract_full_text(
    article_id: UUID,
    user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ExtractFullTextResponse:
    """
    Extract full text content from the article's original URL using trafilatura.

    This endpoint fetches the complete article content from the source URL,
    which is useful when the RSS feed only provides a summary or excerpt.
    This is the manual extraction endpoint - automatic extraction happens
    during article fetch if content is detected as incomplete.
    """
    try:
        logger.info(
            "Extracting full text for article",
            article_id=str(article_id),
            user_id=user.sub,
        )

        from app.crud.crud_article import get_article as crud_get_article

        extraction_service = ContentExtractionService()

        # Get the article directly from DB to verify ownership and get URL
        # Don't use rss_service.get_article() as it triggers auto-extraction
        article_db = await crud_get_article(db=db, article_id=article_id, user_id=UUID(user.sub), allow_preview=False)
        if not article_db:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

        # Handle both tuple (FeedArticle, UserArticleState) and ClippedArticle types
        from app.models.rss_models import ClippedArticle

        if isinstance(article_db, ClippedArticle):
            article_link = article_db.content.link if article_db.content else None
            article_title = article_db.content.title if article_db.content else None
        elif isinstance(article_db, tuple):
            # FeedArticle tuple
            article_link = article_db[0].content.link if article_db[0].content else None
            article_title = article_db[0].content.title if article_db[0].content else None
        else:
            # Legacy single FeedArticle
            article_link = article_db.content.link if hasattr(article_db, "content") and article_db.content else None
            article_title = article_db.content.title if hasattr(article_db, "content") and article_db.content else None

        if not article_link:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Article has no source URL available",
            )

        url = str(article_link)

        # Extract content using the shared extraction service, passing title to remove duplicates
        content, read_time, error = await extraction_service.extract_full_content(url, article_title)

        if content and not error:
            return ExtractFullTextResponse(success=True, content=content, estimated_read_time_minutes=read_time)
        else:
            return ExtractFullTextResponse(success=False, error=error)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error extracting full text",
            error=str(e),
            article_id=str(article_id),
            exc_info=True,
        )
        return ExtractFullTextResponse(success=False, error="An unexpected error occurred while extracting content")


@router.post("/{article_id}/summarize", response_model=SummarizeResponse)
async def summarize_article(
    article_id: UUID,
    request: SummarizeRequest = SummarizeRequest(),
    user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SummarizeResponse:
    """
    Generate an AI summary of the article content.

    This endpoint creates a concise, high-quality summary that captures
    the main points and key insights of the article.
    """
    try:
        logger.info(
            "Generating summary for article",
            article_id=str(article_id),
            user_id=user.sub,
        )

        article_service = ArticleManagementService(db, UUID(user.sub))
        ai_service = get_ai_service()

        # Get the article to verify ownership and get content
        article = await article_service.get_article(article_id)
        if not article:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

        # Use provided content if available, otherwise fall back to extracted content, article content, or description
        content_to_summarize = request.content or article.extracted_content or article.content or article.description
        if not content_to_summarize:
            return SummarizeResponse(success=False, error="No content available to summarize")

        # Determine the content source for logging
        if request.content:
            content_source = "request"
        elif article.extracted_content:
            content_source = "extracted_content"
        elif article.content:
            content_source = "article_content"
        else:
            content_source = "description"

        logger.info(
            "Content sources for summarization",
            article_id=str(article_id),
            has_request_content=bool(request.content),
            has_extracted_content=bool(article.extracted_content),
            has_article_content=bool(article.content),
            has_article_description=bool(article.description),
            content_length=len(content_to_summarize),
            content_source=content_source,
        )

        # Generate summary using AI service
        summary = await ai_service.summarize_article(title=article.title or "", content=content_to_summarize)

        if not summary:
            return SummarizeResponse(success=False, error="Failed to generate summary")

        logger.info(
            "Successfully generated summary",
            article_id=str(article_id),
            summary_length=len(summary),
        )

        return SummarizeResponse(success=True, summary=summary)

    except HTTPException:
        raise
    except ServiceUnavailableError as e:
        logger.warning(
            "AI service unavailable for summary",
            error=str(e),
            article_id=str(article_id),
        )
        return SummarizeResponse(success=False, error=str(e))
    except Exception as e:
        logger.error(
            "Error generating summary",
            error=str(e),
            article_id=str(article_id),
            exc_info=True,
        )
        return SummarizeResponse(success=False, error="An unexpected error occurred while generating summary")


@router.post("/{article_id}/translate", response_model=TranslateResponse)
async def translate_article(
    article_id: UUID,
    request: TranslateRequest,
    user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TranslateResponse:
    """
    Translate the article content to a target language.

    This endpoint translates the article content while preserving
    formatting and maintaining the original meaning and tone.
    """
    try:
        logger.info(
            "Translating article",
            article_id=str(article_id),
            target_language=request.target_language,
            user_id=user.sub,
        )

        article_service = ArticleManagementService(db, UUID(user.sub))
        ai_service = get_ai_service()

        # Get the article to verify ownership and get content
        article = await article_service.get_article(article_id)
        if not article:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

        # Use provided content if available, otherwise fall back to extracted content, article content, or description
        content_to_translate = request.content or article.extracted_content or article.content or article.description
        if not content_to_translate:
            return TranslateResponse(success=False, error="No content available to translate")

        # Generate translation using AI service
        translated_content = await ai_service.translate_article(
            content=content_to_translate, target_language=request.target_language
        )

        if not translated_content:
            return TranslateResponse(success=False, error="Failed to generate translation")

        logger.info(
            "Successfully translated article",
            article_id=str(article_id),
            target_language=request.target_language,
        )

        return TranslateResponse(
            success=True,
            translated_content=translated_content,
            target_language=request.target_language,
        )

    except HTTPException:
        raise
    except ServiceUnavailableError as e:
        logger.warning(
            "AI service unavailable for translation",
            error=str(e),
            article_id=str(article_id),
            target_language=request.target_language,
        )
        return TranslateResponse(success=False, error=str(e), target_language=request.target_language)
    except Exception as e:
        logger.error(
            "Error translating article",
            error=str(e),
            article_id=str(article_id),
            exc_info=True,
        )
        return TranslateResponse(
            success=False,
            error="An unexpected error occurred while translating content",
        )
