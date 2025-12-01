import feedparser
import html
import nh3
import re

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

parsed = feedparser.parse(content, sanitize_html=True)
entry = parsed.entries[0]

print(f"Raw Title: {entry.title!r}")
print(f"Raw Description: {entry.description!r}")


def clean_html_text(text: str | None) -> str:
    if not text:
        return ""
    # Use nh3 to strip all tags
    text = nh3.clean(str(text), tags=set())
    # Collapse whitespace
    return re.sub(r"\s+", " ", text).strip()


cleaned_desc = clean_html_text(entry.description)
print(f"Cleaned Description: {cleaned_desc!r}")

unescaped_desc = html.unescape(cleaned_desc)
print(f"Unescaped Cleaned Description: {unescaped_desc!r}")
