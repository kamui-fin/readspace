import logging
import sys

import structlog

from app.core.config import get_settings

settings = get_settings()


def setup_logging() -> None:
    if structlog.is_configured():
        return

    is_production = settings.ENVIRONMENT == "production"

    # 1. Define Shared Processors (apply to all logs)
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.TimeStamper(fmt="iso", utc=True)
        if is_production
        else structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S", utc=False),
    ]

    # 2. Configure Structlog
    structlog.configure(
        processors=shared_processors
        + [
            # Prepare event dict for stdlib formatting
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=False,
    )

    # 3. Define the Formatter
    if is_production:
        formatter = structlog.stdlib.ProcessorFormatter(
            # Foreign logs (like Uvicorn) go through shared_processors first
            foreign_pre_chain=shared_processors,
            processors=[
                # Clean up internal keys
                structlog.stdlib.ProcessorFormatter.remove_processors_meta,
                # Rename "event" to "message"
                structlog.processors.EventRenamer("message"),
                # Render JSON
                structlog.processors.JSONRenderer(),
            ],
        )
    else:
        formatter = structlog.stdlib.ProcessorFormatter(
            foreign_pre_chain=shared_processors,
            processor=structlog.dev.ConsoleRenderer(),
        )

    # 4. Create the Handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    # 5. Configure Root Logger
    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(settings.LOG_LEVEL)

    # --- THE CRITICAL FIX FOR UVICORN ---
    # We must iterate through Uvicorn's specific loggers, remove their
    # default handlers (which print text), and force them to propagate
    # up to the root logger (which prints JSON).
    for _log in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
        logger = logging.getLogger(_log)
        logger.handlers = []  # Remove the default text handler
        logger.propagate = True  # Send logs up to the root logger (JSON)

    # 6. Silence noisy libraries
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    # 7. Test
    log = structlog.get_logger()
    log.info("Logging configured", mode="JSON" if is_production else "Human")
