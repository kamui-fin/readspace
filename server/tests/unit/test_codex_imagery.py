"""Tests for Codex Digest development-card imagery selection.

`_choose` / `_dedupe_urls` are pure. `_probe_one`, `select_development_imagery`, and
`_attach_development_imagery` are exercised against an in-memory httpx.MockTransport (real
Pillow parsing of generated image bytes, no real network, no DB).
"""

import asyncio
import io
from datetime import datetime, timezone

import httpx
import pytest
from PIL import Image

from app.core.constants import (
    CODEX_HERO_MIN_RATIO,
    CODEX_HERO_MIN_WIDTH,
    CODEX_IMAGE_PROBE_BYTES,
    CODEX_MAX_IMAGE_PROBES,
    CODEX_MAX_STRIP_IMAGES,
    CODEX_STRIP_MIN_WIDTH,
)
from app.services.codex import imagery as imagery_module
from app.services.codex.imagery import (
    DevelopmentImagery,
    _choose,
    _dedupe_urls,
    _probe_one,
    _ProbedImage,
    select_development_imagery,
)
from app.services.codex.pipeline import _attach_development_imagery
from app.typing.entries import EntryListItem

pytestmark = pytest.mark.unit


# Captured before any test monkeypatches `httpx.AsyncClient`, so `_mock_client` can still
# build a real one even inside a test that has patched the name.
_RealAsyncClient = httpx.AsyncClient


def _img_bytes(width: int, height: int, fmt: str = "JPEG") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), (12, 34, 56)).save(buf, format=fmt)
    return buf.getvalue()


def _mock_client(routes: dict[str, object]) -> httpx.AsyncClient:
    """An AsyncClient whose responses come from `routes` (url -> bytes | Exception | int status)."""

    def handler(request: httpx.Request) -> httpx.Response:
        entry = routes.get(str(request.url))
        if entry is None:
            return httpx.Response(404)
        if isinstance(entry, Exception):
            raise entry
        if isinstance(entry, int):
            return httpx.Response(entry)
        return httpx.Response(200, content=entry, headers={"content-type": "image/jpeg"})

    return _RealAsyncClient(transport=httpx.MockTransport(handler))


def _item(catalog_id: int, image_url: str | None) -> EntryListItem:
    now = datetime.now(timezone.utc)
    return EntryListItem(
        id=f"00000000-0000-4000-8000-{catalog_id:012d}",
        title=f"Article {catalog_id}",
        link=f"https://example.com/{catalog_id}",
        created_at=now,
        published_at=now,
        image_url=image_url,
    )


def _article_dict(catalog_id: int, *, image_url: str | None, title: str = "Story") -> dict:
    """A JSON-shaped article as it sits in a resolved payload (EntryListItem.model_dump)."""
    return _item(catalog_id, image_url).model_dump(mode="json") | {"title": title}


def _wide(url: str) -> _ProbedImage:
    return _ProbedImage(url=url, width=CODEX_HERO_MIN_WIDTH + 200, height=720)


def _mid(url: str) -> _ProbedImage:
    return _ProbedImage(url=url, width=CODEX_STRIP_MIN_WIDTH + 50, height=300)


class TestDedupeUrls:
    def test_keeps_article_order_and_drops_dupes_and_nones(self):
        articles = [
            _item(1, "https://img/a.jpg"),
            _item(2, None),
            _item(3, "https://img/b.jpg"),
            _item(4, "https://img/a.jpg"),  # dupe of #1
        ]
        assert _dedupe_urls(articles) == ["https://img/a.jpg", "https://img/b.jpg"]

    def test_no_images_returns_empty(self):
        assert _dedupe_urls([_item(1, None), _item(2, None)]) == []

    def test_capped_at_max_probes(self):
        articles = [_item(i, f"https://img/{i}.jpg") for i in range(CODEX_MAX_IMAGE_PROBES + 4)]
        result = _dedupe_urls(articles)
        assert len(result) == CODEX_MAX_IMAGE_PROBES
        assert result == [f"https://img/{i}.jpg" for i in range(CODEX_MAX_IMAGE_PROBES)]


class TestChoose:
    def test_no_probed_images_is_text_only(self):
        assert _choose(["https://img/a.jpg"], {}) == DevelopmentImagery()

    def test_widest_qualifying_image_becomes_hero_in_candidate_order(self):
        candidates = ["https://img/a.jpg", "https://img/b.jpg"]
        probed = {"https://img/a.jpg": _wide("https://img/a.jpg"), "https://img/b.jpg": _wide("https://img/b.jpg")}
        result = _choose(candidates, probed)
        assert result.hero_url == "https://img/a.jpg"  # first qualifying, order preserved
        assert result.strip_urls == ["https://img/b.jpg"]

    def test_small_lead_image_is_skipped_and_a_later_wide_one_is_promoted(self):
        candidates = ["https://img/small.jpg", "https://img/wide.jpg"]
        probed = {
            "https://img/small.jpg": _ProbedImage(url="https://img/small.jpg", width=300, height=200),
            "https://img/wide.jpg": _wide("https://img/wide.jpg"),
        }
        result = _choose(candidates, probed)
        assert result.hero_url == "https://img/wide.jpg"
        # The sub-strip-width lead image isn't usable anywhere.
        assert result.strip_urls == []

    def test_portrait_image_is_rejected_for_hero(self):
        url = "https://img/portrait.jpg"
        tall = _ProbedImage(url=url, width=CODEX_HERO_MIN_WIDTH + 100, height=CODEX_HERO_MIN_WIDTH + 400)
        assert tall.ratio < CODEX_HERO_MIN_RATIO
        # Only one image, no hero possible -> text-only (a lone strip tile isn't shown).
        assert _choose([url], {url: tall}) == DevelopmentImagery()

    def test_mid_size_images_with_no_hero_form_a_strip(self):
        candidates = ["https://img/a.jpg", "https://img/b.jpg", "https://img/c.jpg"]
        probed = {c: _mid(c) for c in candidates}
        result = _choose(candidates, probed)
        assert result.hero_url is None
        assert result.strip_urls == candidates

    def test_single_mid_image_with_no_hero_is_text_only(self):
        url = "https://img/lonely.jpg"
        assert _choose([url], {url: _mid(url)}) == DevelopmentImagery()

    def test_strip_is_capped(self):
        candidates = [f"https://img/{i}.jpg" for i in range(CODEX_MAX_STRIP_IMAGES + 3)]
        probed = {c: _mid(c) for c in candidates}
        result = _choose(candidates, probed)
        assert len(result.strip_urls) == CODEX_MAX_STRIP_IMAGES

    def test_hero_excluded_from_its_own_strip(self):
        candidates = ["https://img/hero.jpg", "https://img/s1.jpg", "https://img/s2.jpg"]
        probed = {
            "https://img/hero.jpg": _wide("https://img/hero.jpg"),
            "https://img/s1.jpg": _mid("https://img/s1.jpg"),
            "https://img/s2.jpg": _mid("https://img/s2.jpg"),
        }
        result = _choose(candidates, probed)
        assert result.hero_url == "https://img/hero.jpg"
        assert "https://img/hero.jpg" not in result.strip_urls
        assert result.strip_urls == ["https://img/s1.jpg", "https://img/s2.jpg"]

    def test_unprobed_candidates_are_ignored(self):
        candidates = ["https://img/a.jpg", "https://img/failed.jpg", "https://img/b.jpg"]
        probed = {"https://img/a.jpg": _wide("https://img/a.jpg"), "https://img/b.jpg": _mid("https://img/b.jpg")}
        result = _choose(candidates, probed)
        assert result.hero_url == "https://img/a.jpg"
        assert result.strip_urls == ["https://img/b.jpg"]


@pytest.mark.asyncio
class TestProbeOne:
    async def test_reads_dimensions_from_a_real_jpeg(self):
        url = "https://cdn.test/big.jpg"
        async with _mock_client({url: _img_bytes(1400, 800)}) as client:
            probed = await _probe_one(client, url, asyncio.Semaphore(1))
        assert probed is not None
        assert (probed.width, probed.height) == (1400, 800)

    async def test_non_image_content_type_is_rejected(self):
        url = "https://cdn.test/nope"

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, content=b"<html></html>", headers={"content-type": "text/html"})

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            assert await _probe_one(client, url, asyncio.Semaphore(1)) is None

    async def test_http_error_returns_none(self):
        url = "https://cdn.test/500"
        async with _mock_client({url: 500}) as client:
            assert await _probe_one(client, url, asyncio.Semaphore(1)) is None

    async def test_garbage_body_returns_none(self):
        url = "https://cdn.test/garbage.jpg"
        async with _mock_client({url: b"not an image at all"}) as client:
            assert await _probe_one(client, url, asyncio.Semaphore(1)) is None

    async def test_stops_reading_after_the_probe_byte_cap(self):
        # A server that ignores Range and streams a huge body: the parser has the header long
        # before the cap, so we still get dimensions and don't read the whole thing.
        url = "https://cdn.test/huge.jpg"
        payload = _img_bytes(1200, 700) + b"\x00" * (CODEX_IMAGE_PROBE_BYTES * 4)
        async with _mock_client({url: payload}) as client:
            probed = await _probe_one(client, url, asyncio.Semaphore(1))
        assert probed is not None
        assert probed.width == 1200


@pytest.mark.asyncio
class TestSelectDevelopmentImagery:
    async def test_end_to_end_hero_and_strip(self, monkeypatch):
        routes = {
            "https://img/hero.jpg": _img_bytes(1600, 900),
            "https://img/s1.jpg": _img_bytes(600, 400),
            "https://img/s2.jpg": _img_bytes(500, 400),
            "https://img/tiny.jpg": _img_bytes(120, 120),
        }
        monkeypatch.setattr(imagery_module.httpx, "AsyncClient", lambda **kw: _mock_client(routes))

        articles = [
            _item(1, "https://img/hero.jpg"),
            _item(2, "https://img/s1.jpg"),
            _item(3, "https://img/s2.jpg"),
            _item(4, "https://img/tiny.jpg"),
        ]
        result = await select_development_imagery(articles)
        assert result.hero_url == "https://img/hero.jpg"
        assert result.strip_urls == ["https://img/s1.jpg", "https://img/s2.jpg"]

    async def test_all_probes_fail_is_text_only(self, monkeypatch):
        routes = {"https://img/a.jpg": 500, "https://img/b.jpg": httpx.ConnectError("boom")}
        monkeypatch.setattr(imagery_module.httpx, "AsyncClient", lambda **kw: _mock_client(routes))

        articles = [_item(1, "https://img/a.jpg"), _item(2, "https://img/b.jpg")]
        assert await select_development_imagery(articles) == DevelopmentImagery()

    async def test_no_candidate_images_skips_all_http(self):
        # No monkeypatch: if this touched the network the test would hang/fail.
        assert await select_development_imagery([_item(1, None)]) == DevelopmentImagery()


@pytest.mark.asyncio
class TestAttachDevelopmentImagery:
    async def test_fills_hero_and_strip_on_the_payload_dict(self, monkeypatch):
        async def fake_select(articles):
            return DevelopmentImagery(hero_url="https://h", strip_urls=["https://s"])

        monkeypatch.setattr("app.services.codex.pipeline.select_development_imagery", fake_select)

        payload = {"developments": [{"title": "A", "articles": [_article_dict(1, image_url="https://h")]}]}
        await _attach_development_imagery(payload)
        assert payload["developments"][0]["hero_image_url"] == "https://h"
        assert payload["developments"][0]["strip_image_urls"] == ["https://s"]

    async def test_one_development_failing_does_not_sink_the_rest(self, monkeypatch):
        async def fake_select(articles):
            if articles and articles[0].title == "boom":
                raise RuntimeError("probe blew up")
            return DevelopmentImagery(hero_url="https://ok")

        monkeypatch.setattr("app.services.codex.pipeline.select_development_imagery", fake_select)

        payload = {
            "developments": [
                {"title": "fine", "articles": [_article_dict(1, image_url="https://ok", title="fine")]},
                {"title": "bad", "articles": [_article_dict(2, image_url="https://x", title="boom")]},
            ]
        }
        await _attach_development_imagery(payload)
        assert payload["developments"][0]["hero_image_url"] == "https://ok"
        # The failed one falls back to a text-first card, not a KeyError downstream.
        assert payload["developments"][1]["hero_image_url"] is None
        assert payload["developments"][1]["strip_image_urls"] == []

    async def test_no_developments_is_a_noop(self):
        payload: dict = {"developments": []}
        await _attach_development_imagery(payload)
        assert payload == {"developments": []}
