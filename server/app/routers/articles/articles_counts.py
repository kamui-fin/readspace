"""Article count routes - consolidated unread counts."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.article.counts import (
    count_read_later_articles,
    count_today_articles,
    get_unread_counts_per_feed,
)
from app.db.session import get_db
from app.services.user.auth import get_current_user
from app.typing.user import TokenData

router = APIRouter()


from app.models.enums import UserRole
from app.utils.time import get_sync_cutoff

# --- Response Model ---
class ArticleCountsResponse(BaseModel):
    feed_counts: dict[str, int]
    read_later: int
    today: int


# --- Routes ---
@router.get(
    "/counts",
    response_model=ArticleCountsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get article counts",
    description="Retrieve unread counts per feed, read later count, and today's count.",
)
async def get_article_counts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> ArticleCountsResponse:
    """
    Retrieve unread stats for the frontend sidebar.
    """
    user_id = UUID(current_user.sub)

    published_until = None
    if current_user.role == UserRole.BASIC:
        published_until = get_sync_cutoff()

    # Parallel execution could be added here using asyncio.gather for minor perf boost
    feed_counts = await get_unread_counts_per_feed(db=db, user_id=user_id, published_until=published_until)
    read_later = await count_read_later_articles(db=db, user_id=user_id)
    today = await count_today_articles(db=db, user_id=user_id, published_until=published_until)

    return ArticleCountsResponse(
        feed_counts={str(fid): count for fid, count in feed_counts.items()},
        read_later=read_later,
        today=today,
    )
