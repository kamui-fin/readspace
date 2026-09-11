"""Codex Digest routes - generate (enqueue) and fetch the latest digest."""

from datetime import date, datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.custom_exceptions import NotFoundError, ResourceLimitError, ValidationError
from app.crud import codex as crud_codex
from app.crud import folder as crud_folder
from app.db.session import get_db
from app.services.user.auth import get_current_user
from app.services.user.resource_limits import enforce_codex_quota
from app.typing.codex import (
    CodexDigestResponse,
    CodexGenerateRequest,
    CodexGenerateResponse,
    CodexNotEntitledResponse,
    CodexPreferencesResponse,
    CodexPreferencesUpdate,
)
from app.typing.user import TokenData
from app.workers.codex_tasks import generate_codex_digest_task

logger = structlog.get_logger(__name__)
router = APIRouter()


def _resolve_local_date(body: CodexGenerateRequest | None) -> date:
    """The reader's local calendar day (client-supplied), clamped to +/-1 day of UTC today.

    This is used ONLY as the digest's human-facing ``digest_date`` label ("which day's news
    is this"). It has NO effect on the quota, which is a server-clock rolling window - so a
    spoofed value can at most mislabel a digest by a day, never unlock extra generations.
    """
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
    summary="Generate (or fetch) the caller's Codex digest",
    description="Enqueues a digest generation. The allowance is a rolling server-clock window "
    "(a little under 24h) - a repeat request while one is in flight, or once the window cap is "
    "hit, returns the existing row rather than re-spending.",
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

    label_date = _resolve_local_date(body)  # display label only - not a quota input

    try:
        existing = await enforce_codex_quota(db, user_id)
    except ResourceLimitError as e:
        return CodexNotEntitledResponse(reason=e.message, error_code=e.error_code or "CODEX_LIMIT_EXCEEDED")

    if existing:
        logger.info("Codex digest request served from existing row", digest_id=str(existing.id))
        return existing

    digest = await crud_codex.create_pending_digest(db, user_id, label_date)
    await db.commit()

    await generate_codex_digest_task.kiq(str(user_id), str(digest.id))
    logger.info(
        "Codex digest generation enqueued",
        digest_id=str(digest.id),
        digest_date=label_date.isoformat(),
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


@router.get(
    "/preferences",
    response_model=CodexPreferencesResponse,
    summary="Get the caller's digest preferences",
)
async def get_preferences(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
) -> CodexPreferencesResponse:
    """Return the user's digest knobs. A user who has never saved any gets the defaults
    (no folder excluded)."""
    user_id = UUID(current_user.sub)
    prefs = await crud_codex.get_preferences(db, user_id)
    excluded = [UUID(fid) for fid in prefs.excluded_folder_ids] if prefs else []
    return CodexPreferencesResponse(excluded_folder_ids=excluded)


@router.put(
    "/preferences",
    response_model=CodexPreferencesResponse,
    summary="Update the caller's digest preferences",
    description="Replaces the excluded-folder set wholesale. Takes effect on the next digest "
    "generation, not retroactively. Folder ids that don't belong to the caller are rejected.",
)
async def update_preferences(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[TokenData, Depends(get_current_user)],
    body: CodexPreferencesUpdate,
) -> CodexPreferencesResponse:
    """Validate the excluded folder ids against the user's own folders, then upsert."""
    user_id = UUID(current_user.sub)
    requested = list(dict.fromkeys(body.excluded_folder_ids))  # de-dupe, keep order

    if requested:
        owned = await crud_folder.filter_owned_ids(db, user_id, requested)
        unknown = [str(fid) for fid in requested if fid not in owned]
        if unknown:
            raise ValidationError(
                message="One or more folders don't belong to you.",
                error_code="CODEX_UNKNOWN_FOLDER",
                details={"unknown_folder_ids": unknown},
            )

    prefs = await crud_codex.upsert_preferences(db, user_id, excluded_folder_ids=requested)
    await db.commit()
    logger.info("Codex preferences updated", user_id=current_user.sub, excluded_count=len(requested))
    return CodexPreferencesResponse(excluded_folder_ids=[UUID(fid) for fid in prefs.excluded_folder_ids])
