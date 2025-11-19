from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.auth import TokenData
from app.services.articles.article_management import ArticleManagementService
from app.services.user.auth import get_current_user

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get(
    "/unread-counts",
    response_model=dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Get unread article counts",
    description="Retrieve unread article counts, optionally filtered by folder",
    responses={
        200: {
            "description": "Successfully retrieved unread counts",
            "content": {
                "application/json": {
                    "examples": {
                        "global_counts": {
                            "summary": "Global unread counts (no folder filter)",
                            "value": {
                                "total_unread": 42,
                                "unread_by_folder": {"folder-uuid-1": 15, "folder-uuid-2": 27},
                                "read_later_count": 5,
                                "today_count": 8,
                            },
                        },
                        "folder_specific": {
                            "summary": "Counts for specific folder",
                            "value": {"total_unread": 15, "folder_id": "folder-uuid-1"},
                        },
                    }
                }
            },
        },
        422: {
            "description": "Validation error in folder ID parameter",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [
                            {"loc": ["query", "folder_id"], "msg": "invalid uuid format", "type": "value_error.uuid"}
                        ]
                    }
                }
            },
        },
    },
)
async def get_unread_article_counts(
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(get_current_user),
    folder_id: UUID | None = Query(None, description="Optional folder ID to get counts for a specific folder"),
) -> dict[str, Any]:
    """
    Retrieve unread article counts, optionally filtered by folder.

    This endpoint provides unread article statistics to power UI elements like
    badges, notifications, and navigation counters. It can return either global
    counts across all folders or counts for a specific folder.

    Args:
        db: Database session dependency
        current_user: Authenticated user token data
        folder_id: Optional UUID to get counts for a specific folder only

    Returns:
        dict[str, Any]: Unread count statistics with the following structure:
        - If folder_id is None: {
            "total_unread": int,
            "unread_by_folder": {"folder_id": count, ...},
            "read_later_count": int,
            "today_count": int
          }
        - If folder_id is provided: {
            "unread_count": int
          }

    Raises:
        HTTPException:
            - 422: Validation error in folder_id parameter (invalid UUID format)

    Note:
        - Only counts articles from feeds the user is subscribed to
        - "Uncategorized" includes articles from feeds not assigned to any folder
        - Counts are calculated in real-time and not cached
        - Useful for displaying unread badges in navigation menus
    """
    article_service = ArticleManagementService(db=db, user_id=UUID(current_user.sub))
    if folder_id:
        count = await article_service.count_unread_articles_by_folder(folder_id=folder_id)
        return {"unread_count": count}
    else:
        # Use optimized single-query method and return directly
        return await article_service.get_all_unread_counts()
