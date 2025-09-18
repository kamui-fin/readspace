from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.schemas.rss_schemas import (
    ArticleContentCreate,
    ArticleContentResponse,
    ClippedArticleCreate,
    ClippedArticleResponse,
)
from app.services.web_article_service import WebArticleService


@pytest.mark.unit
class TestWebArticleService:
    def setup_method(self):
        self.db = AsyncMock()
        self.user_id = uuid4()
        self.service = WebArticleService(self.db, self.user_id)
        self.url = "https://example.com/article"
        self.title = "Test Article"
        self.content = "<h1>Test Content</h1><p>This is a test article with some content.</p>"

    @patch("app.services.web_article_service.crud_article_content")
    @patch("app.services.web_article_service.crud_clipped_article")
    @pytest.mark.asyncio
    async def test_save_article_from_url_success(self, mock_crud_clipped, mock_crud_content):
        # Setup mocks - these are async functions
        mock_crud_content.get_by_link_extracted_by_extension = AsyncMock(return_value=None)

        content_id = uuid4()
        mock_content_record = MagicMock()
        mock_content_record.id = content_id
        mock_crud_content.create = AsyncMock(return_value=mock_content_record)

        mock_crud_clipped.get_by_user_and_content = AsyncMock(return_value=None)

        clipped_id = uuid4()
        mock_clipped_article = MagicMock()
        mock_clipped_article.id = clipped_id
        mock_crud_clipped.create = AsyncMock(return_value=mock_clipped_article)

        # Create a proper mock that looks like a ClippedArticleResponse
        mock_clipped_with_content = MagicMock()
        mock_clipped_with_content.id = clipped_id
        mock_clipped_with_content.content_id = content_id
        mock_clipped_with_content.user_id = self.user_id
        mock_clipped_with_content.priority = "high"
        mock_clipped_with_content.note = None
        mock_clipped_with_content.is_read = False
        mock_clipped_with_content.is_read_later = True
        mock_clipped_with_content.is_favorite = True
        mock_clipped_with_content.read_at = None
        mock_clipped_with_content.created_at = datetime.now(timezone.utc)

        # Mock the content relationship
        mock_content = MagicMock()
        mock_content.id = content_id
        mock_content.title = self.title
        mock_content.link = self.url
        mock_content.description = None
        mock_content.content = self.content
        mock_content.author = None
        mock_content.image_url = None
        mock_content.published_at = None
        mock_content.estimated_read_time_minutes = 1
        mock_content.custom_metadata = {"extracted_by": "chrome_extension"}
        mock_content.created_at = datetime.now(timezone.utc)
        mock_content.updated_at = datetime.now(timezone.utc)
        mock_clipped_with_content.content = mock_content

        mock_crud_clipped.get_with_content = AsyncMock(return_value=mock_clipped_with_content)

        # Mock the response creation
        expected_response = ClippedArticleResponse(
            id=clipped_id,
            content_id=content_id,
            user_id=self.user_id,
            priority="high",
            note=None,
            is_read=False,
            is_read_later=True,
            is_favorite=True,
            read_at=None,
            created_at=datetime.now(timezone.utc),
            content=ArticleContentResponse(
                id=content_id,
                title=self.title,
                link=self.url,
                description=None,
                content=self.content,
                author=None,
                image_url=None,
                published_at=None,
                estimated_read_time_minutes=1,
                custom_metadata={"extracted_by": "chrome_extension"},
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            ),
        )

        with patch.object(ClippedArticleResponse, "model_validate", return_value=expected_response):
            # Execute
            result = await self.service.save_article_from_url(
                url=self.url, title=self.title, content=self.content, priority="high"
            )

        # Verify
        mock_crud_content.get_by_link_extracted_by_extension.assert_called_once_with(self.db, link=self.url)
        mock_crud_content.create.assert_called_once()
        mock_crud_clipped.create.assert_called_once()
        mock_crud_clipped.get_with_content.assert_called_once_with(self.db, article_id=mock_clipped_article.id)

        # Check the ArticleContentCreate object passed to create
        create_call_args = mock_crud_content.create.call_args
        create_obj = create_call_args[1]["obj_in"]
        assert isinstance(create_obj, ArticleContentCreate)
        assert create_obj.title == self.title
        assert str(create_obj.link) == self.url
        assert create_obj.content == self.content
        assert "chrome_extension" in create_obj.custom_metadata["extracted_by"]
        assert result == expected_response

    @pytest.mark.asyncio
    async def test_save_article_from_url_no_content_raises_error(self):
        with pytest.raises(ValueError, match="No content provided"):
            await self.service.save_article_from_url(url=self.url, title=self.title, content=None)

    @patch("app.services.web_article_service.crud_article_content")
    @patch("app.services.web_article_service.crud_clipped_article")
    @pytest.mark.asyncio
    async def test_save_article_existing_content(self, mock_crud_clipped, mock_crud_content):
        # Setup - existing content found
        mock_existing_content = MagicMock()
        mock_existing_content.id = uuid4()
        mock_existing_content.content = "existing content"
        mock_crud_content.get_by_link_extracted_by_extension = AsyncMock(return_value=mock_existing_content)

        mock_crud_clipped.get_by_user_and_content = AsyncMock(return_value=None)

        mock_clipped_article = MagicMock()
        mock_clipped_article.id = uuid4()
        mock_crud_clipped.create = AsyncMock(return_value=mock_clipped_article)

        # Create proper mock for get_with_content
        mock_clipped_with_content = MagicMock()
        mock_clipped_with_content.id = mock_clipped_article.id
        mock_clipped_with_content.content_id = mock_existing_content.id
        mock_clipped_with_content.user_id = self.user_id
        mock_clipped_with_content.priority = "medium"
        mock_clipped_with_content.note = None
        mock_clipped_with_content.is_read = False
        mock_clipped_with_content.is_read_later = True
        mock_clipped_with_content.is_favorite = False
        mock_clipped_with_content.read_at = None
        mock_clipped_with_content.created_at = datetime.now(timezone.utc)

        # Mock the content relationship
        mock_content_obj = MagicMock()
        mock_content_obj.id = mock_existing_content.id
        mock_content_obj.title = self.title
        mock_content_obj.link = self.url
        mock_content_obj.description = None
        mock_content_obj.content = "existing content"
        mock_content_obj.author = None
        mock_content_obj.image_url = None
        mock_content_obj.published_at = None
        mock_content_obj.estimated_read_time_minutes = 1
        mock_content_obj.custom_metadata = {"extracted_by": "chrome_extension"}
        mock_content_obj.created_at = datetime.now(timezone.utc)
        mock_content_obj.updated_at = datetime.now(timezone.utc)
        mock_clipped_with_content.content = mock_content_obj

        mock_crud_clipped.get_with_content = AsyncMock(return_value=mock_clipped_with_content)

        # Execute
        await self.service.save_article_from_url(url=self.url, title=self.title, content=self.content)

        # Verify - should not create new content
        mock_crud_content.get_by_link_extracted_by_extension.assert_called_once()
        mock_crud_content.create.assert_not_called()
        mock_crud_clipped.create.assert_called_once()

    @patch("app.services.web_article_service.crud_article_content")
    @patch("app.services.web_article_service.crud_clipped_article")
    @pytest.mark.asyncio
    async def test_save_article_already_clipped(self, mock_crud_clipped, mock_crud_content):
        # Setup - existing clipped article
        mock_existing_content = MagicMock()
        mock_existing_content.id = uuid4()
        mock_crud_content.get_by_link_extracted_by_extension = AsyncMock(return_value=mock_existing_content)

        mock_existing_clipped = MagicMock()
        mock_existing_clipped.id = uuid4()
        mock_crud_clipped.get_by_user_and_content = AsyncMock(return_value=mock_existing_clipped)

        # Setup proper mock return value
        mock_existing_clipped.id = uuid4()
        mock_existing_clipped.content_id = mock_existing_content.id
        mock_existing_clipped.user_id = self.user_id
        mock_existing_clipped.priority = "medium"
        mock_existing_clipped.note = None
        mock_existing_clipped.is_read = False
        mock_existing_clipped.is_read_later = True
        mock_existing_clipped.is_favorite = False
        mock_existing_clipped.read_at = None
        mock_existing_clipped.created_at = datetime.now(timezone.utc)

        # Mock content for the response
        mock_content_for_response = MagicMock()
        mock_content_for_response.id = mock_existing_content.id
        mock_content_for_response.title = self.title
        mock_content_for_response.link = self.url
        mock_content_for_response.description = None
        mock_content_for_response.content = self.content
        mock_content_for_response.author = None
        mock_content_for_response.image_url = None
        mock_content_for_response.published_at = None
        mock_content_for_response.estimated_read_time_minutes = 1
        mock_content_for_response.custom_metadata = {"extracted_by": "chrome_extension"}
        mock_content_for_response.created_at = datetime.now(timezone.utc)
        mock_content_for_response.updated_at = datetime.now(timezone.utc)
        mock_existing_clipped.content = mock_content_for_response

        # Execute
        result = await self.service.save_article_from_url(url=self.url, title=self.title, content=self.content)

        # Verify - should return existing clipped article
        mock_crud_clipped.get_by_user_and_content.assert_called_once_with(
            self.db, user_id=self.user_id, content_id=mock_existing_content.id
        )
        mock_crud_clipped.create.assert_not_called()
        assert result is not None

    @patch("app.services.web_article_service.crud_article_content")
    @patch("app.services.web_article_service.crud_clipped_article")
    @pytest.mark.asyncio
    async def test_save_article_with_metadata(self, mock_crud_clipped, mock_crud_content):
        # Setup
        mock_crud_content.get_by_link_extracted_by_extension = AsyncMock(return_value=None)

        mock_content_record = MagicMock()
        mock_content_record.id = uuid4()
        mock_crud_content.create = AsyncMock(return_value=mock_content_record)

        mock_crud_clipped.get_by_user_and_content = AsyncMock(return_value=None)

        clipped_id = uuid4()
        mock_clipped_article = MagicMock()
        mock_clipped_article.id = clipped_id
        mock_crud_clipped.create = AsyncMock(return_value=mock_clipped_article)

        # Create proper mock for get_with_content
        mock_clipped_with_content = MagicMock()
        mock_clipped_with_content.id = clipped_id
        mock_clipped_with_content.content_id = mock_content_record.id
        mock_clipped_with_content.user_id = self.user_id
        mock_clipped_with_content.priority = "medium"
        mock_clipped_with_content.note = None
        mock_clipped_with_content.is_read = False
        mock_clipped_with_content.is_read_later = True
        mock_clipped_with_content.is_favorite = False
        mock_clipped_with_content.read_at = None
        mock_clipped_with_content.created_at = datetime.now(timezone.utc)

        # Mock the content relationship with metadata
        mock_content_obj = MagicMock()
        mock_content_obj.id = mock_content_record.id
        mock_content_obj.title = self.title
        mock_content_obj.link = self.url
        mock_content_obj.description = "Test description"
        mock_content_obj.content = self.content
        mock_content_obj.author = "Test Author"
        mock_content_obj.image_url = "https://example.com/image.jpg"
        mock_content_obj.published_at = datetime(2023, 5, 31, 7, 2, 4, tzinfo=timezone.utc)
        mock_content_obj.estimated_read_time_minutes = 1
        mock_content_obj.custom_metadata = {"extracted_by": "chrome_extension"}
        mock_content_obj.created_at = datetime.now(timezone.utc)
        mock_content_obj.updated_at = datetime.now(timezone.utc)
        mock_clipped_with_content.content = mock_content_obj

        mock_crud_clipped.get_with_content = AsyncMock(return_value=mock_clipped_with_content)

        metadata = {
            "description": "Test description",
            "author": "Test Author",
            "image_url": "https://example.com/image.jpg",
            "published_at": "2023-05-31T07:02:04Z",
        }

        # Execute
        await self.service.save_article_from_url(
            url=self.url, title=self.title, content=self.content, metadata=metadata
        )

        # Verify metadata was included
        create_call_args = mock_crud_content.create.call_args
        create_obj = create_call_args[1]["obj_in"]
        assert create_obj.description == metadata["description"]
        assert create_obj.author == metadata["author"]
        assert str(create_obj.image_url) == metadata["image_url"]
        assert create_obj.published_at is not None


@pytest.mark.unit
class TestWebArticleServiceDateTimeParsing:
    def setup_method(self):
        self.db = AsyncMock()
        self.user_id = uuid4()
        self.service = WebArticleService(self.db, self.user_id)

    def test_parse_datetime_string_iso_z_format(self):
        date_str = "2023-05-31T07:02:04Z"
        result = self.service._parse_datetime_string(date_str)

        expected = datetime(2023, 5, 31, 7, 2, 4, tzinfo=timezone.utc)
        assert result == expected

    def test_parse_datetime_string_space_timezone(self):
        date_str = "2023-05-31 07:02:04 -0500"
        result = self.service._parse_datetime_string(date_str)

        assert result is not None
        assert result.year == 2023
        assert result.month == 5
        assert result.day == 31

    def test_parse_datetime_string_t_timezone_format(self):
        date_str = "2023-05-31T07:02:04-0500"
        result = self.service._parse_datetime_string(date_str)

        assert result is not None
        assert result.year == 2023
        assert result.month == 5
        assert result.day == 31

    def test_parse_datetime_string_standard_iso(self):
        date_str = "2023-05-31T07:02:04"
        result = self.service._parse_datetime_string(date_str)

        expected = datetime(2023, 5, 31, 7, 2, 4)
        assert result == expected

    def test_parse_datetime_string_simple_date(self):
        date_str = "2023-05-31"
        result = self.service._parse_datetime_string(date_str)

        assert result is not None
        assert result.year == 2023
        assert result.month == 5
        assert result.day == 31

    def test_parse_datetime_string_slash_format(self):
        date_str = "2023/05/31 07:02:04"
        result = self.service._parse_datetime_string(date_str)

        assert result is not None
        assert result.year == 2023
        assert result.month == 5
        assert result.day == 31

    def test_parse_datetime_string_invalid(self):
        date_str = "invalid-date-string"
        result = self.service._parse_datetime_string(date_str)

        assert result is None

    def test_parse_datetime_string_empty(self):
        result = self.service._parse_datetime_string("")
        assert result is None

    def test_parse_datetime_string_none(self):
        result = self.service._parse_datetime_string(None)
        assert result is None


@pytest.mark.unit
class TestWebArticleServiceReadingTime:
    def setup_method(self):
        self.db = AsyncMock()
        self.user_id = uuid4()
        self.service = WebArticleService(self.db, self.user_id)

    def test_calculate_reading_time_none_content(self):
        result = self.service._calculate_reading_time(None)
        assert result is None

    def test_calculate_reading_time_empty_content(self):
        result = self.service._calculate_reading_time("")
        assert result is None

    def test_calculate_reading_time_short_content(self):
        content = "This is a short article with just a few words."
        result = self.service._calculate_reading_time(content)
        assert result == 1  # Minimum 1 minute

    def test_calculate_reading_time_medium_content(self):
        # Create content with approximately 230 words (should be 1 minute)
        words = ["word"] * 230
        content = " ".join(words)
        result = self.service._calculate_reading_time(content)
        assert result == 1

    def test_calculate_reading_time_long_content(self):
        # Create content with approximately 460 words (should be 2 minutes)
        words = ["word"] * 460
        content = " ".join(words)
        result = self.service._calculate_reading_time(content)
        assert result == 2

    def test_calculate_reading_time_with_html_tags(self):
        content = "<h1>Title</h1><p>This is a paragraph with <b>bold</b> and <i>italic</i> text.</p>"
        result = self.service._calculate_reading_time(content)
        assert result == 1  # HTML tags should be stripped for word count

    def test_calculate_reading_time_with_punctuation(self):
        content = "Hello, world! This is a test. How are you? I'm fine, thanks."
        result = self.service._calculate_reading_time(content)
        assert result == 1  # Punctuation should be handled appropriately


@pytest.mark.unit
class TestWebArticleServicePriorityHandling:
    def setup_method(self):
        self.db = AsyncMock()
        self.user_id = uuid4()
        self.service = WebArticleService(self.db, self.user_id)

    @patch("app.services.web_article_service.crud_article_content")
    @patch("app.services.web_article_service.crud_clipped_article")
    @pytest.mark.asyncio
    async def test_high_priority_makes_favorite(self, mock_crud_clipped, mock_crud_content):
        # Setup
        mock_crud_content.get_by_link_extracted_by_extension = AsyncMock(return_value=None)

        mock_content_record = MagicMock()
        mock_content_record.id = uuid4()
        mock_crud_content.create = AsyncMock(return_value=mock_content_record)

        mock_crud_clipped.get_by_user_and_content = AsyncMock(return_value=None)

        clipped_id = uuid4()
        mock_clipped_article = MagicMock()
        mock_clipped_article.id = clipped_id
        mock_crud_clipped.create = AsyncMock(return_value=mock_clipped_article)

        # Create proper mock for get_with_content
        mock_clipped_with_content = MagicMock()
        mock_clipped_with_content.id = clipped_id
        mock_clipped_with_content.content_id = mock_content_record.id
        mock_clipped_with_content.user_id = self.user_id
        mock_clipped_with_content.priority = "high"
        mock_clipped_with_content.note = None
        mock_clipped_with_content.is_read = False
        mock_clipped_with_content.is_read_later = True
        mock_clipped_with_content.is_favorite = True
        mock_clipped_with_content.read_at = None
        mock_clipped_with_content.created_at = datetime.now(timezone.utc)

        # Mock the content relationship
        mock_content_obj = MagicMock()
        mock_content_obj.id = mock_content_record.id
        mock_content_obj.title = "Test Article"
        mock_content_obj.link = "https://example.com/article"
        mock_content_obj.description = None
        mock_content_obj.content = "<p>Test content</p>"
        mock_content_obj.author = None
        mock_content_obj.image_url = None
        mock_content_obj.published_at = None
        mock_content_obj.estimated_read_time_minutes = 1
        mock_content_obj.custom_metadata = {"extracted_by": "chrome_extension"}
        mock_content_obj.created_at = datetime.now(timezone.utc)
        mock_content_obj.updated_at = datetime.now(timezone.utc)
        mock_clipped_with_content.content = mock_content_obj

        mock_crud_clipped.get_with_content = AsyncMock(return_value=mock_clipped_with_content)

        # Execute with high priority
        await self.service.save_article_from_url(
            url="https://example.com/article",
            title="Test Article",
            content="<p>Test content</p>",
            priority="high",
        )

        # Verify high priority becomes favorite
        create_call_args = mock_crud_clipped.create.call_args
        create_obj = create_call_args[1]["obj_in"]
        assert isinstance(create_obj, ClippedArticleCreate)
        assert create_obj.priority == "high"
        assert create_obj.is_favorite is True

    @patch("app.services.web_article_service.crud_article_content")
    @patch("app.services.web_article_service.crud_clipped_article")
    @pytest.mark.asyncio
    async def test_medium_priority_not_favorite(self, mock_crud_clipped, mock_crud_content):
        # Setup
        mock_crud_content.get_by_link_extracted_by_extension = AsyncMock(return_value=None)

        mock_content_record = MagicMock()
        mock_content_record.id = uuid4()
        mock_crud_content.create = AsyncMock(return_value=mock_content_record)

        mock_crud_clipped.get_by_user_and_content = AsyncMock(return_value=None)

        clipped_id = uuid4()
        mock_clipped_article = MagicMock()
        mock_clipped_article.id = clipped_id
        mock_crud_clipped.create = AsyncMock(return_value=mock_clipped_article)

        # Create proper mock for get_with_content
        mock_clipped_with_content = MagicMock()
        mock_clipped_with_content.id = clipped_id
        mock_clipped_with_content.content_id = mock_content_record.id
        mock_clipped_with_content.user_id = self.user_id
        mock_clipped_with_content.priority = "medium"
        mock_clipped_with_content.note = None
        mock_clipped_with_content.is_read = False
        mock_clipped_with_content.is_read_later = True
        mock_clipped_with_content.is_favorite = False
        mock_clipped_with_content.read_at = None
        mock_clipped_with_content.created_at = datetime.now(timezone.utc)

        # Mock the content relationship
        mock_content_obj = MagicMock()
        mock_content_obj.id = mock_content_record.id
        mock_content_obj.title = "Test Article"
        mock_content_obj.link = "https://example.com/article"
        mock_content_obj.description = None
        mock_content_obj.content = "<p>Test content</p>"
        mock_content_obj.author = None
        mock_content_obj.image_url = None
        mock_content_obj.published_at = None
        mock_content_obj.estimated_read_time_minutes = 1
        mock_content_obj.custom_metadata = {"extracted_by": "chrome_extension"}
        mock_content_obj.created_at = datetime.now(timezone.utc)
        mock_content_obj.updated_at = datetime.now(timezone.utc)
        mock_clipped_with_content.content = mock_content_obj

        mock_crud_clipped.get_with_content = AsyncMock(return_value=mock_clipped_with_content)

        # Execute with medium priority
        await self.service.save_article_from_url(
            url="https://example.com/article",
            title="Test Article",
            content="<p>Test content</p>",
            priority="medium",
        )

        # Verify medium priority is not favorite
        create_call_args = mock_crud_clipped.create.call_args
        create_obj = create_call_args[1]["obj_in"]
        assert create_obj.priority == "medium"
        assert create_obj.is_favorite is False

    @patch("app.services.web_article_service.crud_article_content")
    @patch("app.services.web_article_service.crud_clipped_article")
    @pytest.mark.asyncio
    async def test_default_priority_medium(self, mock_crud_clipped, mock_crud_content):
        # Setup
        mock_crud_content.get_by_link_extracted_by_extension = AsyncMock(return_value=None)

        mock_content_record = MagicMock()
        mock_content_record.id = uuid4()
        mock_crud_content.create = AsyncMock(return_value=mock_content_record)

        mock_crud_clipped.get_by_user_and_content = AsyncMock(return_value=None)

        clipped_id = uuid4()
        mock_clipped_article = MagicMock()
        mock_clipped_article.id = clipped_id
        mock_crud_clipped.create = AsyncMock(return_value=mock_clipped_article)

        # Create proper mock for get_with_content
        mock_clipped_with_content = MagicMock()
        mock_clipped_with_content.id = clipped_id
        mock_clipped_with_content.content_id = mock_content_record.id
        mock_clipped_with_content.user_id = self.user_id
        mock_clipped_with_content.priority = "medium"
        mock_clipped_with_content.note = None
        mock_clipped_with_content.is_read = False
        mock_clipped_with_content.is_read_later = True
        mock_clipped_with_content.is_favorite = False
        mock_clipped_with_content.read_at = None
        mock_clipped_with_content.created_at = datetime.now(timezone.utc)

        # Mock the content relationship
        mock_content_obj = MagicMock()
        mock_content_obj.id = mock_content_record.id
        mock_content_obj.title = "Test Article"
        mock_content_obj.link = "https://example.com/article"
        mock_content_obj.description = None
        mock_content_obj.content = "<p>Test content</p>"
        mock_content_obj.author = None
        mock_content_obj.image_url = None
        mock_content_obj.published_at = None
        mock_content_obj.estimated_read_time_minutes = 1
        mock_content_obj.custom_metadata = {"extracted_by": "chrome_extension"}
        mock_content_obj.created_at = datetime.now(timezone.utc)
        mock_content_obj.updated_at = datetime.now(timezone.utc)
        mock_clipped_with_content.content = mock_content_obj

        mock_crud_clipped.get_with_content = AsyncMock(return_value=mock_clipped_with_content)

        # Execute without priority
        await self.service.save_article_from_url(
            url="https://example.com/article",
            title="Test Article",
            content="<p>Test content</p>",
        )

        # Verify default priority is medium
        create_call_args = mock_crud_clipped.create.call_args
        create_obj = create_call_args[1]["obj_in"]
        assert create_obj.priority == "medium"
