import structlog
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

# New CRUD imports
from app.crud import content as crud_content
from app.crud import state as crud_state
from app.schemas import ArticleContentCreate, ClippedArticleResponse
from app.utils.reading_time import calculate_reading_time

logger = structlog.get_logger(__name__)


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
    PURE ORCHESTRATION: No DB queries defined here.
    """
    metadata = metadata or {}

    # 1. Prepare Content Data
    # Logic: Determine published date
    published_at = datetime.now(timezone.utc)
    if metadata.get("published_at"):
        # (Assume parser util is here)
        pass

    content_in = ArticleContentCreate(
        title=title or "Untitled",
        link=url,
        content=content,
        description=metadata.get("description"),
        author=metadata.get("author"),
        image_url=metadata.get("image_url"),
        published_at=published_at,
        estimated_read_time_minutes=calculate_reading_time(content),
        custom_metadata=metadata,
    )

    # 2. Delegate to CRUD: Content
    # This handles the "Check if exists, if not create, if yes update title" logic strictly in DB layer
    article_content = await crud_content.create_or_update(db, obj_in=content_in, update_title_if_changed=True)

    # 3. Delegate to CRUD: User State
    # This handles the "Mark as Read Later" logic
    user_entry = await crud_state.upsert_user_state(
        db, user_id=user_id, content_id=article_content.id, is_read_later=True, priority=priority, note=note
    )

    logger.info("Clipped article saved", url=url, user_id=user_id)

    # 4. Return
    return ClippedArticleResponse(content=article_content, user_entry=user_entry)
