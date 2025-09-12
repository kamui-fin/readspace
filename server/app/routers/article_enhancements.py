"""Article enhancement endpoints for AI-powered features."""

from uuid import UUID

import structlog
import trafilatura
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.auth import TokenData
from app.services.ai_service import get_ai_service
from app.services.auth import get_current_user
from app.services.rss_service import RssService

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/articles", tags=["Article Enhancements"])


def _calculate_read_time(content: str) -> int:
    """Calculate estimated reading time in minutes."""
    if not content:
        return 1

    # Average reading speed: 200 words per minute
    word_count = len(content.split())
    read_time = max(1, round(word_count / 200))

    return min(read_time, 60)  # Cap at 60 minutes


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
    target_language: str = Field(..., min_length=2, max_length=10, description="Target language code (e.g., 'es', 'fr', 'zh')")
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
):
    """
    Extract full text content from the article's original URL using trafilatura.
    
    This endpoint fetches the complete article content from the source URL,
    which is useful when the RSS feed only provides a summary or excerpt.
    """
    try:
        logger.info("Extracting full text for article", article_id=str(article_id), user_id=user.sub)
        
        rss_service = RssService(db, UUID(user.sub))
        
        # Get the article to verify ownership and get URL
        article = await rss_service.get_article(article_id, user.sub)
        if not article:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Article not found"
            )
        
        if not article.link:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Article has no source URL available"
            )
        
        url = str(article.link)
        logger.debug("Fetching content from URL", url=url)
        
        # Fetch and extract content using trafilatura
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            logger.warning("Failed to fetch URL", url=url)
            return ExtractFullTextResponse(
                success=False,
                error="Failed to fetch content from URL"
            )
        
        extracted = trafilatura.extract(downloaded, output_format="html")
        if not extracted:
            logger.warning("Could not extract content from URL", url=url)
            return ExtractFullTextResponse(
                success=False,
                error="Could not extract readable content from the page"
            )
        
        # Calculate read time for the extracted content
        read_time = _calculate_read_time(extracted)
        
        logger.info("Successfully extracted full text", article_id=str(article_id), content_length=len(extracted), read_time=read_time)
        
        return ExtractFullTextResponse(
            success=True,
            content=extracted,
            estimated_read_time_minutes=read_time
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error extracting full text", error=str(e), article_id=str(article_id), exc_info=True)
        return ExtractFullTextResponse(
            success=False,
            error="An unexpected error occurred while extracting content"
        )


@router.post("/{article_id}/summarize", response_model=SummarizeResponse)
async def summarize_article(
    article_id: UUID,
    request: SummarizeRequest = SummarizeRequest(),
    user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate an AI summary of the article content.
    
    This endpoint creates a concise, high-quality summary that captures
    the main points and key insights of the article.
    """
    try:
        logger.info("Generating summary for article", article_id=str(article_id), user_id=user.sub)
        
        rss_service = RssService(db, UUID(user.sub))
        ai_service = get_ai_service()
        
        # Get the article to verify ownership and get content
        article = await rss_service.get_article(article_id, user.sub)
        if not article:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Article not found"
            )
        
        # Use provided content if available, otherwise fall back to article content/description
        content_to_summarize = request.content or article.content or article.description
        if not content_to_summarize:
            return SummarizeResponse(
                success=False,
                error="No content available to summarize"
            )
        
        # Generate summary using AI service
        summary = await ai_service.summarize_article(
            title=article.title or "",
            content=content_to_summarize
        )
        
        if not summary:
            return SummarizeResponse(
                success=False,
                error="Failed to generate summary"
            )
        
        logger.info("Successfully generated summary", article_id=str(article_id), summary_length=len(summary))
        
        return SummarizeResponse(
            success=True,
            summary=summary
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error generating summary", error=str(e), article_id=str(article_id), exc_info=True)
        return SummarizeResponse(
            success=False,
            error="An unexpected error occurred while generating summary"
        )


@router.post("/{article_id}/translate", response_model=TranslateResponse)
async def translate_article(
    article_id: UUID,
    request: TranslateRequest,
    user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Translate the article content to a target language.
    
    This endpoint translates the article content while preserving
    formatting and maintaining the original meaning and tone.
    """
    try:
        logger.info("Translating article", article_id=str(article_id), target_language=request.target_language, user_id=user.sub)
        
        rss_service = RssService(db, UUID(user.sub))
        ai_service = get_ai_service()
        
        # Get the article to verify ownership and get content
        article = await rss_service.get_article(article_id, user.sub)
        if not article:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Article not found"
            )
        
        # Use provided content if available, otherwise fall back to article content/description
        content_to_translate = request.content or article.content or article.description
        if not content_to_translate:
            return TranslateResponse(
                success=False,
                error="No content available to translate"
            )
        
        # Generate translation using AI service
        translated_content = await ai_service.translate_article(
            content=content_to_translate,
            target_language=request.target_language
        )
        
        if not translated_content:
            return TranslateResponse(
                success=False,
                error="Failed to generate translation"
            )
        
        logger.info("Successfully translated article", article_id=str(article_id), target_language=request.target_language)
        
        return TranslateResponse(
            success=True,
            translated_content=translated_content,
            target_language=request.target_language
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error translating article", error=str(e), article_id=str(article_id), exc_info=True)
        return TranslateResponse(
            success=False,
            error="An unexpected error occurred while translating content"
        )
