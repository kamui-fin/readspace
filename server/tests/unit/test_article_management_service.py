"""Unit tests for ArticleManagementService."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from app.services.article_management_service import ArticleManagementService
from app.schemas.rss_schemas import ArticleResponse, ArticleUpdate, PaginatedResponse


def create_mock_article(is_read=False):
    """Helper function to create a mock article with all required fields for ArticleResponse."""
    from datetime import datetime

    # Create mock content object
    mock_content = MagicMock()
    mock_content.title = "Test Article"
    mock_content.link = "https://example.com"
    mock_content.description = "Test description"
    mock_content.content = "Test content"
    mock_content.image_url = "https://example.com/image.png"
    mock_content.author = "Test Author"
    mock_content.published_at = datetime.now()
    mock_content.estimated_read_time_minutes = 5

    # Create mock feed object
    mock_feed = MagicMock()
    mock_feed.id = uuid4()
    mock_feed.title = "Test Feed"
    mock_feed.url = "https://example.com/feed.xml"
    mock_feed.image_url = None
    mock_feed.folder_id = uuid4()

    # Create mock article object
    mock_article = MagicMock()
    mock_article.id = uuid4()
    mock_article.content = mock_content
    mock_article.feed = mock_feed
    mock_article.created_at = datetime.now()
    mock_article.updated_at = datetime.now()
    mock_article.is_read = is_read
    mock_article.is_read_later = False
    mock_article.is_favorite = False
    mock_article.feed_id = mock_feed.id
    mock_article.guid = "test-guid"
    
    return mock_article


@pytest.mark.unit
class TestArticleManagementService:
    """Test cases for ArticleManagementService."""

    def setup_method(self):
        """Set up test fixtures."""
        self.db = AsyncMock()
        self.user_id = uuid4()
        self.service = ArticleManagementService(db=self.db, user_id=self.user_id)

    @pytest.mark.asyncio
    async def test_get_articles_success(self):
        """Test successful article retrieval with pagination."""
        mock_article1 = create_mock_article(is_read=False)
        mock_article2 = create_mock_article(is_read=True)
        
        mock_articles = [mock_article1, mock_article2]
        total_count = 2
        
        with pytest.MonkeyPatch().context() as m:
            mock_get_articles_by_user = AsyncMock()
            mock_get_articles_by_user.return_value = (mock_articles, total_count)
            m.setattr("app.services.article_management_service.get_articles_by_user", mock_get_articles_by_user)
            
            result = await self.service.get_articles(page=1, size=10)
            
            assert isinstance(result, PaginatedResponse)
            assert len(result.items) == 2
            assert result.total == 2
            
            mock_get_articles_by_user.assert_called_once_with(
                db=self.db,
                user_id=self.user_id,
                feed_ids=None,
                folder_id=None,
                is_read=None,
                is_read_later=None,
                is_favorite=None,
                feed_is_favorite=None,
                published_since=None,
                published_until=None,
                search_query=None,
                sort_by="published_at",
                sort_order="desc",
                skip=0,
                limit=10,
            )

    @pytest.mark.asyncio
    async def test_get_articles_with_filters(self):
        """Test article retrieval with various filters."""
        folder_id = uuid4()
        feed_id = uuid4()
        tag_names = ["tech", "news"]
        
        with pytest.MonkeyPatch().context() as m:
            mock_get_articles_by_user = AsyncMock()
            mock_get_articles_by_user.return_value = ([], 0)
            m.setattr("app.services.article_management_service.get_articles_by_user", mock_get_articles_by_user)
            
            await self.service.get_articles(
                folder_id=folder_id,
                feed_ids=[feed_id],
                is_read=True,
                search_query="python",
                page=2,  # skip=20, limit=50 means page 2
                size=50,
            )
            
            mock_get_articles_by_user.assert_called_once_with(
                db=self.db,
                user_id=self.user_id,
                feed_ids=[feed_id],
                folder_id=folder_id,
                is_read=True,
                is_read_later=None,
                is_favorite=None,
                feed_is_favorite=None,
                published_since=None,
                published_until=None,
                search_query="python",
                sort_by="published_at",
                sort_order="desc",
                skip=50,
                limit=50,
            )

    @pytest.mark.asyncio
    async def test_get_articles_pagination_has_next(self):
        """Test pagination logic when there are more results."""
        with pytest.MonkeyPatch().context() as m:
            mock_get_articles_by_user = AsyncMock()
            mock_get_articles_by_user.return_value = ([], 100)  # 100 total items
            m.setattr("app.services.article_management_service.get_articles_by_user", mock_get_articles_by_user)
            
            result = await self.service.get_articles(page=1, size=10)
            
            assert result.total == 100
            assert result.pages == 10

    @pytest.mark.asyncio
    async def test_get_unread_articles(self):
        """Test getting unread articles calls get_articles with is_read=False."""
        folder_id = uuid4()
        
        with pytest.MonkeyPatch().context() as m:
            mock_get_articles_by_user = AsyncMock()
            mock_get_articles_by_user.return_value = ([], 0)
            m.setattr("app.services.article_management_service.get_articles_by_user", mock_get_articles_by_user)
            
            await self.service.get_unread_articles(
                folder_id=folder_id,
                search_query="python",
                skip=10,
                limit=25,
            )
            
            mock_get_articles_by_user.assert_called_once_with(
                db=self.db,
                user_id=self.user_id,
                folder_id=folder_id,
                feed_ids=None,
                is_read=False,
                search_query="python",
                skip=10,
                limit=25,
            )

    @pytest.mark.asyncio
    async def test_get_read_later_articles(self):
        """Test getting read later articles."""
        mock_article = create_mock_article()
        mock_articles = [mock_article]
        total_count = 1
        
        with pytest.MonkeyPatch().context() as m:
            mock_get_unified_articles = AsyncMock()
            mock_get_unified_articles.return_value = (mock_articles, total_count)
            m.setattr("app.services.article_management_service.crud_unified_articles.get_unified_articles_by_user", mock_get_unified_articles)
            
            result = await self.service.get_read_later_articles(skip=5, limit=15)
            
            assert isinstance(result, PaginatedResponse)
            assert len(result.items) == 1
            assert result.total == 1
            
            mock_get_unified_articles.assert_called_once_with(
                db=self.db,
                user_id=self.user_id,
                is_read_later=True,
                skip=5,
                limit=15,
                sort_by="published_at",
                sort_order="desc",
                include_feed_articles=True,
                include_clipped_articles=True,
            )

    @pytest.mark.asyncio
    async def test_get_recently_read_articles(self):
        """Test getting recently read articles."""
        mock_article = create_mock_article(is_read=True)
        mock_articles = [mock_article]
        total_count = 1
        
        with pytest.MonkeyPatch().context() as m:
            mock_get_recently_read = AsyncMock()
            mock_get_recently_read.return_value = (mock_articles, total_count)
            m.setattr("app.services.article_management_service.get_recently_read_articles", mock_get_recently_read)
            
            result = await self.service.get_recently_read_articles(skip=0, limit=20)
            
            assert isinstance(result, PaginatedResponse)
            assert len(result.items) == 1
            assert result.total == 1
            
            mock_get_recently_read.assert_called_once_with(
                db=self.db,
                user_id=self.user_id,
                skip=0,
                limit=20,
            )

    @pytest.mark.asyncio
    async def test_update_article_success(self):
        """Test successful article update."""
        article_id = uuid4()
        article_update = ArticleUpdate(is_read=True, is_favorite=True)
        
        updated_article = create_mock_article(is_read=True)
        updated_article.id = article_id
        updated_article.is_favorite = True
        
        with pytest.MonkeyPatch().context() as m:
            mock_crud_update_article = AsyncMock()
            mock_crud_update_article.return_value = updated_article
            m.setattr("app.services.article_management_service.crud_update_article", mock_crud_update_article)
            
            result = await self.service.update_article(article_id, article_update)
            
            assert isinstance(result, ArticleResponse)
            assert result is not None
            
            mock_crud_update_article.assert_called_once_with(
                db=self.db,
                article_id=article_id,
                article_in=article_update,
                user_id=self.user_id,
                article_type='feed',
            )

    @pytest.mark.asyncio
    async def test_get_articles_pagination_no_next(self):
        """Test pagination logic when there are no more results."""
        with pytest.MonkeyPatch().context() as m:
            mock_get_articles_by_user = AsyncMock()
            mock_get_articles_by_user.return_value = ([], 5)  # 5 total items
            m.setattr("app.services.article_management_service.get_articles_by_user", mock_get_articles_by_user)
            
            result = await self.service.get_articles(page=1, size=10)
            
            assert result.total == 5
            assert result.pages == 1

    @pytest.mark.asyncio
    async def test_update_article_not_found(self):
        """Test article update when article doesn't exist."""
        article_id = uuid4()
        article_update = ArticleUpdate(is_read=True)
        
        with pytest.MonkeyPatch().context() as m:
            mock_crud_update_article = AsyncMock()
            mock_crud_update_article.return_value = None
            m.setattr("app.services.article_management_service.crud_update_article", mock_crud_update_article)
            
            result = await self.service.update_article(article_id, article_update)
            
            assert result is None

    @pytest.mark.asyncio
    async def test_get_unread_counts_by_folder(self):
        """Test getting unread counts grouped by folder."""
        expected_counts = {
            "Technology": 15,
            "News": 8,
            "Science": 3
        }
        
        with pytest.MonkeyPatch().context() as m:
            mock_get_unread_counts = AsyncMock()
            mock_get_unread_counts.return_value = expected_counts
            m.setattr("app.services.article_management_service.get_unread_counts_by_folder", mock_get_unread_counts)
            
            result = await self.service.get_unread_counts_by_folder()
            
            assert result == expected_counts
            mock_get_unread_counts.assert_called_once_with(
                db=self.db,
                user_id=self.user_id
            )

    @pytest.mark.asyncio
    async def test_get_total_unread_count(self):
        """Test getting total unread article count."""
        expected_count = 42
        
        with pytest.MonkeyPatch().context() as m:
            mock_count_unread = AsyncMock()
            mock_count_unread.return_value = expected_count
            m.setattr("app.services.article_management_service.count_unread_articles", mock_count_unread)
            
            result = await self.service.get_total_unread_count()
            
            assert result == expected_count
            mock_count_unread.assert_called_once_with(
                db=self.db,
                user_id=self.user_id
            )