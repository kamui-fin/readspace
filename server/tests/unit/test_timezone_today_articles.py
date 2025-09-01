"""Unit tests for last 24 hours articles functionality."""

import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock, AsyncMock
from uuid import UUID

from app.routers.rss_articles import get_todays_articles
from app.schemas.auth import TokenData


class TestLast24HoursArticles:
    """Test last 24 hours article filtering."""

    @pytest.fixture
    def mock_db_session(self):
        """Mock database session."""
        return MagicMock()

    @pytest.fixture
    def mock_current_user(self):
        """Mock current user token data."""
        return TokenData(sub="12345678-1234-5678-1234-567812345678")

    @pytest.fixture
    def mock_rss_service(self):
        """Mock RSS service."""
        service = AsyncMock()
        service.get_articles.return_value = {
            "items": [],
            "total": 0,
            "page": 1,
            "pages": 1,
            "size": 25
        }
        return service

    @pytest.mark.asyncio
    async def test_get_todays_articles_last_24_hours(self, mock_db_session, mock_current_user, mock_rss_service):
        """Test getting articles from the last 24 hours in UTC."""
        with patch("app.routers.rss_articles.RssService") as mock_service_class:
            mock_service_class.return_value = mock_rss_service
            
            result = await get_todays_articles(
                db=mock_db_session,
                current_user=mock_current_user,
                page=1,
                size=25
            )
            
            # Verify the service was called 
            mock_rss_service.get_articles.assert_called_once()
            call_args = mock_rss_service.get_articles.call_args[1]
            
            # Verify that UTC dates were passed for last 24 hours
            assert "published_since" in call_args
            assert "published_until" in call_args
            assert call_args["sort_by"] == "published_at"
            assert call_args["sort_order"] == "desc"
            assert call_args["page"] == 1
            assert call_args["size"] == 25
            
            # Verify the dates span approximately 24 hours
            since_date = call_args["published_since"]
            until_date = call_args["published_until"]
            time_diff = until_date - since_date
            
            # Should be approximately 24 hours (within a few seconds for execution time)
            assert 23.99 <= time_diff.total_seconds() / 3600 <= 24.01

    @pytest.mark.asyncio
    async def test_get_todays_articles_pagination_params(self, mock_db_session, mock_current_user, mock_rss_service):
        """Test that pagination parameters are correctly passed through."""
        with patch("app.routers.rss_articles.RssService") as mock_service_class:
            mock_service_class.return_value = mock_rss_service
            
            await get_todays_articles(
                db=mock_db_session,
                current_user=mock_current_user,
                page=3,
                size=50
            )
            
            call_args = mock_rss_service.get_articles.call_args[1]
            
            assert call_args["page"] == 3
            assert call_args["size"] == 50

    @pytest.mark.asyncio
    async def test_get_todays_articles_service_instantiation(self, mock_db_session, mock_current_user, mock_rss_service):
        """Test that RssService is correctly instantiated with user_id."""
        with patch("app.routers.rss_articles.RssService") as mock_service_class:
            mock_service_class.return_value = mock_rss_service
            
            await get_todays_articles(
                db=mock_db_session,
                current_user=mock_current_user,
                page=1,
                size=25
            )
            
            # Verify RssService was instantiated with correct parameters
            mock_service_class.assert_called_once()
            call_args = mock_service_class.call_args
            
            assert call_args[1]["db"] == mock_db_session
            assert str(call_args[1]["user_id"]) == mock_current_user.sub

    @pytest.mark.asyncio
    async def test_get_todays_articles_default_pagination(self, mock_db_session, mock_current_user, mock_rss_service):
        """Test that default pagination values are used when not specified."""
        with patch("app.routers.rss_articles.RssService") as mock_service_class:
            mock_service_class.return_value = mock_rss_service
            
            await get_todays_articles(
                db=mock_db_session,
                current_user=mock_current_user
            )
            
            call_args = mock_rss_service.get_articles.call_args[1]
            
            # Should use default values (Query objects have default values)
            page_value = call_args["page"].default if hasattr(call_args["page"], 'default') else call_args["page"]
            size_value = call_args["size"].default if hasattr(call_args["size"], 'default') else call_args["size"]
            assert page_value == 1
            assert size_value == 25


class TestDateCalculations:
    """Test date calculation logic for last 24 hours."""

    def test_24_hour_time_range(self):
        """Test that the time range is exactly 24 hours."""
        now = datetime.utcnow()
        twenty_four_hours_ago = now - timedelta(hours=24)
        
        time_diff = now - twenty_four_hours_ago
        assert time_diff.total_seconds() == 24 * 60 * 60  # Exactly 24 hours in seconds

    def test_utc_datetime_creation(self):
        """Test that UTC datetime objects are created correctly."""
        now = datetime.utcnow()
        assert now.tzinfo is None  # datetime.utcnow() returns naive datetime
        
        # Test that we can create timezone-aware datetime if needed
        import zoneinfo
        now_tz_aware = now.replace(tzinfo=zoneinfo.ZoneInfo("UTC"))
        assert now_tz_aware.tzinfo is not None
        assert now_tz_aware.tzinfo.key == "UTC"