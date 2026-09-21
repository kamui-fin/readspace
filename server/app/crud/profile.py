"""
CRUD operations for Profile model
"""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import NEWSLETTER_URL_SCHEME
from app.models.article import UserEntry
from app.models.feed import Feed, FeedSubscription
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

    if resource == "max_newsletters":
        query = (
            select(func.count())
            .select_from(FeedSubscription)
            .join(Feed, Feed.id == FeedSubscription.feed_id)
            # Newsletters are the virtual email feeds, identified by URL scheme. Not content_type:
            # enrichment also tags ordinary RSS feeds (e.g. Substack) as "newsletter".
            .where(FeedSubscription.user_id == user_id, Feed.url.startswith(NEWSLETTER_URL_SCHEME))
        )
        result = await db.execute(query)
        return result.scalar() or 0

    if resource == "max_saved_articles":
        # Same predicate as the read-later list, so the count matches what the user sees
        query = select(func.count()).select_from(UserEntry).where(UserEntry.user_id == user_id, UserEntry.is_saved)
        result = await db.execute(query)
        return result.scalar() or 0

    return 0


async def update_profile(db: AsyncSession, *, user_id: UUID, is_onboarded: bool | None = None) -> Profile | None:
    """Update profile fields."""
    profile = await get_profile_by_id(db, user_id=user_id)
    if not profile:
        return None
    if is_onboarded is not None:
        profile.is_onboarded = is_onboarded
    await db.commit()
    await db.refresh(profile)
    return profile
