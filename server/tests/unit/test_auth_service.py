"""Unit tests for authentication service."""

from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException, Request, status
from jose import JWTError

from app.schemas.auth import TokenData
from app.services.auth import (
    get_current_user,
    get_optional_user,
    requires_auth,
    verify_token,
)


@pytest.mark.unit
class TestAuthService:
    """Test cases for authentication service."""

    def test_verify_token_success(self):
        """Test successful token verification."""
        mock_payload = {
            "sub": "user123",
            "email": "test@example.com",
            "role": "authenticated",
            "app_metadata": {"provider": "email"},
            "user_metadata": {"name": "Test User"},
        }

        with (
            patch("app.services.auth.get_settings") as mock_settings,
            patch("app.services.auth.jwt.decode") as mock_decode,
        ):
            mock_config = Mock()
            mock_config.SUPABASE_JWT_SECRET.get_secret_value.return_value = "secret"
            mock_settings.return_value = mock_config
            mock_decode.return_value = mock_payload

            result = verify_token("valid_token")

            assert isinstance(result, TokenData)
            assert result.sub == "user123"
            assert result.email == "test@example.com"
            assert result.role == "authenticated"

            mock_decode.assert_called_once_with(
                "valid_token",
                key="secret",
                algorithms=["HS256"],
                options={"verify_aud": False},
            )

    def test_verify_token_jwt_error(self):
        """Test token verification with JWT error."""
        with (
            patch("app.services.auth.get_settings") as mock_settings,
            patch("app.services.auth.jwt.decode") as mock_decode,
        ):
            mock_config = Mock()
            mock_config.SUPABASE_JWT_SECRET.get_secret_value.return_value = "secret"
            mock_settings.return_value = mock_config
            mock_decode.side_effect = JWTError("Invalid token")

            with pytest.raises(HTTPException) as exc_info:
                verify_token("invalid_token")

            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert exc_info.value.detail == "Invalid token"

    def test_get_current_user_success(self):
        """Test successful user extraction from request."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {"Authorization": "Bearer valid_token"}

        with patch("app.services.auth.verify_token") as mock_verify:
            expected_token_data = TokenData(
                sub="user123", email="test@example.com", role="authenticated"
            )
            mock_verify.return_value = expected_token_data

            result = get_current_user(mock_request)

            assert result == expected_token_data
            mock_verify.assert_called_once_with("valid_token")

    def test_get_current_user_missing_header(self):
        """Test user extraction with missing authorization header."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {}

        with pytest.raises(HTTPException) as exc_info:
            get_current_user(mock_request)

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Missing or invalid authorization header" in exc_info.value.detail

    def test_get_current_user_invalid_header_format(self):
        """Test user extraction with invalid header format."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {"Authorization": "Invalid token_here"}

        with pytest.raises(HTTPException) as exc_info:
            get_current_user(mock_request)

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Missing or invalid authorization header" in exc_info.value.detail

    def test_get_current_user_verify_token_fails(self):
        """Test user extraction when token verification fails."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {"Authorization": "Bearer invalid_token"}

        with patch("app.services.auth.verify_token") as mock_verify:
            mock_verify.side_effect = HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
            )

            with pytest.raises(HTTPException) as exc_info:
                get_current_user(mock_request)

            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert exc_info.value.detail == "Invalid token"

    def test_get_optional_user_success(self):
        """Test successful optional user extraction."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {"Authorization": "Bearer valid_token"}

        with patch("app.services.auth.verify_token") as mock_verify:
            expected_token_data = TokenData(
                sub="user123", email="test@example.com", role="authenticated"
            )
            mock_verify.return_value = expected_token_data

            result = get_optional_user(mock_request)

            assert result == expected_token_data
            mock_verify.assert_called_once_with("valid_token")

    def test_get_optional_user_missing_header(self):
        """Test optional user extraction with missing header returns None."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {}

        result = get_optional_user(mock_request)

        assert result is None

    def test_get_optional_user_invalid_header_format(self):
        """Test optional user extraction with invalid header format returns None."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {"Authorization": "Invalid token_here"}

        result = get_optional_user(mock_request)

        assert result is None

    def test_get_optional_user_verification_fails(self):
        """Test optional user extraction when verification fails returns None."""
        mock_request = Mock(spec=Request)
        mock_request.headers = {"Authorization": "Bearer invalid_token"}

        with patch("app.services.auth.verify_token") as mock_verify:
            mock_verify.side_effect = HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
            )

            result = get_optional_user(mock_request)

            assert result is None

    @pytest.mark.asyncio
    async def test_requires_auth_decorator_success(self):
        """Test requires_auth decorator with authenticated user."""

        @requires_auth
        async def test_route(request: Request):
            return {"message": "success"}

        mock_request = Mock(spec=Request)
        mock_request.state = Mock()
        mock_request.state.user = TokenData(
            sub="user123", email="test@example.com", role="authenticated"
        )

        result = await test_route(mock_request)

        assert result == {"message": "success"}

    @pytest.mark.asyncio
    async def test_requires_auth_decorator_no_user(self):
        """Test requires_auth decorator without user raises error."""

        @requires_auth
        async def test_route(request: Request):
            return {"message": "success"}

        mock_request = Mock(spec=Request)
        mock_request.state = Mock()
        mock_request.state.user = None

        with pytest.raises(HTTPException) as exc_info:
            await test_route(mock_request)

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert exc_info.value.detail == "Authentication required"

    @pytest.mark.asyncio
    async def test_requires_auth_decorator_no_state_user(self):
        """Test requires_auth decorator without user attribute raises error."""

        @requires_auth
        async def test_route(request: Request):
            return {"message": "success"}

        mock_request = Mock(spec=Request)
        mock_request.state = Mock()
        # Remove user attribute to simulate missing user
        delattr(mock_request.state, "user") if hasattr(
            mock_request.state, "user"
        ) else None

        with pytest.raises(HTTPException) as exc_info:
            await test_route(mock_request)

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert exc_info.value.detail == "Authentication required"
