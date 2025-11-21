import time
from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_user_service
from app.db.session import get_db
from app.schemas import SaveArticleRequest
from app.schemas.auth import TokenData
from app.services.articles.clipped import WebArticleService
from app.services.user.auth import get_current_user
from app.services.user.user import UserService

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    summary="Save web article",
    description="Save a web article from URL for read-later functionality",
    responses={
        201: {
            "description": "Article successfully saved",
            "content": {"application/json": {"example": {"success": True, "article_id": "uuid-string"}}},
        },
        400: {
            "description": "Bad request - invalid URL, validation error, or connection error",
            "content": {"application/json": {"example": {"detail": "Unable to fetch article: Connection timeout"}}},
        },
        422: {
            "description": "Validation error in request data",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [{"loc": ["body", "url"], "msg": "invalid url format", "type": "value_error.url"}]
                    }
                }
            },
        },
        500: {
            "description": "Internal server error",
            "content": {
                "application/json": {"example": {"detail": "An unexpected error occurred while saving the article."}}
            },
        },
    },
)
async def save_web_article(
    request: SaveArticleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
) -> dict[str, Any]:
    """
    Save a web article from URL for read-later functionality.

    This endpoint allows users to save articles from any URL to their read-later collection.
    The service will attempt to extract the article content, title, and metadata automatically
    if not provided in the request.

    Args:
        request: Article save request containing URL and optional metadata
        db: Database session dependency
        current_user: Authenticated user token data
        user_service: Injected user service

    Returns:
        ClippedArticleResponse: The saved article with extracted content and metadata

    Raises:
        HTTPException:
            - 400: Invalid URL format, connection error, or validation error
            - 422: Request validation error
            - 500: Unexpected server error during article processing

    Note:
        - If title or content are not provided, they will be extracted from the URL
        - Articles are automatically associated with the authenticated user
        - Duplicate URLs for the same user are handled gracefully
    """
    start_time = time.perf_counter()

    # Ensure user profile exists in database
    await user_service.ensure_user_profile_exists(current_user)

    web_service = WebArticleService(db=db, user_id=UUID(current_user.sub))

    try:
        article = await web_service.save_article_from_url(
            url=str(request.url),
            title=request.title,
            content=request.content,  # Pass extracted content from extension
            metadata=request.metadata or {},
            # tag_ids removed - using ARRAY field on feeds
            note=request.note,
            priority=request.priority,
        )

        duration = time.perf_counter() - start_time

        logger.info(
            "Web article saved successfully",
            article_id=article.id,
            user_id=current_user.sub,
            url=str(request.url),
            duration_seconds=round(duration, 3),
        )

        # Return minimal response for extension
        return {"success": True, "article_id": str(article.id)}

    except ValueError as e:
        duration = time.perf_counter() - start_time

        logger.warning(
            "Failed to save web article due to validation error",
            error=str(e),
            user_id=current_user.sub,
            url=str(request.url),
            duration_seconds=round(duration, 3),
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except ConnectionError as e:
        duration = time.perf_counter() - start_time

        logger.warning(
            "Failed to save web article due to connection error",
            error=str(e),
            user_id=current_user.sub,
            url=str(request.url),
            duration_seconds=round(duration, 3),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to fetch article: {str(e)}",
        ) from e
    except Exception as e:
        duration = time.perf_counter() - start_time

        logger.error(
            "Unexpected error saving web article",
            error=str(e),
            user_id=current_user.sub,
            url=str(request.url),
            duration_seconds=round(duration, 3),
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while saving the article.",
        ) from e


@router.get(
    "/check-saved",
    status_code=status.HTTP_200_OK,
    summary="Check if article is saved by URL",
    description="Check if an article URL has been saved",
    responses={
        200: {
            "description": "Article check result",
            "content": {"application/json": {"example": {"is_saved": True, "article_id": "uuid-string"}}},
        },
        422: {
            "description": "Validation error in query parameters",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [{"loc": ["query", "url"], "msg": "invalid url format", "type": "value_error.url"}]
                    }
                }
            },
        },
    },
)
async def check_article_saved(
    url: str = Query(..., description="URL of the article to check"),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Check if an article URL has been saved.

    This endpoint allows the extension to check if a user has already saved
    an article by its URL.

    Args:
        url: The URL of the article to check
        db: Database session dependency
        current_user: Authenticated user token data

    Returns:
        dict: {"is_saved": bool, "article_id": str | None}

    Raises:
        HTTPException:
            - 422: Validation error in URL parameter

    Note:
        - Queries both clipped_articles and article_contents tables
        - Joins on content_id to find article by URL
        - Returns minimal response for extension efficiency
    """
    web_service = WebArticleService(db=db, user_id=UUID(current_user.sub))

    try:
        article = await web_service.get_article_by_url(url)

        if article:
            # Return minimal metadata without heavy content
            return {
                "is_saved": True,
                "article_id": str(article.id),
                "id": str(article.id),
                "title": article.content.title if article.content else None,
                "note": article.note,
                "priority": article.priority.value if article.priority else None,
                "is_read": article.is_read,
                "is_read_later": article.is_read_later,
                "read_at": article.read_at.isoformat() if article.read_at else None,
            }
        else:
            return {"is_saved": False, "article_id": None}
    except Exception as e:
        logger.error(
            "Error checking if article is saved",
            error=str(e),
            user_id=current_user.sub,
            url=url,
        )
        return {"is_saved": False, "article_id": None}
