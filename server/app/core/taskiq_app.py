"""Taskiq broker configuration for async task processing."""

import logging
import os

from taskiq import AsyncBroker, InMemoryBroker, PrometheusMiddleware, TaskiqScheduler
from taskiq.middlewares import SmartRetryMiddleware
from taskiq.schedule_sources import LabelScheduleSource
from taskiq_redis import ListRedisScheduleSource, RedisAsyncResultBackend, RedisStreamBroker

from app.core.config import get_settings
from app.core.logging_config import setup_logging

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

    # Create RedisStreamBroker
    # This uses Redis Streams for reliable at-least-once delivery with acknowledgements
    broker = RedisStreamBroker(
        url=settings.REDIS_URL,
        queue_name="taskiq_tasks",
    ).with_result_backend(result_backend)

    # Add middlewares for retry and metrics
    broker = broker.with_middlewares(
        # Retry middleware with exponential backoff and jitter
        # This prevents retry storms when feeds fail (e.g., temporary network issues)
        # With exponential backoff: 30s → 1min → 2min → 4min (capped at 5min)
        SmartRetryMiddleware(
            default_retry_count=3,  # Maximum 3 retries per task
            default_delay=30,  # Initial delay: 30 seconds
            use_jitter=True,  # Add randomness to prevent thundering herd
            use_delay_exponent=True,  # Enable exponential backoff
            max_delay_exponent=300,  # Cap at 5 minutes
        ),
        # Prometheus metrics for monitoring task performance
        # Exposes metrics at http://worker:9090/metrics
        # Tracks: task_duration, task_count, task_errors, task_retries
        PrometheusMiddleware(
            server_addr="0.0.0.0",  # noqa: S104 - Docker container binding
            server_port=9090,
        ),
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
