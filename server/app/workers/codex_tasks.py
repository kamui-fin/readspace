"""Codex Digest Taskiq task - a thin wrapper around services/codex/pipeline.py."""

import structlog

from app.core.taskiq_app import broker
from app.services.codex.pipeline import generate_digest_for_user
from app.workers.common import ensure_uuid

logger = structlog.get_logger(__name__)


@broker.task(
    task_name="codex_tasks.generate_codex_digest",
    retry_on_error=True,
    max_retries=1,
    timeout=300,
)
async def generate_codex_digest_task(user_id: str, digest_id: str) -> None:
    """Generate a Codex digest for one user (Task Wrapper).

    The digest row is created PENDING by the router before this is enqueued; this task
    owns moving it through IN_PROGRESS to a terminal status. On an unexpected exception the
    pipeline itself marks the row FAILED before re-raising, so the one Taskiq retry starts
    from a clean FAILED state rather than a stuck IN_PROGRESS one.
    """
    await generate_digest_for_user(user_id=ensure_uuid(user_id), digest_id=ensure_uuid(digest_id))
