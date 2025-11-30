from datetime import UTC, datetime
from uuid import UUID

import structlog
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.article.actions import set_article_state
from app.crud.article.ingester import upsert_article_content
from app.models.article import ArticleContent, UserEntry
from app.typing.entries import ArticleCreate

logger = structlog.get_logger(__name__)


class ClippedArticleResponse(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    content: ArticleContent
    user_entry: UserEntry


async def save_article_from_url(
    db: AsyncSession,
    *,
    user_id: UUID,
    url: str,
    content: str,
    title: str | None = None,
    metadata: dict | None = None,
    note: str | None = None,
    priority: str = "MEDIUM",
) -> ClippedArticleResponse:
    """
    Save article from extension.
    PURE ORCHESTRATION: Delegates to CRUD.
    """
    metadata = metadata or {}

    # 1. Prepare Content Data
    content_in = ArticleCreate(
        title=title or "Untitled",
        link=url,
        guid=url,  # Use URL as GUID for clips
        content=content,
        description=metadata.get("description"),
        author=metadata.get("author"),
        image_url=metadata.get("image_url"),
        published_at=datetime.now(UTC),
    )

    # 2. Delegate to CRUD: Content
    # This handles the "Check if exists, if not create, if yes update title" logic strictly in DB layer
    article_content = await upsert_article_content(
        db, article_in=content_in, update_title_if_changed=True
    )

    # 3. Delegate to CRUD: User State
    # This handles the "Mark as Read Later" logic
    user_entry = await set_article_state(
        db,
        user_id=user_id,
        content_id=article_content.id,  # type: ignore
        is_saved=True,
        priority=priority,
        user_note=note,
    )

    logger.info("Clipped article saved", url=url, user_id=str(user_id))

    # 4. Return
    return ClippedArticleResponse(content=article_content, user_entry=user_entry)
