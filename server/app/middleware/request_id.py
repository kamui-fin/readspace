"""Middleware to ensure request_id is always set on request state."""

import uuid

import structlog
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

logger = structlog.get_logger(__name__)


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Middleware to ensure every request has a unique request_id in its state."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """
        Process request and ensure request_id is set in state.

        This middleware guarantees that request.state.request_id is always
        available for logging and tracing purposes.

        Args:
            request: The incoming FastAPI request
            call_next: The next middleware or endpoint to call

        Returns:
            Response: The response from the next middleware/endpoint
        """
        # Set request_id in state if not already present
        if not hasattr(request.state, "request_id"):
            request.state.request_id = str(uuid.uuid4())

        # Add request_id to response headers for debugging
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id

        return response
