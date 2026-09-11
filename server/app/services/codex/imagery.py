"""Codex Digest development-card imagery selection.

The client renders exactly the imagery the payload names — no client-side image measuring.
This module probes each cited article's `image_url` (a bounded ranged GET, header parsed with
Pillow's incremental parser, no full download) and picks a hero image plus a small strip from
what's actually large enough, in article-strength order.

Everything here is best-effort: any probe that fails, times out, or comes back too small is
simply skipped. A development with no usable image gets `hero_image_url=None` and an empty
strip, and the card falls back to its text-first layout.
"""

import asyncio
from dataclasses import dataclass, field

import httpx
import structlog
from PIL import ImageFile, UnidentifiedImageError

from app.core.constants import (
    CODEX_HERO_MIN_RATIO,
    CODEX_HERO_MIN_WIDTH,
    CODEX_IMAGE_PROBE_BYTES,
    CODEX_IMAGE_PROBE_CONCURRENCY,
    CODEX_IMAGE_PROBE_TIMEOUT,
    CODEX_MAX_IMAGE_PROBES,
    CODEX_MAX_STRIP_IMAGES,
    CODEX_STRIP_MIN_WIDTH,
)
from app.typing.entries import EntryListItem

logger = structlog.get_logger(__name__)


@dataclass
class DevelopmentImagery:
    """The imagery chosen for one development card."""

    hero_url: str | None = None
    strip_urls: list[str] = field(default_factory=list)


@dataclass
class _ProbedImage:
    url: str
    width: int
    height: int

    @property
    def ratio(self) -> float:
        return self.width / self.height if self.height else 0.0


async def _probe_one(client: httpx.AsyncClient, url: str, sem: asyncio.Semaphore) -> _ProbedImage | None:
    """Fetch just enough of `url` to read its pixel dimensions. None on any failure.

    Streams the response and stops after CODEX_IMAGE_PROBE_BYTES so a server that ignores the
    Range header can't make us download a full-size image. The header of every common format
    (JPEG/PNG/WebP/GIF) fits well inside that window.
    """
    async with sem:
        try:
            headers = {"Range": f"bytes=0-{CODEX_IMAGE_PROBE_BYTES - 1}"}
            async with client.stream("GET", url, headers=headers, timeout=CODEX_IMAGE_PROBE_TIMEOUT) as resp:
                resp.raise_for_status()
                content_type = resp.headers.get("content-type", "")
                if content_type and not content_type.startswith("image/"):
                    return None

                parser = ImageFile.Parser()
                read = 0
                async for chunk in resp.aiter_bytes():
                    parser.feed(chunk)
                    read += len(chunk)
                    if parser.image is not None or read >= CODEX_IMAGE_PROBE_BYTES:
                        break

            if parser.image is None:
                return None
            width, height = parser.image.size
            if width <= 0 or height <= 0:
                return None
            return _ProbedImage(url=url, width=width, height=height)
        except (httpx.HTTPError, UnidentifiedImageError, OSError, ValueError) as e:
            logger.debug("Codex image probe failed", url=url, error=str(e))
            return None


def _dedupe_urls(articles: list[EntryListItem]) -> list[str]:
    """Candidate image URLs in article (strength) order, de-duped and capped at the most we
    could render (1 hero + the strip cap) — probing past that is wasted work."""
    seen: set[str] = set()
    out: list[str] = []
    for a in articles:
        if a.image_url and a.image_url not in seen:
            seen.add(a.image_url)
            out.append(a.image_url)
            if len(out) >= CODEX_MAX_IMAGE_PROBES:
                break
    return out


def _choose(candidates: list[str], probed: dict[str, _ProbedImage]) -> DevelopmentImagery:
    """Pick hero + strip from the successfully-probed images, keeping candidate order."""
    usable = [probed[url] for url in candidates if url in probed]
    if not usable:
        return DevelopmentImagery()

    hero = next(
        (img for img in usable if img.width >= CODEX_HERO_MIN_WIDTH and img.ratio >= CODEX_HERO_MIN_RATIO),
        None,
    )
    strip = [
        img.url for img in usable if img.url != (hero.url if hero else None) and img.width >= CODEX_STRIP_MIN_WIDTH
    ][:CODEX_MAX_STRIP_IMAGES]

    # A lone strip image reads better as a text-only card than a single orphaned tile.
    if not hero and len(strip) < 2:
        return DevelopmentImagery()

    return DevelopmentImagery(hero_url=hero.url if hero else None, strip_urls=strip)


async def select_development_imagery(articles: list[EntryListItem]) -> DevelopmentImagery:
    """Probe one development's article images and return the hero + strip to render."""
    candidates = _dedupe_urls(articles)
    if not candidates:
        return DevelopmentImagery()

    sem = asyncio.Semaphore(CODEX_IMAGE_PROBE_CONCURRENCY)
    async with httpx.AsyncClient(follow_redirects=True) as client:
        results = await asyncio.gather(*(_probe_one(client, url, sem) for url in candidates))

    probed = {img.url: img for img in results if img is not None}
    return _choose(candidates, probed)
