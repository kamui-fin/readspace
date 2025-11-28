import pytest
from datetime import datetime, timezone
from app.services.feeds.parsing import parse_feed_content

RSS_FEED_WITH_TAGS_TTL = """
<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title>Tech News</title>
  <link>https://example.com</link>
  <description>Latest technology news</description>
  <language>en-us</language>
  <ttl>60</ttl>
  <category>Technology</category>
  <category>Programming</category>
  <item>
    <title>New Python Release</title>
    <link>https://example.com/python-3-14</link>
    <description>Python 3.14 is out!</description>
    <guid>https://example.com/python-3-14</guid>
  </item>
</channel>
</rss>
"""

ATOM_FEED_FULL = """
<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <link href="https://example.org/"/>
  <updated>2023-10-01T12:00:00Z</updated>
  <author>
    <name>John Doe</name>
  </author>
  <id>urn:uuid:60a76c80-d399-11d9-b93C-0003939e0af6</id>
  <category term="Science"/>
  <category term="Space"/>
  <entry>
    <title>Atom Entry</title>
    <link href="https://example.org/2023/10/01/atom-entry"/>
    <id>urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a</id>
    <updated>2023-10-01T12:00:00Z</updated>
    <summary>Some summary</summary>
    <content type="html">&lt;p&gt;Full content&lt;/p&gt;</content>
  </entry>
</feed>
"""


def test_parse_rss_feed_with_tags_ttl():
    parsed = parse_feed_content(RSS_FEED_WITH_TAGS_TTL, "https://example.com/rss")

    assert parsed["title"] == "Tech News"
    assert parsed["description"] == "Latest technology news"
    assert parsed["language"] == "en-us"
    assert "Technology" in parsed["tags"]
    assert "Programming" in parsed["tags"]
    assert len(parsed["articles"]) == 1
    assert parsed["articles"][0].title == "New Python Release"


def test_parse_atom_feed_full():
    parsed = parse_feed_content(ATOM_FEED_FULL, "https://example.org/atom")

    assert parsed["title"] == "Atom Feed"
    assert parsed["author_name"] == "John Doe"
    assert "Science" in parsed["tags"]
    assert "Space" in parsed["tags"]
    assert parsed["last_updated_at"] is not None
    # Check timezone awareness
    assert parsed["last_updated_at"].tzinfo == timezone.utc

    assert len(parsed["articles"]) == 1
    article = parsed["articles"][0]
    assert article.title == "Atom Entry"
    assert article.content == "<p>Full content</p>"


def test_parse_feed_minimal():
    minimal_rss = """
    <rss version="2.0">
    <channel>
      <title>Minimal</title>
      <link>https://minimal.com</link>
    </channel>
    </rss>
    """
    parsed = parse_feed_content(minimal_rss, "https://minimal.com/feed")

    assert parsed["title"] == "Minimal"
    assert parsed["language"] == "en"  # Default
    assert parsed["tags"] == []
    assert parsed["articles"] == []


def test_parse_feed_broken_ttl():
    rss_broken_ttl = """
    <rss version="2.0">
    <channel>
      <title>Broken TTL</title>
      <ttl>invalid</ttl>
    </channel>
    </rss>
    """
    parsed = parse_feed_content(rss_broken_ttl, "https://example.com/feed")
    # Just ensure it doesn't crash


def test_article_extraction_details():
    feed_content = """
    <rss version="2.0">
    <channel>
      <title>Article Test</title>
      <item>
        <title>Test Article</title>
        <link>https://example.com/article</link>
        <description>Summary</description>
        <content:encoded xmlns:content="http://purl.org/rss/1.0/modules/content/">
          <![CDATA[<p>Full content with <a href="/relative">relative link</a></p>]]>
        </content:encoded>
        <pubDate>Mon, 06 Sep 2021 16:45:00 +0000</pubDate>
      </item>
    </channel>
    </rss>
    """
    parsed = parse_feed_content(feed_content, "https://example.com/feed")
    article = parsed["articles"][0]

    assert article.title == "Test Article"
    assert "Full content" in article.content
    # Check relative link resolution
    assert (
        'href="https://example.com/relative"' in article.content
        or 'href="https://example.com/feed/relative"' in article.content
    )
    # Note: urljoin behavior depends on base url ending with / or not.
    # If base is https://example.com/feed (no trailing slash), /relative becomes https://example.com/relative.

    assert article.published_at is not None
