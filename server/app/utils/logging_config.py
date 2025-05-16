import logging
import sys  # Import sys for console handler
from typing import Any

import structlog

# Import the Settings model
from app.schemas.settings import Settings

# Instantiate settings to load configuration
settings = Settings()


def setup_logging() -> None:
    """Configures structlog using values from Settings."""
    if structlog.is_configured():
        return

    # Define shared processors for structlog (unchanged)
    if settings.ENVIRONMENT == "production":
        shared_processors: list[Any] = [
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.dict_tracebacks,
            structlog.contextvars.merge_contextvars,
        ]
        # Configure structlog for standard library integration (unchanged)
        structlog.configure(
            processors=shared_processors
            + [
                structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
            ],
            logger_factory=structlog.stdlib.LoggerFactory(),
            wrapper_class=structlog.stdlib.BoundLogger,
            cache_logger_on_first_use=True,
        )
    else:
        structlog.configure(
            processors=[
                structlog.contextvars.merge_contextvars,
                structlog.processors.add_log_level,
                structlog.processors.StackInfoRenderer(),
                structlog.dev.set_exc_info,
                structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S", utc=False),
                structlog.dev.ConsoleRenderer(),
            ],
            wrapper_class=structlog.make_filtering_bound_logger(logging.NOTSET),
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(),
            cache_logger_on_first_use=False,
        )

    console_formatter = structlog.stdlib.ProcessorFormatter(
        processor=structlog.dev.ConsoleRenderer(colors=True),
    )

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.handlers.clear()

    # Always add console handler in development or when LOG_TO_CONSOLE is True
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)

    # Add Loki handler only if not in development environment
    handlers_active = ["Console"]
    root_logger.setLevel(settings.LOG_LEVEL)

    log = structlog.get_logger()
    log.info(
        "Structlog logging configured",
        handlers=handlers_active,
        level=settings.LOG_LEVEL,
        environment=settings.ENVIRONMENT,
    )

    return log
