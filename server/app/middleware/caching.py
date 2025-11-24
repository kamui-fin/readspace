"""
Functional middleware for HTTP Cache-Control headers.
"""

from fastapi import Request
from starlette.responses import Response
from app.core.constants import CACHE_CONTROL_ARTICLE_LISTS, CACHE_CONTROL_STATIC_FEEDS


async def caching_middleware(request: Request, call_next) -> Response:
    """
    Adds Cache-Control headers to GET requests for specific routes.
    """
    response = await call_next(request)

    # Only cache successful GET requests
    if request.method != "GET" or response.status_code != 200:
        return response

    path = request.url.path
    cache_value = None

    # 1. Static Feed Metadata (Public, longer cache)
    if path == "/api/feeds" or (path.startswith("/api/feeds/") and "/admin" not in path):
        cache_value = CACHE_CONTROL_STATIC_FEEDS

    # 2. Article Lists (Private, short cache, frequent updates)
    elif path.startswith("/api/articles"):
        cache_value = CACHE_CONTROL_ARTICLE_LISTS

    # 3. Discovery
    elif path.startswith("/api/discover"):
        cache_value = CACHE_CONTROL_STATIC_FEEDS

    if cache_value:
        response.headers["Cache-Control"] = cache_value
        response.headers["Vary"] = "Accept-Encoding, Authorization"

    return response
