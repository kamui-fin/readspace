"""Unit tests for Codex Digest serialization and payload resolution (no DB)."""

import json
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.services.codex.pipeline import _resolve_payload
from app.services.codex.serialize import render_catalog_toon
from app.typing.codex import (
    CodexCluster,
    CodexDevelopment,
    CodexSynthesisOutput,
    CodexTriageOutput,
    CodexWorthReadingItem,
)
from app.typing.entries import EntryListItem

pytestmark = pytest.mark.unit


def _make_item(catalog_id: int, title: str = "Some Article") -> EntryListItem:
    now = datetime.now(timezone.utc)
    return EntryListItem(
        id=uuid4(),
        title=f"{title} {catalog_id}",
        link=f"https://example.com/{catalog_id}",
        description="A description",
        feed_id=uuid4(),
        feed_title="Test Feed",
        published_at=now,
        created_at=now,
    )


class TestRenderCatalogToon:
    def test_basic_shape(self):
        catalog = [
            {
                "id": 1,
                "source": "Stratechery",
                "age": "2h",
                "published_at": "2026-09-09T10:00:00+00:00",
                "title": "The inference cost curve",
                "snippet": "Ben Thompson on pricing",
            }
        ]
        toon = render_catalog_toon(catalog, {"total_articles": 1, "total_sources": 1})

        assert toon.startswith("articles[1]{id,source,age,published_at,title,snippet}:")
        assert "1,Stratechery,2h,2026-09-09T10:00:00+00:00,The inference cost curve,Ben Thompson on pricing" in toon
        assert "counts{total_articles,total_sources}: 1,1" in toon

    def test_escapes_values_containing_commas(self):
        catalog = [
            {
                "id": 1,
                "source": "Hacker News",
                "age": "1h",
                "published_at": "2026-09-09T11:00:00+00:00",
                "title": "CoreWeave raises $9B",
                "snippet": "Debt facility, and what it signals",
            }
        ]
        toon = render_catalog_toon(catalog, {"total_articles": 1, "total_sources": 1})

        assert '"Debt facility, and what it signals"' in toon

    def test_escapes_embedded_quotes(self):
        catalog = [
            {
                "id": 1,
                "source": "The Verge",
                "age": "3h",
                "published_at": "2026-09-09T09:00:00+00:00",
                "title": 'They called it "the future"',
                "snippet": "A snippet",
            }
        ]
        toon = render_catalog_toon(catalog, {"total_articles": 1, "total_sources": 1})

        assert '"They called it ""the future"""' in toon

    def test_empty_catalog(self):
        toon = render_catalog_toon([], {"total_articles": 0, "total_sources": 0})

        assert toon.startswith("articles[0]{id,source,age,published_at,title,snippet}:")
        assert "counts{total_articles,total_sources}: 0,0" in toon


class TestResolvePayload:
    def test_resolves_article_ids_to_entry_list_items(self):
        items_by_id = {1: _make_item(1), 2: _make_item(2), 3: _make_item(3)}
        triage = CodexTriageOutput(
            gist="A quiet day.",
            clusters=[CodexCluster(label="Story A", article_ids=[1, 2], source_count=2, article_count=2)],
            worth_reading_ids=[3],
        )
        synthesis = CodexSynthesisOutput(
            scale_setter="3 articles from 3 sources.",
            developments=[
                CodexDevelopment(
                    title="Story A",
                    synthesis="Sources agree on X.",
                    source_count=2,
                    article_count=2,
                    article_ids=[1, 2],
                )
            ],
            worth_reading=[CodexWorthReadingItem(article_id=3, reason="Only source on this.")],
            closing_line="1 of 1 developments shown.",
        )

        payload = _resolve_payload(
            triage=triage,
            synthesis=synthesis,
            items_by_id=items_by_id,
            full_text_by_catalog_id={},
        )

        assert payload["gist"] == "A quiet day."
        assert len(payload["developments"]) == 1
        assert len(payload["developments"][0]["articles"]) == 2
        assert payload["developments"][0]["article_count"] == 2
        assert len(payload["worth_reading"]) == 1
        assert payload["worth_reading"][0]["article"]["link"] == items_by_id[3].link

    def test_single_source_development_is_preserved(self):
        """A lone high-priority story (source_count=1, one article) must survive resolution
        with its counts intact - the pipeline never silently 'fixes' a solo development away."""
        items_by_id = {1: _make_item(1)}
        triage = CodexTriageOutput(
            gist="One story worth leading with, nothing else converged.",
            clusters=[CodexCluster(label="Solo Story", article_ids=[1], source_count=1, article_count=1)],
            worth_reading_ids=[],
        )
        synthesis = CodexSynthesisOutput(
            scale_setter="1 piece from 1 source.",
            developments=[
                CodexDevelopment(
                    title="A lone but major release",
                    synthesis="- The one source lays out what shipped and why it matters.",
                    source_count=1,
                    article_count=1,
                    article_ids=[1],
                )
            ],
            worth_reading=[],
            closing_line="1 development shown.",
        )

        payload = _resolve_payload(
            triage=triage,
            synthesis=synthesis,
            items_by_id=items_by_id,
            full_text_by_catalog_id={},
        )

        assert len(payload["developments"]) == 1
        dev = payload["developments"][0]
        assert dev["source_count"] == 1
        assert dev["article_count"] == 1
        assert len(dev["articles"]) == 1

    def test_article_count_matches_resolved_articles_length(self):
        """Regression guard: article_count must equal len(articles) in the persisted payload."""
        items_by_id = {i: _make_item(i) for i in range(1, 9)}
        triage = CodexTriageOutput(gist="Busy day.", clusters=[], worth_reading_ids=[])
        synthesis = CodexSynthesisOutput(
            scale_setter="8 articles.",
            developments=[
                CodexDevelopment(
                    title="Big Story",
                    synthesis="Everyone covered it.",
                    source_count=8,
                    article_count=8,
                    article_ids=list(range(1, 9)),
                )
            ],
            worth_reading=[],
            closing_line="Done.",
        )

        payload = _resolve_payload(
            triage=triage,
            synthesis=synthesis,
            items_by_id=items_by_id,
            full_text_by_catalog_id={},
        )

        dev = payload["developments"][0]
        assert dev["article_count"] == len(dev["articles"]) == 8

    def test_unresolvable_article_ids_are_skipped_not_fatal(self):
        items_by_id = {1: _make_item(1)}
        triage = CodexTriageOutput(gist="A day.", clusters=[], worth_reading_ids=[])
        synthesis = CodexSynthesisOutput(
            scale_setter="setter",
            developments=[
                CodexDevelopment(
                    title="Story",
                    synthesis="synthesis",
                    source_count=2,
                    article_count=2,
                    article_ids=[1, 999],  # 999 doesn't exist in items_by_id
                )
            ],
            worth_reading=[CodexWorthReadingItem(article_id=888, reason="missing")],
            closing_line="closing",
        )

        payload = _resolve_payload(
            triage=triage,
            synthesis=synthesis,
            items_by_id=items_by_id,
            full_text_by_catalog_id={},
        )

        assert len(payload["developments"][0]["articles"]) == 1
        assert payload["worth_reading"] == []

    def test_development_with_no_resolvable_articles_is_dropped(self):
        items_by_id: dict[int, EntryListItem] = {}
        triage = CodexTriageOutput(gist="A day.", clusters=[], worth_reading_ids=[])
        synthesis = CodexSynthesisOutput(
            scale_setter="setter",
            developments=[
                CodexDevelopment(
                    title="Ghost Story",
                    synthesis="synthesis",
                    source_count=2,
                    article_count=2,
                    article_ids=[1, 2],
                )
            ],
            worth_reading=[],
            closing_line="closing",
        )

        payload = _resolve_payload(
            triage=triage,
            synthesis=synthesis,
            items_by_id=items_by_id,
            full_text_by_catalog_id={},
        )

        assert payload["developments"] == []

    def test_payload_is_json_serializable(self):
        items_by_id = {1: _make_item(1)}
        triage = CodexTriageOutput(gist="A day.", clusters=[], worth_reading_ids=[1])
        synthesis = CodexSynthesisOutput(
            scale_setter="setter",
            developments=[],
            worth_reading=[CodexWorthReadingItem(article_id=1, reason="reason")],
            closing_line="closing",
        )

        payload = _resolve_payload(
            triage=triage,
            synthesis=synthesis,
            items_by_id=items_by_id,
            full_text_by_catalog_id={},
        )

        # Should not raise - datetimes etc. must already be JSON-primitive.
        json.dumps(payload)


class TestPayloadThemes:
    def test_themes_pass_through_trimmed_and_capped(self):
        items_by_id = {1: _make_item(1)}
        triage = CodexTriageOutput(
            gist="A day.",
            clusters=[],
            worth_reading_ids=[1],
            themes=["  Claude Opus 4.5 ", "AI datacenter financing", "Postgres 18", "EU AI Act", "extra"],
        )
        synthesis = CodexSynthesisOutput(
            scale_setter="setter",
            developments=[],
            worth_reading=[CodexWorthReadingItem(article_id=1, reason="reason")],
            closing_line="closing",
        )

        payload = _resolve_payload(
            triage=triage, synthesis=synthesis, items_by_id=items_by_id, full_text_by_catalog_id={}
        )

        assert payload["themes"] == [
            "Claude Opus 4.5",
            "AI datacenter financing",
            "Postgres 18",
            "EU AI Act",
        ]

    def test_no_themes_yields_empty_list(self):
        items_by_id = {1: _make_item(1)}
        triage = CodexTriageOutput(gist="A day.", clusters=[], worth_reading_ids=[1])
        synthesis = CodexSynthesisOutput(
            scale_setter="setter",
            developments=[],
            worth_reading=[CodexWorthReadingItem(article_id=1, reason="reason")],
            closing_line="closing",
        )

        payload = _resolve_payload(
            triage=triage, synthesis=synthesis, items_by_id=items_by_id, full_text_by_catalog_id={}
        )

        assert payload["themes"] == []


class TestReadingTimeStats:
    def _synthesis_with_one_dev(self, article_ids: list[int]) -> CodexSynthesisOutput:
        return CodexSynthesisOutput(
            scale_setter="setter",
            developments=[
                CodexDevelopment(
                    title="Story",
                    synthesis="synthesis",
                    source_count=len(article_ids),
                    article_count=len(article_ids),
                    article_ids=article_ids,
                )
            ],
            worth_reading=[],
            closing_line="closing",
        )

    def test_quiet_day_has_no_stats(self):
        items_by_id = {1: _make_item(1)}
        triage = CodexTriageOutput(gist="Quiet.", clusters=[], worth_reading_ids=[1])
        synthesis = CodexSynthesisOutput(
            scale_setter="setter",
            developments=[],
            worth_reading=[CodexWorthReadingItem(article_id=1, reason="only source")],
            closing_line="closing",
        )

        payload = _resolve_payload(
            triage=triage, synthesis=synthesis, items_by_id=items_by_id, full_text_by_catalog_id={}
        )

        assert payload["stats"] is None

    def test_uses_real_word_count_when_full_text_present(self):
        items_by_id = {1: _make_item(1), 2: _make_item(2)}
        triage = CodexTriageOutput(gist="Busy.", clusters=[], worth_reading_ids=[])
        synthesis = self._synthesis_with_one_dev([1, 2])
        # 220 wpm: 1100 words -> 5 minutes.
        full_text = {1: "word " * 600, 2: "word " * 500}

        payload = _resolve_payload(
            triage=triage, synthesis=synthesis, items_by_id=items_by_id, full_text_by_catalog_id=full_text
        )

        assert payload["stats"]["minutes_condensed"] == 5
        assert payload["stats"]["articles_condensed"] == 2
        assert payload["stats"]["minutes_capped"] is False

    def test_falls_back_to_assumed_words_without_full_text(self):
        items_by_id = {1: _make_item(1), 2: _make_item(2)}
        triage = CodexTriageOutput(gist="Busy.", clusters=[], worth_reading_ids=[])
        synthesis = self._synthesis_with_one_dev([1, 2])

        payload = _resolve_payload(
            triage=triage, synthesis=synthesis, items_by_id=items_by_id, full_text_by_catalog_id={}
        )

        # 2 * 650 assumed words / 220 wpm ~= 6 minutes.
        assert payload["stats"]["minutes_condensed"] == 6
        assert payload["stats"]["articles_condensed"] == 2

    def test_minutes_are_clamped_and_flagged(self):
        items_by_id = {i: _make_item(i) for i in range(1, 9)}
        triage = CodexTriageOutput(gist="Firehose.", clusters=[], worth_reading_ids=[])
        synthesis = self._synthesis_with_one_dev(list(range(1, 9)))
        full_text = dict.fromkeys(range(1, 9), "word " * 4000)  # 32000 words -> ~145 min

        payload = _resolve_payload(
            triage=triage, synthesis=synthesis, items_by_id=items_by_id, full_text_by_catalog_id=full_text
        )

        assert payload["stats"]["minutes_condensed"] == 90
        assert payload["stats"]["minutes_capped"] is True
