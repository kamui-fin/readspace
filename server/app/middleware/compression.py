"""
Functional middleware for Brotli compression.
"""

import brotli
from fastapi import Request
from starlette.responses import Response, StreamingResponse
from app.core.constants import COMPRESSION_CONTENT_TYPES, COMPRESSION_LEVEL, COMPRESSION_MIN_SIZE


async def compression_middleware(request: Request, call_next) -> Response:
    """
    Compresses compatible responses using Brotli.
    """
    # Check client support early
    accept_encoding = request.headers.get("accept-encoding", "")
    if "br" not in accept_encoding.lower():
        return await call_next(request)

    response = await call_next(request)

    # Skip if streaming, already compressed, or empty
    if isinstance(response, StreamingResponse) or response.headers.get("content-encoding"):
        return response

    # Check Content-Type
    content_type = response.headers.get("content-type", "").split(";")[0].strip()
    if content_type not in COMPRESSION_CONTENT_TYPES:
        return response

    # Buffer body (Be careful: this loads full response into memory)
    # Since we set COMPRESSION_MIN_SIZE, this is generally safe for API JSON responses
    response_body = b""
    async for chunk in response.body_iterator:
        response_body += chunk

    if len(response_body) < COMPRESSION_MIN_SIZE:
        # Return reconstructed response (we consumed the iterator)
        return Response(
            content=response_body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )

    # Compress
    try:
        compressed_body = brotli.compress(response_body, quality=COMPRESSION_LEVEL)

        # Only use if smaller
        if len(compressed_body) < len(response_body):
            response.headers["Content-Encoding"] = "br"
            response.headers["Content-Length"] = str(len(compressed_body))
            response.headers.append("Vary", "Accept-Encoding")

            return Response(
                content=compressed_body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

    except Exception:
        pass  # Fallback to original if compression fails

    return Response(
        content=response_body,
        status_code=response.status_code,
        headers=dict(response.headers),
        media_type=response.media_type,
    )
