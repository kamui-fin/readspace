"""Metrics middleware for collecting HTTP request/response metrics.

This middleware tracks detailed metrics for all HTTP requests including:
- Request duration (histogram)
- Request count by endpoint and status (counter)
- Active requests (gauge)
- Request/response body sizes (histogram)

It complements the Prometheus Instrumentator with more detailed labeling
and better integration with our centralized metrics module.
"""

import time
from collections.abc import Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.metrics import (
    http_request_duration_seconds,
    http_request_size_bytes,
    http_requests_in_progress,
    http_requests_total,
    http_response_size_bytes,
)

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
        # Extract method and path for labeling
        method = request.method
        path = request.url.path

        # Normalize path to remove IDs and query params
        # This prevents high cardinality in metrics
        endpoint = self._normalize_path(path)

        # Track active requests
        http_requests_in_progress.labels(method=method, endpoint=endpoint).inc()

        # Track request size if available
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                http_request_size_bytes.labels(method=method, endpoint=endpoint).observe(int(content_length))
            except (ValueError, TypeError):
                pass

        # Start timing
        start_time = time.perf_counter()
        status = "500"  # Default to error if something goes wrong

        try:
            # Process request
            response = await call_next(request)
            status = str(response.status_code)

            # Track response size if available
            response_length = response.headers.get("content-length")
            if response_length:
                try:
                    http_response_size_bytes.labels(method=method, endpoint=endpoint).observe(int(response_length))
                except (ValueError, TypeError):
                    pass

            return response

        except Exception:
            # Let the exception propagate but still record metrics
            raise

        finally:
            # Record duration
            duration = time.perf_counter() - start_time
            http_request_duration_seconds.labels(method=method, endpoint=endpoint).observe(duration)

            # Increment request counter
            http_requests_total.labels(method=method, endpoint=endpoint, status=status).inc()

            # Decrement active requests
            http_requests_in_progress.labels(method=method, endpoint=endpoint).dec()

            # Log slow requests (>5 seconds)
            if duration > 5.0:
                logger.warning(
                    "Slow HTTP request detected",
                    method=method,
                    endpoint=endpoint,
                    status=status,
                    duration_seconds=round(duration, 3),
                    request_id=getattr(request.state, "request_id", None),
                )

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
