"""Middleware for HTTP caching with ETag and Cache-Control headers."""

import hashlib

import structlog
from fastapi import Request
from starlette.datastructures import MutableHeaders
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response
from starlette.types import ASGIApp

from app.core.constants import CACHE_CONTROL_ARTICLE_LISTS, CACHE_CONTROL_NO_CACHE, CACHE_CONTROL_STATIC_FEEDS

logger = structlog.get_logger(__name__)


class HTTPCachingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add HTTP caching headers (ETag, Cache-Control, Last-Modified).

    Caching Strategy:
    1. Feed metadata (GET /api/feeds/*): Public cache for 1 hour
    2. Article lists (GET /api/articles): Private cache for 5 minutes with ETag
    3. Mutations (POST, PUT, DELETE): No caching
    4. Other dynamic content: No cache headers

    ETags enable conditional requests (304 Not Modified) to save bandwidth.
    """

    def __init__(self, app: ASGIApp) -> None:
        """
        Initialize the HTTP caching middleware.

        Args:
            app: The ASGI application to wrap
        """
        super().__init__(app)
        self.app = app

    def _generate_etag(self, content: bytes) -> str:
        """
        Generate an ETag from response content using MD5 hash.

        Args:
            content: The response body bytes

        Returns:
            str: The ETag value (quoted hex string)
        """
        # Use MD5 for fast hashing (not for security, just for change detection)
        hash_value = hashlib.md5(content).hexdigest()  # noqa: S324
        return f'"{hash_value}"'

    def _should_cache_endpoint(self, path: str, method: str) -> tuple[bool, str | None]:
        """
        Determine if an endpoint should have cache headers and which type.

        Args:
            path: The request path
            method: The HTTP method

        Returns:
            tuple: (should_cache, cache_control_value)
        """
        # Only cache GET requests
        if method != "GET":
            return False, None

        # Feed endpoints - static metadata
        if "/api/feeds" in path and "/refresh" not in path:
            # Feed list and individual feed details
            if path == "/api/feeds" or (path.startswith("/api/feeds/") and "/admin" not in path):
                return True, CACHE_CONTROL_STATIC_FEEDS

        # Article list endpoints - frequently updated
        if "/api/articles" in path:
            # Article lists should have shorter cache and ETags
            if path in [
                "/api/articles",
                "/api/articles/today",
                "/api/articles/read-later",
                "/api/articles/recently-read",
            ]:
                return True, CACHE_CONTROL_ARTICLE_LISTS

        # Discovery endpoints - can be cached
        if "/api/discover" in path:
            return True, CACHE_CONTROL_STATIC_FEEDS

        # Default: no caching
        return False, None

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """
        Process request and add caching headers to response.

        Args:
            request: The incoming FastAPI request
            call_next: The next middleware or endpoint to call

        Returns:
            Response: The response with caching headers added
        """
        path = request.url.path
        method = request.method

        # Check if we should add cache headers
        should_cache, cache_control = self._should_cache_endpoint(path, method)

        # Get the original response
        response = await call_next(request)

        # Only process successful responses
        if response.status_code not in (200, 304):
            return response

        # Get response body for ETag generation
        response_body = b""
        async for chunk in response.body_iterator:
            response_body += chunk

        # Create mutable headers
        headers = MutableHeaders(response.headers)

        if should_cache and cache_control:
            # Add Cache-Control header
            headers["cache-control"] = cache_control

            # Generate ETag for cacheable content
            etag = self._generate_etag(response_body)
            headers["etag"] = etag

            # Check If-None-Match header for conditional requests
            if_none_match = request.headers.get("if-none-match")
            if if_none_match and if_none_match == etag:
                # Content hasn't changed, return 304 Not Modified
                logger.debug("Returning 304 Not Modified", path=path, etag=etag)
                return Response(status_code=304, headers=dict(headers))

            # Add Vary header to indicate caching varies by headers
            headers.append("vary", "Accept-Encoding")

            logger.debug("Cache headers added", path=path, cache_control=cache_control, etag=etag)
        else:
            # For non-cacheable endpoints, add no-cache header
            if method in ["POST", "PUT", "DELETE", "PATCH"]:
                headers["cache-control"] = CACHE_CONTROL_NO_CACHE

        # Return response with caching headers
        return Response(
            content=response_body,
            status_code=response.status_code,
            headers=dict(headers),
            media_type=response.media_type,
        )
