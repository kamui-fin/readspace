"""Unit tests for OPML file validation."""

from xml.etree import ElementTree as ET

import pytest

from app.core.constants import MAX_OPML_FILE_SIZE_MB


class TestOPMLFileValidation:
    """Test OPML file size and structure validation."""

    def test_valid_opml_structure(self):
        """Test that valid OPML structure is accepted."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Test OPML</title>
    </head>
    <body>
        <outline type="rss" text="Test Feed" xmlUrl="https://example.com/feed.xml"/>
    </body>
</opml>"""
        # Should parse without error
        root = ET.fromstring(opml_content)
        assert root.tag == "opml"
        assert root.find(".//body") is not None

    def test_opml_with_multiple_feeds(self):
        """Test OPML with multiple feeds."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Test OPML</title>
    </head>
    <body>
        <outline type="rss" text="Feed 1" xmlUrl="https://example.com/feed1.xml"/>
        <outline type="rss" text="Feed 2" xmlUrl="https://example.com/feed2.xml"/>
        <outline type="rss" text="Feed 3" xmlUrl="https://example.com/feed3.xml"/>
    </body>
</opml>"""
        root = ET.fromstring(opml_content)
        feeds = root.findall(".//outline[@type='rss']")
        assert len(feeds) == 3

    def test_opml_with_nested_folders(self):
        """Test OPML with nested folder structure."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Test OPML</title>
    </head>
    <body>
        <outline text="Technology">
            <outline type="rss" text="Tech Feed 1" xmlUrl="https://example.com/tech1.xml"/>
            <outline type="rss" text="Tech Feed 2" xmlUrl="https://example.com/tech2.xml"/>
        </outline>
        <outline text="News">
            <outline type="rss" text="News Feed 1" xmlUrl="https://example.com/news1.xml"/>
        </outline>
    </body>
</opml>"""
        root = ET.fromstring(opml_content)
        # Find folders - they are outline elements without type attribute that are direct children of body
        folders = [elem for elem in root.find(".//body") if elem.tag == "outline" and elem.get("type") is None]
        assert len(folders) == 2
        feeds = root.findall(".//outline[@type='rss']")
        assert len(feeds) == 3

    def test_invalid_xml_malformed(self):
        """Test that malformed XML is rejected."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Test OPML</title>
    </head>
    <body>
        <outline type="rss" text="Test Feed" xmlUrl="https://example.com/feed.xml"
    </body>
</opml>"""
        with pytest.raises(ET.ParseError):
            ET.fromstring(opml_content)

    def test_invalid_xml_missing_root(self):
        """Test that XML without OPML root is rejected."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
    <channel>
        <title>Not OPML</title>
    </channel>
</rss>"""
        root = ET.fromstring(opml_content)
        # Should parse but not be an OPML file
        assert root.tag != "opml"

    def test_opml_missing_body(self):
        """Test that OPML without body element is detected."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Test OPML</title>
    </head>
</opml>"""
        root = ET.fromstring(opml_content)
        assert root.find(".//body") is None

    def test_opml_empty_body(self):
        """Test that OPML with empty body is valid but has no feeds."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Test OPML</title>
    </head>
    <body>
    </body>
</opml>"""
        root = ET.fromstring(opml_content)
        feeds = root.findall(".//outline[@xmlUrl]")
        assert len(feeds) == 0

    def test_count_feeds_xmlurl_attribute(self):
        """Test counting feeds by xmlUrl attribute instead of string search."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Test OPML with xmlUrl in comments <!-- xmlUrl --></title>
    </head>
    <body>
        <outline type="rss" text="Feed 1" xmlUrl="https://example.com/feed1.xml"/>
        <outline type="rss" text="Feed 2 xmlUrl" xmlUrl="https://example.com/feed2.xml"/>
    </body>
</opml>"""
        root = ET.fromstring(opml_content)
        # Proper counting using XML parsing
        feeds = root.findall(".//outline[@xmlUrl]")
        assert len(feeds) == 2

        # Naive string counting would give wrong result
        naive_count = opml_content.count("xmlUrl")
        assert naive_count > 2  # Would incorrectly count comment and text

    def test_file_size_validation(self):
        """Test file size validation logic."""
        # 1 MB content (below 50MB limit)
        small_content = "A" * (1 * 1024 * 1024)
        assert len(small_content) < MAX_OPML_FILE_SIZE_MB * 1024 * 1024

        # Exactly at limit
        max_content = "A" * (MAX_OPML_FILE_SIZE_MB * 1024 * 1024)
        assert len(max_content) == MAX_OPML_FILE_SIZE_MB * 1024 * 1024

        # Over limit
        oversized_content = "A" * (MAX_OPML_FILE_SIZE_MB * 1024 * 1024 + 1)
        assert len(oversized_content) > MAX_OPML_FILE_SIZE_MB * 1024 * 1024

    def test_file_size_calculation_bytes(self):
        """Test that file size is calculated in bytes correctly."""
        content = "test content"
        size_bytes = len(content.encode("utf-8"))
        size_mb = size_bytes / (1024 * 1024)

        assert size_bytes == 12
        assert size_mb < 1

    def test_opml_with_html_entities(self):
        """Test OPML with HTML entities in attributes."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Test OPML</title>
    </head>
    <body>
        <outline type="rss" text="Test &amp; Feed" xmlUrl="https://example.com/feed.xml?param=1&amp;param2=2"/>
    </body>
</opml>"""
        root = ET.fromstring(opml_content)
        feed = root.find(".//outline[@type='rss']")
        assert feed is not None
        assert "Test & Feed" in feed.get("text", "")

    def test_opml_with_special_characters(self):
        """Test OPML with special characters in feed names."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Test OPML</title>
    </head>
    <body>
        <outline type="rss" text="Café &amp; Restaurant 日本語" xmlUrl="https://example.com/feed.xml"/>
    </body>
</opml>"""
        root = ET.fromstring(opml_content)
        feed = root.find(".//outline[@type='rss']")
        assert feed is not None

    def test_opml_version_1_0(self):
        """Test that OPML version 1.0 is also supported."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
    <head>
        <title>Test OPML v1</title>
    </head>
    <body>
        <outline type="rss" text="Test Feed" xmlUrl="https://example.com/feed.xml"/>
    </body>
</opml>"""
        root = ET.fromstring(opml_content)
        assert root.tag == "opml"
        assert root.get("version") == "1.0"

    def test_opml_without_version(self):
        """Test OPML without version attribute."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
<opml>
    <head>
        <title>Test OPML</title>
    </head>
    <body>
        <outline type="rss" text="Test Feed" xmlUrl="https://example.com/feed.xml"/>
    </body>
</opml>"""
        root = ET.fromstring(opml_content)
        assert root.tag == "opml"
        # Version is optional according to OPML spec
