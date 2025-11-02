import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import get_settings
from app.core.constants import SHOW_DOCS_ENVIRONMENTS
from app.core.redis_cache import RedisCache
from app.middleware import CompressionMiddleware, HTTPCachingMiddleware, RequestIdMiddleware
from app.routers import router as api_router  # Import the main router
from app.utils.logging_config import setup_logging

# Configure structured logging first
setup_logging()
logger = structlog.get_logger(__name__)


# Initialize OpenTelemetry
def setup_tracing() -> None:
    """Configure OpenTelemetry tracing"""
    settings = get_settings()
    service_name = settings.SERVICE_NAME
    otel_endpoint = settings.OTEL_EXPORTER_OTLP_ENDPOINT

    if not otel_endpoint:
        logger.warning("OTEL_EXPORTER_OTLP_ENDPOINT not set, skipping tracing setup")
        return

    # Configure resource with service information
    resource = Resource.create(
        {
            SERVICE_NAME: service_name,
            "service.instance.id": f"{service_name}-{os.getpid()}",
        }
    )

    # Set up tracer provider
    tracer_provider = TracerProvider(resource=resource)
    trace.set_tracer_provider(tracer_provider)

    # Configure OTLP exporter
    otlp_exporter = OTLPSpanExporter(endpoint=f"{otel_endpoint}/v1/traces")
    span_processor = BatchSpanProcessor(otlp_exporter)
    tracer_provider.add_span_processor(span_processor)

    # Instrument libraries
    LoggingInstrumentor().instrument()
    HTTPXClientInstrumentor().instrument()
    RedisInstrumentor().instrument()
    SQLAlchemyInstrumentor().instrument()

    logger.info("OpenTelemetry tracing configured", endpoint=otel_endpoint, service=service_name)


# Initialize tracing after logging setup
setup_tracing()


# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """FastAPI lifespan context manager for startup/shutdown."""
    # Startup: Initialize Redis connection pool
    await RedisCache.get_pool()
    logger.info("Application startup complete")

    yield

    # Shutdown: Close Redis connection pool
    await RedisCache.close_pool()
    logger.info("Application shutdown complete")


# Configure FastAPI with comprehensive documentation metadata
settings = get_settings()

# Determine if documentation should be enabled based on environment
docs_config = {}

if settings.ENVIRONMENT not in SHOW_DOCS_ENVIRONMENTS:
    # Hide documentation in production
    docs_config.update(
        {
            "openapi_url": None,
            "docs_url": None,
            "redoc_url": None,
        }
    )

app = FastAPI(
    title="Readspace API",
    description="""
    **Readspace** is an open-source, privacy-first reading hub that brings RSS feeds,
    newsletters, saved articles, Twitter threads, Reddit posts, and books into one clean,
    distraction-free inbox.

    ## Features

    * **RSS Feed Management** - Subscribe to and manage RSS feeds
    * **Article Processing** - Automatic content extraction and enhancement
    * **AI-Powered Features** - Content similarity and recommendations
    * **OPML Support** - Import/export feed collections
    * **Highlights & Annotations** - Save and organize important content
    * **Book Management** - Organize and track reading materials
    * **Search & Discovery** - Find new feeds and content

    ## Authentication

    This API uses Supabase JWT tokens for authentication. Include your token in the
    `Authorization` header as `Bearer <token>`.

    ## Rate Limiting

    Some endpoints have resource limits to ensure fair usage and prevent abuse.
    """,
    version="1.0.0",
    terms_of_service="https://readspace.app/terms",
    contact={
        "name": "Readspace Support",
        "url": "https://github.com/readspace-app/readspace",
        "email": "support@readspace.app",
    },
    license_info={
        "name": "MIT License",
        "url": "https://github.com/readspace-app/readspace/blob/main/LICENSE",
    },
    servers=[
        {"url": "http://localhost:8008", "description": "Development server"},
        {"url": "https://api.readspace.app", "description": "Production server"},
    ],
    lifespan=lifespan,
    **docs_config,
)

# Instrument FastAPI after app creation
FastAPIInstrumentor.instrument_app(app)

# Initialize Prometheus metrics
instrumentator = Instrumentator()
instrumentator.instrument(app).expose(app)

# Add Request ID middleware (must be added before other middleware to ensure request_id is always available)
app.add_middleware(RequestIdMiddleware)

# Add HTTP Caching middleware (adds ETag and Cache-Control headers)
# This should be early in the chain to cache the final response
app.add_middleware(HTTPCachingMiddleware)

# Add Compression middleware (compresses responses with Brotli)
# This should be last in the middleware chain so it compresses the final response
app.add_middleware(CompressionMiddleware)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.CORS_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    logger.error(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )


# Include the main API router
app.include_router(api_router, prefix="/api")  # Add all routes from app.routers with /api prefix
