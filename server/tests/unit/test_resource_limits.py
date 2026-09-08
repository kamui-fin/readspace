"""Unit tests for user resource limits validation."""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.core.custom_exceptions import ResourceLimitError
from app.models.enums import UserRole
from app.services.user.resource_limits import (
    check_daily_scrape_limit,
    enforce_daily_ai_limit,
    enforce_daily_scrape_limit,
    enforce_subscription_limit,
)

TEST_LIMITS = {
    "basic": {"max_subscriptions": 10, "max_daily_ai_calls": 5, "max_daily_scrapes": 5},
    "pro": {"max_subscriptions": 1000, "max_daily_ai_calls": 100, "max_daily_scrapes": -1},
    "admin": {"max_subscriptions": -1, "max_daily_ai_calls": -1, "max_daily_scrapes": -1},
}


class MockProfile:
    def __init__(self, role: UserRole):
        self.id = uuid4()
        self.role = role


@pytest.mark.asyncio
async def test_enforce_subscription_limit_under_limit():
    """Test subscription checker passes when usage is under limit."""
    db = AsyncMock()
    user_id = uuid4()

    # Mock profile and current usage
    profile = MockProfile(UserRole.BASIC)

    with (
        patch("app.services.user.resource_limits.RESOURCE_LIMITS", TEST_LIMITS),
        patch("app.services.user.resource_limits.get_profile_by_id", return_value=profile),
        patch("app.services.user.resource_limits.get_current_usage", return_value=2),
    ):
        # BASIC limit is 10, usage is 2, adding 1 -> under limit (3 <= 10)
        await enforce_subscription_limit(db, user_id, additional_count=1)


@pytest.mark.asyncio
async def test_enforce_subscription_limit_exceeded():
    """Test subscription checker raises ResourceLimitError when limit is exceeded."""
    db = AsyncMock()
    user_id = uuid4()

    profile = MockProfile(UserRole.BASIC)

    with (
        patch("app.services.user.resource_limits.RESOURCE_LIMITS", TEST_LIMITS),
        patch("app.services.user.resource_limits.get_profile_by_id", return_value=profile),
        patch("app.services.user.resource_limits.get_current_usage", return_value=10),
    ):
        # BASIC limit is 10, usage is 10, adding 1 -> exceeds limit (11 > 10)
        with pytest.raises(ResourceLimitError) as exc_info:
            await enforce_subscription_limit(db, user_id, additional_count=1)
        assert exc_info.value.error_code == "SUBSCRIPTION_LIMIT_EXCEEDED"


@pytest.mark.asyncio
async def test_enforce_daily_ai_limit_under_limit():
    """Test daily AI checker passes and increments key when under limit."""
    db = AsyncMock()
    user_id = uuid4()

    profile = MockProfile(UserRole.BASIC)

    with (
        patch("app.services.user.resource_limits.RESOURCE_LIMITS", TEST_LIMITS),
        patch("app.services.user.resource_limits.get_profile_by_id", return_value=profile),
        patch("app.services.user.resource_limits.redis_cache.incr", return_value=1) as mock_incr,
    ):
        # BASIC limit is 5, incr returns 1 -> under limit (1 <= 5)
        await enforce_daily_ai_limit(db, user_id)
        mock_incr.assert_called_once()


@pytest.mark.asyncio
async def test_enforce_daily_ai_limit_exceeded():
    """Test daily AI checker raises ResourceLimitError and decrements key on limit breach."""
    db = AsyncMock()
    user_id = uuid4()

    profile = MockProfile(UserRole.BASIC)

    with (
        patch("app.services.user.resource_limits.RESOURCE_LIMITS", TEST_LIMITS),
        patch("app.services.user.resource_limits.get_profile_by_id", return_value=profile),
        patch("app.services.user.resource_limits.redis_cache.incr", return_value=6) as mock_incr,
        patch("app.services.user.resource_limits.redis_cache.decr") as mock_decr,
    ):
        # BASIC limit is 5, incr returns 6 -> exceeds limit (6 > 5)
        with pytest.raises(ResourceLimitError) as exc_info:
            await enforce_daily_ai_limit(db, user_id)
        assert exc_info.value.error_code == "AI_LIMIT_EXCEEDED"
        mock_incr.assert_called_once()
        mock_decr.assert_called_once()


@pytest.mark.asyncio
async def test_check_daily_scrape_limit_under_limit():
    """Scrape checker returns True and increments the counter when under limit."""
    db = AsyncMock()
    user_id = uuid4()
    profile = MockProfile(UserRole.BASIC)

    with (
        patch("app.services.user.resource_limits.RESOURCE_LIMITS", TEST_LIMITS),
        patch("app.services.user.resource_limits.get_profile_by_id", return_value=profile),
        patch("app.services.user.resource_limits.redis_cache.incr", return_value=1) as mock_incr,
        patch("app.services.user.resource_limits.redis_cache.decr") as mock_decr,
    ):
        assert await check_daily_scrape_limit(db, user_id) is True
        mock_incr.assert_called_once()
        mock_decr.assert_not_called()


@pytest.mark.asyncio
async def test_check_daily_scrape_limit_over_limit_reverts():
    """Scrape checker returns False and reverts the speculative increment on breach."""
    db = AsyncMock()
    user_id = uuid4()
    profile = MockProfile(UserRole.BASIC)

    with (
        patch("app.services.user.resource_limits.RESOURCE_LIMITS", TEST_LIMITS),
        patch("app.services.user.resource_limits.get_profile_by_id", return_value=profile),
        patch("app.services.user.resource_limits.redis_cache.incr", return_value=6) as mock_incr,
        patch("app.services.user.resource_limits.redis_cache.decr") as mock_decr,
    ):
        # BASIC limit is 5, incr returns 6 -> over limit
        assert await check_daily_scrape_limit(db, user_id) is False
        mock_incr.assert_called_once()
        mock_decr.assert_called_once()


@pytest.mark.asyncio
async def test_check_daily_scrape_limit_pro_bypasses():
    """Pro/admin (limit -1) bypass the scrape counter entirely."""
    db = AsyncMock()
    user_id = uuid4()
    profile = MockProfile(UserRole.PRO)

    with (
        patch("app.services.user.resource_limits.RESOURCE_LIMITS", TEST_LIMITS),
        patch("app.services.user.resource_limits.get_profile_by_id", return_value=profile),
        patch("app.services.user.resource_limits.redis_cache.incr") as mock_incr,
    ):
        assert await check_daily_scrape_limit(db, user_id) is True
        mock_incr.assert_not_called()


@pytest.mark.asyncio
async def test_enforce_daily_scrape_limit_raises_on_breach():
    """enforce_daily_scrape_limit raises ResourceLimitError when the quota is exhausted."""
    db = AsyncMock()
    user_id = uuid4()
    profile = MockProfile(UserRole.BASIC)

    with (
        patch("app.services.user.resource_limits.RESOURCE_LIMITS", TEST_LIMITS),
        patch("app.services.user.resource_limits.get_profile_by_id", return_value=profile),
        patch("app.services.user.resource_limits.redis_cache.incr", return_value=6),
        patch("app.services.user.resource_limits.redis_cache.decr"),
    ):
        with pytest.raises(ResourceLimitError) as exc_info:
            await enforce_daily_scrape_limit(db, user_id)
        assert exc_info.value.error_code == "SCRAPE_LIMIT_EXCEEDED"
        assert exc_info.value.details["limit"] == 5


@pytest.mark.asyncio
async def test_enforce_daily_scrape_limit_passes_under_limit():
    """enforce_daily_scrape_limit is a no-op when under the quota."""
    db = AsyncMock()
    user_id = uuid4()
    profile = MockProfile(UserRole.BASIC)

    with (
        patch("app.services.user.resource_limits.RESOURCE_LIMITS", TEST_LIMITS),
        patch("app.services.user.resource_limits.get_profile_by_id", return_value=profile),
        patch("app.services.user.resource_limits.redis_cache.incr", return_value=3),
        patch("app.services.user.resource_limits.redis_cache.decr") as mock_decr,
    ):
        await enforce_daily_scrape_limit(db, user_id)
        mock_decr.assert_not_called()
