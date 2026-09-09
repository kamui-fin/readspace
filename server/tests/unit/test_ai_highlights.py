"""Unit tests for AI Highlights safety logic (text integrity + sanitization). Pure logic, no DB."""

import nh3
import pytest

from app.services.ai.service import (
    HIGHLIGHT_ALLOWED_ATTRIBUTES,
    HIGHLIGHT_ALLOWED_TAGS,
    _add_highlight_class,
    _highlights_preserve_text,
    _strip_mark_tags,
)


class TestAddHighlightClass:
    """
    The model is only asked to emit data-rank (see get_highlight_system_prompt) — it can't be
    trusted to also remember a literal "rs-highlight" class on every tag, and the frontend CSS
    on both web and mobile keys off that class to hide/reveal marks. Without it, <mark> falls
    back to the browser's plain yellow UA style with none of our theming or animation.
    """

    def test_adds_class_to_bare_mark_with_data_rank(self):
        html = '<p>The <mark data-rank="1">quick brown fox</mark> jumps.</p>'
        assert (
            _add_highlight_class(html)
            == '<p>The <mark class="rs-highlight" data-rank="1">quick brown fox</mark> jumps.</p>'
        )

    def test_adds_class_to_mark_with_no_attributes(self):
        assert _add_highlight_class("<mark>bare</mark>") == '<mark class="rs-highlight">bare</mark>'

    def test_appends_to_existing_class_rather_than_overwriting(self):
        html = '<mark class="foo" data-rank="2">x</mark>'
        assert _add_highlight_class(html) == '<mark class="foo rs-highlight" data-rank="2">x</mark>'

    def test_idempotent_when_class_already_present(self):
        html = '<mark class="rs-highlight" data-rank="1">already</mark>'
        assert _add_highlight_class(html) == html


class TestStripMarkTags:
    def test_removes_opening_and_closing_tags(self):
        html = '<p>The <mark data-rank="1">quick brown fox</mark> jumps.</p>'
        assert _strip_mark_tags(html) == "<p>The quick brown fox jumps.</p>"

    def test_no_op_when_no_mark_tags(self):
        html = "<p>Nothing to strip here.</p>"
        assert _strip_mark_tags(html) == html


class TestHighlightsPreserveText:
    def test_accepts_identical_text_with_marks_inserted(self):
        original = "<p>The quick brown fox jumps over the lazy dog.</p>"
        candidate = '<p>The <mark data-rank="1">quick brown fox</mark> jumps over the lazy dog.</p>'
        assert _highlights_preserve_text(original_html=original, candidate_html=candidate) is True

    def test_rejects_reworded_content(self):
        original = "<p>The quick brown fox jumps over the lazy dog.</p>"
        candidate = "<p>A totally different sentence about something else entirely, made up.</p>"
        assert _highlights_preserve_text(original_html=original, candidate_html=candidate) is False

    def test_rejects_missing_paragraph(self):
        original = "<p>First paragraph with several words in it.</p><p>Second paragraph also has several words.</p>"
        candidate = '<p>First <mark data-rank="1">paragraph</mark> with several words in it.</p>'
        assert _highlights_preserve_text(original_html=original, candidate_html=candidate) is False

    def test_rejects_empty_candidate(self):
        original = "<p>The quick brown fox jumps over the lazy dog.</p>"
        assert _highlights_preserve_text(original_html=original, candidate_html="") is False

    def test_rejects_empty_original(self):
        candidate = '<p>The <mark data-rank="1">quick brown fox</mark> jumps.</p>'
        assert _highlights_preserve_text(original_html="", candidate_html=candidate) is False


class TestHighlightSanitization:
    """Verify the nh3 allowlist strips injection vectors but keeps <mark> highlights intact."""

    def test_keeps_mark_class_and_data_rank(self):
        raw = '<p>Some <mark class="rs-highlight" data-rank="1">important text</mark> here.</p>'
        cleaned = nh3.clean(raw, tags=HIGHLIGHT_ALLOWED_TAGS, attributes=HIGHLIGHT_ALLOWED_ATTRIBUTES)
        assert 'class="rs-highlight"' in cleaned
        assert 'data-rank="1"' in cleaned

    def test_strips_script_tag(self):
        raw = '<p>Text</p><script>alert("xss")</script>'
        cleaned = nh3.clean(raw, tags=HIGHLIGHT_ALLOWED_TAGS, attributes=HIGHLIGHT_ALLOWED_ATTRIBUTES)
        assert "<script" not in cleaned
        assert "alert" not in cleaned

    def test_strips_event_handler_attribute(self):
        raw = '<p onclick="alert(1)"><mark data-rank="2">text</mark></p>'
        cleaned = nh3.clean(raw, tags=HIGHLIGHT_ALLOWED_TAGS, attributes=HIGHLIGHT_ALLOWED_ATTRIBUTES)
        assert "onclick" not in cleaned

    def test_strips_disallowed_attribute_on_mark(self):
        raw = '<mark data-rank="1" onmouseover="steal()">text</mark>'
        cleaned = nh3.clean(raw, tags=HIGHLIGHT_ALLOWED_TAGS, attributes=HIGHLIGHT_ALLOWED_ATTRIBUTES)
        assert "onmouseover" not in cleaned
        assert 'data-rank="1"' in cleaned

    @pytest.mark.parametrize("tag", ["iframe", "object", "embed", "style"])
    def test_strips_dangerous_tags(self, tag):
        raw = f"<p>Text</p><{tag}>payload</{tag}>"
        cleaned = nh3.clean(raw, tags=HIGHLIGHT_ALLOWED_TAGS, attributes=HIGHLIGHT_ALLOWED_ATTRIBUTES)
        assert f"<{tag}" not in cleaned
