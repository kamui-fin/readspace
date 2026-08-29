"""E2E/Integration tests for client config endpoint."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.core.config import get_settings


class TestConfigEndpoint:
    """Test client config configuration endpoint."""

    @pytest.mark.asyncio
    async def test_get_config_success(self, async_client: AsyncClient):
        """Test successfully retrieving client configuration with a mocked Meilisearch search key."""
        settings = get_settings()

        # Override key values in settings for verification
        settings.SUPABASE_ANON_KEY = "test-anon-key-12345"

        # Mock keys returned from Meilisearch client
        mock_key_1 = MagicMock()
        mock_key_1.name = "Default Search API Key"
        mock_key_1.key = "meilisearch-search-key-abcde"

        mock_keys = MagicMock()
        mock_keys.results = [mock_key_1]

        mock_client_instance = AsyncMock()
        mock_client_instance.get_keys.return_value = mock_keys
        mock_client_instance.aclose = AsyncMock()

        with patch("meilisearch_python_sdk.AsyncClient", return_value=mock_client_instance):
            response = await async_client.get("/api/config")

            assert response.status_code == 200
            data = response.json()

            assert data["supabase_url"] == str(settings.SUPABASE_URL)
            assert data["supabase_anon_key"] == "test-anon-key-12345"
            assert data["meilisearch_url"] == settings.MEILISEARCH_URL
            assert data["meilisearch_search_key"] == "meilisearch-search-key-abcde"

            mock_client_instance.get_keys.assert_called_once()
            mock_client_instance.aclose.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_config_meilisearch_error_fallback(self, async_client: AsyncClient):
        """Test retrieving client configuration when Meilisearch fetch fails."""
        settings = get_settings()
        settings.SUPABASE_ANON_KEY = "test-anon-key-fallback"

        # Mocking AsyncClient to raise an exception on initialization or call
        with patch("meilisearch_python_sdk.AsyncClient", side_effect=Exception("Connection refused")):
            response = await async_client.get("/api/config")

            assert response.status_code == 200
            data = response.json()

            assert data["supabase_url"] == str(settings.SUPABASE_URL)
            assert data["supabase_anon_key"] == "test-anon-key-fallback"
            assert data["meilisearch_url"] == settings.MEILISEARCH_URL
            assert data["meilisearch_search_key"] == ""  # Fallback value when Meilisearch is down
