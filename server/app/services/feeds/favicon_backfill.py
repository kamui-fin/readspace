"""One-off migration of stored favicons to normalized PNGs.

Legacy objects in the ``favicons`` bucket are a mix of ``ns0:``-prefixed SVGs, ICO/WebP/GIF/AVIF/BMP
files, raster bytes mislabeled as SVG or text, oversized images and generated grey placeholder
boxes. Stored MIME types are unreliable (the dataset importer labeled ~everything ``image/jpeg``),
so every decision is made from the real bytes. For each stored key referenced by a feed:

* generated placeholder            -> ``feeds.image_url = NULL`` (clients render their own fallback)
* PNG/JPEG within FAVICON_MAX_PX   -> left alone (already renders everywhere), unless mislabeled SVG/text
* anything else that decodes       -> new ``<uuid>.png`` upload, feeds repointed, old object removed
* undecodable / missing            -> left untouched and reported

The run is idempotent and resumable: its own output is a small PNG, which is skipped next time.
"""

import asyncio
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import UUID

import structlog
from sqlalchemy import select, text, update
from supabase import AsyncClient

from app.core.config import get_settings
from app.core.constants import (
    FAVICON_BACKFILL_CONCURRENCY,
    FAVICON_BACKFILL_SYNC_BATCH,
    FAVICON_ORPHAN_GRACE_HOURS,
    FAVICON_STORAGE_LIST_PAGE,
    FAVICONS_BUCKET_NAME,
)
from app.models.feed import Feed
from app.services.feeds.favicon import _get_async_supabase, put_favicon_png
from app.services.feeds.favicon_image import (
    ImageKind,
    is_already_normalized,
    is_generated_placeholder,
    normalize_favicon_to_png,
    sniff_image_kind,
)
from app.services.feeds.meilisearch import sync_feeds_batch
from app.workers.common import worker_db

logger = structlog.get_logger(__name__)

_PUBLIC_PREFIX = f"storage/v1/object/public/{FAVICONS_BUCKET_NAME}/"
# Stored MIME types that mean "not a usable raster label" when the bytes are actually raster.
_MISLABELED_RASTER_MIMETYPES = frozenset({"image/svg+xml", "image/svg", "text/plain"})


@dataclass
class BackfillStats:
    """Counters describing what a backfill run did (or would do in a dry run)."""

    converted: int = 0
    unchanged: int = 0
    nulled: int = 0
    dangling: int = 0
    skipped_unusable: int = 0
    failed: int = 0
    bytes_before: int = 0
    bytes_after: int = 0
    changed_feed_ids: set[UUID] = field(default_factory=set)


def storage_key_from_image_url(image_url: str) -> str | None:
    """
    Extract the bucket object key from a stored ``feeds.image_url`` value.

    The column is mixed-mode: a bare key, a key with the public-URL path prefix (possibly
    doubled), or an absolute remote URL. Only the first two refer to our bucket.

    Args:
        image_url: Raw column value

    Returns:
        The object key, or None if the value is not a stored favicon
    """
    if image_url.startswith(("http://", "https://", "data:")):
        return None
    key = image_url.lstrip("/")
    while key.startswith(_PUBLIC_PREFIX):
        key = key[len(_PUBLIC_PREFIX) :]
    return key or None


async def _load_stored_mimetypes() -> dict[str, str]:
    """Map every object name in the favicons bucket to its stored MIME type."""
    async with worker_db() as db:
        rows = await db.execute(
            text("SELECT name, metadata->>'mimetype' FROM storage.objects WHERE bucket_id = :bucket"),
            {"bucket": FAVICONS_BUCKET_NAME},
        )
    return {name: mimetype or "" for name, mimetype in rows.all()}


async def _load_keys_to_feed_ids(keys: set[str] | None, limit: int | None) -> dict[str, list[UUID]]:
    """Group feed ids by the storage key their ``image_url`` points at."""
    async with worker_db() as db:
        rows = (await db.execute(select(Feed.id, Feed.image_url).where(Feed.image_url.is_not(None)))).all()

    grouped: dict[str, list[UUID]] = defaultdict(list)
    for feed_id, image_url in rows:
        key = storage_key_from_image_url(image_url)
        if key is None or (keys is not None and key not in keys):
            continue
        grouped[key].append(feed_id)

    selected = dict(list(grouped.items())[:limit]) if limit else dict(grouped)
    logger.info("favicon_backfill_candidates", keys=len(selected), feeds=sum(len(v) for v in selected.values()))
    return selected


async def _set_feed_image_url(feed_ids: list[UUID], image_url: str | None) -> None:
    """Point every listed feed at ``image_url`` (or NULL)."""
    async with worker_db() as db:
        await db.execute(update(Feed).where(Feed.id.in_(feed_ids)).values(image_url=image_url))


def _is_not_found(error: Exception) -> bool:
    """True if a storage error is a definitive 404 (as opposed to a transient failure)."""
    return "not_found" in str(error) or "404" in str(error)


async def _process_key(
    supabase: AsyncClient,
    key: str,
    feed_ids: list[UUID],
    stored_mimetype: str,
    stats: BackfillStats,
    semaphore: asyncio.Semaphore,
    dry_run: bool,
) -> None:
    """Migrate one storage key and every feed that references it."""
    async with semaphore:
        try:
            original = await supabase.storage.from_(FAVICONS_BUCKET_NAME).download(key)
        except Exception as e:
            if _is_not_found(e):
                # Dangling reference: the object is gone, so clients can only ever show a broken image.
                logger.warning("favicon_backfill_dangling_reference", key=key)
                if not dry_run:
                    await _set_feed_image_url(feed_ids, None)
                stats.dangling += 1
                stats.changed_feed_ids.update(feed_ids)
                return
            logger.warning("favicon_backfill_download_failed", key=key, error=str(e))
            stats.failed += 1
            return

        stats.bytes_before += len(original)

        if is_generated_placeholder(original):
            if not dry_run:
                await _set_feed_image_url(feed_ids, None)
                await supabase.storage.from_(FAVICONS_BUCKET_NAME).remove([key])
            stats.nulled += 1
            stats.changed_feed_ids.update(feed_ids)
            return

        mislabeled = stored_mimetype in _MISLABELED_RASTER_MIMETYPES and sniff_image_kind(original) != ImageKind.SVG
        if not mislabeled and is_already_normalized(original):
            stats.unchanged += 1
            return

        png = await asyncio.to_thread(normalize_favicon_to_png, original)
        if png is None:
            logger.warning("favicon_backfill_unusable", key=key, size=len(original))
            stats.skipped_unusable += 1
            return

        stats.bytes_after += len(png)
        if not dry_run:
            try:
                new_key = await put_favicon_png(supabase, png)
                await _set_feed_image_url(feed_ids, new_key)
                # Remove the old object only after feeds point at the new one.
                await supabase.storage.from_(FAVICONS_BUCKET_NAME).remove([key])
            except Exception as e:
                logger.error("favicon_backfill_write_failed", key=key, error=str(e))
                stats.failed += 1
                return
        stats.converted += 1
        stats.changed_feed_ids.update(feed_ids)


async def _resync_meilisearch(feed_ids: set[UUID]) -> None:
    """Push the new ``image_url`` values into the Meilisearch discovery index."""
    settings = get_settings()
    ids = list(feed_ids)
    for start in range(0, len(ids), FAVICON_BACKFILL_SYNC_BATCH):
        chunk = ids[start : start + FAVICON_BACKFILL_SYNC_BATCH]
        async with worker_db() as db:
            feeds = (await db.execute(select(Feed).where(Feed.id.in_(chunk)))).scalars().all()
        await sync_feeds_batch(settings, feeds)


async def backfill_favicons(
    dry_run: bool = True, limit: int | None = None, keys: set[str] | None = None
) -> BackfillStats:
    """
    Normalize every stored favicon to a bounded PNG and null out generated placeholders.

    Args:
        dry_run: When True, download and evaluate everything but write nothing
        limit: Process at most this many distinct storage keys
        keys: Restrict the run to these storage keys (targeted re-runs and tests)

    Returns:
        Counters describing the outcome
    """
    stats = BackfillStats()
    candidates = await _load_keys_to_feed_ids(keys, limit)
    mimetypes = await _load_stored_mimetypes()
    supabase = await _get_async_supabase()
    semaphore = asyncio.Semaphore(FAVICON_BACKFILL_CONCURRENCY)

    await asyncio.gather(
        *(
            _process_key(supabase, k, ids, mimetypes.get(k, ""), stats, semaphore, dry_run)
            for k, ids in candidates.items()
        )
    )

    if not dry_run and stats.changed_feed_ids:
        await _resync_meilisearch(stats.changed_feed_ids)

    logger.info(
        "favicon_backfill_complete",
        dry_run=dry_run,
        converted=stats.converted,
        unchanged=stats.unchanged,
        nulled=stats.nulled,
        dangling=stats.dangling,
        skipped_unusable=stats.skipped_unusable,
        failed=stats.failed,
        bytes_before=stats.bytes_before,
        bytes_after=stats.bytes_after,
    )
    return stats


async def _list_bucket_objects(supabase: AsyncClient) -> list[dict[str, str]]:
    """Page through every object in the (flat) favicons bucket."""
    objects: list[dict[str, str]] = []
    while True:
        page = await supabase.storage.from_(FAVICONS_BUCKET_NAME).list(
            options={
                "limit": FAVICON_STORAGE_LIST_PAGE,
                "offset": len(objects),
                "sortBy": {"column": "name", "order": "asc"},
            }
        )
        objects.extend(page)
        if len(page) < FAVICON_STORAGE_LIST_PAGE:
            return objects


def _is_older_than_grace(created_at: str | None, now: datetime) -> bool:
    """True if the object is old enough that no in-flight upload can still need it."""
    if not created_at:
        return False  # Unknown age: keep it
    created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    return now - created > timedelta(hours=FAVICON_ORPHAN_GRACE_HOURS)


async def sweep_orphan_favicons(dry_run: bool = True) -> int:
    """
    Delete bucket objects that no feed references.

    Every favicon refetch uploads a fresh ``<uuid>`` key without removing the old one, and the
    original dataset seed left placeholder boxes behind, so unreferenced objects accumulate.
    Objects younger than FAVICON_ORPHAN_GRACE_HOURS are kept: the worker uploads before it
    updates ``feeds.image_url``, so a brand-new object may be about to be referenced.

    Args:
        dry_run: When True, only count what would be deleted

    Returns:
        Number of orphaned objects found (deleted unless dry_run)
    """
    async with worker_db() as db:
        image_urls = (await db.execute(select(Feed.image_url).where(Feed.image_url.is_not(None)))).scalars().all()
    referenced = {key for url in image_urls if (key := storage_key_from_image_url(url))}

    supabase = await _get_async_supabase()
    now = datetime.now(UTC)
    objects = await _list_bucket_objects(supabase)
    orphans = [
        o["name"]
        for o in objects
        if o.get("name") and o["name"] not in referenced and _is_older_than_grace(o.get("created_at"), now)
    ]

    if not dry_run:
        for start in range(0, len(orphans), FAVICON_STORAGE_LIST_PAGE):
            await supabase.storage.from_(FAVICONS_BUCKET_NAME).remove(
                orphans[start : start + FAVICON_STORAGE_LIST_PAGE]
            )

    logger.info(
        "favicon_orphan_sweep_complete",
        dry_run=dry_run,
        bucket_objects=len(objects),
        referenced_keys=len(referenced),
        orphans=len(orphans),
    )
    return len(orphans)
