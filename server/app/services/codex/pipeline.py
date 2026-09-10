"""Codex Digest pipeline orchestration - one user_id in, one codex_digests row out.

Short DB sessions for gather + finalize; LLM and full-text fetch work happen outside any
transaction, matching the design doc's guidance for a worker task that may run for minutes.
"""

import asyncio
import json
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import structlog

from app.core.config import get_settings
from app.core.constants import (
    CODEX_ASSUMED_WORDS_PER_ARTICLE,
    CODEX_INGEST_WINDOW_HOURS,
    CODEX_MAX_ARTICLES_PER_DEVELOPMENT_DISPLAY,
    CODEX_MAX_ARTICLES_PER_DEVELOPMENT_FULLTEXT,
    CODEX_MAX_DAY_THEMES,
    CODEX_MAX_DEVELOPMENTS,
    CODEX_MAX_MINUTES_CONDENSED,
    CODEX_MAX_WORTH_READING,
    CODEX_MAX_WORTH_READING_FALLBACK,
    CODEX_READING_WPM,
)
from app.crud import codex as crud_codex
from app.models.enums import CodexDigestPhase, CodexDigestStatus
from app.services.ai.codex import CodexGenerationError, run_codex_synthesis, run_codex_triage
from app.services.codex.gather import fetch_full_texts, gather_catalog
from app.services.codex.imagery import select_development_imagery
from app.services.codex.serialize import render_catalog_toon
from app.typing.codex import (
    CodexCluster,
    CodexDevelopmentResolved,
    CodexDigestPayload,
    CodexDigestStats,
    CodexSynthesisOutput,
    CodexTriageOutput,
    CodexWorthReadingResolved,
)
from app.typing.entries import EntryListItem
from app.workers.common import worker_db

logger = structlog.get_logger(__name__)


async def generate_digest_for_user(user_id: UUID, digest_id: UUID) -> None:
    """Run the full pipeline for one user and finalize the given (already-PENDING) digest row.

    Never raises on expected failure modes - always finalizes the row (COMPLETED / FAILED /
    SKIPPED). Only re-raises on an unexpected error so the one Taskiq retry can kick in, in
    which case the row is left FAILED first.
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    log = logger.bind(user_id=str(user_id), digest_id=str(digest_id))

    if not settings.ENABLE_AI:
        async with worker_db() as db:
            await crud_codex.finalize_digest(db, digest_id, CodexDigestStatus.SKIPPED, error="AI is disabled")
        log.info("Codex digest skipped - AI disabled")
        return

    try:
        async with worker_db() as db:
            await crud_codex.mark_in_progress(db, digest_id, CodexDigestPhase.GATHERING)

        async with worker_db() as db:
            excluded_feed_ids = await crud_codex.get_excluded_feed_ids(db, user_id)
            gathered = await gather_catalog(db, user_id, now=now, excluded_feed_ids=excluded_feed_ids)

        if not gathered.catalog:
            async with worker_db() as db:
                await crud_codex.finalize_digest(
                    db,
                    digest_id,
                    CodexDigestStatus.SKIPPED,
                    input_article_count=0,
                    input_source_count=0,
                    window_hours=CODEX_INGEST_WINDOW_HOURS,
                )
            log.info("Codex digest skipped - no candidate articles")
            return

        async with worker_db() as db:
            await crud_codex.set_progress_phase(db, digest_id, CodexDigestPhase.TRIAGING)

        triage_prompt = render_catalog_toon(
            gathered.catalog,
            {"total_articles": gathered.total_articles, "total_sources": gathered.total_sources},
        )
        triage = await run_codex_triage(triage_prompt)

        clusters = sorted(triage.clusters, key=lambda c: c.source_count, reverse=True)
        clusters_found = len(clusters)
        top_clusters = clusters[:CODEX_MAX_DEVELOPMENTS]

        worth_reading_cap = CODEX_MAX_WORTH_READING if top_clusters else CODEX_MAX_WORTH_READING_FALLBACK
        worth_reading_ids = triage.worth_reading_ids[:worth_reading_cap]

        fulltext_targets: dict[int, EntryListItem] = {}
        for cluster in top_clusters:
            for cid in cluster.article_ids[:CODEX_MAX_ARTICLES_PER_DEVELOPMENT_FULLTEXT]:
                if cid in gathered.items_by_id:
                    fulltext_targets[cid] = gathered.items_by_id[cid]
        for wid in worth_reading_ids:
            if wid in gathered.items_by_id:
                fulltext_targets[wid] = gathered.items_by_id[wid]

        async with worker_db() as db:
            await crud_codex.set_progress_phase(db, digest_id, CodexDigestPhase.READING)

        full_texts = await fetch_full_texts(list(fulltext_targets.values()))
        full_text_by_catalog_id = {
            cid: full_texts.get(item.id, item.description or "") for cid, item in fulltext_targets.items()
        }

        async with worker_db() as db:
            await crud_codex.set_progress_phase(db, digest_id, CodexDigestPhase.SYNTHESIZING)

        synthesis_prompt = _build_synthesis_prompt(
            triage=triage,
            top_clusters=top_clusters,
            worth_reading_ids=worth_reading_ids,
            gathered_items=gathered.items_by_id,
            full_text_by_catalog_id=full_text_by_catalog_id,
        )
        synthesis = await run_codex_synthesis(synthesis_prompt)

        payload = _resolve_payload(
            triage=triage,
            synthesis=synthesis,
            items_by_id=gathered.items_by_id,
            full_text_by_catalog_id=full_text_by_catalog_id,
        )
        await _attach_development_imagery(payload)

        async with worker_db() as db:
            await crud_codex.finalize_digest(
                db,
                digest_id,
                CodexDigestStatus.COMPLETED,
                payload=payload,
                model=settings.GEMINI_SMART_MODEL,
                window_hours=CODEX_INGEST_WINDOW_HOURS,
                input_article_count=gathered.total_articles,
                input_source_count=gathered.total_sources,
                clusters_found=clusters_found,
            )
        log.info(
            "Codex digest completed",
            input_article_count=gathered.total_articles,
            clusters_found=clusters_found,
            developments_shown=len(payload["developments"]),
        )

    except CodexGenerationError as e:
        log.warning("Codex digest failed - generation error", error=str(e))
        async with worker_db() as db:
            await crud_codex.finalize_digest(db, digest_id, CodexDigestStatus.FAILED, error=str(e))
    except Exception as e:
        log.error("Codex digest failed - unexpected error", error=str(e), exc_info=True)
        async with worker_db() as db:
            await crud_codex.finalize_digest(db, digest_id, CodexDigestStatus.FAILED, error=str(e))
        raise


def _build_synthesis_prompt(
    *,
    triage: CodexTriageOutput,
    top_clusters: list[CodexCluster],
    worth_reading_ids: list[int],
    gathered_items: dict[int, EntryListItem],
    full_text_by_catalog_id: dict[int, str],
) -> str:
    """Build the (nested, JSON) Phase 2 input framing."""
    clusters_payload = []
    for cluster in top_clusters:
        articles_payload = []
        for cid in cluster.article_ids[:CODEX_MAX_ARTICLES_PER_DEVELOPMENT_FULLTEXT]:
            item = gathered_items.get(cid)
            if not item:
                continue
            articles_payload.append(
                {
                    "id": cid,
                    "source": item.feed_title or "Unknown source",
                    "title": item.title,
                    "body": full_text_by_catalog_id.get(cid, item.description or ""),
                }
            )
        clusters_payload.append(
            {
                "label": cluster.label,
                "source_count": cluster.source_count,
                "article_count": cluster.article_count,
                "display_cap": CODEX_MAX_ARTICLES_PER_DEVELOPMENT_DISPLAY,
                "articles": articles_payload,
            }
        )

    worth_reading_payload = []
    for wid in worth_reading_ids:
        item = gathered_items.get(wid)
        if not item:
            continue
        worth_reading_payload.append(
            {
                "id": wid,
                "source": item.feed_title or "Unknown source",
                "title": item.title,
                "body": full_text_by_catalog_id.get(wid, item.description or ""),
            }
        )

    return json.dumps(
        {
            "headline": triage.headline,
            "gist": triage.gist,
            "clusters_found": len(triage.clusters),
            "developments_shown": len(top_clusters),
            "clusters": clusters_payload,
            "worth_reading": worth_reading_payload,
        },
        ensure_ascii=False,
    )


def _resolve_payload(
    *,
    triage: CodexTriageOutput,
    synthesis: CodexSynthesisOutput,
    items_by_id: dict[int, EntryListItem],
    full_text_by_catalog_id: dict[int, str],
) -> dict[str, Any]:
    """Resolve every catalog id in the Phase 2 output back to its EntryListItem, and build the
    self-contained JSON payload (no ids left for a future reader to resolve). Development
    imagery (`hero_image_url` / `strip_image_urls`) is filled in separately, in place, by
    _attach_development_imagery.
    """
    developments: list[CodexDevelopmentResolved] = []
    condensed_ids: list[int] = []
    for dev in synthesis.developments:
        dev_ids = [cid for cid in dev.article_ids[:CODEX_MAX_ARTICLES_PER_DEVELOPMENT_DISPLAY] if cid in items_by_id]
        if not dev_ids:
            continue
        condensed_ids.extend(dev_ids)
        developments.append(
            CodexDevelopmentResolved(
                title=dev.title,
                synthesis=dev.synthesis,
                source_count=dev.source_count,
                article_count=dev.article_count,
                articles=[items_by_id[cid] for cid in dev_ids],
            )
        )

    worth_reading: list[CodexWorthReadingResolved] = []
    for wr in synthesis.worth_reading:
        item = items_by_id.get(wr.article_id)
        if not item:
            continue
        worth_reading.append(CodexWorthReadingResolved(article=item, reason=wr.reason))

    payload = CodexDigestPayload(
        headline=triage.headline,
        gist=triage.gist,
        scale_setter=synthesis.scale_setter,
        developments=developments,
        worth_reading=worth_reading,
        closing_line=synthesis.closing_line,
        themes=[t.strip() for t in triage.themes if t.strip()][:CODEX_MAX_DAY_THEMES],
        stats=_reading_time_stats(condensed_ids, full_text_by_catalog_id),
    )
    result: dict[str, Any] = json.loads(payload.model_dump_json())
    return result


async def _attach_development_imagery(payload: dict[str, Any]) -> None:
    """Probe each development's article images and fill in its `hero_image_url` /
    `strip_image_urls` on the resolved payload dict, in place.

    Best-effort — a development whose images can't be probed (or aren't large enough) keeps a
    `None` hero and empty strip, and the card renders text-first. Developments are probed
    concurrently; the probe fan-out within each is bounded internally.
    """
    developments: list[dict[str, Any]] = payload.get("developments") or []
    if not developments:
        return

    article_lists = [[EntryListItem.model_validate(a) for a in dev.get("articles", [])] for dev in developments]
    results = await asyncio.gather(
        *(select_development_imagery(articles) for articles in article_lists),
        return_exceptions=True,
    )
    for dev, imagery in zip(developments, results, strict=True):
        if isinstance(imagery, BaseException):
            logger.warning("Codex imagery selection failed for development", title=dev.get("title"), error=str(imagery))
            dev.setdefault("hero_image_url", None)
            dev.setdefault("strip_image_urls", [])
            continue
        dev["hero_image_url"] = imagery.hero_url
        dev["strip_image_urls"] = imagery.strip_urls


def _reading_time_stats(
    condensed_ids: list[int],
    full_text_by_catalog_id: dict[int, str],
) -> CodexDigestStats | None:
    """Estimate how long the Development source articles would have taken to read.

    A fetched full text gives a real word count; anything cited but not fetched (articles
    past the full-text cap) falls back to CODEX_ASSUMED_WORDS_PER_ARTICLE. Worth Reading is
    excluded on purpose — the reader is still expected to read those.
    """
    if not condensed_ids:
        return None

    total_words = 0
    for cid in condensed_ids:
        body = full_text_by_catalog_id.get(cid, "")
        total_words += len(body.split()) if body else CODEX_ASSUMED_WORDS_PER_ARTICLE

    minutes = round(total_words / CODEX_READING_WPM)
    capped = minutes > CODEX_MAX_MINUTES_CONDENSED
    return CodexDigestStats(
        minutes_condensed=min(minutes, CODEX_MAX_MINUTES_CONDENSED),
        articles_condensed=len(condensed_ids),
        minutes_capped=capped,
    )
