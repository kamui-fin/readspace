import xml.etree.ElementTree as ET
from unittest.mock import MagicMock

import pytest

from app.core.custom_exceptions import ValidationError
from app.services.opml_processor import OpmlProcessor


@pytest.mark.unit
class TestOpmlProcessorExtractFeeds:
    def setup_method(self):
        self.processor = OpmlProcessor()

    @pytest.mark.asyncio
    async def test_extract_feeds_simple_opml(self):
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
            <head>
                <title>Test OPML</title>
            </head>
            <body>
                <outline title="Feed 1" xmlUrl="https://example.com/feed1.xml" htmlUrl="https://example.com" />
                <outline title="Feed 2" xmlUrl="https://example.com/feed2.xml" htmlUrl="https://example2.com" />
            </body>
        </opml>"""

        result = await self.processor.extract_feeds_from_opml(opml_content)

        assert len(result) == 2
        assert result[0] == {
            "title": "Feed 1",
            "xml_url": "https://example.com/feed1.xml",
            "html_url": "https://example.com",
            "folder_name": None,
            "type": "feed",
        }
        assert result[1] == {
            "title": "Feed 2",
            "xml_url": "https://example.com/feed2.xml",
            "html_url": "https://example2.com",
            "folder_name": None,
            "type": "feed",
        }

    @pytest.mark.asyncio
    async def test_extract_feeds_with_folders(self):
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
            <head>
                <title>Test OPML</title>
            </head>
            <body>
                <outline title="Tech News" text="Tech News">
                    <outline title="TechCrunch" xmlUrl="https://techcrunch.com/feed" htmlUrl="https://techcrunch.com" />
                    <outline title="Hacker News" xmlUrl="https://hnrss.org/frontpage" htmlUrl="https://news.ycombinator.com" />
                </outline>
                <outline title="Direct Feed" xmlUrl="https://example.com/direct.xml" htmlUrl="https://example.com" />
            </body>
        </opml>"""

        result = await self.processor.extract_feeds_from_opml(opml_content)

        assert len(result) == 3  # Fixed: no more duplicates

        # Check folder feeds
        tech_feeds = [feed for feed in result if feed["folder_name"] == "Tech News"]
        assert len(tech_feeds) == 2

        tech_titles = {feed["title"] for feed in tech_feeds}
        assert tech_titles == {"TechCrunch", "Hacker News"}

        # Check direct feed (should be 1 now)
        direct_feeds = [feed for feed in result if feed["folder_name"] is None]
        assert len(direct_feeds) == 1  # Fixed: no more duplicates

        # Check that Direct Feed is in the results
        direct_feed_titles = {feed["title"] for feed in direct_feeds}
        assert "Direct Feed" in direct_feed_titles

    @pytest.mark.asyncio
    async def test_extract_feeds_nested_folders(self):
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
            <body>
                <outline title="News" text="News">
                    <outline title="Tech" text="Tech">
                        <outline title="TechCrunch" xmlUrl="https://techcrunch.com/feed" />
                    </outline>
                </outline>
            </body>
        </opml>"""

        result = await self.processor.extract_feeds_from_opml(opml_content)

        assert len(result) == 1  # Fixed: no more duplicates

        # Check that we have the properly nested folder structure
        nested_feeds = [feed for feed in result if feed["folder_name"] == "Tech"]
        assert len(nested_feeds) == 1
        assert nested_feeds[0]["title"] == "TechCrunch"
        assert nested_feeds[0]["xml_url"] == "https://techcrunch.com/feed"

    @pytest.mark.asyncio
    async def test_extract_feeds_text_fallback(self):
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
            <body>
                <outline text="Feed Text" xmlUrl="https://example.com/feed.xml" />
            </body>
        </opml>"""

        result = await self.processor.extract_feeds_from_opml(opml_content)

        assert len(result) == 1
        assert result[0]["title"] == "Feed Text"

    @pytest.mark.asyncio
    async def test_extract_feeds_no_html_url(self):
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
            <body>
                <outline title="Feed No HTML" xmlUrl="https://example.com/feed.xml" />
            </body>
        </opml>"""

        result = await self.processor.extract_feeds_from_opml(opml_content)

        assert len(result) == 1
        assert result[0]["html_url"] is None

    @pytest.mark.asyncio
    async def test_extract_feeds_invalid_xml(self):
        invalid_opml = '<opml><body><outline title="broken'

        with pytest.raises(ValidationError, match="Invalid XML format"):
            await self.processor.extract_feeds_from_opml(invalid_opml)

    @pytest.mark.asyncio
    async def test_extract_feeds_no_body(self):
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
            <head>
                <title>Test OPML</title>
            </head>
        </opml>"""

        with pytest.raises(ValidationError, match="Invalid OPML format: No body element found"):
            await self.processor.extract_feeds_from_opml(opml_content)

    @pytest.mark.asyncio
    async def test_extract_feeds_no_valid_feeds(self):
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
            <body>
                <outline title="Just a folder" text="Just a folder" />
            </body>
        </opml>"""

        with pytest.raises(ValidationError, match="No valid feeds found in OPML file"):
            await self.processor.extract_feeds_from_opml(opml_content)

    @pytest.mark.asyncio
    async def test_extract_feeds_empty_outlines(self):
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
            <body>
                <outline />
                <outline title="" />
            </body>
        </opml>"""

        with pytest.raises(ValidationError, match="No valid feeds found in OPML file"):
            await self.processor.extract_feeds_from_opml(opml_content)


@pytest.mark.unit
class TestOpmlProcessorExportFeeds:
    def setup_method(self):
        self.processor = OpmlProcessor()

    @pytest.mark.asyncio
    async def test_export_feeds_simple(self):
        # Create mock feeds
        feed1 = MagicMock()
        feed1.title = "Feed 1"
        feed1.url = "https://example.com/feed1.xml"
        feed1.link = "https://example.com"
        feed1.folder = None

        feed2 = MagicMock()
        feed2.title = "Feed 2"
        feed2.url = "https://example.com/feed2.xml"
        feed2.link = "https://example2.com"
        feed2.folder = None

        feeds = [feed1, feed2]

        result = await self.processor.export_feeds_to_opml(feeds)

        # Parse the result to verify structure
        root = ET.fromstring(result)
        assert root.tag == "opml"
        assert root.get("version") == "2.0"

        # Check head
        head = root.find("head")
        assert head is not None
        title = head.find("title")
        assert title.text == "Readspace Feeds Export"

        # Check body and feeds
        body = root.find("body")
        outlines = body.findall("outline")
        assert len(outlines) == 2

        # Verify feed attributes
        feed_outline_1 = outlines[0]
        assert feed_outline_1.get("title") == "Feed 1"
        assert feed_outline_1.get("xmlUrl") == "https://example.com/feed1.xml"
        assert feed_outline_1.get("htmlUrl") == "https://example.com"
        assert feed_outline_1.get("type") == "rss"

    @pytest.mark.asyncio
    async def test_export_feeds_with_folders(self):
        # Create mock folders
        folder1 = MagicMock()
        folder1.name = "Tech News"

        folder2 = MagicMock()
        folder2.name = "Science"

        # Create mock feeds
        feed1 = MagicMock()
        feed1.title = "TechCrunch"
        feed1.url = "https://techcrunch.com/feed"
        feed1.link = "https://techcrunch.com"
        feed1.folder = folder1

        feed2 = MagicMock()
        feed2.title = "Hacker News"
        feed2.url = "https://hnrss.org/frontpage"
        feed2.link = "https://news.ycombinator.com"
        feed2.folder = folder1

        feed3 = MagicMock()
        feed3.title = "Science Daily"
        feed3.url = "https://sciencedaily.com/feed"
        feed3.link = "https://sciencedaily.com"
        feed3.folder = folder2

        feeds = [feed1, feed2, feed3]

        result = await self.processor.export_feeds_to_opml(feeds)

        # Parse the result
        root = ET.fromstring(result)
        body = root.find("body")
        folder_outlines = body.findall("outline")

        # Should have 2 folder outlines
        assert len(folder_outlines) == 2

        # Check folder names
        folder_names = {outline.get("title") for outline in folder_outlines}
        assert folder_names == {"Tech News", "Science"}

        # Check feeds in Tech News folder
        tech_folder = next(outline for outline in folder_outlines if outline.get("title") == "Tech News")
        tech_feeds = tech_folder.findall("outline")
        assert len(tech_feeds) == 2

        tech_feed_titles = {feed.get("title") for feed in tech_feeds}
        assert tech_feed_titles == {"TechCrunch", "Hacker News"}

    @pytest.mark.asyncio
    async def test_export_feeds_no_link(self):
        # Create mock feed without link
        feed = MagicMock()
        feed.title = "Feed No Link"
        feed.url = "https://example.com/feed.xml"
        feed.link = None
        feed.folder = None

        feeds = [feed]

        result = await self.processor.export_feeds_to_opml(feeds)

        root = ET.fromstring(result)
        body = root.find("body")
        outline = body.find("outline")

        assert outline.get("htmlUrl") is None
        assert outline.get("xmlUrl") == "https://example.com/feed.xml"

    @pytest.mark.asyncio
    async def test_export_feeds_mixed_folders_and_uncategorized(self):
        # Create mock folder
        folder = MagicMock()
        folder.name = "News"

        # Create feeds - some with folder, some without
        feed1 = MagicMock()
        feed1.title = "News Feed"
        feed1.url = "https://news.com/feed"
        feed1.link = "https://news.com"
        feed1.folder = folder

        feed2 = MagicMock()
        feed2.title = "Uncategorized Feed"
        feed2.url = "https://example.com/feed"
        feed2.link = "https://example.com"
        feed2.folder = None

        feeds = [feed1, feed2]

        result = await self.processor.export_feeds_to_opml(feeds)

        root = ET.fromstring(result)
        body = root.find("body")
        outlines = body.findall("outline")

        # Should have 2 outlines: 1 folder + 1 uncategorized feed
        assert len(outlines) == 2

    @pytest.mark.asyncio
    async def test_export_feeds_date_created_format(self):
        feed = MagicMock()
        feed.title = "Test Feed"
        feed.url = "https://example.com/feed"
        feed.link = "https://example.com"
        feed.folder = None

        result = await self.processor.export_feeds_to_opml([feed])

        root = ET.fromstring(result)
        head = root.find("head")
        date_created = head.find("dateCreated")

        # Verify date format (should be RFC 822 format)
        assert date_created is not None
        assert "GMT" in date_created.text


@pytest.mark.unit
class TestOpmlProcessorValidation:
    def setup_method(self):
        self.processor = OpmlProcessor()

    def test_validate_opml_content_valid(self):
        valid_opml = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
            <body>
                <outline title="Feed" xmlUrl="https://example.com/feed.xml" />
            </body>
        </opml>"""

        # Should not raise any exception
        self.processor.validate_opml_content(valid_opml)

    def test_validate_opml_content_empty(self):
        with pytest.raises(ValidationError, match="OPML content is empty"):
            self.processor.validate_opml_content("")

    def test_validate_opml_content_whitespace_only(self):
        with pytest.raises(ValidationError, match="OPML content is empty"):
            self.processor.validate_opml_content("   \n\t  ")

    def test_validate_opml_content_invalid_xml(self):
        invalid_xml = '<opml><body><outline title="broken'

        with pytest.raises(ValidationError, match="Invalid XML format"):
            self.processor.validate_opml_content(invalid_xml)

    def test_validate_opml_content_wrong_root_element(self):
        wrong_root = """<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
            <channel>
                <title>Not OPML</title>
            </channel>
        </rss>"""

        with pytest.raises(ValidationError, match="This appears to be an RSS/Atom feed file"):
            self.processor.validate_opml_content(wrong_root)

    def test_validate_opml_content_no_body(self):
        no_body = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
            <head>
                <title>No Body</title>
            </head>
        </opml>"""

        with pytest.raises(ValidationError, match="Invalid OPML format: No body element found"):
            self.processor.validate_opml_content(no_body)

    def test_validate_opml_content_no_outlines(self):
        no_outlines = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
            <body>
            </body>
        </opml>"""

        with pytest.raises(ValidationError, match="Invalid OPML format: No feed entries found"):
            self.processor.validate_opml_content(no_outlines)

    def test_validate_opml_content_case_insensitive_root(self):
        uppercase_opml = """<?xml version="1.0" encoding="UTF-8"?>
        <OPML version="2.0">
            <body>
                <outline title="Feed" xmlUrl="https://example.com/feed.xml" />
            </body>
        </OPML>"""

        # Should not raise exception (case insensitive)
        self.processor.validate_opml_content(uppercase_opml)


@pytest.mark.unit
class TestOpmlProcessorXmlIndentation:
    def setup_method(self):
        self.processor = OpmlProcessor()

    def test_indent_xml_simple_element(self):
        # Create a simple XML element
        root = ET.Element("root")
        child = ET.SubElement(root, "child")
        child.text = "content"

        self.processor._indent_xml(root)

        # Convert to string to check formatting
        xml_str = ET.tostring(root, encoding="unicode")

        # Should contain newlines and indentation
        assert "\n" in xml_str
        assert "  " in xml_str  # Should have indentation

    def test_indent_xml_nested_elements(self):
        # Create nested XML structure
        root = ET.Element("root")
        parent = ET.SubElement(root, "parent")
        child = ET.SubElement(parent, "child")
        child.text = "content"

        self.processor._indent_xml(root)

        xml_str = ET.tostring(root, encoding="unicode")

        # Should have proper nesting indentation
        lines = xml_str.split("\n")
        assert len(lines) > 1  # Should have multiple lines

    def test_indent_xml_empty_element(self):
        root = ET.Element("root")

        self.processor._indent_xml(root)

        # Should handle empty elements without error
        xml_str = ET.tostring(root, encoding="unicode")
        assert xml_str.startswith("<root")


@pytest.mark.unit
class TestOpmlProcessorEdgeCases:
    def setup_method(self):
        self.processor = OpmlProcessor()

    @pytest.mark.asyncio
    async def test_extract_feeds_special_characters_in_titles(self):
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
            <body>
                <outline title="Feed with &amp; special chars &lt;&gt;" xmlUrl="https://example.com/feed.xml" />
                <outline title="Feed with üñíçödé" xmlUrl="https://example.com/feed2.xml" />
            </body>
        </opml>"""

        result = await self.processor.extract_feeds_from_opml(opml_content)

        assert len(result) == 2
        assert result[0]["title"] == "Feed with & special chars <>"
        assert result[1]["title"] == "Feed with üñíçödé"

    @pytest.mark.asyncio
    async def test_extract_feeds_empty_attributes(self):
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
            <body>
                <outline title="" xmlUrl="https://example.com/feed.xml" />
                <outline title="Valid Feed" xmlUrl="" />
            </body>
        </opml>"""

        # Should extract one feed with empty title, ignore one with empty xmlUrl
        result = await self.processor.extract_feeds_from_opml(opml_content)

        assert len(result) == 1
        assert result[0]["title"] == ""  # Empty title is preserved
        assert result[0]["xml_url"] == "https://example.com/feed.xml"

    @pytest.mark.asyncio
    async def test_export_feeds_special_characters(self):
        feed = MagicMock()
        feed.title = "Feed with & special <chars>"
        feed.url = "https://example.com/feed.xml"
        feed.link = "https://example.com"
        feed.folder = None

        result = await self.processor.export_feeds_to_opml([feed])

        # Parse back to ensure XML is valid
        root = ET.fromstring(result)
        outline = root.find(".//outline")

        # XML should properly escape special characters
        assert outline.get("title") == "Feed with & special <chars>"

    def test_process_outline_element_no_attributes(self):
        # Create outline element with no attributes
        outline = ET.Element("outline")

        result = self.processor._process_outline_element(outline)

        # Should return empty list for outline with no useful attributes
        assert result == []

    def test_process_outline_element_type_attribute(self):
        # Create outline with type attribute
        outline = ET.Element("outline")
        outline.set("title", "Test Feed")
        outline.set("xmlUrl", "https://example.com/feed.xml")
        outline.set("type", "rss")

        result = self.processor._process_outline_element(outline)

        assert len(result) == 1
        assert result[0]["type"] == "feed"  # Type is always "feed" for feeds
