"""Unit tests for the "did the feed give us the whole article?" heuristic."""

import pytest

from app.services.articles.service import is_extraction_worthwhile
from app.utils.text import is_content_complete, visible_text_length

pytestmark = pytest.mark.unit


def _article(words: int) -> str:
    return f"<p>{'word ' * words}</p>"


def test_visible_text_length_ignores_markup() -> None:
    """Markup weight doesn't count toward the article's length."""
    html = '<div class="a-very-long-class-name"><p>Hello world.</p></div>'
    assert visible_text_length(html) == len("Hello world.")


def test_visible_text_length_ignores_scripts_and_styles() -> None:
    """Tracking scripts and inline styles are not article text."""
    html = "<script>var tracking = 'x'.repeat(5000);</script><style>p{color:red}</style><p>Real text.</p>"
    assert visible_text_length(html) == len("Real text.")


@pytest.mark.parametrize("content", [None, "", "<p>   </p>"])
def test_empty_content_is_not_complete(content: str | None) -> None:
    """Nothing to read means nothing to show."""
    assert is_content_complete(content) is False


def test_truncated_teaser_is_not_complete() -> None:
    """
    A two-sentence teaser with a "Read more" link is the exact shape that used to be
    misclassified as a full article, leaving extraction permanently switched off.
    """
    teaser = (
        "<p>The company announced the change on Tuesday, citing slower growth. "
        'The rollout begins next month. <a href="https://example.com/post">Read more</a></p>'
    )
    assert is_content_complete(teaser) is False


def test_markup_heavy_teaser_is_not_complete() -> None:
    """Kilobytes of share widgets around a short teaser is still a teaser."""
    padding = "".join(f'<div class="share share-{i}"></div>' for i in range(200))
    assert is_content_complete(f"{padding}<p>A short teaser sentence.</p>") is False


def test_full_article_is_complete() -> None:
    """A genuinely long body needs no extraction."""
    assert is_content_complete(_article(400)) is True


def test_threshold_is_measured_in_visible_characters() -> None:
    """The boundary is visible text, not raw HTML length."""
    assert is_content_complete("<p>" + "x" * 1500 + "</p>") is True
    assert is_content_complete("<p>" + "x" * 1499 + "</p>") is False


def test_extraction_worthwhile_when_substantially_longer() -> None:
    """A real full-text scrape is much longer than the teaser it replaces."""
    assert is_extraction_worthwhile(_article(400), _article(20)) is True


def test_extraction_not_worthwhile_when_no_gain() -> None:
    """A scrape returning the same teaser back is not an improvement."""
    teaser = _article(20)
    assert is_extraction_worthwhile(teaser, teaser) is False


def test_extraction_not_worthwhile_for_paywall_stub() -> None:
    """A paywall stub shorter than the feed's own content must never replace it."""
    assert is_extraction_worthwhile("<p>Subscribe to continue reading.</p>", _article(100)) is False


@pytest.mark.parametrize("extracted", [None, "", "<p> </p>"])
def test_extraction_not_worthwhile_when_empty(extracted: str | None) -> None:
    """An empty scrape is never stored."""
    assert is_extraction_worthwhile(extracted, _article(20)) is False


def test_extraction_worthwhile_when_feed_had_nothing() -> None:
    """Any real text beats a feed entry with no content at all."""
    assert is_extraction_worthwhile(_article(50), None) is True
