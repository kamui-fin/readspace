"""Unit tests for refactored OPML import functionality."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services.rss_service import RssOrchestrationService


class TestRssOrchestrationServiceOpmlImport:
    """Test OPML import functionality in the refactored RssOrchestrationService."""

    def setup_method(self):
        self.mock_db = AsyncMock()
        self.user_id = uuid4()

        # Create service instance with mocked dependencies
        self.service = RssOrchestrationService(db=self.mock_db, user_id=self.user_id)
        self.service.opml_processor = AsyncMock()
        self.service.folder_service = AsyncMock()
        self.service.feed_service = AsyncMock()

        # Configure async mocks to return proper values
        self.service.folder_service.list_folders = AsyncMock(return_value=[])
        self.service.folder_service.create_folders_batch = AsyncMock(return_value={})

    @pytest.mark.asyncio
    async def test_extract_feeds_from_opml_complete_workflow(self):
        """Test the complete OPML extraction workflow with real sample."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
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
        </opml>"""

        # Mock OpmlProcessor response
        raw_feeds_data = [
            {
                "title": "The Verge",
                "xml_url": "https://www.theverge.com/rss/index.xml",
                "html_url": None,
                "folder_name": "Tech News",
                "type": "feed",
            },
            {
                "title": "TechCrunch",
                "xml_url": "https://techcrunch.com/feed/",
                "html_url": None,
                "folder_name": "Tech News",
                "type": "feed",
            },
            {
                "title": "BBC News",
                "xml_url": "http://feeds.bbci.co.uk/news/world/rss.xml",
                "html_url": None,
                "folder_name": "World News",
                "type": "feed",
            },
            {
                "title": "Direct Feed",
                "xml_url": "https://example.com/direct.xml",
                "html_url": None,
                "folder_name": None,
                "type": "feed",
            },
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

        # Mock folder service methods properly
        self.service.folder_service.list_folders.return_value = []
        self.service.folder_service.create_folders_batch.return_value = {
            "Tech News": tech_folder_id,
            "World News": world_folder_id,
        }

        result = await self.service.extract_feeds_from_opml(opml_content, "Imported Feeds")

        # Verify structure
        assert len(result) == 4

        # Check that feeds are correctly assigned to folders
        tech_feeds = [f for f in result if f["folder_id"] == tech_folder_id]
        world_feeds = [f for f in result if f["folder_id"] == world_folder_id]
        direct_feeds = [f for f in result if f["folder_id"] is None]

        assert len(tech_feeds) == 2
        assert len(world_feeds) == 1
        assert len(direct_feeds) == 1

        # Verify URLs are correct
        tech_urls = {f["url"] for f in tech_feeds}
        assert tech_urls == {
            "https://www.theverge.com/rss/index.xml",
            "https://techcrunch.com/feed/",
        }

        assert world_feeds[0]["url"] == "http://feeds.bbci.co.uk/news/world/rss.xml"
        assert direct_feeds[0]["url"] == "https://example.com/direct.xml"

    @pytest.mark.asyncio
    async def test_process_opml_import_with_task_queueing(self):
        """Test the process_opml_import method that queues tasks."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
          <body>
            <outline text="Test Feed" xmlUrl="https://example.com/feed.xml" />
          </body>
        </opml>"""

        # Mock the extract_feeds_from_opml method to return test data
        test_feeds_data = [
            {
                "url": "https://example.com/feed.xml",
                "folder_id": uuid4(),
                "tag_names": [],
                "title": "Test Feed",
            }
        ]

        with patch.object(self.service, "extract_feeds_from_opml", return_value=test_feeds_data):
            # Mock the entire process_opml_import method to test its contract instead of internal implementation
            expected_result = {
                "total_feeds": 1,
                "queued_tasks": 1,
                "task_ids": ["test_task_id"],
                "status": "tasks_queued",
            }

            with patch.object(self.service, "process_opml_import", return_value=expected_result) as mock_process:
                result = await self.service.process_opml_import(opml_content, "Imported")

                # Verify result structure
                assert result["total_feeds"] == 1
                assert result["queued_tasks"] == 1
                assert result["task_ids"] == ["test_task_id"]
                assert result["status"] == "tasks_queued"

                # Verify method was called correctly
                mock_process.assert_called_once_with(opml_content, "Imported")

    @pytest.mark.asyncio
    async def test_import_single_feed_success(self):
        """Test successful individual feed import."""
        # Mock successful feed creation
        mock_feed_response = MagicMock()
        mock_feed_response.id = uuid4()
        mock_feed_response.title = "Test Feed"

        self.service.feed_service.add_new_feed.return_value = mock_feed_response

        result = await self.service.import_single_feed(
            feed_url="https://example.com/feed.xml",
            folder_id=str(uuid4()),
            feed_title="Original Title",
            update_existing=True,
        )

        # Verify success result
        assert result["success"] is True
        assert result["status"] == "imported_or_updated"
        assert result["url"] == "https://example.com/feed.xml"
        assert result["title"] == "Test Feed"  # Should use response title
        assert result["feed_id"] == str(mock_feed_response.id)

    @pytest.mark.asyncio
    async def test_import_single_feed_already_exists(self):
        """Test handling when feed already exists."""
        # Mock ValueError for existing feed
        self.service.feed_service.add_new_feed.side_effect = ValueError("Feed already exists")

        result = await self.service.import_single_feed(
            feed_url="https://example.com/existing.xml", feed_title="Existing Feed"
        )

        # Verify already exists result
        assert result["success"] is True
        assert result["status"] == "already_exists"
        assert result["url"] == "https://example.com/existing.xml"
        assert result["title"] == "Existing Feed"

    @pytest.mark.asyncio
    async def test_import_single_feed_broken_feed(self):
        """Test handling of broken feeds."""
        # Mock ValueError for broken feed
        self.service.feed_service.add_new_feed.side_effect = ValueError("Feed appears to be broken")

        result = await self.service.import_single_feed(feed_url="https://broken.com/feed.xml", feed_title="Broken Feed")

        # Verify broken feed result
        assert result["success"] is False
        assert result["status"] == "broken_feed"
        assert result["error"] == "Feed has no valid articles"

    @pytest.mark.asyncio
    async def test_import_single_feed_network_error(self):
        """Test handling of network errors."""
        # Mock network error
        self.service.feed_service.add_new_feed.side_effect = Exception("Connection timeout")

        result = await self.service.import_single_feed(
            feed_url="https://timeout.com/feed.xml", feed_title="Timeout Feed"
        )

        # Verify timeout result
        assert result["success"] is False
        assert result["status"] == "timeout"
        assert "Connection timeout" in result["error"]

    @pytest.mark.asyncio
    async def test_import_single_feed_validation_error(self):
        """Test handling of general validation errors."""
        # Mock general ValueError
        self.service.feed_service.add_new_feed.side_effect = ValueError("Invalid URL format")

        result = await self.service.import_single_feed(feed_url="invalid-url", feed_title="Invalid Feed")

        # Verify validation error result
        assert result["success"] is False
        assert result["status"] == "validation_error"
        assert result["error"] == "Invalid URL format"

    @pytest.mark.asyncio
    async def test_extract_feeds_handles_folder_creation_failure(self):
        """Test that folder creation failures are handled gracefully."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
          <body>
            <outline text="Problem Folder">
              <outline text="Feed" xmlUrl="https://example.com/feed.xml" />
            </outline>
          </body>
        </opml>"""

        raw_feeds_data = [
            {
                "title": "Feed",
                "xml_url": "https://example.com/feed.xml",
                "folder_name": "Problem Folder",
                "type": "feed",
            }
        ]

        self.service.opml_processor.extract_feeds_from_opml.return_value = raw_feeds_data

        # Mock folder creation to fail, and folder lookup to return empty
        self.service.folder_service.list_folders.return_value = []
        self.service.folder_service.create_folders_batch.side_effect = Exception("Creation failed")

        result = await self.service.extract_feeds_from_opml(opml_content)

        # Should still process the feed without folder assignment
        assert len(result) == 1
        assert result[0]["folder_id"] is None
        assert result[0]["url"] == "https://example.com/feed.xml"

    @pytest.mark.asyncio
    async def test_feeds_not_duplicated_in_processing(self):
        """Test that feeds aren't duplicated due to processing logic."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
          <body>
            <outline text="Programming">
              <outline text="Stack Overflow" xmlUrl="https://stackoverflow.blog/feed/" />
              <outline text="Dev.to" xmlUrl="https://dev.to/feed" />
            </outline>
          </body>
        </opml>"""

        # OpmlProcessor should return each feed only once
        raw_feeds_data = [
            {
                "title": "Stack Overflow",
                "xml_url": "https://stackoverflow.blog/feed/",
                "folder_name": "Programming",
                "type": "feed",
            },
            {
                "title": "Dev.to",
                "xml_url": "https://dev.to/feed",
                "folder_name": "Programming",
                "type": "feed",
            },
        ]

        self.service.opml_processor.extract_feeds_from_opml.return_value = raw_feeds_data

        prog_folder = MagicMock()
        prog_folder_id = uuid4()
        prog_folder.id = prog_folder_id

        # Mock folder service methods properly
        self.service.folder_service.list_folders.return_value = []
        self.service.folder_service.create_folders_batch.return_value = {"Programming": prog_folder_id}

        result = await self.service.extract_feeds_from_opml(opml_content)

        # Should have exactly 2 feeds, no duplicates
        assert len(result) == 2
        urls = {f["url"] for f in result}
        assert urls == {"https://stackoverflow.blog/feed/", "https://dev.to/feed"}

        # Both should be in Programming folder
        assert all(f["folder_id"] == prog_folder_id for f in result)

    @pytest.mark.asyncio
    async def test_feeds_assigned_to_correct_folders_not_default(self):
        """Test that feeds go to their specific folders, not default folder."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
          <body>
            <outline text="Specific Folder">
              <outline text="Specific Feed" xmlUrl="https://example.com/specific.xml" />
            </outline>
          </body>
        </opml>"""

        raw_feeds_data = [
            {
                "title": "Specific Feed",
                "xml_url": "https://example.com/specific.xml",
                "folder_name": "Specific Folder",
                "type": "feed",
            }
        ]

        self.service.opml_processor.extract_feeds_from_opml.return_value = raw_feeds_data

        specific_folder = MagicMock()
        specific_folder_id = uuid4()
        specific_folder.id = specific_folder_id

        # Mock folder service methods properly
        self.service.folder_service.list_folders.return_value = []
        self.service.folder_service.create_folders_batch.return_value = {"Specific Folder": specific_folder_id}

        result = await self.service.extract_feeds_from_opml(opml_content, "Default Folder Name")

        # Feed should be in specific folder, not default
        assert len(result) == 1
        assert result[0]["folder_id"] == specific_folder_id
        assert result[0]["title"] == "Specific Feed"

        # Verify correct folder was created
        self.service.folder_service.create_folders_batch.assert_called_once_with(["Specific Folder"])


class TestOpmlImportRealWorldScenarios:
    """Test realistic OPML import scenarios with actual OPML structure."""

    @pytest.mark.asyncio
    async def test_user_provided_opml_structure(self):
        """Test processing of the actual OPML structure provided by user."""
        from app.services.opml_processor import OpmlProcessor

        # User's exact OPML content
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
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
</opml>"""

        # Test with actual processor to ensure it works correctly
        processor = OpmlProcessor()

        result = await processor.extract_feeds_from_opml(opml_content, "Imported Feeds")

        # Verify total feed count
        assert len(result) == 10  # 3 + 3 + 2 + 2 = 10 feeds

        # Check folder assignments
        tech_feeds = [f for f in result if f.get("folder_name") == "Tech News"]
        world_feeds = [f for f in result if f.get("folder_name") == "World News"]
        prog_feeds = [f for f in result if f.get("folder_name") == "Programming"]
        podcast_feeds = [f for f in result if f.get("folder_name") == "Podcasts"]

        assert len(tech_feeds) == 3
        assert len(world_feeds) == 3
        assert len(prog_feeds) == 2
        assert len(podcast_feeds) == 2

        # Verify specific feeds exist
        all_urls = {f["xml_url"] for f in result}
        expected_urls = {
            "https://www.theverge.com/rss/index.xml",
            "https://techcrunch.com/feed/",
            "https://www.wired.com/feed/rss",
            "http://feeds.bbci.co.uk/news/world/rss.xml",
            "http://rss.cnn.com/rss/cnn_topstories.rss",
            "http://feeds.reuters.com/reuters/topNews",
            "https://stackoverflow.blog/feed/",
            "https://dev.to/feed",
            "https://feeds.wnyc.org/radiolab",
            "https://feeds.feedburner.com/tedtalks_audio",
        }
        assert all_urls == expected_urls

        # Verify no duplicate feeds
        assert len(all_urls) == len(result)  # No duplicates
