"""Logging middleware for FastAPI application."""

import time
import uuid

import structlog
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

logger = structlog.get_logger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all incoming requests and their processing time.

    This middleware logs:
    - Request start with method, path, and client information
    - Request completion with status code and processing time
    - Request failures with error details
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Log all incoming requests and their processing time.

        Args:
            request: The incoming FastAPI request
            call_next: The next middleware or endpoint to call

        Returns:
            Response: The response from the next middleware/endpoint
        """
        start_time = time.time()

        logger.info(
            "Request started",
            method=request.method,
            path=request.url.path,
            client_host=request.client.host if request.client else None,
        )

        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            logger.info(
                "Request completed",
                status_code=response.status_code,
                process_time=process_time,
            )
            return response
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(
                "Request failed",
                error=str(e),
                process_time=process_time,
                exc_info=True,
            )
            raise
