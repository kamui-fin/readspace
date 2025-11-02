"""Middleware package for FastAPI application.

This package contains custom middleware components for request processing.
Note: The UserProfileMiddleware is available but not currently enabled in main.py
to avoid performance overhead. Consider using a dependency injection approach instead.
"""

from app.middleware.compression import CompressionMiddleware
from app.middleware.http_caching import HTTPCachingMiddleware
from app.middleware.request_id import RequestIdMiddleware

# UserProfileMiddleware is not imported here to avoid circular imports
# Import it directly if needed: from app.middleware.user_profile import UserProfileMiddleware

__all__ = ["RequestIdMiddleware", "CompressionMiddleware", "HTTPCachingMiddleware"]
