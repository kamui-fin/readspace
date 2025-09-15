import logging
import os
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
from prometheus_fastapi_instrumentator import Instrumentator
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.core.config import get_settings
from app.core.redis_cache import RedisCache
from app.routers import router as api_router  # Import the main router
from app.utils.logging_config import setup_logging

# Configure structured logging first
setup_logging()
logger = structlog.get_logger(__name__)

# Initialize OpenTelemetry
def setup_tracing():
    """Configure OpenTelemetry tracing"""
    settings = get_settings()
    service_name = settings.SERVICE_NAME
    otel_endpoint = settings.OTEL_EXPORTER_OTLP_ENDPOINT

    if not otel_endpoint:
        logger.warning("OTEL_EXPORTER_OTLP_ENDPOINT not set, skipping tracing setup")
        return

    # Configure resource with service information
    resource = Resource.create({
        SERVICE_NAME: service_name,
        "service.instance.id": f"{service_name}-{os.getpid()}",
    })

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
async def lifespan(app: FastAPI):
    # Startup: Initialize Redis client
    await RedisCache._get_client()
    yield


app = FastAPI(title="Readspace API", lifespan=lifespan)

settings = get_settings()

# Instrument FastAPI after app creation
FastAPIInstrumentor.instrument_app(app)

# Initialize Prometheus metrics
instrumentator = Instrumentator()
instrumentator.instrument(app).expose(app)

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
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=400,
        content={"detail": exc.errors()},
    )


# Include the main API router
app.include_router(
    api_router, prefix="/api"
)  # Add all routes from app.routers with /api prefix
