"""Quick test to verify listparser2 integration."""

from app.services.opml.parsing import extract_opml_metadata, parse_opml

# Sample OPML with metadata
SAMPLE_OPML = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Tech News Daily</title>
    <ownerName>Jane Smith</ownerName>
    <ownerEmail>jane@example.com</ownerEmail>
  </head>
  <body>
    <outline text="Technology" title="Technology">
      <outline type="rss" text="TechCrunch" title="TechCrunch" xmlUrl="https://techcrunch.com/feed/" />
      <outline type="rss" text="Ars Technica" title="Ars Technica" xmlUrl="https://arstechnica.com/feed/" />
    </outline>
    <outline text="News" title="News">
      <outline type="rss" text="BBC News" title="BBC News" xmlUrl="http://feeds.bbci.co.uk/news/rss.xml" />
    </outline>
  </body>
</opml>
"""


def test_extract_metadata():
    """Test metadata extraction."""
    title, author = extract_opml_metadata(SAMPLE_OPML)
    print(f"Title: {title}")
    print(f"Author: {author}")
    assert title == "Tech News Daily"
    assert author in ["Jane Smith", "jane@example.com"]  # Depends on parser behavior


def test_parse_feeds():
    """Test feed parsing with folder structure."""
    feeds = parse_opml(SAMPLE_OPML, default_folder_name="Imported")
    print(f"\nFound {len(feeds)} feeds:")
    for feed in feeds:
        print(f"  - {feed['title']} ({feed['folder_name']}): {feed['xml_url']}")
    
    assert len(feeds) == 3
    assert feeds[0]["folder_name"] == "Technology"
    assert feeds[2]["folder_name"] == "News"


if __name__ == "__main__":
    print("Testing OPML metadata extraction...")
    test_extract_metadata()
    print("\n✓ Metadata extraction works!")
    
    print("\nTesting OPML feed parsing...")
    test_parse_feeds()
    print("\n✓ Feed parsing works!")
    
    print("\n🎉 All tests passed! listparser2 integration is working.")
