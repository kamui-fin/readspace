"""
Resource limit enforcement logic.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.resource_limits import RESOURCE_LIMITS
from app.crud.profile import get_current_usage, get_profile_by_id


def _get_limit_for_role(role: str, resource: str) -> int:
    """Get the numeric limit for a specific role and resource."""
    # Normalize role (handle "UserRole.BASIC" vs "basic")
    normalized_role = role.lower().split(".")[-1]

    role_limits = RESOURCE_LIMITS.get(normalized_role, RESOURCE_LIMITS["basic"])
    return role_limits.get(resource, 0)


async def check_limit(db: AsyncSession, user_id: UUID, resource: str, user_role: str) -> bool:
    """
    Boolean check: Can the user perform this action?
    """
    limit = _get_limit_for_role(user_role, resource)

    # -1 indicates unlimited
    if limit == -1:
        return True

    current_usage = await get_current_usage(db, user_id, resource)
    return current_usage < limit


async def enforce_subscription_limit(db: AsyncSession, user_id: UUID) -> None:
    """
    High-level dependency: Checks subscription limit and raises 429 if exceeded.

    Usage:
        await enforce_subscription_limit(db, user_id)
        # proceed to create subscription...
    """
    profile = await get_profile_by_id(db, user_id=user_id)
    if not profile:
        # Should technically never happen if auth middleware works
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")

    resource = "max_subscriptions"
    user_role = str(profile.role)

    limit = _get_limit_for_role(user_role, resource)

    # Check limit
    if limit != -1:
        current = await get_current_usage(db, user_id, resource)
        if current >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Subscription limit reached ({current}/{limit}). Please upgrade your plan.",
            )
