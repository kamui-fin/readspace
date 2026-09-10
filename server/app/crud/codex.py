"""CRUD for codex_digests - one row per user per local day per edition."""

from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.codex import CodexDigest
from app.models.enums import CodexDigestPhase, CodexDigestStatus

# Statuses that count as "a digest already exists" for dedupe / quota purposes.
_ACTIVE_STATUSES = (
    CodexDigestStatus.PENDING.value,
    CodexDigestStatus.IN_PROGRESS.value,
    CodexDigestStatus.COMPLETED.value,
)


async def get_latest_edition_for_date(db: AsyncSession, user_id: UUID, digest_date: date) -> CodexDigest | None:
    """Fetch the highest-numbered edition for a user on a specific local day, if any."""
    result = await db.execute(
        select(CodexDigest)
        .where(
            CodexDigest.user_id == user_id,
            CodexDigest.digest_date == digest_date,
        )
        .order_by(CodexDigest.edition.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def count_editions_for_date(db: AsyncSession, user_id: UUID, digest_date: date) -> int:
    """Count how many active (PENDING/IN_PROGRESS/COMPLETED) editions exist for this local day.

    A SKIPPED / FAILED edition doesn't count - it can be retried in place without spending a
    new per-day slot.
    """
    result = await db.execute(
        select(func.count(CodexDigest.id)).where(
            CodexDigest.user_id == user_id,
            CodexDigest.digest_date == digest_date,
            CodexDigest.status.in_(_ACTIVE_STATUSES),
        )
    )
    return result.scalar_one() or 0


async def get_latest_digest(db: AsyncSession, user_id: UUID) -> CodexDigest | None:
    """Fetch the most recent digest row for a user - latest edition of the latest day."""
    result = await db.execute(
        select(CodexDigest)
        .where(CodexDigest.user_id == user_id)
        .order_by(CodexDigest.digest_date.desc(), CodexDigest.edition.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def count_ready_digests_in_month(db: AsyncSession, user_id: UUID, today: date | None = None) -> int:
    """Count COMPLETED digests for the user in the current calendar month.

    Only COMPLETED rows count toward the Basic monthly allowance - a SKIPPED or FAILED
    run never burns it.
    """
    today = today or datetime.now(timezone.utc).date()
    month_start = today.replace(day=1)
    result = await db.execute(
        select(func.count(CodexDigest.id)).where(
            CodexDigest.user_id == user_id,
            CodexDigest.status == CodexDigestStatus.COMPLETED.value,
            CodexDigest.digest_date >= month_start,
            CodexDigest.digest_date <= today,
        )
    )
    return result.scalar_one() or 0


async def create_pending_digest(db: AsyncSession, user_id: UUID, digest_date: date) -> CodexDigest:
    """Get a PENDING digest row for this local day: recycle a retryable latest edition, else
    insert the next edition.

    If the latest edition for the day is SKIPPED / FAILED, it's reset to PENDING in place - a
    retry, not a new slot. Otherwise a fresh row is inserted at ``edition = <highest> + 1``.
    Per-day / per-month allowance is caller-gated upstream (``enforce_codex_quota``); an active
    (PENDING/IN_PROGRESS/COMPLETED) latest edition is left untouched here and returned as-is.
    """
    latest = await get_latest_edition_for_date(db, user_id, digest_date)
    if latest is not None:
        if latest.status in (CodexDigestStatus.SKIPPED.value, CodexDigestStatus.FAILED.value):
            latest.status = CodexDigestStatus.PENDING.value
            latest.progress_phase = None
            latest.error = None
            latest.payload = None
            latest.generated_at = None
            latest.clusters_found = None
            latest.input_article_count = None
            latest.input_source_count = None
            latest.requested_at = datetime.now(timezone.utc)
            await db.flush()
            await db.refresh(latest)
            return latest
        next_edition = int(latest.edition) + 1
    else:
        next_edition = 1

    digest = CodexDigest(
        user_id=user_id,
        digest_date=digest_date,
        edition=next_edition,
        status=CodexDigestStatus.PENDING.value,
    )
    db.add(digest)
    await db.flush()
    await db.refresh(digest)
    return digest


async def mark_in_progress(db: AsyncSession, digest_id: UUID, phase: CodexDigestPhase) -> None:
    """Flip a digest row to IN_PROGRESS and set its starting phase once the worker picks it up."""
    digest = await db.get(CodexDigest, digest_id)
    if digest:
        digest.status = CodexDigestStatus.IN_PROGRESS.value
        digest.progress_phase = phase.value


async def set_progress_phase(db: AsyncSession, digest_id: UUID, phase: CodexDigestPhase) -> None:
    """Advance an already-IN_PROGRESS digest row to a new pipeline phase.

    Called between pipeline stages so a polling client sees "Reading your feeds..." become
    "Finding patterns..." etc. Best-effort - swallows a missing row rather than raising, since
    this is UX polish, not correctness-critical.
    """
    digest = await db.get(CodexDigest, digest_id)
    if digest:
        digest.progress_phase = phase.value


async def finalize_digest(
    db: AsyncSession,
    digest_id: UUID,
    status: CodexDigestStatus,
    *,
    payload: dict[str, Any] | None = None,
    error: str | None = None,
    model: str | None = None,
    window_hours: int | None = None,
    input_article_count: int | None = None,
    input_source_count: int | None = None,
    clusters_found: int | None = None,
) -> CodexDigest | None:
    """Finalize a digest row with a terminal status (COMPLETED / FAILED / SKIPPED)."""
    digest = await db.get(CodexDigest, digest_id)
    if not digest:
        return None

    digest.status = status.value
    digest.generated_at = datetime.now(timezone.utc)
    if payload is not None:
        digest.payload = payload
    if error is not None:
        digest.error = error
    if model is not None:
        digest.model = model
    if window_hours is not None:
        digest.window_hours = window_hours
    if input_article_count is not None:
        digest.input_article_count = input_article_count
    if input_source_count is not None:
        digest.input_source_count = input_source_count
    if clusters_found is not None:
        digest.clusters_found = clusters_found

    await db.flush()
    await db.refresh(digest)
    return digest
