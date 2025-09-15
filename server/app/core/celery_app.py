import os

from celery import Celery
from celery.schedules import crontab
from celery.signals import worker_process_init
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.celery import CeleryInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.core.config import get_settings
from app.utils.logging_config import setup_logging

settings = get_settings()


def setup_celery_tracing():
    """Configure OpenTelemetry tracing for Celery"""
    settings = get_settings()
    service_name = settings.OTEL_SERVICE_NAME
    otel_endpoint = settings.OTEL_EXPORTER_OTLP_ENDPOINT

    if not otel_endpoint:
        print(f"OTEL_EXPORTER_OTLP_ENDPOINT not set, skipping tracing setup for {service_name}")
        return

    # Configure resource with service information
    resource = Resource.create({
        SERVICE_NAME: service_name,
        SERVICE_VERSION: "1.0.0",
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
    CeleryInstrumentor().instrument()

    print(f"OpenTelemetry tracing configured for {service_name}, endpoint: {otel_endpoint}")


@worker_process_init.connect
def init_worker_logging(**_kwargs):
    """Initialize logging and tracing for Celery worker processes with service-specific tags."""
    setup_logging()
    setup_celery_tracing()

# Ensure that the DJANGO_SETTINGS_MODULE environment variable is set correctly
# For FastAPI, this might not be needed unless you are using Django components.
# os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'your_project.settings')

# Default to local Redis if not specified by environment variable
# redis_host = os.getenv("REDIS_HOST", "redis") # Service name from docker-compose
# redis_port = os.getenv("REDIS_PORT", "6379")

# CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', f'redis://{redis_host}:{redis_port}/0')
# CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', f'redis://{redis_host}:{redis_port}/1')

CELERY_BROKER_URL = settings.CELERY_BROKER_URL
CELERY_RESULT_BACKEND = settings.CELERY_RESULT_BACKEND

celery = Celery(
    __name__,  # Using __name__ will make the app name 'app.core.celery_app'
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=["app.workers.tasks"],  # List of modules to import when the worker starts
)

# Optional Celery configuration, see Celery docs for more options
celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # Enable events for Flower monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,
    # Optional: set a default task execution time limit
    # task_time_limit=300, # 5 minutes
    # Optional: set a default task soft time limit
    # task_soft_time_limit=240, # 4 minutes
    # Task result expiration (24 hours)
    result_expires=86400,
    # Task acknowledgments
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

# Define periodic tasks (Celery Beat schedule)
celery.conf.beat_schedule = {
    "schedule-hourly-feed-refreshes": {
        "task": "app.workers.tasks.schedule_all_feed_refreshes_task",
        # 'schedule': crontab(minute=0),  # Every hour at minute 0
        "schedule": crontab(
            minute="*/30"
        ),  # Every 30 minutes for more frequent updates during dev/testing
        # 'args': (16, 16), # Example arguments for the task, if any
    },
    # You can add more periodic tasks here
}

if __name__ == "__main__":
    # This allows running celery worker directly using: python -m app.core.celery_app worker -l info
    # (Though typically you'd use the `celery` CLI command from docker-compose)
    celery.start()
