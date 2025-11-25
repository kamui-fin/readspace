"""Clipped article routes - save and check web articles."""

from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.article.reader import check_article_saved_by_url
from app.db.session import get_db
from app.services.articles.clipper import save_article_from_url
from app.services.user.auth import get_current_user
from app.typing.entries import EntryCreateExternal
from app.typing.user import TokenData

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
    request: EntryCreateExternal,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
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

    Returns:
        dict: Success response with article_id

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
    try:
        article = await save_article_from_url(
            db=db,
            user_id=UUID(current_user.sub),
            url=str(request.url),
            content=request.content or "",
            title=request.title,
            metadata=None,
            note=request.note,
            priority=str(request.priority.value) if request.priority else "MEDIUM",
        )

        logger.info(
            "Web article saved successfully",
            article_id=article.user_entry.id if hasattr(article, "user_entry") else None,
            user_id=current_user.sub,
            url=str(request.url),
        )

        return {
            "success": True,
            "article_id": str(article.user_entry.id if hasattr(article, "user_entry") else article.content.id),
        }

    except ValueError as e:
        logger.warning(
            "Failed to save web article due to validation error",
            error=str(e),
            user_id=current_user.sub,
            url=str(request.url),
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except ConnectionError as e:
        logger.warning(
            "Failed to save web article due to connection error",
            error=str(e),
            user_id=current_user.sub,
            url=str(request.url),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to fetch article: {str(e)}",
        ) from e
    except Exception as e:
        logger.error(
            "Unexpected error saving web article",
            error=str(e),
            user_id=current_user.sub,
            url=str(request.url),
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
        dict: {"is_saved": bool, "article_id": str | None, ...}

    Raises:
        HTTPException:
            - 422: Validation error in URL parameter

    Note:
        - Queries article_contents table by URL
        - Checks for associated UserEntry for the user
        - Returns minimal response for extension efficiency
    """
    try:
        # Check if article is saved using CRUD function
        result = await check_article_saved_by_url(db=db, url=url, user_id=UUID(current_user.sub))

        if result:
            content, user_entry = result
            if user_entry:
                return {
                    "is_saved": True,
                    "article_id": str(user_entry.id),
                    "id": str(user_entry.id),
                    "title": content.title,
                    "note": user_entry.user_note,
                    "priority": user_entry.priority.value if user_entry.priority else None,
                    "is_read": user_entry.is_read or False,
                    "is_read_later": user_entry.is_read_later or False,
                    "read_at": user_entry.read_at.isoformat() if user_entry.read_at else None,
                }
            else:
                # Content exists but user hasn't saved it
                return {"is_saved": False, "article_id": None}
        else:
            return {"is_saved": False, "article_id": None}
    except Exception as e:
        logger.error(
            "Error checking if article is saved",
            error=str(e),
            user_id=current_user.sub,
            url=url,
            exc_info=True,
        )
        return {"is_saved": False, "article_id": None}
