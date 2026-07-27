"""Unit tests for user resource limits validation."""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.core.custom_exceptions import ResourceLimitError
from app.models.enums import UserRole
from app.services.user.resource_limits import (
    enforce_daily_ai_limit,
    enforce_subscription_limit,
)


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
        patch("app.services.user.resource_limits.get_profile_by_id", return_value=profile),
        patch("app.services.user.resource_limits.get_current_usage", return_value=2),
    ):
        # BASIC limit is 5, usage is 2, adding 1 -> under limit (3 <= 5)
        await enforce_subscription_limit(db, user_id, additional_count=1)


@pytest.mark.asyncio
async def test_enforce_subscription_limit_exceeded():
    """Test subscription checker raises ResourceLimitError when limit is exceeded."""
    db = AsyncMock()
    user_id = uuid4()

    profile = MockProfile(UserRole.BASIC)

    with (
        patch("app.services.user.resource_limits.get_profile_by_id", return_value=profile),
        patch("app.services.user.resource_limits.get_current_usage", return_value=5),
    ):
        # BASIC limit is 5, usage is 5, adding 1 -> exceeds limit (6 > 5)
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
        patch("app.services.user.resource_limits.get_profile_by_id", return_value=profile),
        patch("app.services.user.resource_limits.redis_cache.incr", return_value=1) as mock_incr,
    ):
        # BASIC limit is 3, incr returns 1 -> under limit (1 <= 3)
        await enforce_daily_ai_limit(db, user_id)
        mock_incr.assert_called_once()


@pytest.mark.asyncio
async def test_enforce_daily_ai_limit_exceeded():
    """Test daily AI checker raises ResourceLimitError and decrements key on limit breach."""
    db = AsyncMock()
    user_id = uuid4()

    profile = MockProfile(UserRole.BASIC)

    with (
        patch("app.services.user.resource_limits.get_profile_by_id", return_value=profile),
        patch("app.services.user.resource_limits.redis_cache.incr", return_value=4) as mock_incr,
        patch("app.services.user.resource_limits.redis_cache.decr") as mock_decr,
    ):
        # BASIC limit is 3, incr returns 4 -> exceeds limit (4 > 3)
        with pytest.raises(ResourceLimitError) as exc_info:
            await enforce_daily_ai_limit(db, user_id)
        assert exc_info.value.error_code == "AI_LIMIT_EXCEEDED"
        mock_incr.assert_called_once()
        mock_decr.assert_called_once()
