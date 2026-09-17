"""Unit tests for Codex Digest Phase 0 pure logic (no DB) - dedupe, capping, age formatting."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.core.constants import CODEX_MAX_PER_FEED
from app.services.codex.gather import _cap_and_dedupe, _normalize_title, _relative_age, fetch_full_texts, gather_catalog
from app.typing.entries import EntryListItem

pytestmark = pytest.mark.unit


def _make_item(
    *,
    title: str = "Some Article",
    link: str = "https://example.com/a",
    feed_id=None,
    published_at: datetime | None = None,
    description: str | None = "A description",
) -> EntryListItem:
    now = datetime.now(timezone.utc)
    return EntryListItem(
        id=uuid4(),
        title=title,
        link=link,
        description=description,
        feed_id=feed_id or uuid4(),
        feed_title="Test Feed",
        published_at=published_at or now,
        created_at=now,
    )


class TestNormalizeTitle:
    def test_lowercases_and_collapses_whitespace(self):
        assert _normalize_title("  The   Big   Story  ") == "the big story"

    def test_strips_surrounding_punctuation(self):
        assert _normalize_title('"Breaking News!"') == "breaking news"

    def test_none_returns_empty_string(self):
        assert _normalize_title(None) == ""

    def test_different_case_and_spacing_normalize_equal(self):
        assert _normalize_title("Hello World") == _normalize_title("  hello   world  ")


class TestRelativeAge:
    def test_minutes(self):
        now = datetime.now(timezone.utc)
        published = now - timedelta(minutes=30)
        assert _relative_age(published, now) == "30m"

    def test_hours(self):
        now = datetime.now(timezone.utc)
        published = now - timedelta(hours=5)
        assert _relative_age(published, now) == "5h"

    def test_days(self):
        now = datetime.now(timezone.utc)
        published = now - timedelta(days=2)
        assert _relative_age(published, now) == "2d"

    def test_future_or_zero_delta_floors_at_one_minute(self):
        now = datetime.now(timezone.utc)
        assert _relative_age(now, now) == "1m"


class TestCapAndDedupe:
    def test_per_feed_cap_keeps_most_recent(self):
        feed_id = uuid4()
        now = datetime.now(timezone.utc)
        items = [
            _make_item(
                title=f"Article {i}",
                feed_id=feed_id,
                published_at=now - timedelta(hours=i),
            )
            for i in range(CODEX_MAX_PER_FEED + 10)
        ]

        survivors = _cap_and_dedupe(items)

        assert len(survivors) == CODEX_MAX_PER_FEED
        # The most recent (smallest hour offset) articles should survive.
        kept_titles = {item.title for item in survivors}
        assert "Article 0" in kept_titles
        assert f"Article {CODEX_MAX_PER_FEED + 5}" not in kept_titles

    def test_title_dedupe_keeps_earliest_published(self):
        now = datetime.now(timezone.utc)
        earlier = _make_item(
            title="The Same Story",
            link="https://a.com/1",
            published_at=now - timedelta(hours=5),
        )
        later = _make_item(
            title="The Same Story",
            link="https://b.com/1",
            published_at=now - timedelta(hours=1),
        )

        survivors = _cap_and_dedupe([later, earlier])

        assert len(survivors) == 1
        assert survivors[0].link == "https://a.com/1"

    def test_title_dedupe_is_case_and_whitespace_insensitive(self):
        now = datetime.now(timezone.utc)
        a = _make_item(title="Big Story!", published_at=now - timedelta(hours=2))
        b = _make_item(title="  big   story  ", published_at=now - timedelta(hours=1))

        survivors = _cap_and_dedupe([a, b])

        assert len(survivors) == 1

    def test_untitled_articles_are_never_deduped_against_each_other(self):
        now = datetime.now(timezone.utc)
        a = _make_item(title=None, link="https://a.com/1", published_at=now)
        b = _make_item(title=None, link="https://b.com/1", published_at=now)

        survivors = _cap_and_dedupe([a, b])

        assert len(survivors) == 2

    def test_distinct_titles_all_survive(self):
        now = datetime.now(timezone.utc)
        items = [_make_item(title=f"Story {i}", published_at=now - timedelta(hours=i)) for i in range(5)]

        survivors = _cap_and_dedupe(items)

        assert len(survivors) == 5

    def test_result_sorted_most_recent_first(self):
        now = datetime.now(timezone.utc)
        older = _make_item(title="Old", published_at=now - timedelta(hours=10))
        newer = _make_item(title="New", published_at=now - timedelta(hours=1))

        survivors = _cap_and_dedupe([older, newer])

        assert [item.title for item in survivors] == ["New", "Old"]


class TestGatherCatalog:
    @pytest.mark.asyncio
    async def test_gathers_all_300_articles_across_pages(self, monkeypatch):
        now = datetime.now(timezone.utc)
        items = [_make_item(title=f"Story {i}", published_at=now - timedelta(seconds=i)) for i in range(300)]
        get_articles = AsyncMock(
            side_effect=[
                SimpleNamespace(items=items[:100], has_more=True, next_cursor="page2"),
                SimpleNamespace(items=items[100:200], has_more=True, next_cursor="page3"),
                SimpleNamespace(items=items[200:], has_more=False, next_cursor=None),
            ]
        )
        monkeypatch.setattr("app.services.codex.gather.get_articles", get_articles)

        result = await gather_catalog(AsyncMock(), uuid4(), now=now)

        assert result.total_articles == 300
        assert len(result.catalog) == 300
        assert get_articles.await_count == 3

    @pytest.mark.asyncio
    @pytest.mark.parametrize("filter_reason", ["duplicate", "per_feed", "excluded"])
    async def test_filtered_articles_do_not_consume_catalog_budget(self, monkeypatch, filter_reason):
        monkeypatch.setattr("app.services.codex.gather.CODEX_MAX_ARTICLES", 3)
        monkeypatch.setattr("app.services.codex.gather.CODEX_MAX_PER_FEED", 1)
        now = datetime.now(timezone.utc)
        first = _make_item(title="First", published_at=now)
        dropped = _make_item(title="Dropped", published_at=now - timedelta(seconds=1))
        excluded = set()
        if filter_reason == "duplicate":
            dropped.title = first.title
        elif filter_reason == "per_feed":
            dropped.feed_id = first.feed_id
        else:
            excluded.add(dropped.feed_id)
        second = _make_item(title="Second", published_at=now - timedelta(seconds=2))
        third = _make_item(title="Third", published_at=now - timedelta(seconds=3))
        extra = _make_item(title="Extra", published_at=now - timedelta(seconds=4))
        get_articles = AsyncMock(
            side_effect=[
                SimpleNamespace(items=[first, dropped, second], has_more=True, next_cursor="page2"),
                SimpleNamespace(items=[third, extra], has_more=True, next_cursor="page3"),
            ]
        )
        monkeypatch.setattr("app.services.codex.gather.get_articles", get_articles)

        result = await gather_catalog(AsyncMock(), uuid4(), now=now, excluded_feed_ids=excluded)

        assert result.total_articles == 3
        assert [item["title"] for item in result.catalog] == ["First", "Second", "Third"]
        assert get_articles.await_count == 2
        assert get_articles.await_args_list[1].args[2].cursor == "page2"
        assert get_articles.await_args_list[1].kwargs["published_until"] == now


class TestFetchFullTexts:
    NEWSLETTER_LINK = "newsletter://user-id/writer@example.com/abc123"

    @pytest.mark.asyncio
    async def test_newsletter_uses_stored_body_as_plain_text_without_scraping(self, monkeypatch):
        scrape = AsyncMock(return_value=("<p>scraped</p>", None))
        monkeypatch.setattr("app.services.codex.gather.extract_full_content", scrape)
        item = _make_item(link=self.NEWSLETTER_LINK, description="Short excerpt")

        results = await fetch_full_texts(
            [item], stored_bodies={item.id: "<table><tr><td><p>The whole newsletter body</p></td></tr></table>"}
        )

        scrape.assert_not_called()
        assert "The whole newsletter body" in results[item.id]
        assert "<" not in results[item.id]

    @pytest.mark.asyncio
    async def test_newsletter_without_stored_body_falls_back_to_description(self, monkeypatch):
        scrape = AsyncMock(return_value=("<p>scraped</p>", None))
        monkeypatch.setattr("app.services.codex.gather.extract_full_content", scrape)
        item = _make_item(link=self.NEWSLETTER_LINK, description="Short excerpt")

        results = await fetch_full_texts([item])

        scrape.assert_not_called()
        assert results[item.id] == "Short excerpt"

    @pytest.mark.asyncio
    async def test_web_articles_are_still_scraped(self, monkeypatch):
        scrape = AsyncMock(return_value=("<p>Scraped body</p>", None))
        monkeypatch.setattr("app.services.codex.gather.extract_full_content", scrape)
        item = _make_item(link="https://example.com/story")

        results = await fetch_full_texts([item], stored_bodies={item.id: "ignored for web articles"})

        scrape.assert_awaited_once()
        assert results[item.id] == "<p>Scraped body</p>"
