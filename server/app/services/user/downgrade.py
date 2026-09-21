"""
Plan downgrade compliance.

When a user's role drops (e.g. Pro -> Basic after a cancelled subscription), their existing
subscriptions can exceed the new plan. Role changes happen outside the API (billing webhooks
write ``profiles.role`` directly), so compliance is derived from current state on demand rather
than from a downgrade event: a Basic user must resolve holdings above their plan's limits.
Existing paid holdings remain readable; caps still apply to new subscriptions.
"""

from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import redis_cache
from app.core.constants import (
    DOWNGRADE_ACTION_REQUIRED_ERROR_CODE,
    PLAN_COMPLIANCE_CACHE_KEY_PREFIX,
    PLAN_COMPLIANCE_CACHE_TTL_SECONDS,
)
from app.core.custom_exceptions import DowngradeRequiredError, ValidationError
from app.crud.feed.subscription import bulk_delete_subscriptions, get_subscribed_feed_ids_by_kind
from app.services.user.resource_limits import get_over_limit_state
from app.typing.user import DowngradeResolveResponse, OverLimitState

logger = structlog.get_logger(__name__)


def _compliance_cache_key(user_id: UUID) -> str:
    """Redis key marking a user as recently verified plan-compliant."""
    return f"{PLAN_COMPLIANCE_CACHE_KEY_PREFIX}:{user_id}"


async def invalidate_plan_compliance(user_id: UUID) -> None:
    """Drop the cached compliant flag so the next request re-checks the user's holdings."""
    await redis_cache.delete(_compliance_cache_key(user_id))


def _downgrade_required_error(state: OverLimitState) -> DowngradeRequiredError:
    """Build the error returned to clients that must finish the downgrade flow."""
    return DowngradeRequiredError(
        message="Your plan changed. Open Readspace to choose which feeds to keep.",
        error_code=DOWNGRADE_ACTION_REQUIRED_ERROR_CODE,
        details=state.model_dump(),
    )


async def ensure_plan_compliance(db: AsyncSession, user_id: UUID) -> None:
    """
    Raise DowngradeRequiredError when a Basic user's holdings exceed their plan.

    Only a compliant result is cached (briefly), so a non-compliant user is re-checked on every
    request and unblocked as soon as they resolve. A fresh downgrade can go unnoticed for at most
    PLAN_COMPLIANCE_CACHE_TTL_SECONDS.
    """
    cache_key = _compliance_cache_key(user_id)
    if await redis_cache.exists(cache_key):
        return

    state = await get_over_limit_state(db, user_id)
    if state.downgrade_required:
        logger.info(
            "Blocked request pending downgrade resolution",
            user_id=str(user_id),
            subscriptions=state.subscriptions.usage,
            newsletters=state.newsletters.usage,
        )
        raise _downgrade_required_error(state)

    await redis_cache.set(cache_key, True, ttl_seconds=PLAN_COMPLIANCE_CACHE_TTL_SECONDS)


async def resolve_downgrade(db: AsyncSession, user_id: UUID, keep_feed_ids: list[UUID]) -> DowngradeResolveResponse:
    """
    Keep only ``keep_feed_ids`` and unsubscribe the user from everything else.

    All newsletters are removed when the plan allows none. The whole change runs in the
    request's transaction, so the user ends either fully compliant or unchanged.

    Raises:
        ValidationError: The user isn't over their plan, picked too many feeds, or picked a feed
            that isn't one of their own regular (non-newsletter) subscriptions.
    """
    state = await get_over_limit_state(db, user_id)
    if not state.downgrade_required:
        raise ValidationError(
            message="Your subscriptions already fit your plan.",
            error_code="DOWNGRADE_NOT_REQUIRED",
        )

    keep = set(keep_feed_ids)
    feed_limit = state.subscriptions.limit
    if feed_limit != -1 and len(keep) > feed_limit:
        raise ValidationError(
            message=f"You can keep up to {feed_limit} feeds on your plan.",
            error_code="DOWNGRADE_TOO_MANY_FEEDS",
            details={"requested": len(keep), "limit": feed_limit},
        )

    feed_ids, newsletter_ids = await get_subscribed_feed_ids_by_kind(db, user_id=user_id)
    unknown = keep - feed_ids
    if unknown:
        raise ValidationError(
            message="Some selected feeds can't be kept.",
            error_code="DOWNGRADE_INVALID_FEEDS",
            details={"invalid_feed_ids": [str(feed_id) for feed_id in unknown]},
        )

    remove_feeds = feed_ids - keep
    # Newsletters only survive a downgrade to a plan that still allows them
    newsletter_limit = state.newsletters.limit
    remove_newsletters = newsletter_ids if newsletter_limit == 0 else set()

    to_remove = list(remove_feeds | remove_newsletters)
    if to_remove:
        await bulk_delete_subscriptions(db, feed_ids=to_remove, user_id=user_id)
    await invalidate_plan_compliance(user_id)
    # Same session, so the flushed deletes are visible without waiting for the commit
    resolved_state = await get_over_limit_state(db, user_id)

    logger.info(
        "Resolved plan downgrade",
        user_id=str(user_id),
        kept=len(keep),
        removed_feeds=len(remove_feeds),
        removed_newsletters=len(remove_newsletters),
    )
    return DowngradeResolveResponse(
        kept_count=len(keep),
        removed_feed_count=len(remove_feeds),
        removed_newsletter_count=len(remove_newsletters),
        over_limit=resolved_state,
    )
