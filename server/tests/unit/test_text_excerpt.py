"""Unit tests for plain-text excerpt generation."""

import pytest

from app.utils.text import build_excerpt

pytestmark = pytest.mark.unit


def test_returns_first_sentence_when_long_enough() -> None:
    """A substantial first sentence is used on its own."""
    html = "<p>This first sentence is comfortably long enough to be a preview by itself.</p><p>Second one.</p>"
    assert build_excerpt(html, 100, 40) == "This first sentence is comfortably long enough to be a preview by itself."


def test_combines_short_leading_sentences() -> None:
    """Very short openers are joined with the following sentences."""
    html = "<p>Hi.</p><p>This is a longer second sentence with context.</p>"
    assert build_excerpt(html, 200, 40) == "Hi. This is a longer second sentence with context."


def test_keeps_inline_markup_spacing() -> None:
    """Inline tags don't introduce stray spaces before punctuation."""
    assert build_excerpt("<p>Hello <b>world</b>.</p>", 100, 40) == "Hello world."


def test_truncates_at_word_boundary_without_punctuation() -> None:
    """Text with no sentence break is cut on a word boundary with an ellipsis."""
    excerpt = build_excerpt("<p>" + "word " * 50 + "</p>", 32, 10)
    assert excerpt == "word word word word word word…"


def test_skips_scripts_and_figures() -> None:
    """Non-prose elements are ignored."""
    html = "<script>var x = 1;</script><figure><figcaption>Caption</figcaption></figure><p>Real text.</p>"
    assert build_excerpt(html, 100, 40) == "Real text."


@pytest.mark.parametrize("content", [None, "", "<p>   </p>"])
def test_empty_content_returns_empty_string(content: str | None) -> None:
    """Empty or whitespace-only content yields no excerpt."""
    assert build_excerpt(content, 100, 40) == ""
