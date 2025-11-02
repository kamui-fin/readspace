"""E2E tests for user routes."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Profile


class TestUserProfile:
    """Test user profile endpoints."""

    @pytest.mark.asyncio
    async def test_get_current_user_profile_success(self, async_client: AsyncClient, test_user: Profile):
        """Test getting current user profile successfully."""
        response = await async_client.get("/api/users/profile")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_user.id)
        assert data["email"] == test_user.email
        # The database default role is "basic", not "user"
        assert data["role"] == "basic"
        assert "created_at" in data
        assert "updated_at" in data

    @pytest.mark.asyncio
    async def test_get_current_user_profile_unauthenticated(self):
        """Test getting profile without authentication."""
        from app.main import app
        from httpx import ASGITransport, AsyncClient

        # Create client without auth override
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/users/profile")
            assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_current_user_profile_not_found(self, db_session: AsyncSession):
        """Test getting profile when user doesn't exist in database."""
        from app.main import app
        from app.schemas.auth import TokenData
        from app.services.user.auth import get_current_user
        from httpx import ASGITransport, AsyncClient

        # Mock user that doesn't exist in DB
        async def mock_nonexistent_user():
            return TokenData(sub="00000000-0000-0000-0000-000000000000", email="nonexistent@example.com")

        async def override_get_db():
            yield db_session

        from app.db.session import get_db

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = mock_nonexistent_user

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/users/profile")
            assert response.status_code == 404
            assert "not found" in response.json()["detail"].lower()

        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_profile_response_schema(self, async_client: AsyncClient, test_user: Profile):
        """Test that profile response matches expected schema."""
        response = await async_client.get("/api/users/profile")

        assert response.status_code == 200
        data = response.json()

        # Verify all required fields are present
        required_fields = ["id", "email", "role", "created_at", "updated_at"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"

        # Verify field types
        assert isinstance(data["id"], str)
        assert isinstance(data["email"], str)
        assert isinstance(data["role"], str)
        assert isinstance(data["created_at"], str)
        assert isinstance(data["updated_at"], str)

    @pytest.mark.asyncio
    async def test_profile_reflects_database_state(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession
    ):
        """Test that profile endpoint returns current database state."""
        # Get profile via API
        response = await async_client.get("/api/users/profile")
        assert response.status_code == 200
        api_data = response.json()

        # Get profile from database
        result = await db_session.execute(select(Profile).where(Profile.id == test_user.id))
        db_user = result.scalar_one()

        # Verify they match
        assert api_data["id"] == str(db_user.id)
        assert api_data["email"] == db_user.email
        assert api_data["role"] == db_user.role
