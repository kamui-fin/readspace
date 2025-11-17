"""Taskiq broker configuration for async task processing."""

import logging
import os
from typing import Any

from taskiq import AsyncBroker, InMemoryBroker, TaskiqScheduler
from taskiq.middlewares import SmartRetryMiddleware
from taskiq.schedule_sources import LabelScheduleSource
from taskiq_aio_pika import AioPikaBroker
from taskiq_redis import ListRedisScheduleSource, RedisAsyncResultBackend

from app.core.config import get_settings
from app.utils.logging_config import setup_logging

logger = logging.getLogger(__name__)

settings = get_settings()

# Initialize logging for workers
setup_logging()

# Check if we're in test mode
env = os.environ.get("ENVIRONMENT", settings.ENVIRONMENT)

# Use InMemoryBroker for testing to avoid network calls
if env in ("test", "pytest"):
    logger.info("Using InMemoryBroker for testing")
    broker: AsyncBroker = InMemoryBroker()
else:
    # Create result backend with Redis
    result_backend = RedisAsyncResultBackend(
        redis_url=settings.REDIS_URL,
        result_ex_time=86400,  # Results expire after 24 hours
        keep_results=False,  # Remove results after reading
    )

    # Create AioPika broker for RabbitMQ
    # Note: RabbitMQ URL format: amqp://username:password@host:port/vhost
    rabbitmq_url = getattr(settings, "RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")

    broker = AioPikaBroker(
        url=rabbitmq_url,
        queue_name="taskiq_tasks",
        max_priority=10,  # Enable task priorities
        qos=50,  # Prefetch 50 messages per worker process (balances throughput with memory usage)
        declare_exchange=True,
        exchange_name="taskiq_exchange",
    ).with_result_backend(result_backend)

    # Add retry middleware with exponential backoff and jitter
    # This prevents retry storms when feeds fail (e.g., temporary network issues)
    # With exponential backoff: 30s → 1min → 2min → 4min (capped at 5min)
    broker = broker.with_middlewares(
        SmartRetryMiddleware(
            default_retry_count=3,  # Maximum 3 retries per task
            default_delay=30,  # Initial delay: 30 seconds
            use_jitter=True,  # Add randomness to prevent thundering herd
            use_delay_exponent=True,  # Enable exponential backoff
            max_delay_exponent=300,  # Cap at 5 minutes
        )
    )

# Create schedule source for dynamic scheduling (skip for tests)
if env not in ("test", "pytest"):
    schedule_source = ListRedisScheduleSource(
        url=settings.REDIS_URL,
        prefix="taskiq:schedule",
    )

    # Create scheduler with label-based schedules and Redis schedule source
    scheduler = TaskiqScheduler(
        broker=broker,
        sources=[
            LabelScheduleSource(broker),  # For label-based schedules
            schedule_source,  # For dynamic schedules
        ],
    )
else:
    # Simple scheduler for tests
    scheduler = TaskiqScheduler(
        broker=broker,
        sources=[LabelScheduleSource(broker)],
    )


# Helper function for JSON serialization of UUIDs and other types
def default_serializer(obj: Any) -> Any:
    """Custom JSON serializer for non-standard types."""
    from uuid import UUID

    if isinstance(obj, UUID):
        return str(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
