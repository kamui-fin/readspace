"""
Functional logging middleware.
"""

import time

import structlog
from fastapi import Request
from starlette.responses import Response

logger = structlog.get_logger("request_logger")


async def logging_middleware(request: Request, call_next) -> Response:
    """
    Logs request start/end details and timing.
    """
    start_time = time.perf_counter()

    # Contextualize logger with request ID if available (from headers or upstream)
    request_id = request.headers.get("X-Request-ID", "unknown")
    log = logger.bind(request_id=request_id, path=request.url.path, method=request.method)

    log.info("Request started")

    try:
        response = await call_next(request)

        process_time = time.perf_counter() - start_time
        log.info("Request completed", status_code=response.status_code, duration=round(process_time, 4))

        # Add timing header for client visibility
        response.headers["X-Process-Time"] = str(process_time)
        return response

    except Exception as e:
        process_time = time.perf_counter() - start_time
        log.error("Request failed", error=str(e), duration=round(process_time, 4), exc_info=True)
        raise
