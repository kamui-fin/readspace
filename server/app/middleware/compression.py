"""Middleware for Brotli response compression."""

import brotli
import structlog
from fastapi import Request
from starlette.datastructures import MutableHeaders
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response, StreamingResponse
from starlette.types import ASGIApp

from app.core.constants import COMPRESSION_CONTENT_TYPES, COMPRESSION_LEVEL, COMPRESSION_MIN_SIZE

logger = structlog.get_logger(__name__)


class CompressionMiddleware(BaseHTTPMiddleware):
    """
    Middleware to compress HTTP responses using Brotli.

    This middleware compresses responses that:
    1. Are larger than COMPRESSION_MIN_SIZE bytes
    2. Have a compressible content type (JSON, HTML, CSS, JS, etc.)
    3. Client supports brotli encoding (Accept-Encoding: br)

    Brotli provides better compression ratios than gzip, especially for text-based content.
    """

    def __init__(self, app: ASGIApp) -> None:
        """
        Initialize the compression middleware.

        Args:
            app: The ASGI application to wrap
        """
        super().__init__(app)
        self.app = app

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """
        Process request and compress response if applicable.

        Args:
            request: The incoming FastAPI request
            call_next: The next middleware or endpoint to call

        Returns:
            Response: The response (compressed if applicable)
        """
        # Get the original response
        response = await call_next(request)

        # Check if client accepts brotli encoding
        accept_encoding = request.headers.get("accept-encoding", "")
        if "br" not in accept_encoding.lower():
            return response

        # Don't compress streaming responses
        if isinstance(response, StreamingResponse):
            return response

        # Get content type
        content_type = response.headers.get("content-type", "")
        # Extract base content type (remove charset, etc.)
        base_content_type = content_type.split(";")[0].strip()

        # Check if content type is compressible
        if base_content_type not in COMPRESSION_CONTENT_TYPES:
            return response

        # Get response body
        response_body = b""
        async for chunk in response.body_iterator:
            response_body += chunk

        # Check if response is large enough to compress
        if len(response_body) < COMPRESSION_MIN_SIZE:
            # Return uncompressed response
            return Response(
                content=response_body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

        # Compress the response
        try:
            compressed_body = brotli.compress(response_body, quality=COMPRESSION_LEVEL)

            # Only use compression if it actually reduces size
            if len(compressed_body) < len(response_body):
                # Create new headers with compression info
                headers = MutableHeaders(response.headers)
                headers["content-encoding"] = "br"
                headers["content-length"] = str(len(compressed_body))
                # Add Vary header to indicate compression varies by Accept-Encoding
                headers.append("vary", "Accept-Encoding")

                logger.debug(
                    "Response compressed with Brotli",
                    original_size=len(response_body),
                    compressed_size=len(compressed_body),
                    compression_ratio=f"{(1 - len(compressed_body) / len(response_body)) * 100:.1f}%",
                )

                return Response(
                    content=compressed_body,
                    status_code=response.status_code,
                    headers=dict(headers),
                    media_type=response.media_type,
                )
            else:
                # Compression didn't help, return original
                return Response(
                    content=response_body,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type,
                )

        except Exception as e:
            # If compression fails, return uncompressed response
            logger.warning("Failed to compress response", error=str(e))
            return Response(
                content=response_body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )
