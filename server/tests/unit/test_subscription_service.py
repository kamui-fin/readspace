"""Tests for the SubscriptionService."""

from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas import FolderResponse, SubscriptionFeedResponse, SubscriptionResponse
from app.services.subscription import SubscriptionService


@pytest.fixture
def mock_db():
    """Mock database session."""
    return Mock(spec=AsyncSession)


@pytest.fixture
def user_id():
    """Sample user ID."""
    return uuid4()


@pytest.fixture
def subscription_service(mock_db, user_id):
    """Create SubscriptionService instance."""
    return SubscriptionService(mock_db, user_id)


@pytest.fixture
def sample_feed_data():
    """Sample feed data."""
    return {
        "url": "https://example.com/feed.xml",
        "title": "Sample Feed",
        "description": "A sample feed",
        "link": "https://example.com",
        "language": "en",
        "image_url": "https://example.com/image.jpg",
        "ttl": 60,
    }


@pytest.fixture
def sample_subscription_response():
    """Sample subscription response."""
    feed_id = uuid4()
    subscription_id = uuid4()
    user_id = uuid4()
    folder_id = uuid4()

    return SubscriptionResponse(
        id=subscription_id,
        user_id=user_id,
        feed_id=feed_id,
        folder_id=folder_id,
        is_favorite=False,
        custom_title=None,
        created_at="2023-01-01T00:00:00Z",
        updated_at="2023-01-01T00:00:00Z",
        feed=SubscriptionFeedResponse(
            id=feed_id,
            url="https://example.com/feed.xml",
            title="Sample Feed",
            link="https://example.com",
            language="en",
            image_url="https://example.com/image.jpg",
            last_fetched_at=None,
            last_article_published_at=None,
        ),
        folder=FolderResponse(
            id=folder_id,
            user_id=user_id,
            name="Test Folder",
            created_at="2023-01-01T00:00:00Z",
            updated_at="2023-01-01T00:00:00Z",
        ),
    )


class TestSubscriptionService:
    """Test cases for SubscriptionService."""

    @pytest.mark.asyncio
    async def test_create_subscription_success(
        self, subscription_service, sample_feed_data, sample_subscription_response
    ):
        """Should successfully create a subscription."""
        folder_id = uuid4()

        with patch("app.crud.crud_subscription.create_subscription") as mock_create:
            mock_create.return_value = Mock()
            mock_create.return_value.id = sample_subscription_response.id
            mock_create.return_value.user_id = sample_subscription_response.user_id
            mock_create.return_value.feed_id = sample_subscription_response.feed_id
            mock_create.return_value.folder_id = sample_subscription_response.folder_id
            mock_create.return_value.is_favorite = False
            mock_create.return_value.custom_title = None
            mock_create.return_value.created_at = sample_subscription_response.created_at
            mock_create.return_value.updated_at = sample_subscription_response.updated_at
            mock_create.return_value.feed = sample_subscription_response.feed
            mock_create.return_value.folder = sample_subscription_response.folder

            result = await subscription_service.create_subscription(
                url="https://example.com/feed.xml",
                folder_id=folder_id,
                feed_data=sample_feed_data,
            )

            assert isinstance(result, SubscriptionResponse)
            mock_create.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_subscription_duplicate_raises_error(self, subscription_service):
        """Should raise error when trying to create duplicate subscription."""
        from sqlalchemy.exc import IntegrityError

        folder_id = uuid4()

        with patch("app.crud.crud_subscription.create_subscription") as mock_create:
            mock_create.side_effect = IntegrityError("", "", "")

            with pytest.raises(ValueError, match="already exists"):
                await subscription_service.create_subscription(url="https://example.com/feed.xml", folder_id=folder_id)

    @pytest.mark.asyncio
    async def test_get_subscription_by_id_found(self, subscription_service, sample_subscription_response):
        """Should return subscription when found."""
        subscription_id = sample_subscription_response.id

        with patch("app.crud.crud_subscription.get_subscription_by_id") as mock_get:
            mock_sub = Mock()
            mock_sub.id = sample_subscription_response.id
            mock_sub.user_id = sample_subscription_response.user_id
            mock_sub.feed_id = sample_subscription_response.feed_id
            mock_sub.folder_id = sample_subscription_response.folder_id
            mock_sub.is_favorite = sample_subscription_response.is_favorite
            mock_sub.custom_title = sample_subscription_response.custom_title
            mock_sub.created_at = sample_subscription_response.created_at
            mock_sub.updated_at = sample_subscription_response.updated_at
            mock_sub.feed = sample_subscription_response.feed
            mock_sub.folder = sample_subscription_response.folder

            mock_get.return_value = mock_sub

            result = await subscription_service.get_subscription_by_id(subscription_id=subscription_id)

            assert result is not None
            assert result.id == subscription_id
            mock_get.assert_called_once_with(
                subscription_service.db,
                subscription_id=subscription_id,
                user_id=subscription_service.user_id,
            )

    @pytest.mark.asyncio
    async def test_get_subscription_by_id_not_found(self, subscription_service):
        """Should return None when subscription not found."""
        subscription_id = uuid4()

        with patch("app.crud.crud_subscription.get_subscription_by_id") as mock_get:
            mock_get.return_value = None

            result = await subscription_service.get_subscription_by_id(subscription_id=subscription_id)

            assert result is None

    @pytest.mark.asyncio
    async def test_list_subscriptions_with_filters(self, subscription_service):
        """Should list subscriptions with filters applied."""
        folder_id = uuid4()

        with patch("app.crud.crud_subscription.get_subscriptions_by_user") as mock_list:
            mock_list.return_value = []

            await subscription_service.list_subscriptions(
                folder_id=folder_id,
                tag_names=["tech", "news"],
                is_favorite=True,
                search_query="python",
                skip=10,
                limit=50,
            )

            mock_list.assert_called_once_with(
                subscription_service.db,
                user_id=subscription_service.user_id,
                folder_id=folder_id,
                tag_names=["tech", "news"],
                is_favorite=True,
                search_query="python",
                skip=10,
                limit=50,
            )

    @pytest.mark.asyncio
    async def test_delete_subscription_success(self, subscription_service):
        """Should successfully delete subscription."""
        subscription_id = uuid4()

        with patch("app.crud.crud_subscription.delete_subscription") as mock_delete:
            mock_delete.return_value = Mock()  # Non-None indicates success

            result = await subscription_service.delete_subscription(subscription_id=subscription_id)

            assert result is True
            mock_delete.assert_called_once_with(
                subscription_service.db,
                subscription_id=subscription_id,
                user_id=subscription_service.user_id,
            )

    @pytest.mark.asyncio
    async def test_delete_subscription_not_found(self, subscription_service):
        """Should return False when subscription not found."""
        subscription_id = uuid4()

        with patch("app.crud.crud_subscription.delete_subscription") as mock_delete:
            mock_delete.return_value = None

            result = await subscription_service.delete_subscription(subscription_id=subscription_id)

            assert result is False

    @pytest.mark.asyncio
    async def test_get_legacy_feed_response_maps_correctly(self, subscription_service, sample_subscription_response):
        """Should correctly map subscription to legacy feed format."""
        subscription_id = sample_subscription_response.id

        with patch("app.crud.crud_subscription.get_subscription_by_id") as mock_get:
            # Create mock subscription with all required attributes
            mock_sub = Mock()
            mock_sub.id = sample_subscription_response.id
            mock_sub.user_id = sample_subscription_response.user_id
            mock_sub.folder_id = sample_subscription_response.folder_id
            mock_sub.is_favorite = sample_subscription_response.is_favorite
            mock_sub.custom_title = "Custom Title"
            mock_sub.created_at = sample_subscription_response.created_at
            mock_sub.updated_at = sample_subscription_response.updated_at

            # Mock feed - get_legacy_feed_response accesses the full feed from DB,
            # not the minimal SubscriptionFeedResponse
            mock_feed = Mock()
            mock_feed.url = sample_subscription_response.feed.url
            mock_feed.title = sample_subscription_response.feed.title
            mock_feed.description = "A sample feed"  # Full feed has description
            mock_feed.link = sample_subscription_response.feed.link
            mock_feed.language = sample_subscription_response.feed.language
            mock_feed.image_url = sample_subscription_response.feed.image_url
            mock_feed.ttl = 60  # Full feed has ttl
            mock_feed.skip_hours = None
            mock_feed.skip_days = None
            mock_feed.last_fetched_at = sample_subscription_response.feed.last_fetched_at
            mock_feed.last_modified_header = None
            mock_feed.etag_header = None
            mock_feed.last_article_published_at = sample_subscription_response.feed.last_article_published_at

            mock_sub.feed = mock_feed
            mock_get.return_value = mock_sub

            result = await subscription_service.get_legacy_feed_response(subscription_id=subscription_id)

            assert result is not None
            assert result.id == subscription_id  # Uses subscription ID as "feed" ID
            assert result.title == "Custom Title"  # Uses custom title
            assert result.url == sample_subscription_response.feed.url
            assert result.is_favorite == sample_subscription_response.is_favorite
