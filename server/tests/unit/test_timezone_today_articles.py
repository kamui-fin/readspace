"""Unit tests for timezone-aware today's articles functionality."""

import pytest
from datetime import datetime, timezone as tz
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import HTTPException
import zoneinfo
from uuid import UUID

from app.routers.rss_articles import get_todays_articles
from app.schemas.auth import TokenData


class TestTimezoneArticles:
    """Test timezone-aware article filtering."""

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
    async def test_get_todays_articles_utc_timezone(self, mock_db_session, mock_current_user, mock_rss_service):
        """Test getting today's articles with UTC timezone."""
        with patch("app.routers.rss_articles.RssService") as mock_service_class:
            mock_service_class.return_value = mock_rss_service
            
            result = await get_todays_articles(
                db=mock_db_session,
                current_user=mock_current_user,
                user_timezone="UTC",
                page=1,
                size=25
            )
            
            # Verify the service was called 
            mock_rss_service.get_articles.assert_called_once()
            call_args = mock_rss_service.get_articles.call_args[1]
            
            # Verify that UTC dates were passed (we can't mock the exact time, but we can verify structure)
            assert "published_since" in call_args
            assert "published_until" in call_args
            assert call_args["published_since"].tzinfo.key == "UTC"
            assert call_args["published_until"].tzinfo.key == "UTC"
            assert call_args["sort_by"] == "published_at"
            assert call_args["sort_order"] == "desc"
            assert call_args["page"] == 1
            assert call_args["size"] == 25
            
            # Verify the dates are on the same day and properly bounded
            since_date = call_args["published_since"]
            until_date = call_args["published_until"]
            assert since_date.hour == 0 and since_date.minute == 0 and since_date.second == 0
            assert until_date.hour == 23 and until_date.minute == 59 and until_date.second == 59

    @pytest.mark.asyncio
    async def test_get_todays_articles_pst_timezone(self, mock_db_session, mock_current_user, mock_rss_service):
        """Test getting today's articles with PST timezone (UTC-8)."""
        with patch("app.routers.rss_articles.RssService") as mock_service_class:
            mock_service_class.return_value = mock_rss_service
            
            result = await get_todays_articles(
                db=mock_db_session,
                current_user=mock_current_user,
                user_timezone="America/Los_Angeles",
                page=1,
                size=25
            )
            
            # Verify the service was called
            mock_rss_service.get_articles.assert_called_once()
            call_args = mock_rss_service.get_articles.call_args[1]
            
            # Verify that UTC dates were passed after timezone conversion
            published_since = call_args["published_since"]
            published_until = call_args["published_until"]
            
            assert published_since.tzinfo.key == "UTC"
            assert published_until.tzinfo.key == "UTC"
            
            # Verify it's a full day range (24 hours)
            time_diff = published_until - published_since
            # Should be approximately 24 hours (give or take microseconds)
            assert 23.9 <= time_diff.total_seconds() / 3600 <= 24.0

    @pytest.mark.asyncio
    async def test_get_todays_articles_eastern_timezone(self, mock_db_session, mock_current_user, mock_rss_service):
        """Test getting today's articles with Eastern timezone (UTC-5)."""
        with patch("app.routers.rss_articles.RssService") as mock_service_class:
            mock_service_class.return_value = mock_rss_service
            
            result = await get_todays_articles(
                db=mock_db_session,
                current_user=mock_current_user,
                user_timezone="America/New_York",
                page=1,
                size=25
            )
            
            # Verify the service was called
            mock_rss_service.get_articles.assert_called_once()
            call_args = mock_rss_service.get_articles.call_args[1]
            
            published_since = call_args["published_since"]
            published_until = call_args["published_until"]
            
            # Verify that UTC dates were passed after timezone conversion
            assert published_since.tzinfo.key == "UTC"
            assert published_until.tzinfo.key == "UTC"
            
            # Verify it's a full day range (approximately 24 hours)
            time_diff = published_until - published_since
            assert 23.9 <= time_diff.total_seconds() / 3600 <= 24.0

    @pytest.mark.asyncio
    async def test_get_todays_articles_invalid_timezone(self, mock_db_session, mock_current_user):
        """Test that invalid timezone raises HTTPException."""
        with pytest.raises(HTTPException) as exc_info:
            await get_todays_articles(
                db=mock_db_session,
                current_user=mock_current_user,
                user_timezone="Invalid/Timezone",
                page=1,
                size=25
            )
        
        assert exc_info.value.status_code == 400
        assert "Invalid timezone" in str(exc_info.value.detail)
        assert "Invalid/Timezone" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_get_todays_articles_pagination_params(self, mock_db_session, mock_current_user, mock_rss_service):
        """Test that pagination parameters are correctly passed through."""
        with patch("app.routers.rss_articles.RssService") as mock_service_class:
            mock_service_class.return_value = mock_rss_service
            
            await get_todays_articles(
                db=mock_db_session,
                current_user=mock_current_user,
                user_timezone="UTC",
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
                user_timezone="UTC",
                page=1,
                size=25
            )
            
            # Verify RssService was instantiated with correct parameters
            mock_service_class.assert_called_once()
            call_args = mock_service_class.call_args
            
            assert call_args[1]["db"] == mock_db_session
            assert str(call_args[1]["user_id"]) == mock_current_user.sub


class TestTimezoneValidation:
    """Test timezone validation edge cases."""

    def test_valid_timezone_identifiers(self):
        """Test that common timezone identifiers are valid."""
        valid_timezones = [
            "UTC",
            "America/New_York",
            "America/Los_Angeles",
            "America/Chicago",
            "Europe/London",
            "Europe/Paris",
            "Asia/Tokyo",
            "Australia/Sydney",
            "America/Sao_Paulo"
        ]
        
        for tz_name in valid_timezones:
            try:
                tz = zoneinfo.ZoneInfo(tz_name)
                assert tz is not None
            except zoneinfo.ZoneInfoNotFoundError:
                pytest.fail(f"Valid timezone {tz_name} should not raise ZoneInfoNotFoundError")

    def test_invalid_timezone_identifiers(self):
        """Test that invalid timezone identifiers raise appropriate errors."""
        invalid_timezones = [
            "Invalid/Timezone",
            "NotATimezone", 
            "America/InvalidCity",
            "UTC+5",  # Should use proper IANA format
            "America/New York",  # Spaces not allowed
        ]
        
        for tz_name in invalid_timezones:
            with pytest.raises(zoneinfo.ZoneInfoNotFoundError):
                zoneinfo.ZoneInfo(tz_name)
                
        # Empty string raises ValueError, whitespace raises ZoneInfoNotFoundError
        with pytest.raises(ValueError):
            zoneinfo.ZoneInfo("")
        
        with pytest.raises(zoneinfo.ZoneInfoNotFoundError):
            zoneinfo.ZoneInfo("  ")


class TestDateCalculations:
    """Test date calculation logic in isolation."""

    def test_start_end_of_day_calculation(self):
        """Test start and end of day calculations for different timezones."""
        # Test UTC
        utc_time = datetime(2023, 12, 15, 14, 30, 45, 123456, tzinfo=zoneinfo.ZoneInfo("UTC"))
        start_utc = utc_time.replace(hour=0, minute=0, second=0, microsecond=0)
        end_utc = utc_time.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        assert start_utc == datetime(2023, 12, 15, 0, 0, 0, 0, tzinfo=zoneinfo.ZoneInfo("UTC"))
        assert end_utc == datetime(2023, 12, 15, 23, 59, 59, 999999, tzinfo=zoneinfo.ZoneInfo("UTC"))

    def test_timezone_conversion_maintains_date(self):
        """Test that timezone conversion preserves the local date."""
        # Create a time in PST
        pst_time = datetime(2023, 12, 15, 2, 0, 0, tzinfo=zoneinfo.ZoneInfo("America/Los_Angeles"))
        
        # Start and end of day in PST
        start_pst = pst_time.replace(hour=0, minute=0, second=0, microsecond=0)
        end_pst = pst_time.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Convert to UTC
        utc_tz = zoneinfo.ZoneInfo("UTC")
        start_utc = start_pst.astimezone(utc_tz)
        end_utc = end_pst.astimezone(utc_tz)
        
        # Verify that we still get December 15th in PST, even though UTC times will be different
        assert start_pst.date() == datetime(2023, 12, 15).date()
        assert end_pst.date() == datetime(2023, 12, 15).date()
        
        # UTC times should be offset by PST offset (8 hours during standard time)
        # This will vary based on daylight savings, but the structure should be preserved
        assert start_utc.tzinfo.key == "UTC"
        assert end_utc.tzinfo.key == "UTC"