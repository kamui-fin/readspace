"""Unit tests for Codex Digest Phase 0 pure logic (no DB) - dedupe, capping, age formatting."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.core.constants import CODEX_MAX_PER_FEED
from app.services.codex.gather import _cap_and_dedupe, _normalize_title, _relative_age
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
