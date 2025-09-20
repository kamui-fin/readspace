"""Unit tests for dependencies."""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.core.dependencies import get_db, get_request_id


@pytest.mark.unit
class TestDependencies:
    """Test cases for dependency functions."""

    @pytest.mark.asyncio
    async def test_get_db(self):
        """Test the get_db dependency."""
        db_gen = get_db()
        db = await db_gen.__anext__()
        assert db is not None
        with pytest.raises(StopAsyncIteration):
            await db_gen.__anext__()

    @pytest.mark.asyncio
    async def test_get_request_id(self):
        """Test the get_request_id dependency."""
        mock_request = MagicMock()
        # Configure the mock to return a string when request_id is accessed
        mock_request.state.request_id = str(uuid4())
        request_id = await get_request_id(mock_request)
        assert isinstance(request_id, str)
        # Check that the same request_id is returned on subsequent calls
        assert await get_request_id(mock_request) == request_id
