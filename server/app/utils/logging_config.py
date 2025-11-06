import logging
import sys

import structlog

from app.core.config import get_settings

# Get settings
settings = get_settings()


def setup_logging(service_name: str = "api") -> None:
    """Configures structlog for console logging only.

    Args:
        service_name: Name of the service for logging context. Defaults to 'api'
    """
    if structlog.is_configured():
        return

    # Configure structlog with consistent console logging for all environments
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
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
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S", utc=False),
        ],
    )

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.handlers.clear()

    # Add console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)

    # Reduce logging noise from various libraries
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.dialects").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    # Ensure uvicorn access logs are at INFO level
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)

    root_logger.setLevel(settings.LOG_LEVEL)

    log = structlog.get_logger()
    log.info(
        "Logging configured",
        service=service_name,
        level=settings.LOG_LEVEL,
        environment=settings.ENVIRONMENT,
    )
