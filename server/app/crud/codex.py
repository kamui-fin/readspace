"""CRUD for codex_digests.

Quota is enforced on a **rolling time window keyed on the server clock** (``requested_at``),
never on a client-supplied calendar date - see ``count_recent_generations``. ``digest_date``
is kept only as a human-facing label ("which day's news is this") and plays no part in the
allowance.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.codex import CodexDigest, CodexPreferences
from app.models.enums import CodexDigestPhase, CodexDigestStatus
from app.models.feed import FeedSubscription

# Statuses that count as "a digest already exists" for dedupe / quota purposes.
_ACTIVE_STATUSES = (
    CodexDigestStatus.PENDING.value,
    CodexDigestStatus.IN_PROGRESS.value,
    CodexDigestStatus.COMPLETED.value,
)

# In-flight statuses - a row in one of these is a generation still running, so a repeat
# request is served from it rather than spending a fresh slot.
_IN_FLIGHT_STATUSES = (
    CodexDigestStatus.PENDING.value,
    CodexDigestStatus.IN_PROGRESS.value,
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


async def count_recent_generations(
    db: AsyncSession, user_id: UUID, *, window: timedelta, now: datetime | None = None
) -> int:
    """Count the user's active (PENDING/IN_PROGRESS/COMPLETED) generations whose ``requested_at``
    falls inside the trailing ``window`` from ``now`` (server clock, UTC).

    This is the quota primitive: it can't be gamed by changing the device clock or the
    client-supplied local date, and it resets continuously (the oldest generation ages out of
    the window ``window`` after it was requested). SKIPPED / FAILED rows never count - they're
    retried in place.
    """
    now = now or datetime.now(timezone.utc)
    cutoff = now - window
    result = await db.execute(
        select(func.count(CodexDigest.id)).where(
            CodexDigest.user_id == user_id,
            CodexDigest.status.in_(_ACTIVE_STATUSES),
            CodexDigest.requested_at > cutoff,
        )
    )
    return result.scalar_one() or 0


async def get_latest_in_flight(db: AsyncSession, user_id: UUID) -> CodexDigest | None:
    """The user's most recent still-running (PENDING/IN_PROGRESS) generation, if any.

    A repeat request while one of these exists is served from it - the client just keeps
    polling the same row instead of spending another slot.
    """
    result = await db.execute(
        select(CodexDigest)
        .where(
            CodexDigest.user_id == user_id,
            CodexDigest.status.in_(_IN_FLIGHT_STATUSES),
        )
        .order_by(CodexDigest.requested_at.desc(), CodexDigest.edition.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_latest_retryable(db: AsyncSession, user_id: UUID) -> CodexDigest | None:
    """The user's most recent SKIPPED / FAILED generation, if that's also their most recent
    generation overall. Such a row can be re-run in place without spending a fresh slot.

    Returns None when the latest generation is active (in-flight or completed) or there is
    none at all.
    """
    latest = await get_latest_digest(db, user_id)
    if latest is None:
        return None
    if latest.status in (CodexDigestStatus.SKIPPED.value, CodexDigestStatus.FAILED.value):
        return latest
    return None


async def get_latest_digest(db: AsyncSession, user_id: UUID) -> CodexDigest | None:
    """Fetch the user's most recent digest row, ordered by when it was requested (server
    clock). A SKIPPED/FAILED row that is later retried keeps its id but has ``requested_at``
    bumped, so ordering by ``requested_at`` reflects true recency."""
    result = await db.execute(
        select(CodexDigest)
        .where(CodexDigest.user_id == user_id)
        .order_by(CodexDigest.requested_at.desc(), CodexDigest.edition.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def count_completed_since(db: AsyncSession, user_id: UUID, *, since: datetime) -> int:
    """Count the user's COMPLETED digests requested at/after ``since`` (server clock, UTC).

    Only COMPLETED rows count toward the Basic monthly allowance - a SKIPPED or FAILED run
    never burns it. Keyed on ``requested_at`` so a spoofed local date can't dodge the cap.
    """
    result = await db.execute(
        select(func.count(CodexDigest.id)).where(
            CodexDigest.user_id == user_id,
            CodexDigest.status == CodexDigestStatus.COMPLETED.value,
            CodexDigest.requested_at >= since,
        )
    )
    return result.scalar_one() or 0


async def create_pending_digest(db: AsyncSession, user_id: UUID, digest_date: date) -> CodexDigest:
    """Get a PENDING digest row: recycle the user's most recent generation if it's a
    retryable SKIPPED / FAILED, otherwise insert a fresh row.

    ``digest_date`` is a display label only (the local day the digest is "for"). The unique
    constraint is ``(user_id, digest_date, edition)``, so a fresh row takes
    ``edition = <highest edition already on that date> + 1``.

    Per-generation / monthly allowance is caller-gated upstream (``enforce_codex_quota``); an
    in-flight or completed latest generation is left untouched here (the router serves it back
    without calling this).
    """
    retryable = await get_latest_retryable(db, user_id)
    if retryable is not None:
        retryable.status = CodexDigestStatus.PENDING.value
        retryable.progress_phase = None
        retryable.error = None
        retryable.payload = None
        retryable.generated_at = None
        retryable.clusters_found = None
        retryable.input_article_count = None
        retryable.input_source_count = None
        retryable.requested_at = datetime.now(timezone.utc)
        # digest_date (the display label) is left as-is: it's the day this digest was first
        # requested for, and re-homing it risks colliding with the (user, date, edition)
        # unique constraint. The quota window keys on requested_at, which we just bumped.
        await db.flush()
        await db.refresh(retryable)
        return retryable

    latest_for_date = await get_latest_edition_for_date(db, user_id, digest_date)
    next_edition = int(latest_for_date.edition) + 1 if latest_for_date is not None else 1

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


# ================= Preferences =================


async def get_preferences(db: AsyncSession, user_id: UUID) -> CodexPreferences | None:
    """Fetch the user's digest preferences row, or None if they've never saved any."""
    return await db.get(CodexPreferences, user_id)


async def upsert_preferences(db: AsyncSession, user_id: UUID, *, excluded_folder_ids: list[UUID]) -> CodexPreferences:
    """Create or update the user's digest preferences row.

    ``excluded_folder_ids`` is stored as a JSONB array of UUID strings; the caller is
    responsible for validating the ids belong to the user's own folders.
    """
    prefs = await db.get(CodexPreferences, user_id)
    stored = [str(fid) for fid in excluded_folder_ids]
    if prefs is None:
        prefs = CodexPreferences(user_id=user_id, excluded_folder_ids=stored)
        db.add(prefs)
    else:
        prefs.excluded_folder_ids = stored
    await db.flush()
    await db.refresh(prefs)
    return prefs


async def get_excluded_feed_ids(db: AsyncSession, user_id: UUID) -> set[UUID]:
    """Resolve the user's excluded-folder preference to the concrete feed ids to drop from the
    digest catalog. Empty set when the user has no preferences row or has excluded nothing.
    """
    prefs = await db.get(CodexPreferences, user_id)
    if not prefs or not prefs.excluded_folder_ids:
        return set()

    excluded_folder_ids = [UUID(fid) for fid in prefs.excluded_folder_ids]
    result = await db.execute(
        select(FeedSubscription.feed_id).where(
            FeedSubscription.user_id == user_id,
            FeedSubscription.folder_id.in_(excluded_folder_ids),
        )
    )
    return {row[0] for row in result.all()}
