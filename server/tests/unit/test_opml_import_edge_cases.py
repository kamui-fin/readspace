"""Edge case tests for OPML import functionality."""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from app.services.rss_service import RssOrchestrationService


@pytest.mark.unit
class TestOpmlImportEdgeCases:
    """Test edge cases and error conditions in OPML import."""

    def setup_method(self):
        self.mock_db = AsyncMock()
        self.user_id = uuid4()
        self.service = RssOrchestrationService(db=self.mock_db, user_id=self.user_id)
        self.service.opml_processor = AsyncMock()
        self.service.folder_service = AsyncMock()

        # Configure async mocks to return proper values
        self.service.folder_service.list_folders = AsyncMock(return_value=[])
        self.service.folder_service.create_folders_batch = AsyncMock(return_value={})

    @pytest.mark.asyncio
    async def test_feeds_not_added_multiple_times(self):
        """Test that feeds aren't processed multiple times due to nested structure."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
          <body>
            <outline text="Tech">
              <outline text="Feed A" xmlUrl="https://example.com/a.xml" />
            </outline>
            <outline text="Feed B" xmlUrl="https://example.com/b.xml" />
          </body>
        </opml>"""

        # Mock processor to return correct feeds without duplicates
        raw_feeds_data = [
            {
                "title": "Feed A",
                "xml_url": "https://example.com/a.xml",
                "folder_name": "Tech",
                "type": "feed",
            },
            {
                "title": "Feed B",
                "xml_url": "https://example.com/b.xml",
                "folder_name": None,
                "type": "feed",
            },
        ]

        self.service.opml_processor.extract_feeds_from_opml.return_value = raw_feeds_data

        tech_folder = MagicMock()
        tech_folder_id = uuid4()
        tech_folder.id = tech_folder_id
        tech_folder.name = "Tech"

        # Mock folder service methods properly
        self.service.folder_service.list_folders.return_value = []
        self.service.folder_service.create_folders_batch.return_value = {"Tech": tech_folder_id}

        result = await self.service.extract_feeds_from_opml(opml_content)

        # Should have exactly 2 feeds, no duplicates
        assert len(result) == 2

        urls = [f["url"] for f in result]
        assert urls == ["https://example.com/a.xml", "https://example.com/b.xml"]

        # Verify Feed A is in Tech folder, Feed B has no folder
        feed_a = next(f for f in result if f["url"] == "https://example.com/a.xml")
        feed_b = next(f for f in result if f["url"] == "https://example.com/b.xml")

        assert feed_a["folder_id"] == tech_folder_id
        assert feed_b["folder_id"] is None

    @pytest.mark.asyncio
    async def test_feeds_not_added_to_wrong_folder(self):
        """Test that feeds are added to correct folders, not default when they have specific folder."""
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
        specific_folder.name = "Specific Folder"

        # Mock folder service methods properly
        self.service.folder_service.list_folders.return_value = []
        self.service.folder_service.create_folders_batch.return_value = {"Specific Folder": specific_folder_id}

        result = await self.service.extract_feeds_from_opml(opml_content, "Default Folder Name")

        # Feed should be in the specific folder, not default
        assert len(result) == 1
        assert result[0]["folder_id"] == specific_folder_id
        assert result[0]["title"] == "Specific Feed"

        # Verify folder batch creation was called with correct name
        self.service.folder_service.create_folders_batch.assert_called_once_with(["Specific Folder"])

    @pytest.mark.asyncio
    async def test_nested_folder_structure_flattened(self):
        """Test that deeply nested folders are properly handled."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
          <body>
            <outline text="Parent">
              <outline text="Child">
                <outline text="Grandchild">
                  <outline text="Deep Feed" xmlUrl="https://example.com/deep.xml" />
                </outline>
              </outline>
            </outline>
          </body>
        </opml>"""

        # OpmlProcessor should handle nested structure correctly
        raw_feeds_data = [
            {
                "title": "Deep Feed",
                "xml_url": "https://example.com/deep.xml",
                "folder_name": "Parent/Child/Grandchild",  # Nested folder path
                "type": "feed",
            }
        ]

        self.service.opml_processor.extract_feeds_from_opml.return_value = raw_feeds_data

        nested_folder = MagicMock()
        nested_folder_id = uuid4()
        nested_folder.id = nested_folder_id
        nested_folder.name = "Parent/Child/Grandchild"

        # Mock folder service methods properly
        self.service.folder_service.list_folders.return_value = []
        self.service.folder_service.create_folders_batch.return_value = {"Parent/Child/Grandchild": nested_folder_id}

        result = await self.service.extract_feeds_from_opml(opml_content)

        assert len(result) == 1
        assert result[0]["folder_id"] == nested_folder_id

        # Verify the nested folder name was used
        self.service.folder_service.create_folders_batch.assert_called_once_with(["Parent/Child/Grandchild"])

    @pytest.mark.asyncio
    async def test_folder_creation_error_recovery(self):
        """Test recovery when folder creation fails and folder lookup also fails."""
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

        # Both folder creation and lookup fail
        self.service.folder_service.list_folders.return_value = []  # No existing folders
        self.service.folder_service.create_folders_batch.side_effect = Exception("Creation failed")

        result = await self.service.extract_feeds_from_opml(opml_content)

        # Should still process the feed but without folder assignment
        assert len(result) == 1
        assert result[0]["folder_id"] is None  # No folder assigned
        assert result[0]["url"] == "https://example.com/feed.xml"

    @pytest.mark.asyncio
    async def test_empty_folder_names_handled(self):
        """Test handling of empty or whitespace folder names."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
          <body>
            <outline text="">
              <outline text="Feed in Empty Folder" xmlUrl="https://example.com/empty.xml" />
            </outline>
            <outline text="   ">
              <outline text="Feed in Whitespace Folder" xmlUrl="https://example.com/whitespace.xml" />
            </outline>
          </body>
        </opml>"""

        # OpmlProcessor should handle empty folder names
        raw_feeds_data = [
            {
                "title": "Feed in Empty Folder",
                "xml_url": "https://example.com/empty.xml",
                "folder_name": "",  # Empty folder name
                "type": "feed",
            },
            {
                "title": "Feed in Whitespace Folder",
                "xml_url": "https://example.com/whitespace.xml",
                "folder_name": "   ",  # Whitespace folder name
                "type": "feed",
            },
        ]

        self.service.opml_processor.extract_feeds_from_opml.return_value = raw_feeds_data

        # Mock folder service methods - no folders should be created for empty names
        self.service.folder_service.list_folders.return_value = []
        self.service.folder_service.create_folders_batch.return_value = {}

        result = await self.service.extract_feeds_from_opml(opml_content, "Default")

        # Both feeds should have no folder due to invalid names
        assert len(result) == 2
        assert all(f["folder_id"] is None for f in result)

        # No folders should be created for empty/whitespace names
        self.service.folder_service.create_folders_batch.assert_not_called()

    @pytest.mark.asyncio
    async def test_duplicate_feed_urls_same_folder(self):
        """Test handling of duplicate feed URLs in the same folder."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
          <body>
            <outline text="News">
              <outline text="Feed A" xmlUrl="https://example.com/same.xml" />
              <outline text="Feed A Duplicate" xmlUrl="https://example.com/same.xml" />
            </outline>
          </body>
        </opml>"""

        # OpmlProcessor would extract both but they have same URL
        raw_feeds_data = [
            {
                "title": "Feed A",
                "xml_url": "https://example.com/same.xml",
                "folder_name": "News",
                "type": "feed",
            },
            {
                "title": "Feed A Duplicate",
                "xml_url": "https://example.com/same.xml",
                "folder_name": "News",
                "type": "feed",
            },
        ]

        self.service.opml_processor.extract_feeds_from_opml.return_value = raw_feeds_data

        news_folder = MagicMock()
        news_folder_id = uuid4()
        news_folder.id = news_folder_id
        news_folder.name = "News"

        # Mock folder service methods properly
        self.service.folder_service.list_folders.return_value = []
        self.service.folder_service.create_folders_batch.return_value = {"News": news_folder_id}

        result = await self.service.extract_feeds_from_opml(opml_content)

        # Both entries should be processed (worker will handle duplicates)
        assert len(result) == 2
        assert all(f["folder_id"] == news_folder_id for f in result)
        assert all(f["url"] == "https://example.com/same.xml" for f in result)

        # Different titles should be preserved
        titles = {f["title"] for f in result}
        assert titles == {"Feed A", "Feed A Duplicate"}

    @pytest.mark.asyncio
    async def test_special_characters_in_folder_names(self):
        """Test handling of special characters in folder names."""
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
          <body>
            <outline text="Folder with &amp; symbols &lt;&gt;">
              <outline text="Feed" xmlUrl="https://example.com/feed.xml" />
            </outline>
            <outline text="Folder with üñíçödé">
              <outline text="Unicode Feed" xmlUrl="https://example.com/unicode.xml" />
            </outline>
          </body>
        </opml>"""

        raw_feeds_data = [
            {
                "title": "Feed",
                "xml_url": "https://example.com/feed.xml",
                "folder_name": "Folder with & symbols <>",  # Decoded by XML parser
                "type": "feed",
            },
            {
                "title": "Unicode Feed",
                "xml_url": "https://example.com/unicode.xml",
                "folder_name": "Folder with üñíçödé",
                "type": "feed",
            },
        ]

        self.service.opml_processor.extract_feeds_from_opml.return_value = raw_feeds_data

        folder1_id = uuid4()
        folder1 = MagicMock()
        folder1.id = folder1_id
        folder1.name = "Folder with & symbols <>"

        folder2_id = uuid4()
        folder2 = MagicMock()
        folder2.id = folder2_id
        folder2.name = "Folder with üñíçödé"

        # Mock folder service methods properly
        self.service.folder_service.list_folders.return_value = []
        self.service.folder_service.create_folders_batch.return_value = {
            "Folder with & symbols <>": folder1_id,
            "Folder with üñíçödé": folder2_id,
        }

        result = await self.service.extract_feeds_from_opml(opml_content)

        assert len(result) == 2

        # Verify folder assignments
        feed1 = next(f for f in result if f["title"] == "Feed")
        feed2 = next(f for f in result if f["title"] == "Unicode Feed")

        assert feed1["folder_id"] == folder1_id
        assert feed2["folder_id"] == folder2_id

        # Verify folder creation was called with correct names
        self.service.folder_service.create_folders_batch.assert_called_once()
        call_args = self.service.folder_service.create_folders_batch.call_args[0][0]
        assert "Folder with & symbols <>" in call_args
        assert "Folder with üñíçödé" in call_args


# Note: Celery task tests are now covered by the service method tests
# since we refactored the business logic into testable service methods
