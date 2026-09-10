"""Codex Digest routes - generate (enqueue) and fetch the latest digest."""

from datetime import date, datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.custom_exceptions import NotFoundError, ResourceLimitError
from app.crud import codex as crud_codex
from app.db.session import get_db
from app.services.user.auth import get_current_user
from app.services.user.resource_limits import enforce_codex_quota
from app.typing.codex import (
    CodexDigestResponse,
    CodexGenerateRequest,
    CodexGenerateResponse,
    CodexNotEntitledResponse,
)
from app.typing.user import TokenData
from app.workers.codex_tasks import generate_codex_digest_task

logger = structlog.get_logger(__name__)
router = APIRouter()


def _resolve_local_date(body: CodexGenerateRequest | None) -> date:
    """The reader's local calendar day (client-supplied), clamped to +/-1 day of UTC today so
    a spoofed value can't unlock more than a timezone's worth of extra budget."""
    utc_today = datetime.now(timezone.utc).date()
    if body is None or body.local_date is None:
        return utc_today
    delta = (body.local_date - utc_today).days
    if delta > 1:
        return utc_today + timedelta(days=1)
    if delta < -1:
        return utc_today - timedelta(days=1)
    return body.local_date


@router.post(
    "/generate",
    response_model=CodexGenerateResponse | CodexNotEntitledResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Generate (or fetch today's) Codex digest",
    description="Enqueues a digest generation for the caller's local day. Idempotent within "
    "that day up to the tier's per-day edition cap: a repeat request past the cap returns the "
    "existing row rather than re-spending.",
)
async def generate_digest(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    body: Annotated[CodexGenerateRequest | None, Body()] = None,
) -> CodexGenerateResponse | CodexNotEntitledResponse:
    """Enforce quota, then either return an existing edition or enqueue the next one."""
    settings = get_settings()
    user_id = UUID(current_user.sub)
    logger.bind(user_id=current_user.sub)

    if not settings.ENABLE_AI:
        return CodexNotEntitledResponse(reason="AI features are disabled on this instance.", error_code="AI_DISABLED")

    local_date = _resolve_local_date(body)

    try:
        existing = await enforce_codex_quota(db, user_id, local_date=local_date)
    except ResourceLimitError as e:
        return CodexNotEntitledResponse(reason=e.message, error_code=e.error_code or "CODEX_LIMIT_EXCEEDED")

    if existing:
        logger.info("Codex digest request served from existing row", digest_id=str(existing.id))
        return existing

    digest = await crud_codex.create_pending_digest(db, user_id, local_date)
    await db.commit()

    await generate_codex_digest_task.kiq(str(user_id), str(digest.id))
    logger.info(
        "Codex digest generation enqueued",
        digest_id=str(digest.id),
        digest_date=local_date.isoformat(),
        edition=digest.edition,
    )

    return digest


@router.get(
    "/today",
    response_model=CodexDigestResponse,
    summary="Get the latest Codex digest",
)
async def get_today_digest(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> CodexDigestResponse:
    """Return the latest digest row for the user, any status."""
    user_id = UUID(current_user.sub)
    digest = await crud_codex.get_latest_digest(db, user_id)
    if not digest:
        raise NotFoundError(message="No Codex digest found yet", error_code="CODEX_DIGEST_NOT_FOUND")
    return digest
