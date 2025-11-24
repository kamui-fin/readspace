from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ERROR_ARTICLE_NOT_FOUND
from app.db.session import get_db
from app.schemas import ArticleResponse, ArticleUpdate, ClippedArticleUpdate
from app.schemas.auth import TokenData
from app.services.articles.management import ArticleManagementService
from app.services.user.auth import get_current_user

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.put(
    "/{article_id}",
    response_model=ArticleResponse,
    status_code=status.HTTP_200_OK,
    summary="Update article status",
    description="Update an article's user-specific metadata and status flags",
    responses={
        200: {
            "description": "Article successfully updated",
            "model": ArticleResponse,
        },
        404: {
            "description": "Article not found or access denied",
            "content": {"application/json": {"example": {"detail": ERROR_ARTICLE_NOT_FOUND}}},
        },
        422: {
            "description": "Validation error in request data",
            "content": {
                "application/json": {
                    "examples": {
                        "invalid_uuid": {
                            "summary": "Invalid article ID",
                            "value": {
                                "detail": [
                                    {
                                        "loc": ["path", "article_id"],
                                        "msg": "invalid uuid format",
                                        "type": "value_error.uuid",
                                    }
                                ]
                            },
                        },
                        "invalid_type": {
                            "summary": "Invalid article type",
                            "value": {
                                "detail": [
                                    {
                                        "loc": ["query", "article_type"],
                                        "msg": "string does not match regex '^(feed|clipped)$'",
                                        "type": "value_error.str.regex",
                                    }
                                ]
                            },
                        },
                    }
                }
            },
        },
    },
)
async def update_article(
    article_id: UUID,
    article_type: str = Query("feed", pattern="^(feed|clipped)$", description="Article type: feed or clipped"),
    article_in: ArticleUpdate | ClippedArticleUpdate = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
) -> ArticleResponse:
    """
    Update an article's user-specific metadata and status flags.

    This endpoint allows users to modify their personal interaction data with articles,
    such as marking them as read, adding to favorites, or saving for later reading.
    The article content itself cannot be modified through this endpoint.

    Args:
        article_id: UUID of the article to update
        article_in: Update data containing the fields to modify
        article_type: Type of article - either "feed" (from RSS) or "clipped" (saved web article)
        db: Database session dependency
        current_user: Authenticated user token data

    Returns:
        ArticleResponse: Updated article with modified status flags and metadata

    Raises:
        HTTPException:
            - 404: Article not found or user doesn't have access to modify it
            - 422: Validation error in article_id format or article_type parameter

    Updateable Fields:
        - is_read: Mark article as read/unread
        - is_read_later: Add/remove from read-later list
        - read_at: Timestamp when article was read (usually set automatically)

    Note:
        - Only user-specific metadata can be updated, not article content
        - Updates are scoped to the authenticated user
        - article_type parameter helps optimize database queries
        - Automatically logs update activity for audit purposes
    """
    logger.info(
        "Received article update request",
        article_id=article_id,
        article_type=article_type,
        update_data=article_in.model_dump(exclude_unset=True),
        user_id=current_user.sub,
    )
    article_service = ArticleManagementService(db=db, user_id=UUID(current_user.sub))
    updated_article = await article_service.update_article(
        article_id=article_id, article_in=article_in, article_type=article_type
    )

    if not updated_article:
        logger.warning(
            "Article not found for update or access denied",
            article_id=article_id,
            user_id=current_user.sub,
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=ERROR_ARTICLE_NOT_FOUND)

    logger.info(
        "Article status updated successfully",
        article_id=updated_article.id,
        user_id=current_user.sub,
    )
    return updated_article
