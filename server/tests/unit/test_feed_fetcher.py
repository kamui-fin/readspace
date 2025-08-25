"""Unit tests for FeedFetcher service."""

import pytest
from unittest.mock import AsyncMock, Mock, patch
import httpx

from app.services.feed_fetcher import FeedFetcher
from app.core.redis_cache import RedisCache


@pytest.mark.unit
class TestFeedFetcher:
    """Test FeedFetcher functionality."""
    
    def setup_method(self):
        self.redis_cache = Mock(spec=RedisCache)
        self.redis_cache.get = AsyncMock()
        self.redis_cache.set = AsyncMock()
        self.redis_cache.delete = AsyncMock()
        self.fetcher = FeedFetcher(self.redis_cache)
    
    @pytest.mark.asyncio
    async def test_fetch_content_success(self):
        """Test successful feed fetching."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = "<rss>test content</rss>"
        mock_response.headers = {"content-type": "application/rss+xml"}
        
        self.redis_cache.get.return_value = None  # No cached data
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
            
            result = await self.fetcher.fetch_content("http://example.com/feed.xml")
        
        assert result["status_code"] == 200
        assert result["content"] == "<rss>test content</rss>"
        assert "content-type" in result["headers"]
        assert not result.get("error")
        
        # Verify caching was called
        self.redis_cache.set.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_fetch_content_not_modified(self):
        """Test 304 Not Modified response."""
        mock_response = Mock()
        mock_response.status_code = 304
        mock_response.headers = {"etag": "test-etag"}
        
        cached_data = {
            "content": "<rss>cached content</rss>",
            "headers": {"etag": "test-etag"}
        }
        self.redis_cache.get.return_value = cached_data
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
            
            result = await self.fetcher.fetch_content(
                "http://example.com/feed.xml", 
                etag="test-etag"
            )
        
        assert result["status_code"] == 304
        assert result["not_modified"] == True
        assert result["content"] == "<rss>cached content</rss>"
    
    @pytest.mark.asyncio
    async def test_fetch_content_timeout(self):
        """Test timeout handling."""
        self.redis_cache.get.return_value = None
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get.side_effect = httpx.ConnectTimeout("Timeout")
            
            result = await self.fetcher.fetch_content("http://example.com/feed.xml")
        
        assert result["error"] == "timeout"
        assert result["status_code"] == 408
        assert result["content"] == ""
    
    @pytest.mark.asyncio
    async def test_fetch_content_http_error(self):
        """Test HTTP error handling."""
        mock_response = Mock()
        mock_response.status_code = 404
        
        self.redis_cache.get.return_value = None
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get.side_effect = \
                httpx.HTTPStatusError("Not found", request=Mock(), response=mock_response)
            
            result = await self.fetcher.fetch_content("http://example.com/feed.xml")
        
        assert result["error"] == "http_404"
        assert result["status_code"] == 404
        assert result["content"] == ""
    
    @pytest.mark.asyncio
    async def test_build_request_headers(self):
        """Test request header building."""
        headers = self.fetcher._build_request_headers("test-etag", "test-modified", None)
        
        assert headers["User-Agent"] == "Mozilla/5.0 (compatible; Readspace/1.0; +https://readspace.app/bot)"
        assert headers["If-None-Match"] == "test-etag"
        assert headers["If-Modified-Since"] == "test-modified"
    
    @pytest.mark.asyncio
    async def test_build_request_headers_with_cache(self):
        """Test request header building with cached data."""
        cached_data = {
            "headers": {
                "ETag": "cached-etag",
                "Last-Modified": "cached-modified"
            }
        }
        
        headers = self.fetcher._build_request_headers(None, None, cached_data)
        
        assert headers["If-None-Match"] == "cached-etag"
        assert headers["If-Modified-Since"] == "cached-modified"