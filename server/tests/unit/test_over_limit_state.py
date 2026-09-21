"""Unit tests for the pure plan-compliance computation (no database)."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.core.custom_exceptions import ResourceLimitError, ValidationError
from app.core.resource_limits import RESOURCE_LIMITS
from app.services.user.resource_limits import compute_over_limit_state

pytestmark = pytest.mark.unit

BASIC_FEEDS: int = RESOURCE_LIMITS["basic"]["max_subscriptions"]
BASIC_SAVES: int = RESOURCE_LIMITS["basic"]["max_saved_articles"]


@pytest.mark.parametrize(
    ("subscriptions", "expected"),
    [(BASIC_FEEDS - 1, False), (BASIC_FEEDS, False), (BASIC_FEEDS + 1, True)],
)
def test_basic_subscriptions_over_limit_only_above_cap(subscriptions: int, expected: bool) -> None:
    state = compute_over_limit_state("BASIC", subscriptions=subscriptions, newsletters=0, saved_articles=0)

    assert state.subscriptions.over is expected
    assert state.downgrade_required is expected
    assert state.subscriptions.limit == BASIC_FEEDS


def test_basic_with_any_newsletter_requires_downgrade_even_under_feed_cap() -> None:
    state = compute_over_limit_state("BASIC", subscriptions=3, newsletters=1, saved_articles=0)

    assert state.newsletters.over is True
    assert state.subscriptions.over is False
    assert state.downgrade_required is True


@pytest.mark.parametrize("saved", [BASIC_SAVES - 1, BASIC_SAVES, BASIC_SAVES + 1, BASIC_SAVES * 4])
def test_excess_saved_articles_never_require_downgrade(saved: int) -> None:
    state = compute_over_limit_state("BASIC", subscriptions=0, newsletters=0, saved_articles=saved)

    assert state.saved_articles.over is (saved > BASIC_SAVES)
    assert state.downgrade_required is False


@pytest.mark.parametrize("role", ["PRO", "UserRole.PRO", "ADMIN"])
def test_paid_roles_are_compliant_with_large_holdings(role: str) -> None:
    state = compute_over_limit_state(role, subscriptions=200, newsletters=20, saved_articles=500)

    assert state.downgrade_required is False
    assert not state.saved_articles.over


def test_admin_limits_are_reported_as_unlimited() -> None:
    state = compute_over_limit_state("ADMIN", subscriptions=5000, newsletters=500, saved_articles=5000)

    assert state.subscriptions.limit == -1
    assert state.newsletters.limit == -1
    assert state.saved_articles.limit == -1


@pytest.mark.parametrize("role", ["PRO", "UserRole.PRO"])
def test_existing_paid_holdings_above_new_caps_do_not_trigger_free_downgrade(role):
    state = compute_over_limit_state(role, subscriptions=1101, newsletters=101, saved_articles=0)
    assert state.subscriptions.over
    assert state.newsletters.over
    assert not state.downgrade_required


@pytest.mark.asyncio
async def test_paid_overage_keeps_content_access_and_cannot_invoke_destructive_free_resolution():
    from app.services.user import downgrade

    state = compute_over_limit_state("PRO", subscriptions=101, newsletters=101, saved_articles=0)
    with (
        patch.object(downgrade.redis_cache, "exists", new=AsyncMock(return_value=False)),
        patch.object(downgrade.redis_cache, "set", new=AsyncMock()),
        patch.object(downgrade, "get_over_limit_state", new=AsyncMock(return_value=state)),
        patch.object(downgrade, "bulk_delete_subscriptions", new=AsyncMock()) as delete,
    ):
        db, user_id = AsyncMock(), uuid4()
        await downgrade.ensure_plan_compliance(db, user_id)
        with pytest.raises(ValidationError):
            await downgrade.resolve_downgrade(db, user_id, [])
        delete.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(("subscriptions", "newsletters"), [(1000, 10), (101, 101)])
async def test_paid_overage_still_blocks_new_newsletter_subscriptions(subscriptions, newsletters):
    from app.services.user import resource_limits

    async def usage(db, user_id, resource):
        return subscriptions if resource == "max_subscriptions" else newsletters

    with (
        patch.object(resource_limits, "get_profile_by_id", new=AsyncMock(return_value=SimpleNamespace(role="PRO"))),
        patch.object(resource_limits, "get_current_usage", side_effect=usage),
    ):
        with pytest.raises(ResourceLimitError):
            await resource_limits.enforce_newsletter_limit(AsyncMock(), uuid4())
