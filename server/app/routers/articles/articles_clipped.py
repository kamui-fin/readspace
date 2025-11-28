"""Clipped article routes - save and check web articles."""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.article.reader import check_article_saved_by_url
from app.db.session import get_db
from app.models.enums import ArticlePriority
from app.services.articles.clipper import save_article_from_url
from app.services.user.auth import get_current_user
from app.typing.entries import EntryCreateExternal
from app.typing.user import TokenData

logger = structlog.get_logger(__name__)
router = APIRouter()


# --- Response Models ---
# Defined locally or in app/typing/articles.py to keep the route clean
class ArticleSaveResponse(BaseModel):
    success: bool
    article_id: str


class ArticleCheckResponse(BaseModel):
    is_saved: bool
    article_id: str | None = None
    title: str | None = None
    note: str | None = None
    priority: ArticlePriority | int | None = None
    is_read: bool = False
    is_read_later: bool = False
    read_at: str | None = None


# --- Routes ---
@router.post(
    "/",
    response_model=ArticleSaveResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save web article",
    description="Save a web article from URL for read-later functionality.",
)
async def save_web_article(
    request: Annotated[EntryCreateExternal, "Article save request data"],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> ArticleSaveResponse:
    """
    Save a web article. Extracts content automatically if not provided.
    """
    # 1. Bind Context
    logger.bind(user_id=current_user.sub, url=str(request.url))

    # 2. Service Call
    # If this fails (ConnectionError, Validation), the Global Handler catches it.
    article = await save_article_from_url(
        db=db,
        user_id=current_user.sub,
        url=str(request.url),
        content=request.content or "",
        title=request.title,
        metadata=None,
        note=request.note,
        priority=request.priority.value if isinstance(request.priority, ArticlePriority) else request.priority,
    )

    # 3. Resolve ID safely
    # Handling the complex return type of the service (Entry vs Content)
    article_id = article.user_entry.id if hasattr(article, "user_entry") else article.content.id

    logger.info("Web article saved successfully", article_id=str(article_id))

    return ArticleSaveResponse(success=True, article_id=str(article_id))


@router.get(
    "/check-saved",
    response_model=ArticleCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="Check if article is saved by URL",
)
async def check_article_saved(
    url: Annotated[str, Query(description="URL of the article to check")],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> ArticleCheckResponse:
    """
    Check if a user has already saved an article by its URL.
    Returns minimal metadata if found.
    """
    logger.bind(user_id=current_user.sub, url=url)

    # 1. Query DB
    result = await check_article_saved_by_url(db=db, url=url, user_id=current_user.sub)

    # 2. Handle Miss
    if not result:
        return ArticleCheckResponse(is_saved=False)

    content, user_entry = result

    # 3. Handle Content Exists but User Entry Missing (rare edge case)
    if not user_entry:
        return ArticleCheckResponse(is_saved=False)

    # 4. Return Hit
    # Pydantic handles the serialization of UUIDs and Enums automatically
    return ArticleCheckResponse(
        is_saved=True,
        article_id=str(user_entry.id),
        title=content.title,
        note=user_entry.user_note,
        priority=user_entry.priority,
        is_read=user_entry.is_read or False,
        is_read_later=user_entry.is_read_later or False,
        read_at=user_entry.read_at.isoformat() if user_entry.read_at else None,
    )
