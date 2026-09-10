"""Codex Digest Phase 0 (gather/cap/dedupe/catalog) and Phase 1.5 (full-text fetch).

No LLM calls happen in this module - it's the CRUD read, the Python-side capping/dedupe pass,
and the bounded full-text fetch fan-out that feeds Phase 2.
"""

import asyncio
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    CODEX_FULLTEXT_CHAR_CAP,
    CODEX_FULLTEXT_FETCH_CONCURRENCY,
    CODEX_GATHER_PAGE_SIZE,
    CODEX_INGEST_WINDOW_HOURS,
    CODEX_MAX_ARTICLES,
    CODEX_MAX_PER_FEED,
    CODEX_SNIPPET_CHAR_CAP,
)
from app.crud.article.reader import CursorPaginationParams, get_articles
from app.services.articles.scrape import extract_full_content
from app.typing.entries import EntryListItem

logger = structlog.get_logger(__name__)


@dataclass
class GatherResult:
    """Output of Phase 0: the catalog Phase 1 reads, plus the raw items for later resolution."""

    catalog: list[dict[str, Any]] = field(default_factory=list)
    items_by_id: dict[int, EntryListItem] = field(default_factory=dict)
    total_articles: int = 0
    total_sources: int = 0


def _normalize_title(title: str | None) -> str:
    """Lowercase, collapse whitespace, strip surrounding punctuation - for dedupe only."""
    if not title:
        return ""
    normalized = re.sub(r"\s+", " ", title.strip().lower())
    return normalized.strip(".,;:!?\"'“”‘’-–—")


def _relative_age(published_at: datetime, now: datetime) -> str:
    """Render a short relative-age string, e.g. '2h', '3d'."""
    delta = now - published_at
    seconds = max(int(delta.total_seconds()), 0)
    if seconds < 3600:
        return f"{max(seconds // 60, 1)}m"
    if seconds < 86400:
        return f"{seconds // 3600}h"
    return f"{seconds // 86400}d"


async def gather_catalog(db: AsyncSession, user_id: UUID, *, now: datetime | None = None) -> GatherResult:
    """Phase 0: pull the last CODEX_INGEST_WINDOW_HOURS of published articles, cap and dedupe,
    and build the thin catalog Phase 1 reads.

    Deliberately does NOT filter by is_read - Codex covers everything published in the window,
    read or not. It's a digest of the day's coverage, not just an unread inbox.

    Calls get_articles directly (not through the router) so the full 24h window applies
    regardless of the Basic-tier sync cutoff.
    """
    now = now or datetime.now(timezone.utc)
    window_start = now - timedelta(hours=CODEX_INGEST_WINDOW_HOURS)

    raw_items: list[EntryListItem] = []
    cursor: str | None = None
    while len(raw_items) < CODEX_MAX_ARTICLES:
        page = await get_articles(
            db,
            user_id,
            CursorPaginationParams(limit=CODEX_GATHER_PAGE_SIZE, cursor=cursor),
            published_since=window_start,
            published_until=now,
            load_full_content=False,
        )
        raw_items.extend(EntryListItem.model_validate(item) for item in page.items)
        if not page.has_more or not page.next_cursor:
            break
        cursor = page.next_cursor

    survivors = _cap_and_dedupe(raw_items)

    catalog: list[dict[str, Any]] = []
    items_by_id: dict[int, EntryListItem] = {}
    sources: set[str] = set()

    for idx, item in enumerate(survivors, start=1):
        items_by_id[idx] = item
        source = item.feed_title or "Unknown source"
        sources.add(source)
        published_at = item.published_at or item.created_at
        snippet = (item.description or "")[:CODEX_SNIPPET_CHAR_CAP]
        catalog.append(
            {
                "id": idx,
                "source": source,
                "age": _relative_age(published_at, now),
                "published_at": published_at.isoformat(),
                "title": item.title or "(untitled)",
                "snippet": snippet,
            }
        )

    return GatherResult(
        catalog=catalog,
        items_by_id=items_by_id,
        total_articles=len(survivors),
        total_sources=len(sources),
    )


def _cap_and_dedupe(items: list[EntryListItem]) -> list[EntryListItem]:
    """Per-feed cap, title dedupe (keep earliest), then a global cap on most-recent survivors."""
    # Per-feed cap: keep at most CODEX_MAX_PER_FEED most-recent rows per feed_id.
    items_sorted_by_recency = sorted(items, key=lambda i: i.published_at or i.created_at, reverse=True)
    per_feed_counts: dict[UUID | None, int] = {}
    feed_capped: list[EntryListItem] = []
    for item in items_sorted_by_recency:
        count = per_feed_counts.get(item.feed_id, 0)
        if count >= CODEX_MAX_PER_FEED:
            continue
        per_feed_counts[item.feed_id] = count + 1
        feed_capped.append(item)

    # Title dedupe: normalize, drop exact matches, keep the earliest-published copy.
    by_title: dict[str, EntryListItem] = {}
    for item in feed_capped:
        key = _normalize_title(item.title)
        if not key:
            # No title to dedupe on - keep it, keyed uniquely by id/link.
            by_title[f"__untitled__:{item.id}"] = item
            continue
        existing = by_title.get(key)
        if existing is None:
            by_title[key] = item
            continue
        existing_published = existing.published_at or existing.created_at
        candidate_published = item.published_at or item.created_at
        if candidate_published < existing_published:
            by_title[key] = item

    deduped = list(by_title.values())
    deduped.sort(key=lambda i: i.published_at or i.created_at, reverse=True)

    return deduped[:CODEX_MAX_ARTICLES]


async def fetch_full_texts(
    items: list[EntryListItem],
) -> dict[UUID, str]:
    """Phase 1.5: fetch full body text for the given items, bounded by a semaphore.

    On extraction failure/timeout, falls back to the feed's own content, then description.
    Truncates each body to CODEX_FULLTEXT_CHAR_CAP.
    """
    semaphore = asyncio.Semaphore(CODEX_FULLTEXT_FETCH_CONCURRENCY)
    results: dict[UUID, str] = {}

    async def _fetch_one(item: EntryListItem) -> None:
        async with semaphore:
            content, error = await extract_full_content(item.link, item.title, item.image_url)
            if error or not content:
                # EntryListItem never carries body content (list view omits it) - the only
                # fallback available here is the feed's own description/snippet.
                logger.info(
                    "Codex full-text fetch fell back",
                    article_id=str(item.id),
                    error=error,
                )
                content = item.description or ""
            results[item.id] = content[:CODEX_FULLTEXT_CHAR_CAP]

    await asyncio.gather(*(_fetch_one(item) for item in items))
    return results
