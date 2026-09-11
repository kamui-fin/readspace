"""
Resource limit enforcement logic.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core import redis_cache
from app.core.constants import SCRAPE_USAGE_KEY_PREFIX, USAGE_COUNTER_TTL_SECONDS
from app.core.custom_exceptions import NotFoundError, ResourceLimitError
from app.core.resource_limits import CODEX_LIMITS, CODEX_QUOTA_WINDOW_HOURS, RESOURCE_LIMITS
from app.crud import codex as crud_codex
from app.crud.profile import get_current_usage, get_profile_by_id
from app.models.codex import CodexDigest
from app.models.enums import UserRole


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


def _codex_quota_window() -> timedelta:
    return timedelta(hours=CODEX_QUOTA_WINDOW_HOURS)


async def enforce_codex_quota(db: AsyncSession, user_id: UUID, local_date: date | None = None) -> CodexDigest | None:
    """Decide whether the user may start a new Codex digest generation right now.

    Returns:
      - an existing CodexDigest row  -> serve it back, don't spend a slot (an in-flight
        generation is still running, or the cap is hit and this is the row to keep polling);
      - None                          -> the caller should create the next PENDING digest.
    Raises ResourceLimitError when the allowance is spent and there's no row to fall back to.

    Allowance (all server-clock, ``local_date`` plays no part):
      - Admin: unlimited.
      - Pro:   at most CODEX_LIMITS["pro"]["per_window"] generations whose ``requested_at`` is
               within the trailing CODEX_QUOTA_WINDOW_HOURS.
      - Basic: at most CODEX_LIMITS["basic"]["per_window"] in that same window, AND
               <= CODEX_LIMITS["basic"]["per_month"] COMPLETED digests this calendar month.
    A SKIPPED / FAILED latest generation is always retryable in place and counts against
    nothing.
    """
    profile = await get_profile_by_id(db, user_id=user_id)
    if not profile:
        raise NotFoundError(message="User profile not found", error_code="USER_PROFILE_NOT_FOUND")

    role = str(profile.role).upper().split(".")[-1]
    now = datetime.now(timezone.utc)
    window = _codex_quota_window()
    window_h = CODEX_QUOTA_WINDOW_HOURS

    # (1) A retryable (SKIPPED/FAILED) most-recent generation is re-run in place - no slot
    #     spent, no cap consulted. Checked first for every role, before the in-flight check
    #     (a retryable row is never in-flight).
    if await crud_codex.get_latest_retryable(db, user_id) is not None:
        return None

    if role == UserRole.ADMIN.value:
        return None

    tier = "pro" if role == UserRole.PRO.value else "basic"
    per_window = CODEX_LIMITS[tier]["per_window"]
    recent = await crud_codex.count_recent_generations(db, user_id, window=window, now=now)

    # (2) Still under the per-window cap: for BASIC also check the monthly COMPLETED cap, then
    #     allow a fresh generation. PRO has no monthly cap.
    if recent < per_window:
        if tier == "pro":
            return None
        per_month = CODEX_LIMITS["basic"]["per_month"]
        month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        used_month = await crud_codex.count_completed_since(db, user_id, since=month_start)
        if used_month >= per_month:
            raise ResourceLimitError(
                message=f"You've used all {per_month} Daily Digests for this month. Upgrade to Pro for more.",
                error_code="CODEX_LIMIT_EXCEEDED",
                details={"current_usage": used_month, "limit": per_month, "period": "month"},
            )
        return None

    # (3) At/over the per-window cap. If one of those generations is still running, hand it
    #     back so the client keeps polling it (no duplicate, no extra slot). Otherwise refuse.
    in_flight = await crud_codex.get_latest_in_flight(db, user_id)
    if in_flight is not None:
        return in_flight

    hours_msg = f"{window_h} hours"
    if per_window == 1:
        message = f"You've already built a Daily Digest in the last {hours_msg}. Come back later."
    else:
        message = f"You've built {per_window} Daily Digests in the last {hours_msg}. Try again later."
    # Pro has no monthly cap and nothing above it to sell - a window-cap refusal here is a
    # pacing limit, not an entitlement gap, so it gets its own code. The client renders a plain
    # "come back later" explainer for it instead of the Basic upgrade-to-Pro paywall.
    error_code = "CODEX_PRO_RATE_LIMITED" if tier == "pro" else "CODEX_LIMIT_EXCEEDED"
    raise ResourceLimitError(
        message=message,
        error_code=error_code,
        details={"current_usage": recent, "limit": per_window, "period": "window", "window_hours": window_h},
    )


async def get_user_limits_and_usage(db: AsyncSession, user_id: UUID, local_date: date | None = None) -> dict[str, Any]:
    """
    Get user limits configuration and current usage stats.

    ``local_date`` is accepted for backwards compatibility but no longer affects the Codex
    usage figures - the generation cap is a server-clock rolling window (see
    ``CODEX_QUOTA_WINDOW_HOURS``).
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

    codex_usage = await _get_codex_usage(db, user_id, role_lower, local_date)

    return {
        "role": profile.role,
        "limits": {**limits, "codex": CODEX_LIMITS.get(role_lower, {})},
        "usage": {
            "subscriptions": sub_usage,
            "daily_ai_calls": ai_usage,
            "daily_scrapes": scrape_usage,
            "codex": codex_usage,
        },
    }


async def _get_codex_usage(
    db: AsyncSession, user_id: UUID, role_lower: str, local_date: date | None = None
) -> dict[str, Any]:
    """Build the Codex usage summary shown in /users/limits.

    The generation cap is a rolling window (see ``CODEX_QUOTA_WINDOW_HOURS``):
      Pro   -> {period: "window", window_hours, limit, used}
      Basic -> {period: "month", limit, used, used_in_window, window_hours} - the monthly
               COMPLETED count plus whether this window's generation is already spent.
    ``local_date`` is ignored (kept in the signature for callers that still pass it).
    """
    if role_lower == "admin":
        return {"unlimited": True}

    now = datetime.now(timezone.utc)
    window = timedelta(hours=CODEX_QUOTA_WINDOW_HOURS)
    used_in_window = await crud_codex.count_recent_generations(db, user_id, window=window, now=now)

    if role_lower == "pro":
        return {
            "period": "window",
            "window_hours": CODEX_QUOTA_WINDOW_HOURS,
            "limit": CODEX_LIMITS["pro"]["per_window"],
            "used": used_in_window,
        }

    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    used_this_month = await crud_codex.count_completed_since(db, user_id, since=month_start)
    return {
        "period": "month",
        "limit": CODEX_LIMITS["basic"]["per_month"],
        "used": used_this_month,
        "used_in_window": min(used_in_window, CODEX_LIMITS["basic"]["per_window"]),
        "window_hours": CODEX_QUOTA_WINDOW_HOURS,
    }
