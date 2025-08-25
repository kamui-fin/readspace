"""Unit tests for high-level OPML import functionality."""

import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from celery.result import AsyncResult

from app.core.custom_exceptions import ValidationError
from app.services.rss_orchestration_service import RssOrchestrationService
from app.workers.tasks import import_opml_task


@pytest.mark.unit
class TestRssOrchestrationServiceOpmlImport:
    """Test OPML import functionality in RssOrchestrationService."""

    def setup_method(self):
        self.mock_db = AsyncMock()
        self.user_id = uuid4()
        
        # Create service instance with mocked dependencies
        self.service = RssOrchestrationService(db=self.mock_db, user_id=self.user_id)
        self.service.opml_processor = AsyncMock()
        self.service.folder_service = AsyncMock()

    @pytest.mark.asyncio
    async def test_extract_feeds_from_opml_with_folders(self):
        """Test extracting feeds from OPML with proper folder handling."""
        opml_content = '''<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
          <head>
            <title>My RSS Subscriptions</title>
          </head>
          <body>
            <outline text="Tech News">
              <outline text="The Verge" type="rss" xmlUrl="https://www.theverge.com/rss/index.xml" />
              <outline text="TechCrunch" type="rss" xmlUrl="https://techcrunch.com/feed/" />
            </outline>
            <outline text="World News">
              <outline text="BBC News" type="rss" xmlUrl="http://feeds.bbci.co.uk/news/world/rss.xml" />
            </outline>
            <outline text="Direct Feed" type="rss" xmlUrl="https://example.com/direct.xml" />
          </body>
        </opml>'''

        # Mock OpmlProcessor response
        raw_feeds_data = [
            {
                "title": "The Verge",
                "xml_url": "https://www.theverge.com/rss/index.xml",
                "html_url": None,
                "folder_name": "Tech News",
                "type": "feed"
            },
            {
                "title": "TechCrunch",
                "xml_url": "https://techcrunch.com/feed/",
                "html_url": None,
                "folder_name": "Tech News",
                "type": "feed"
            },
            {
                "title": "BBC News",
                "xml_url": "http://feeds.bbci.co.uk/news/world/rss.xml",
                "html_url": None,
                "folder_name": "World News",
                "type": "feed"
            },
            {
                "title": "Direct Feed",
                "xml_url": "https://example.com/direct.xml",
                "html_url": None,
                "folder_name": None,  # Default folder should be used
                "type": "feed"
            }
        ]
        
        self.service.opml_processor.extract_feeds_from_opml.return_value = raw_feeds_data

        # Mock folder creation with explicit name mapping
        tech_folder_id = uuid4()
        world_folder_id = uuid4()
        
        tech_folder = MagicMock()
        tech_folder.id = tech_folder_id
        tech_folder.name = "Tech News"
        
        world_folder = MagicMock()
        world_folder.id = world_folder_id 
        world_folder.name = "World News"
        
        self.service.folder_service.list_folders.return_value = []
        
        # Mock create_folder to return the right folder based on the name
        def create_folder_mock(folder_create):
            if folder_create.name == "Tech News":
                return tech_folder
            elif folder_create.name == "World News":
                return world_folder
            else:
                raise ValueError(f"Unexpected folder name: {folder_create.name}")
        
        self.service.folder_service.create_folder.side_effect = create_folder_mock

        result = await self.service.extract_feeds_from_opml(opml_content, "Imported Feeds")

        # Verify opml processor was called correctly
        self.service.opml_processor.extract_feeds_from_opml.assert_called_once_with(
            opml_content, "Imported Feeds"
        )

        # Verify folders were created
        assert self.service.folder_service.create_folder.call_count == 2

        # Verify result format
        assert len(result) == 4
        
        # Check Tech News feeds
        tech_feeds = [f for f in result if f["folder_id"] == tech_folder_id]
        assert len(tech_feeds) == 2
        tech_urls = {f["url"] for f in tech_feeds}
        assert tech_urls == {"https://www.theverge.com/rss/index.xml", "https://techcrunch.com/feed/"}
        
        # Check World News feeds
        world_feeds = [f for f in result if f["folder_id"] == world_folder_id]
        assert len(world_feeds) == 1
        assert world_feeds[0]["url"] == "http://feeds.bbci.co.uk/news/world/rss.xml"
        
        # Check direct feed (should have no folder)
        direct_feeds = [f for f in result if f["folder_id"] is None]
        assert len(direct_feeds) == 1
        assert direct_feeds[0]["url"] == "https://example.com/direct.xml"
        assert direct_feeds[0]["title"] == "Direct Feed"

    @pytest.mark.asyncio
    async def test_extract_feeds_from_opml_existing_folder(self):
        """Test that existing folders are reused instead of creating duplicates."""
        opml_content = '''<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
          <body>
            <outline text="Existing Folder">
              <outline text="Feed 1" xmlUrl="https://example.com/feed1.xml" />
              <outline text="Feed 2" xmlUrl="https://example.com/feed2.xml" />
            </outline>
          </body>
        </opml>'''

        raw_feeds_data = [
            {
                "title": "Feed 1",
                "xml_url": "https://example.com/feed1.xml",
                "folder_name": "Existing Folder",
                "type": "feed"
            },
            {
                "title": "Feed 2", 
                "xml_url": "https://example.com/feed2.xml",
                "folder_name": "Existing Folder",
                "type": "feed"
            }
        ]
        
        self.service.opml_processor.extract_feeds_from_opml.return_value = raw_feeds_data

        # Mock folder creation to fail first, then return existing folder
        existing_folder = MagicMock()
        existing_folder.id = uuid4()
        existing_folder.name = "Existing Folder"

        self.service.folder_service.list_folders.return_value = [existing_folder]

        result = await self.service.extract_feeds_from_opml(opml_content)

        # Verify folder creation was NOT called since the folder already exists
        self.service.folder_service.create_folder.assert_not_called()
        
        # Verify existing folder was found and reused
        self.service.folder_service.list_folders.assert_called_once()
        
        # Both feeds should use the existing folder
        assert len(result) == 2
        assert all(f["folder_id"] == existing_folder.id for f in result)

    @pytest.mark.asyncio
    async def test_extract_feeds_from_opml_no_duplicate_feeds(self):
        """Test that feeds aren't processed multiple times when in nested structure."""
        opml_content = '''<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
          <body>
            <outline text="Programming">
              <outline text="Stack Overflow Blog" xmlUrl="https://stackoverflow.blog/feed/" />
              <outline text="Dev.to" xmlUrl="https://dev.to/feed" />
            </outline>
          </body>
        </opml>'''

        raw_feeds_data = [
            {
                "title": "Stack Overflow Blog",
                "xml_url": "https://stackoverflow.blog/feed/",
                "folder_name": "Programming",
                "type": "feed"
            },
            {
                "title": "Dev.to",
                "xml_url": "https://dev.to/feed", 
                "folder_name": "Programming",
                "type": "feed"
            }
        ]
        
        self.service.opml_processor.extract_feeds_from_opml.return_value = raw_feeds_data

        prog_folder = MagicMock()
        prog_folder.id = uuid4()
        prog_folder.name = "Programming"
        
        self.service.folder_service.list_folders.return_value = []
        self.service.folder_service.create_folder.return_value = prog_folder

        result = await self.service.extract_feeds_from_opml(opml_content)

        # Should have exactly 2 feeds, not duplicates
        assert len(result) == 2
        
        urls = {f["url"] for f in result}
        assert urls == {"https://stackoverflow.blog/feed/", "https://dev.to/feed"}
        
        # Both should be in Programming folder
        assert all(f["folder_id"] == prog_folder.id for f in result)

    @pytest.mark.asyncio
    async def test_extract_feeds_from_opml_default_folder_fallback(self):
        """Test that feeds without folders get default folder."""
        opml_content = '''<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
          <body>
            <outline text="Feed 1" xmlUrl="https://example.com/feed1.xml" />
            <outline text="Feed 2" xmlUrl="https://example.com/feed2.xml" />
          </body>
        </opml>'''

        raw_feeds_data = [
            {
                "title": "Feed 1",
                "xml_url": "https://example.com/feed1.xml",
                "folder_name": None,
                "type": "feed"
            },
            {
                "title": "Feed 2",
                "xml_url": "https://example.com/feed2.xml", 
                "folder_name": None,
                "type": "feed"
            }
        ]
        
        self.service.opml_processor.extract_feeds_from_opml.return_value = raw_feeds_data

        result = await self.service.extract_feeds_from_opml(opml_content, "My Default Folder")

        # No folders should be created since feeds have no folder
        self.service.folder_service.create_folder.assert_not_called()
        
        # Both feeds should have no folder_id (will use default in worker)
        assert len(result) == 2
        assert all(f["folder_id"] is None for f in result)

    @pytest.mark.asyncio
    async def test_extract_feeds_from_opml_validation_error(self):
        """Test handling of validation errors from OpmlProcessor."""
        opml_content = "invalid xml content"
        
        self.service.opml_processor.extract_feeds_from_opml.side_effect = ValidationError("Invalid OPML format")

        with pytest.raises(ValidationError, match="Invalid OPML format"):
            await self.service.extract_feeds_from_opml(opml_content)

        self.service.folder_service.create_folder.assert_not_called()


@pytest.mark.unit
class TestImportOpmlTask:
    """Test the Celery task for OPML import orchestration."""

    @pytest.mark.asyncio
    async def test_process_opml_import_orchestration(self):
        """Test OPML import orchestration through RssOrchestrationService."""
        opml_content = '''<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
          <body>
            <outline text="Podcasts">
              <outline text="Radiolab" xmlUrl="https://feeds.wnyc.org/radiolab" />
              <outline text="TED Talks Daily" xmlUrl="https://feeds.feedburner.com/tedtalks_audio" />
            </outline>
          </body>
        </opml>'''

        mock_db = AsyncMock()
        user_id = uuid4()
        service = RssOrchestrationService(db=mock_db, user_id=user_id)
        
        # Mock extract_feeds_from_opml to return test data
        test_feeds = [
            {"url": "https://feeds.wnyc.org/radiolab", "folder_id": uuid4(), "tag_names": [], "title": "Radiolab"},
            {"url": "https://feeds.feedburner.com/tedtalks_audio", "folder_id": uuid4(), "tag_names": [], "title": "TED Talks Daily"}
        ]
        
        with patch.object(service, 'extract_feeds_from_opml', return_value=test_feeds), \
             patch('celery.group') as mock_group:
            
            # Mock Celery group result
            mock_task_results = [MagicMock(task_id=f"task_{i}") for i in range(2)]
            mock_result = MagicMock()
            mock_result.results = mock_task_results
            mock_group.return_value.apply_async.return_value = mock_result
            
            result = await service.process_opml_import(opml_content, "Imported Feeds")
            
            # Verify orchestration result
            assert result["total_feeds"] == 2
            assert result["queued_tasks"] == 2
            assert len(result["task_ids"]) == 2
            assert result["status"] == "tasks_queued"


@pytest.mark.unit
class TestOpmlImportEndToEnd:
    """Test end-to-end OPML import scenarios."""

    def test_realistic_opml_structure_parsing(self):
        """Test parsing of realistic OPML structure similar to user's example."""
        # Using the exact OPML from the user's request
        opml_content = '''<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>My RSS Subscriptions</title>
  </head>
  <body>
    <outline text="Tech News">
      <outline text="The Verge" type="rss" xmlUrl="https://www.theverge.com/rss/index.xml" />
      <outline text="TechCrunch" type="rss" xmlUrl="https://techcrunch.com/feed/" />
      <outline text="Wired" type="rss" xmlUrl="https://www.wired.com/feed/rss" />
    </outline>
    <outline text="World News">
      <outline text="BBC News" type="rss" xmlUrl="http://feeds.bbci.co.uk/news/world/rss.xml" />
      <outline text="CNN Top Stories" type="rss" xmlUrl="http://rss.cnn.com/rss/cnn_topstories.rss" />
      <outline text="Reuters Top News" type="rss" xmlUrl="http://feeds.reuters.com/reuters/topNews" />
    </outline>
    <outline text="Programming">
      <outline text="Stack Overflow Blog" type="rss" xmlUrl="https://stackoverflow.blog/feed/" />
      <outline text="Dev.to" type="rss" xmlUrl="https://dev.to/feed" />
    </outline>
    <outline text="Podcasts">
      <outline text="Radiolab" type="rss" xmlUrl="https://feeds.wnyc.org/radiolab" />
      <outline text="TED Talks Daily" type="rss" xmlUrl="https://feeds.feedburner.com/tedtalks_audio" />
    </outline>
  </body>
</opml>'''

        # This test verifies the structure is parsed correctly
        # using the existing OpmlProcessor (which we've already tested)
        from app.services.opml_processor import OpmlProcessor
        
        processor = OpmlProcessor()
        
        # Validate that the OPML is properly formatted
        processor.validate_opml_content(opml_content)  # Should not raise

        # Test that the structure would be parsed correctly
        # by inspecting the XML structure manually
        import xml.etree.ElementTree as ET
        root = ET.fromstring(opml_content)
        
        # Verify overall structure
        assert root.tag == "opml"
        assert root.get("version") == "2.0"
        
        body = root.find("body")
        assert body is not None
        
        # Count top-level folders
        top_level_outlines = body.findall("outline")
        folder_names = {outline.get("text") for outline in top_level_outlines}
        assert folder_names == {"Tech News", "World News", "Programming", "Podcasts"}
        
        # Count feeds in each folder
        for folder_outline in top_level_outlines:
            folder_name = folder_outline.get("text")
            feeds = folder_outline.findall("outline")
            
            if folder_name == "Tech News":
                assert len(feeds) == 3
                feed_names = {feed.get("text") for feed in feeds}
                assert feed_names == {"The Verge", "TechCrunch", "Wired"}
                
            elif folder_name == "World News":
                assert len(feeds) == 3
                feed_names = {feed.get("text") for feed in feeds}
                assert feed_names == {"BBC News", "CNN Top Stories", "Reuters Top News"}
                
            elif folder_name == "Programming":
                assert len(feeds) == 2
                feed_names = {feed.get("text") for feed in feeds}
                assert feed_names == {"Stack Overflow Blog", "Dev.to"}
                
            elif folder_name == "Podcasts":
                assert len(feeds) == 2
                feed_names = {feed.get("text") for feed in feeds}
                assert feed_names == {"Radiolab", "TED Talks Daily"}

        # Verify all feeds have xmlUrl attributes
        all_feeds = root.findall(".//outline[@xmlUrl]")
        assert len(all_feeds) == 10  # Total feeds across all folders
        
        # Verify URLs are present and valid-looking
        urls = [feed.get("xmlUrl") for feed in all_feeds]
        assert all(url.startswith(("http://", "https://")) for url in urls)

    def test_folder_assignment_logic(self):
        """Test that feeds are assigned to correct folders and don't duplicate."""
        from app.services.opml_processor import OpmlProcessor
        import asyncio
        
        opml_content = '''<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
          <body>
            <outline text="News">
              <outline text="Feed A" xmlUrl="https://example.com/a.xml" />
              <outline text="Feed B" xmlUrl="https://example.com/b.xml" />
            </outline>
            <outline text="Tech">
              <outline text="Feed C" xmlUrl="https://example.com/c.xml" />
            </outline>
            <outline text="Direct Feed" xmlUrl="https://example.com/direct.xml" />
          </body>
        </opml>'''
        
        processor = OpmlProcessor()
        
        async def test_extraction():
            result = await processor.extract_feeds_from_opml(opml_content, "Imported")
            
            # Should have exactly 4 feeds
            assert len(result) == 4
            
            # Check folder assignments
            news_feeds = [f for f in result if f.get("folder_name") == "News"]
            tech_feeds = [f for f in result if f.get("folder_name") == "Tech"]
            # The direct feed should use the default folder name provided
            default_feeds = [f for f in result if f.get("folder_name") == "Imported"]
            
            assert len(news_feeds) == 2
            assert len(tech_feeds) == 1  
            assert len(default_feeds) == 1
            
            # Verify specific feed assignments
            news_urls = {f["xml_url"] for f in news_feeds}
            assert news_urls == {"https://example.com/a.xml", "https://example.com/b.xml"}
            
            tech_urls = {f["xml_url"] for f in tech_feeds}
            assert tech_urls == {"https://example.com/c.xml"}
            
            default_urls = {f["xml_url"] for f in default_feeds}
            assert default_urls == {"https://example.com/direct.xml"}
            
            return result
            
        asyncio.run(test_extraction())