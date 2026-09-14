"""Clipped article routes - save and check web articles."""

from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.article.reader import check_article_saved_by_url
from app.db.session import get_db
from app.models.enums import ArticlePriority
from app.services.articles.clipper import save_article_from_url
from app.services.user.auth import get_current_user
from app.services.user.resource_limits import enforce_saved_articles_limit
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

    # 2. Check the saved-articles cap - only a new save counts; re-saving (e.g. editing the note) does not
    user_id = UUID(current_user.sub)
    existing = await check_article_saved_by_url(db=db, url=str(request.url), user_id=user_id)
    already_saved = existing is not None and existing[1] is not None and existing[1].is_saved
    if not already_saved:
        await enforce_saved_articles_limit(db, user_id)

    # 3. Service Call
    # If this fails (ConnectionError, Validation), the Global Handler catches it.
    article = await save_article_from_url(
        db=db,
        user_id=current_user.sub,
        url=str(request.url),
        content=request.content or "",
        title=request.title,
        metadata=request.metadata.model_dump(exclude_none=True) if request.metadata else None,
        note=request.note,
        priority=(request.priority.value if isinstance(request.priority, ArticlePriority) else request.priority),
    )

    # 4. Resolve ID safely
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

    # 3. Handle Content Exists but User Entry Missing or Not Saved
    # Unsaving keeps the UserEntry row (is_saved=False), and read feed articles have
    # entries too, so the entry's existence alone does not mean it is saved.
    if not user_entry or not user_entry.is_saved:
        return ArticleCheckResponse(is_saved=False)

    # 4. Return Hit
    # Always return the UserEntry ID (clipped ID) so the extension can update it directly
    # Pydantic handles the serialization of UUIDs and Enums automatically
    return ArticleCheckResponse(
        article_id=str(user_entry.id),
        title=content.title,
        note=user_entry.user_note,
        priority=user_entry.priority,
        is_read=user_entry.is_read or False,
        is_saved=True,
        read_at=user_entry.read_at.isoformat() if user_entry.read_at else None,
    )
