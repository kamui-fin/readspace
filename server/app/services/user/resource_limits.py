"""
Resource limit enforcement logic.
"""

from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core import redis_cache
from app.core.custom_exceptions import NotFoundError, ResourceLimitError
from app.core.resource_limits import CODEX_LIMITS, RESOURCE_LIMITS
from app.crud import codex as crud_codex
from app.crud.profile import get_current_usage, get_profile_by_id
from app.models.codex import CodexDigest
from app.models.enums import CodexDigestStatus, UserRole


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


def _codex_local_today(local_date: date | None) -> date:
    """The reader's local calendar day (client-supplied); UTC today as a safe fallback."""
    return local_date or datetime.now(timezone.utc).date()


def _latest_is_retryable(latest: CodexDigest | None) -> bool:
    """A SKIPPED/FAILED latest edition can be re-run in place without spending a new slot."""
    return latest is not None and latest.status in (
        CodexDigestStatus.SKIPPED.value,
        CodexDigestStatus.FAILED.value,
    )


async def enforce_codex_quota(db: AsyncSession, user_id: UUID, local_date: date | None = None) -> CodexDigest | None:
    """
    Check whether the user may request a new Codex digest for their local ``local_date``.

    Returns an existing digest row when the request should be served from it (an in-flight or
    completed edition that isn't a retry). Returns None when the caller should create the next
    PENDING edition. Raises ResourceLimitError when the day's / month's allowance is spent.

    Allowance (the "day" is the client's local calendar day):
      - Admin: unlimited.
      - Pro:   up to CODEX_LIMITS["pro"]["per_day"] editions per local day.
      - Basic: 1 edition per local day AND <= CODEX_LIMITS["basic"]["per_month"] COMPLETED
               digests per calendar month.
    A SKIPPED/FAILED latest edition is always retryable and doesn't count against either cap.
    """
    profile = await get_profile_by_id(db, user_id=user_id)
    if not profile:
        raise NotFoundError(message="User profile not found", error_code="USER_PROFILE_NOT_FOUND")

    role = str(profile.role).upper().split(".")[-1]
    today = _codex_local_today(local_date)
    latest = await crud_codex.get_latest_edition_for_date(db, user_id, today)

    if role == UserRole.ADMIN.value:
        return None if _latest_is_retryable(latest) else latest

    # An active (PENDING/IN_PROGRESS/COMPLETED) latest edition: only dedupe to it while there's
    # still day-budget spent on it; a fresh generate past the cap is rejected below.
    active_editions = await crud_codex.count_editions_for_date(db, user_id, today)

    if role == UserRole.PRO.value:
        per_day = CODEX_LIMITS["pro"]["per_day"]
        if _latest_is_retryable(latest):
            return None
        if active_editions >= per_day:
            # The most recent active edition is what the client should keep seeing.
            if latest is not None:
                return latest
            raise ResourceLimitError(
                message=f"You've generated {per_day} Codex digests today. Try again tomorrow.",
                error_code="CODEX_LIMIT_EXCEEDED",
                details={"current_usage": active_editions, "limit": per_day, "period": "day"},
            )
        return None

    # BASIC (and any other role): 1 per local day, plus a monthly COMPLETED cap.
    per_day = CODEX_LIMITS["basic"]["per_day"]
    per_month = CODEX_LIMITS["basic"]["per_month"]
    month_cap_msg = f"You've used all {per_month} Codex digests for this month. Upgrade to Pro for more."

    # Already have today's (non-retryable) edition: just serve it, regardless of month state.
    if not _latest_is_retryable(latest) and active_editions >= per_day and latest is not None:
        return latest

    used_month = await crud_codex.count_ready_digests_in_month(db, user_id, today=today)
    if used_month >= per_month:
        raise ResourceLimitError(
            message=month_cap_msg,
            error_code="CODEX_LIMIT_EXCEEDED",
            details={"current_usage": used_month, "limit": per_month, "period": "month"},
        )

    if _latest_is_retryable(latest):
        return None  # retry today's failed/skipped edition (fits under the month cap)

    if active_editions >= per_day:
        raise ResourceLimitError(
            message="You've already generated today's Codex digest. Come back tomorrow.",
            error_code="CODEX_LIMIT_EXCEEDED",
            details={"current_usage": active_editions, "limit": per_day, "period": "day"},
        )
    return None


async def get_user_limits_and_usage(db: AsyncSession, user_id: UUID, local_date: date | None = None) -> dict[str, Any]:
    """
    Get user limits configuration and current usage stats.

    ``local_date`` is the caller's local calendar day (from the client); it scopes the Codex
    per-day usage so the "used today" count resets at the user's own midnight.
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
    redis_key = f"ai_usage:{user_id}:{today_str}"
    ai_usage_str = await redis_cache.get(redis_key)
    ai_usage = int(ai_usage_str) if ai_usage_str else 0

    codex_usage = await _get_codex_usage(db, user_id, role_lower, local_date)

    return {
        "role": profile.role,
        "limits": {**limits, "codex": CODEX_LIMITS.get(role_lower, {})},
        "usage": {
            "subscriptions": sub_usage,
            "daily_ai_calls": ai_usage,
            "codex": codex_usage,
        },
    }


async def _get_codex_usage(
    db: AsyncSession, user_id: UUID, role_lower: str, local_date: date | None = None
) -> dict[str, Any]:
    """Build the Codex usage summary shown in /users/limits.

    Pro -> {period: "day", limit, used} where ``used`` is today's active-edition count.
    Basic -> {period: "month", limit, used, used_today} - the monthly COMPLETED count plus
             whether today's one local-day digest is already spent.
    """
    today = _codex_local_today(local_date)

    if role_lower == "admin":
        return {"unlimited": True}

    used_today = await crud_codex.count_editions_for_date(db, user_id, today)

    if role_lower == "pro":
        return {"period": "day", "limit": CODEX_LIMITS["pro"]["per_day"], "used": used_today}

    used_this_month = await crud_codex.count_ready_digests_in_month(db, user_id, today=today)
    return {
        "period": "month",
        "limit": CODEX_LIMITS["basic"]["per_month"],
        "used": used_this_month,
        "used_today": min(used_today, CODEX_LIMITS["basic"]["per_day"]),
    }
