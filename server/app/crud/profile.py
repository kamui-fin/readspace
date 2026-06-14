"""
CRUD operations for Profile model
"""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.feed import FeedSubscription
from app.models.user import Profile


async def get_profile_by_id(db: AsyncSession, *, user_id: UUID) -> Profile | None:
    """Get profile by user ID"""
    result = await db.execute(select(Profile).where(Profile.id == user_id))
    return result.scalar_one_or_none()


async def get_profile_by_newsletter_token(db: AsyncSession, *, token: str) -> Profile | None:
    """Get profile by newsletter token"""
    result = await db.execute(select(Profile).where(Profile.newsletter_token == token))
    return result.scalar_one_or_none()


async def get_current_usage(db: AsyncSession, user_id: UUID, resource: str) -> int:
    """
    Get current usage count for a specific resource type.
    """
    if resource == "max_subscriptions":
        query = select(func.count()).select_from(FeedSubscription).where(FeedSubscription.user_id == user_id)
        result = await db.execute(query)
        return result.scalar() or 0

    # Add other resources here as needed (e.g. max_bookmarks, max_daily_reads)
    return 0
