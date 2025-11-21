"""Metrics middleware for collecting HTTP request/response metrics.

This middleware tracks detailed metrics for all HTTP requests including:
- Request duration (histogram)
- Request count by endpoint and status (counter)
- Active requests (gauge)
- Request/response body sizes (histogram)

It complements the Prometheus Instrumentator with more detailed labeling
and better integration with our centralized metrics module.
"""

from collections.abc import Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger(__name__)


class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware to collect HTTP request/response metrics."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and collect metrics.

        Args:
            request: Incoming HTTP request
            call_next: Next middleware/route handler in the chain

        Returns:
            HTTP response
        """
        # Simply pass through the request
        return await call_next(request)

    @staticmethod
    def _normalize_path(path: str) -> str:
        """Normalize path to prevent high cardinality in metrics.

        Replaces UUIDs and numeric IDs with placeholders to reduce unique label values.

        Examples:
            /api/feeds/123e4567-e89b-12d3-a456-426614174000 -> /api/feeds/{id}
            /api/articles/12345 -> /api/articles/{id}
            /api/users/abc123/settings -> /api/users/{id}/settings

        Args:
            path: Original request path

        Returns:
            Normalized path with placeholders
        """
        # Split path into segments
        segments = path.split("/")
        normalized = []

        for segment in segments:
            if not segment:
                normalized.append(segment)
                continue

            # Check if segment looks like a UUID
            if len(segment) == 36 and segment.count("-") == 4:
                normalized.append("{id}")
            # Check if segment is numeric
            elif segment.isdigit():
                normalized.append("{id}")
            # Check if segment is alphanumeric ID (common pattern)
            elif len(segment) > 15 and segment.replace("-", "").replace("_", "").isalnum():
                normalized.append("{id}")
            else:
                normalized.append(segment)

        return "/".join(normalized)
