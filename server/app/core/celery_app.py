import logging
import os
from typing import Any

from celery import Celery  # type: ignore[import-untyped]
from celery.schedules import crontab  # type: ignore[import-untyped]
from celery.signals import worker_process_init  # type: ignore[import-untyped]
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.celery import CeleryInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.core.config import get_settings
from app.utils.logging_config import setup_logging

logger = logging.getLogger(__name__)

settings = get_settings()


def setup_celery_tracing() -> None:
    """Configure OpenTelemetry tracing for Celery"""
    settings = get_settings()
    service_name = settings.OTEL_SERVICE_NAME
    otel_endpoint = settings.OTEL_EXPORTER_OTLP_ENDPOINT

    if not otel_endpoint:
        logger.info("OTEL_EXPORTER_OTLP_ENDPOINT not set, skipping tracing setup for %s", service_name)
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
    CeleryInstrumentor().instrument()

    logger.info("OpenTelemetry tracing configured for %s, endpoint: %s", service_name, otel_endpoint)


@worker_process_init.connect
def init_worker_logging(**_kwargs: Any) -> None:
    """Initialize logging and tracing for Celery worker processes with service-specific tags."""
    setup_logging()
    setup_celery_tracing()


CELERY_BROKER_URL = settings.CELERY_BROKER_URL
CELERY_RESULT_BACKEND = settings.CELERY_RESULT_BACKEND

celery = Celery(
    __name__,  # Using __name__ will make the app name 'app.core.celery_app'
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=["app.workers.tasks"],  # List of modules to import when the worker starts
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    worker_send_task_events=True,
    task_send_sent_event=True,
    result_expires=86400,  # Task result expiration (24 hours)
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

# Define periodic tasks (Celery Beat schedule)
celery.conf.beat_schedule = {
    "schedule-hourly-feed-refreshes": {
        "task": "app.workers.tasks.schedule_all_feed_refreshes_task",
        "schedule": crontab(minute="*/30"),  # Every 30 minutes for frequent updates during dev/testing
    },
}

if __name__ == "__main__":
    # This allows running celery worker directly using: python -m app.core.celery_app worker -l info
    # (Though typically you'd use the `celery` CLI command from docker-compose)
    celery.start()
