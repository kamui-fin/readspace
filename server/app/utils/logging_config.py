import logging
import sys  # Import sys for console handler
from collections.abc import Mapping, MutableMapping
from typing import Any

import structlog
from logging_loki import LokiHandler  # type: ignore[import-untyped]
from opentelemetry import trace
from pythonjsonlogger import jsonlogger

# Import the Settings model
from app.core.config import Settings

# Instantiate settings to load configuration
settings = Settings()


def setup_logging(service_name: str | None = None) -> None:
    """Configures structlog using values from Settings.

    Args:
        service_name: Name of the service for logging tags. If None, uses settings.SERVICE_NAME
    """
    if service_name is None:
        service_name = settings.SERVICE_NAME

    if structlog.is_configured():
        return

    # Check if running under Celery
    is_celery_worker = "celery" in sys.argv[0] if sys.argv else False

    # Add OpenTelemetry trace context processor
    def add_trace_context(
        logger: Any, method_name: str, event_dict: MutableMapping[str, Any]
    ) -> Mapping[str, Any] | str | bytes | bytearray | tuple[Any, ...]:
        """Add OpenTelemetry trace context to log records."""
        span = trace.get_current_span()
        if span and span.get_span_context().is_valid:
            span_context = span.get_span_context()
            event_dict["trace_id"] = format(span_context.trace_id, "032x")
            event_dict["span_id"] = format(span_context.span_id, "016x")
        return event_dict

    # Configure structlog separately (no integration)
    if settings.ENVIRONMENT == "production":
        # For Celery workers, use stdlib integration to avoid double JSON encoding
        if is_celery_worker:
            structlog.configure(
                processors=[
                    structlog.contextvars.merge_contextvars,
                    add_trace_context,
                    structlog.processors.add_log_level,
                    structlog.processors.TimeStamper(fmt="iso"),
                    structlog.processors.dict_tracebacks,
                    structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
                ],
                wrapper_class=structlog.stdlib.BoundLogger,
                context_class=dict,
                logger_factory=structlog.stdlib.LoggerFactory(),
                cache_logger_on_first_use=True,
            )
        else:
            # Production: JSON output for both console and structured logs
            structlog.configure(
                processors=[
                    structlog.contextvars.merge_contextvars,
                    add_trace_context,
                    structlog.processors.add_log_level,
                    structlog.processors.TimeStamper(fmt="iso"),
                    structlog.processors.dict_tracebacks,
                    structlog.processors.JSONRenderer(),
                ],
                wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
                context_class=dict,
                logger_factory=structlog.PrintLoggerFactory(),
                cache_logger_on_first_use=True,
            )
        # JSON formatter for standard library logs using python-json-logger
        if is_celery_worker:
            # Use ProcessorFormatter for Celery to properly handle structlog messages
            console_formatter: Any = structlog.stdlib.ProcessorFormatter(
                processor=structlog.processors.JSONRenderer(),
                foreign_pre_chain=[
                    structlog.contextvars.merge_contextvars,
                    structlog.processors.add_log_level,
                    structlog.processors.TimeStamper(fmt="iso"),
                ],
            )
            json_formatter: Any = structlog.stdlib.ProcessorFormatter(
                processor=structlog.processors.JSONRenderer(),
                foreign_pre_chain=[
                    structlog.contextvars.merge_contextvars,
                    structlog.processors.add_log_level,
                    structlog.processors.TimeStamper(fmt="iso"),
                ],
            )
        else:
            console_formatter = jsonlogger.JsonFormatter(
                "%(asctime)s %(name)s %(levelname)s %(message)s",
                rename_fields={
                    "asctime": "timestamp",
                    "name": "logger",
                    "levelname": "level",
                    "message": "event",
                },
            )
            json_formatter = jsonlogger.JsonFormatter(
                "%(asctime)s %(name)s %(levelname)s %(message)s",
                rename_fields={
                    "asctime": "timestamp",
                    "name": "logger",
                    "levelname": "level",
                    "message": "event",
                },
            )
    else:
        # Development: Use stdlib integration for proper JSON formatting to Loki
        structlog.configure(
            processors=[
                structlog.contextvars.merge_contextvars,
                add_trace_context,
                structlog.processors.add_log_level,
                structlog.processors.StackInfoRenderer(),
                structlog.dev.set_exc_info,
                structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S", utc=False),
                structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
            ],
            wrapper_class=structlog.stdlib.BoundLogger,
            context_class=dict,
            logger_factory=structlog.stdlib.LoggerFactory(),
            cache_logger_on_first_use=False,
        )

        # Human-readable formatter for console
        console_formatter = structlog.stdlib.ProcessorFormatter(
            processor=structlog.dev.ConsoleRenderer(),
            foreign_pre_chain=[
                structlog.contextvars.merge_contextvars,
                add_trace_context,
                structlog.processors.add_log_level,
                structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S", utc=False),
            ],
        )

        # JSON formatter for Loki using ProcessorFormatter
        json_formatter = structlog.stdlib.ProcessorFormatter(
            processor=structlog.processors.JSONRenderer(),
            foreign_pre_chain=[
                structlog.contextvars.merge_contextvars,
                add_trace_context,
                structlog.processors.add_log_level,
                structlog.processors.TimeStamper(fmt="iso"),
            ],
        )

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.handlers.clear()

    # Always add console handler in development or when LOG_TO_CONSOLE is True
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)

    # Reduce logging noise from various libraries
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.dialects").setLevel(logging.WARNING)
    # Keep httpx at INFO level for Loki

    # Ensure uvicorn access logs are at INFO level
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)

    # Add Loki handler in production environment
    handlers_active = ["Console"]

    # Add Loki handler if LOKI_URL is configured (both dev and prod)
    if settings.LOKI_URL:
        try:
            # Configure Loki handler with JSON formatting
            loki_handler = LokiHandler(
                url=f"{settings.LOKI_URL}/loki/api/v1/push",
                tags={
                    "application": "readspace",
                    "service": service_name,
                    "environment": settings.ENVIRONMENT,
                },
                version="1",
            )

            # Use JSON formatter for Loki
            loki_handler.setFormatter(json_formatter)

            # Only send INFO+ logs to Loki, exclude SQLAlchemy noise
            loki_handler.setLevel(logging.INFO)
            loki_handler.addFilter(lambda record: not record.name.startswith("sqlalchemy"))

            root_logger.addHandler(loki_handler)
            handlers_active.append("Loki")
        except Exception as e:
            # Log error but continue without Loki if it fails
            log = structlog.get_logger()
            log.warning("Failed to configure Loki handler", error=str(e))

    root_logger.setLevel(settings.LOG_LEVEL)

    log = structlog.get_logger()
    log.info(
        "Structlog logging configured",
        handlers=handlers_active,
        level=settings.LOG_LEVEL,
        environment=settings.ENVIRONMENT,
    )
