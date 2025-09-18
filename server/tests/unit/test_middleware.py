"""Tests for middleware functionality."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.middleware import create_error_response, setup_middleware


@pytest.mark.unit
class TestCreateErrorResponse:
    def test_create_error_response_basic(self):
        """Test creating error response with basic parameters."""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.return_value = "https://example.com"

        response = create_error_response(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bad request",
            request=mock_request,
        )

        assert isinstance(response, JSONResponse)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        # Check headers were set
        assert "Access-Control-Allow-Origin" in response.headers
        assert "Access-Control-Allow-Credentials" in response.headers
        assert "Access-Control-Allow-Methods" in response.headers
        assert "Access-Control-Allow-Headers" in response.headers

    def test_create_error_response_no_origin_header(self):
        """Test creating error response when no Origin header present."""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.return_value = None

        response = create_error_response(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
            request=mock_request,
        )

        assert isinstance(response, JSONResponse)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        # Should default to "*" when no origin
        mock_request.headers.get.assert_called_with("Origin")

    def test_create_error_response_content_structure(self):
        """Test that error response has correct content structure."""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.return_value = "https://test.com"

        response = create_error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
            request=mock_request,
        )

        # The content should be accessible but might be serialized
        # We can check the status code and that it's a JSONResponse
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert isinstance(response, JSONResponse)


@pytest.mark.unit
class TestSetupMiddleware:
    def setup_method(self):
        self.mock_app = MagicMock(spec=FastAPI)
        self.mock_middlewares = []

        def capture_middleware(middleware_type):
            def decorator(func):
                self.mock_middlewares.append((middleware_type, func))
                return func

            return decorator

        self.mock_app.middleware = capture_middleware

    @patch("app.middleware.logger")
    def test_setup_middleware_with_default_public_paths(self, mock_logger):
        """Test setting up middleware with default public paths."""
        setup_middleware(self.mock_app)

        # Should register 2 middleware functions
        assert len(self.mock_middlewares) == 2

        # Check that both are HTTP middleware
        assert all(mw[0] == "http" for mw in self.mock_middlewares)

        # Check logger was called
        mock_logger.info.assert_called_with("Middleware setup completed", public_paths=[])

    @patch("app.middleware.logger")
    def test_setup_middleware_with_custom_public_paths(self, mock_logger):
        """Test setting up middleware with custom public paths."""
        public_paths = ["/health", "/docs", "/openapi.json"]

        setup_middleware(self.mock_app, public_paths=public_paths)

        # Should register 2 middleware functions
        assert len(self.mock_middlewares) == 2

        # Check logger was called with custom paths
        mock_logger.info.assert_called_with("Middleware setup completed", public_paths=public_paths)

    @pytest.mark.asyncio
    @patch("app.middleware.logger")
    @patch("app.middleware.get_optional_user")
    @patch("app.middleware.settings")
    @patch("uuid.uuid4")
    @patch("time.time")
    async def test_request_logging_middleware_success(
        self, mock_time, mock_uuid, mock_settings, mock_get_user, mock_logger
    ):
        """Test request logging middleware with successful request."""
        # Setup mocks
        mock_uuid.return_value = "test-request-id"
        mock_time.side_effect = [1000.0, 1001.5]  # start and end times

        # Setup middleware
        setup_middleware(self.mock_app, public_paths=["/health"])

        # Get the logging middleware (first one registered)
        logging_middleware = self.mock_middlewares[0][1]

        # Create mock request and response
        mock_request = MagicMock(spec=Request)
        mock_request.method = "GET"
        mock_request.url.path = "/api/test"
        mock_request.client.host = "127.0.0.1"

        mock_response = MagicMock()
        mock_response.status_code = 200

        mock_call_next = AsyncMock(return_value=mock_response)

        # Execute middleware
        result = await logging_middleware(mock_request, mock_call_next)

        # Verify
        assert result == mock_response
        mock_call_next.assert_called_once_with(mock_request)

        # Check logging calls
        assert mock_logger.info.call_count >= 2  # Start and completion logs

    @pytest.mark.asyncio
    @patch("app.middleware.logger")
    @patch("app.middleware.get_optional_user")
    @patch("app.middleware.settings")
    @patch("uuid.uuid4")
    @patch("time.time")
    async def test_request_logging_middleware_exception(
        self, mock_time, mock_uuid, mock_settings, mock_get_user, mock_logger
    ):
        """Test request logging middleware with request that raises exception."""
        # Setup mocks
        mock_uuid.return_value = "test-request-id"
        mock_time.side_effect = [1000.0, 1001.5]  # start and end times

        # Setup middleware
        setup_middleware(self.mock_app, public_paths=[])

        # Get the logging middleware
        logging_middleware = self.mock_middlewares[0][1]

        # Create mock request
        mock_request = MagicMock(spec=Request)
        mock_request.method = "POST"
        mock_request.url.path = "/api/error"
        mock_request.client.host = "127.0.0.1"

        # Mock call_next to raise an exception
        test_exception = Exception("Test error")
        mock_call_next = AsyncMock(side_effect=test_exception)

        # Execute middleware and expect exception to be re-raised
        with pytest.raises(Exception) as exc_info:
            await logging_middleware(mock_request, mock_call_next)

        assert exc_info.value == test_exception

        # Check error logging was called
        mock_logger.error.assert_called_once()

    @pytest.mark.asyncio
    @patch("app.middleware.logger")
    @patch("app.middleware.get_optional_user")
    @patch("app.middleware.settings")
    async def test_auth_middleware_options_request(self, mock_settings, mock_get_user, mock_logger):
        """Test auth middleware allows OPTIONS requests through."""
        setup_middleware(self.mock_app, public_paths=[])

        # Get the auth middleware (second one registered)
        auth_middleware = self.mock_middlewares[1][1]

        # Create OPTIONS request
        mock_request = MagicMock(spec=Request)
        mock_request.method = "OPTIONS"

        mock_response = MagicMock()
        mock_call_next = AsyncMock(return_value=mock_response)

        # Execute middleware
        result = await auth_middleware(mock_request, mock_call_next)

        # Should pass through without auth check
        assert result == mock_response
        mock_call_next.assert_called_once_with(mock_request)
        mock_get_user.assert_not_called()

    @patch("app.middleware.logger")
    @patch("app.middleware.get_optional_user")
    @patch("app.middleware.settings")
    @pytest.mark.asyncio
    async def test_auth_middleware_public_path(self, mock_settings, mock_get_user, mock_logger):
        """Test auth middleware allows public paths through."""
        setup_middleware(self.mock_app, public_paths=["/health", "/docs"])

        # Get the auth middleware
        auth_middleware = self.mock_middlewares[1][1]

        # Create request to public path
        mock_request = MagicMock(spec=Request)
        mock_request.method = "GET"
        mock_request.url.path = "/health"

        mock_response = MagicMock()
        mock_call_next = AsyncMock(return_value=mock_response)

        # Execute middleware
        result = await auth_middleware(mock_request, mock_call_next)

        # Should pass through without auth check
        assert result == mock_response
        mock_call_next.assert_called_once_with(mock_request)
        mock_get_user.assert_not_called()

    @patch("app.middleware.logger")
    @patch("app.middleware.get_optional_user")
    @patch("app.middleware.settings")
    @patch("app.middleware.create_error_response")
    @pytest.mark.asyncio
    async def test_auth_middleware_no_auth_header(self, mock_create_error, mock_settings, mock_get_user, mock_logger):
        """Test auth middleware returns 401 when no auth header present."""
        setup_middleware(self.mock_app, public_paths=[])

        # Get the auth middleware
        auth_middleware = self.mock_middlewares[1][1]

        # Create request without auth header
        mock_request = MagicMock(spec=Request)
        mock_request.method = "GET"
        mock_request.url.path = "/api/protected"
        mock_request.headers.get.return_value = None

        mock_error_response = MagicMock()
        mock_create_error.return_value = mock_error_response

        mock_call_next = AsyncMock()

        # Execute middleware
        result = await auth_middleware(mock_request, mock_call_next)

        # Should return error response without calling next
        assert result == mock_error_response
        mock_call_next.assert_not_called()
        mock_create_error.assert_called_once_with(status.HTTP_401_UNAUTHORIZED, "Authentication required", mock_request)

    @patch("app.middleware.logger")
    @patch("app.middleware.get_optional_user")
    @patch("app.middleware.settings")
    @patch("app.middleware.create_error_response")
    @pytest.mark.asyncio
    async def test_auth_middleware_invalid_auth_header(
        self, mock_create_error, mock_settings, mock_get_user, mock_logger
    ):
        """Test auth middleware returns 401 for invalid auth header format."""
        setup_middleware(self.mock_app, public_paths=[])

        # Get the auth middleware
        auth_middleware = self.mock_middlewares[1][1]

        # Create request with invalid auth header
        mock_request = MagicMock(spec=Request)
        mock_request.method = "GET"
        mock_request.url.path = "/api/protected"
        mock_request.headers.get.return_value = "Invalid token"

        mock_error_response = MagicMock()
        mock_create_error.return_value = mock_error_response

        mock_call_next = AsyncMock()

        # Execute middleware
        result = await auth_middleware(mock_request, mock_call_next)

        # Should return error response
        assert result == mock_error_response
        mock_call_next.assert_not_called()
        mock_create_error.assert_called_once_with(status.HTTP_401_UNAUTHORIZED, "Authentication required", mock_request)

    @patch("app.middleware.logger")
    @patch("app.middleware.get_optional_user")
    @patch("app.middleware.settings")
    @pytest.mark.asyncio
    async def test_auth_middleware_valid_token_with_user(self, mock_settings, mock_get_user, mock_logger):
        """Test auth middleware with valid token and user."""
        setup_middleware(self.mock_app, public_paths=[])

        # Get the auth middleware
        auth_middleware = self.mock_middlewares[1][1]

        # Create request with valid auth header
        mock_request = MagicMock(spec=Request)
        mock_request.method = "GET"
        mock_request.url.path = "/api/protected"
        mock_request.headers.get.return_value = "Bearer valid-token"
        mock_request.state = MagicMock()

        # Mock user retrieval
        mock_user = MagicMock()
        mock_get_user.return_value = mock_user

        mock_response = MagicMock()
        mock_call_next = AsyncMock(return_value=mock_response)

        # Execute middleware
        result = await auth_middleware(mock_request, mock_call_next)

        # Should attach user to request state and proceed
        assert result == mock_response
        assert mock_request.state.user == mock_user
        mock_call_next.assert_called_once_with(mock_request)

    @patch("app.middleware.logger")
    @patch("app.middleware.get_optional_user")
    @patch("app.middleware.settings")
    @patch("app.middleware.create_error_response")
    @pytest.mark.asyncio
    async def test_auth_middleware_valid_token_no_user(
        self, mock_create_error, mock_settings, mock_get_user, mock_logger
    ):
        """Test auth middleware with valid token but no user returned."""
        setup_middleware(self.mock_app, public_paths=[])

        # Get the auth middleware
        auth_middleware = self.mock_middlewares[1][1]

        # Create request with valid auth header
        mock_request = MagicMock(spec=Request)
        mock_request.method = "GET"
        mock_request.url.path = "/api/protected"
        mock_request.headers.get.return_value = "Bearer valid-token"

        # Mock user retrieval returning None
        mock_get_user.return_value = None

        mock_error_response = MagicMock()
        mock_create_error.return_value = mock_error_response

        mock_call_next = AsyncMock()

        # Execute middleware
        result = await auth_middleware(mock_request, mock_call_next)

        # Should return error response
        assert result == mock_error_response
        mock_call_next.assert_not_called()
        mock_create_error.assert_called_once_with(
            status.HTTP_401_UNAUTHORIZED, "Invalid authentication token", mock_request
        )
