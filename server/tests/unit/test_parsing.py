import pytest
from app.services.feeds.parsing import parse_feed_content


def test_parse_feed_content_unescapes_entities():
    # Mock feed content with HTML entities
    content = """
    <rss version="2.0">
        <channel>
            <title>Feed &amp; Title</title>
            <description>Feed &gt; Description</description>
            <item>
                <title>Article &quot;Title&quot;</title>
                <description>Article &lt;Summary&gt;</description>
                <link>http://example.com/article</link>
                <guid>http://example.com/article</guid>
            </item>
        </channel>
    </rss>
    """

    parsed = parse_feed_content(content, "http://example.com/feed")

    assert parsed.title == "Feed & Title"
    assert parsed.description == "Feed > Description"
    assert len(parsed.articles) == 1
    article = parsed.articles[0]
    assert article.title == 'Article "Title"'
    # Summary might have ... appended if long, or be cleaned.
    # The implementation uses clean_html_text then unescape.
    # clean_html_text strips tags. <Summary> might be treated as a tag and stripped if not careful.
    # But &lt;Summary&gt; is escaped, so it should be treated as text "<Summary>".
    # Let's check what clean_html_text does to "<Summary>".
    # If it was &lt;Summary&gt;, nh3.clean might see it as text.

    assert article.description == "Article <Summary>"
