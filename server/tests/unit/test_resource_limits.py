"""Unit tests for resource limits functionality."""

import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock

from app.core.resource_limits import RESOURCE_LIMITS
from app.services.resource_limit_service import ResourceLimitService, ResourceLimitError


@pytest.fixture
def mock_db():
    """Mock database session."""
    return AsyncMock()


@pytest.fixture
def service(mock_db):
    """Resource limit service with mock database."""
    return ResourceLimitService(mock_db)


@pytest.mark.unit
class TestResourceLimitService:
    """Test the ResourceLimitService class."""

    def test_get_user_limits_basic(self, service):
        """Test getting limits for basic user role."""
        limits = service.get_user_limits("basic")
        expected = RESOURCE_LIMITS["basic"]
        assert limits == expected
        assert limits["max_subscriptions"] == 1000
        assert limits["max_books"] == 10

    def test_get_user_limits_admin(self, service):
        """Test getting limits for admin user role."""
        limits = service.get_user_limits("admin")
        expected = RESOURCE_LIMITS["admin"]
        assert limits == expected
        assert limits["max_subscriptions"] == -1  # Unlimited
        assert limits["max_books"] == -1  # Unlimited

    def test_get_user_limits_unknown_role(self, service):
        """Test getting limits for unknown user role defaults to basic."""
        limits = service.get_user_limits("unknown_role")
        expected = RESOURCE_LIMITS["basic"]
        assert limits == expected

    def test_check_book_file_size_basic_within_limit(self, service):
        """Test file size check for basic user within limit."""
        result = service.check_book_file_size(3.0, "basic")  # 3MB
        assert result is True

    def test_check_book_file_size_basic_exceeds_limit(self, service):
        """Test file size check for basic user exceeding limit."""
        result = service.check_book_file_size(10.0, "basic")  # 10MB
        assert result is False

    def test_check_book_file_size_admin_unlimited(self, service):
        """Test file size check for admin user (unlimited)."""
        result = service.check_book_file_size(100.0, "admin")  # 100MB
        assert result is True

    @pytest.mark.asyncio
    async def test_check_limit_admin_unlimited(self, service, mock_db):
        """Test limit check for admin user (should always pass)."""
        user_id = uuid4()
        
        result = await service.check_limit(user_id, "max_subscriptions", "admin")
        assert result is True
        
        # Database should not be queried for admin users
        mock_db.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_check_limit_basic_within_limit(self, service, mock_db):
        """Test limit check for basic user within limits."""
        user_id = uuid4()
        
        # Mock database to return current usage count of 5
        mock_result = MagicMock()
        mock_result.scalar_one.return_value = 5
        mock_db.execute.return_value = mock_result
        
        result = await service.check_limit(user_id, "max_books", "basic")
        assert result is True  # 5 < 10 (limit)

    @pytest.mark.asyncio
    async def test_check_limit_basic_at_limit(self, service, mock_db):
        """Test limit check for basic user at limit."""
        user_id = uuid4()
        
        # Mock database to return current usage count of 10
        mock_result = MagicMock()
        mock_result.scalar_one.return_value = 10
        mock_db.execute.return_value = mock_result
        
        result = await service.check_limit(user_id, "max_books", "basic")
        assert result is False  # 10 >= 10 (limit)

    @pytest.mark.asyncio
    async def test_get_current_usage_subscriptions(self, service, mock_db):
        """Test getting current usage count for subscriptions."""
        user_id = uuid4()
        
        # Mock database to return usage count of 25
        mock_result = MagicMock()
        mock_result.scalar_one.return_value = 25
        mock_db.execute.return_value = mock_result
        
        usage = await service.get_current_usage(user_id, "max_subscriptions")
        assert usage == 25

    @pytest.mark.asyncio
    async def test_get_current_usage_books(self, service, mock_db):
        """Test getting current usage count for books."""
        user_id = uuid4()
        
        # Mock database to return usage count of 3
        mock_result = MagicMock()
        mock_result.scalar_one.return_value = 3
        mock_db.execute.return_value = mock_result
        
        usage = await service.get_current_usage(user_id, "max_books")
        assert usage == 3

    @pytest.mark.asyncio
    async def test_get_current_usage_unknown_resource(self, service, mock_db):
        """Test getting current usage count for unknown resource returns 0."""
        user_id = uuid4()
        
        usage = await service.get_current_usage(user_id, "unknown_resource")
        assert usage == 0
        mock_db.execute.assert_not_called()


@pytest.mark.unit
class TestResourceLimitError:
    """Test the ResourceLimitError exception."""

    def test_resource_limit_error_creation(self):
        """Test creating ResourceLimitError with proper attributes."""
        error = ResourceLimitError("max_books", 10, 15)
        assert error.resource == "max_books"
        assert error.limit == 10
        assert error.current == 15
        assert "max_books" in str(error)
        assert "15/10" in str(error)