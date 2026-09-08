"""
Resource limit enforcement logic.
"""

from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core import redis_cache
from app.core.constants import SCRAPE_USAGE_KEY_PREFIX, USAGE_COUNTER_TTL_SECONDS
from app.core.custom_exceptions import NotFoundError, ResourceLimitError
from app.core.resource_limits import RESOURCE_LIMITS
from app.crud.profile import get_current_usage, get_profile_by_id


def _get_limit_for_role(role: str, resource: str) -> Any:
    """Get the limit for a specific role and resource."""
    # Normalize role (handle "UserRole.BASIC" vs "basic")
    normalized_role = role.lower().split(".")[-1]

    role_limits = RESOURCE_LIMITS.get(normalized_role, RESOURCE_LIMITS["basic"])
    return role_limits.get(resource, 0)


async def enforce_subscription_limit(db: AsyncSession, user_id: UUID, additional_count: int = 1) -> None:
    """
    Checks subscription limit and raises ResourceLimitError if exceeded.
    """
    profile = await get_profile_by_id(db, user_id=user_id)
    if not profile:
        raise NotFoundError(message="User profile not found", error_code="USER_PROFILE_NOT_FOUND")

    resource = "max_subscriptions"
    user_role = str(profile.role)

    limit = _get_limit_for_role(user_role, resource)

    # Check limit
    if limit != -1:
        current = await get_current_usage(db, user_id, resource)
        if current + additional_count > limit:
            raise ResourceLimitError(
                message="Subscription limit would be exceeded. Please upgrade your plan.",
                error_code="SUBSCRIPTION_LIMIT_EXCEEDED",
                details={
                    "current_usage": current,
                    "requested_additional": additional_count,
                    "limit": limit,
                    "would_be_total": current + additional_count,
                },
            )


async def enforce_daily_ai_limit(db: AsyncSession, user_id: UUID) -> None:
    """
    Checks and speculatively increments daily AI invocation limit.
    Raises ResourceLimitError if daily limit exceeded.
    """
    profile = await get_profile_by_id(db, user_id=user_id)
    if not profile:
        raise NotFoundError(message="User profile not found", error_code="USER_PROFILE_NOT_FOUND")

    user_role = str(profile.role)
    limit = _get_limit_for_role(user_role, "max_daily_ai_calls")

    if limit == -1:
        # Unlimited for Admin / Pro
        return

    today_str = date.today().isoformat()
    redis_key = f"ai_usage:{user_id}:{today_str}"

    # Speculatively increment
    # TTL of 36 hours is safe for timezone changes
    current = await redis_cache.incr(redis_key, ttl_seconds=36 * 3600)

    if current > limit:
        # Revert speculative increment
        await redis_cache.decr(redis_key)
        raise ResourceLimitError(
            message=f"Daily AI invocation limit of {limit} reached. Please upgrade to Pro for 100 calls per day.",
            error_code="AI_LIMIT_EXCEEDED",
            details={
                "current_usage": current - 1,
                "limit": limit,
            },
        )


def _scrape_usage_key(user_id: UUID) -> str:
    """Redis key for a user's article-scrape counter for the current UTC day."""
    return f"{SCRAPE_USAGE_KEY_PREFIX}:{user_id}:{date.today().isoformat()}"


async def check_daily_scrape_limit(db: AsyncSession, user_id: UUID) -> bool:
    """
    Check the daily article-scrape quota and speculatively increment it.

    Returns True if a scrape is allowed (and the counter has been incremented),
    False if the daily limit is already reached (counter left unchanged).

    This is the single place holding the scrape counter logic; callers that need
    a hard failure use ``enforce_daily_scrape_limit``.
    """
    profile = await get_profile_by_id(db, user_id=user_id)
    if not profile:
        raise NotFoundError(message="User profile not found", error_code="USER_PROFILE_NOT_FOUND")

    limit = _get_limit_for_role(str(profile.role), "max_daily_scrapes")

    if limit == -1:
        # Unlimited for Admin / Pro
        return True

    redis_key = _scrape_usage_key(user_id)
    current = await redis_cache.incr(redis_key, ttl_seconds=USAGE_COUNTER_TTL_SECONDS)

    if current > limit:
        # Revert speculative increment
        await redis_cache.decr(redis_key)
        return False

    return True


async def enforce_daily_scrape_limit(db: AsyncSession, user_id: UUID) -> None:
    """
    Speculatively increment the daily scrape counter, raising ResourceLimitError
    if the limit is exceeded. Used by the explicit full-text extraction endpoint.
    """
    if await check_daily_scrape_limit(db, user_id):
        return

    profile = await get_profile_by_id(db, user_id=user_id)
    limit = _get_limit_for_role(str(profile.role), "max_daily_scrapes") if profile else 0
    raise ResourceLimitError(
        message=f"Daily article extraction limit of {limit} reached. Upgrade to Pro for unlimited extractions.",
        error_code="SCRAPE_LIMIT_EXCEEDED",
        details={"limit": limit},
    )


async def get_user_limits_and_usage(db: AsyncSession, user_id: UUID) -> dict[str, Any]:
    """
    Get user limits configuration and current usage stats.
    """
    profile = await get_profile_by_id(db, user_id=user_id)
    if not profile:
        raise NotFoundError(message="User profile not found", error_code="USER_PROFILE_NOT_FOUND")

    user_role = str(profile.role)
    role_lower = user_role.lower().split(".")[-1]

    limits = RESOURCE_LIMITS.get(role_lower, RESOURCE_LIMITS["basic"])

    # Get current usages
    sub_usage = await get_current_usage(db, user_id, "max_subscriptions")

    today_str = date.today().isoformat()
    ai_usage_str = await redis_cache.get(f"ai_usage:{user_id}:{today_str}")
    ai_usage = int(ai_usage_str) if ai_usage_str else 0

    scrape_usage_str = await redis_cache.get(_scrape_usage_key(user_id))
    scrape_usage = int(scrape_usage_str) if scrape_usage_str else 0

    return {
        "role": profile.role,
        "limits": limits,
        "usage": {
            "subscriptions": sub_usage,
            "daily_ai_calls": ai_usage,
            "daily_scrapes": scrape_usage,
        },
    }
