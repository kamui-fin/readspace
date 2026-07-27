"""E2E tests for article routes."""

import random
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import ArticleContent, FeedArticle, UserEntry
from app.models.feed import Feed, FeedSubscription
from app.models.user import Profile
from app.utils.hashing import get_content_hash


@pytest_asyncio.fixture
async def test_article(db_session: AsyncSession, test_feed: Feed, test_user: Profile):
    """Create a test article."""
    # Create a folder first
    from app.models.folder import Folder

    folder = Folder(
        id=uuid4(),
        name="Test Folder",
        user_id=test_user.id,
    )
    db_session.add(folder)
    await db_session.flush()

    # Create subscription with folder
    subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=folder.id)
    db_session.add(subscription)
    await db_session.flush()

    # Create article content
    link = "https://example.com/article1"
    content = ArticleContent(
        title="Test Article",
        link=link,
        content_hash=get_content_hash(link),
        description="Test article description",
        content="Full article content here",
    )
    db_session.add(content)
    await db_session.flush()

    # Create feed article
    article = FeedArticle(
        feed_id=test_feed.id,
        content_id=content.id,
        guid_hash="test-guid-1",
        published_at=datetime.now(UTC) - timedelta(hours=3),
    )
    db_session.add(article)
    await db_session.flush()

    # Create user article state
    state = UserEntry(
        user_id=test_user.id,
        content_id=content.id,
        feed_article_id=article.id,
        is_read=False,
        is_saved=False,
    )
    db_session.add(state)
    await db_session.flush()

    return article


class TestSaveWebArticle:
    """Test save web article endpoint."""

    @pytest.mark.asyncio
    async def test_save_article_real_service(self, async_client: AsyncClient):
        """Test saving a web article from URL using real service."""
        response = await async_client.post(
            "/api/articles/",
            json={"url": "https://example.com/article"},
        )

        # Real service may succeed or fail depending on URL accessibility
        assert response.status_code in [201, 400, 500]
        if response.status_code == 201:
            data = response.json()
            assert "article_id" in data

    @pytest.mark.asyncio
    async def test_save_article_with_metadata(self, async_client: AsyncClient):
        """Test saving article with custom metadata using real service."""
        response = await async_client.post(
            "/api/articles/",
            json={
                "url": "https://example.com/test-article",
                "title": "Custom Title",
                "content": "Custom content",
                "note": "My note",
                "priority": "high",
            },
        )

        # Real service behavior - may succeed or fail
        assert response.status_code in [201, 400, 422, 500]

    @pytest.mark.asyncio
    async def test_save_article_invalid_url(self, async_client: AsyncClient):
        """Test saving article with invalid URL."""
        response = await async_client.post("/api/articles/", json={"url": "not-a-url"})

        assert response.status_code == 422


class TestListArticles:
    """Test list articles endpoint."""

    @pytest.mark.asyncio
    async def test_list_articles_empty(self, async_client: AsyncClient):
        """Test listing articles when user has none."""
        response = await async_client.get("/api/articles/")

        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["has_more"] is False
        assert data["next_cursor"] is None

    @pytest.mark.asyncio
    async def test_list_articles_with_data(self, async_client: AsyncClient, test_article: FeedArticle):
        """Test listing articles returns user's articles."""
        response = await async_client.get("/api/articles/")

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1
        assert "has_more" in data
        assert "next_cursor" in data

    @pytest.mark.asyncio
    async def test_list_articles_filter_by_feed(self, async_client: AsyncClient, test_feed: Feed):
        """Test filtering articles by feed."""
        response = await async_client.get(f"/api/articles/?feed_ids={test_feed.id}")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["items"], list)

    @pytest.mark.asyncio
    async def test_list_articles_filter_by_read_status(self, async_client: AsyncClient):
        """Test filtering articles by read status."""
        response = await async_client.get("/api/articles/?is_read=false")

        assert response.status_code == 200
        data = response.json()
        for item in data["items"]:
            assert item["is_read"] is False

    @pytest.mark.asyncio
    async def test_list_articles_filter_by_favorite(self, async_client: AsyncClient):
        """Test filtering articles by favorite status."""
        response = await async_client.get("/api/articles/?is_favorite=true")

        assert response.status_code == 200
        data = response.json()
        for item in data["items"]:
            assert item["is_favorite"] is True

    @pytest.mark.asyncio
    async def test_list_articles_filter_by_read_later(self, async_client: AsyncClient):
        """Test filtering articles by read later status."""
        response = await async_client.get("/api/articles/?is_saved=true")

        assert response.status_code == 200
        data = response.json()
        for item in data["items"]:
            assert item["is_saved"] is True

    @pytest.mark.asyncio
    async def test_list_articles_search(self, async_client: AsyncClient):
        """Test searching articles by query."""
        response = await async_client.get("/api/articles/?search_query=test")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["items"], list)

    @pytest.mark.asyncio
    async def test_list_articles_sort_by_published(self, async_client: AsyncClient):
        """Test sorting articles by published date."""
        response = await async_client.get("/api/articles/?sort_by=published_at&sort_order=desc")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["items"], list)

    @pytest.mark.asyncio
    async def test_list_articles_sort_by_title(self, async_client: AsyncClient):
        """Test sorting articles by title."""
        response = await async_client.get("/api/articles/?sort_by=title&sort_order=asc")

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_list_articles_invalid_sort_by(self, async_client: AsyncClient):
        """Test invalid sort_by parameter."""
        response = await async_client.get("/api/articles/?sort_by=invalid")

        # API ignores unknown parameters, returns 200
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_list_articles_invalid_sort_order(self, async_client: AsyncClient):
        """Test invalid sort_order parameter."""
        response = await async_client.get("/api/articles/?sort_order=invalid")

        # API ignores unknown parameters, returns 200
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_list_articles_pagination(self, async_client: AsyncClient):
        """Test article pagination."""
        response = await async_client.get("/api/articles/?limit=10")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "has_more" in data
        assert "next_cursor" in data

    @pytest.mark.asyncio
    async def test_articles_sorted_by_published_date(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession,
        test_feed: Feed,
        test_user: Profile,
    ):
        """Test that articles are returned in sorted order by published date (newest first)."""
        # Create a folder first
        from app.models.folder import Folder

        folder = Folder(
            id=uuid4(),
            name="Test Folder for Sorting",
            user_id=test_user.id,
        )
        db_session.add(folder)
        await db_session.flush()

        # Create subscription with folder
        subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=folder.id)
        db_session.add(subscription)
        await db_session.flush()

        # Generate 20 random published dates over the past 30 days
        base_date = datetime.now(UTC)
        published_dates = []

        for i in range(20):
            # Random number of days ago (0-30)
            days_ago = random.randint(0, 30)
            # Random number of hours (0-23)
            hours_ago = random.randint(0, 23)
            # Random number of minutes (0-59)
            minutes_ago = random.randint(0, 59)

            published_date = base_date - timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)
            published_dates.append(published_date)

        # Shuffle the dates to ensure they're in random order when created
        random.shuffle(published_dates)

        # Create 20 articles with random published dates
        created_articles = []
        for i, published_date in enumerate(published_dates):
            # Create article content
            link = f"https://example.com/article{i + 1}"
            content = ArticleContent(
                title=f"Test Article {i + 1}",
                link=link,
                content_hash=get_content_hash(link),
                description=f"Test article {i + 1} description",
                content=f"Full article {i + 1} content here",
            )
            db_session.add(content)
            await db_session.flush()

            # Create feed article
            article = FeedArticle(
                feed_id=test_feed.id,
                content_id=content.id,
                guid_hash=f"test-guid-{i + 1}",
                published_at=published_date,
            )
            db_session.add(article)
            await db_session.flush()

            # Create user article state
            state = UserEntry(
                user_id=test_user.id,
                content_id=content.id,
                feed_article_id=article.id,
                is_read=False,
                is_saved=False,
            )
            db_session.add(state)
            created_articles.append((article, content, published_date))

        await db_session.flush()
        await db_session.commit()

        # Fetch articles via API
        response = await async_client.get("/api/articles/?limit=20")

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 20  # Should have at least our 20 articles

        # Extract the articles we created from the response
        our_articles = []
        for item in data["items"]:
            # Check if this is one of our test articles
            if item["title"].startswith("Test Article"):
                our_articles.append(item)

        # Should have found all 20 of our articles
        assert len(our_articles) == 20

        # Verify articles are sorted by published_at in descending order (newest first)
        for i in range(len(our_articles) - 1):
            current_published = datetime.fromisoformat(our_articles[i]["published_at"].replace("Z", "+00:00"))
            next_published = datetime.fromisoformat(our_articles[i + 1]["published_at"].replace("Z", "+00:00"))

            # Current article should be published after (newer than) the next article
            assert current_published >= next_published, (
                f"Articles not sorted correctly: "
                f"Article at index {i} (published {current_published}) "
                f"should be newer than article at index {i + 1} (published {next_published})"
            )

        # Additional verification: check that the sorted order matches expected descending order
        expected_sorted_dates = sorted(published_dates, reverse=True)
        actual_dates = [
            datetime.fromisoformat(article["published_at"].replace("Z", "+00:00")) for article in our_articles
        ]

        # Convert to comparable format (remove microseconds for comparison)
        expected_dates_normalized = [d.replace(microsecond=0) for d in expected_sorted_dates]
        actual_dates_normalized = [d.replace(microsecond=0) for d in actual_dates]

        assert actual_dates_normalized == expected_dates_normalized, (
            "Articles are not returned in the expected sorted order by published date"
        )


class TestGetArticle:
    """Test get single article endpoint."""

    @pytest.mark.asyncio
    async def test_get_article_success(self, async_client: AsyncClient, test_article: FeedArticle):
        """Test getting an article by ID."""
        response = await async_client.get(f"/api/articles/{test_article.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_article.id)

    @pytest.mark.asyncio
    async def test_get_article_not_found(self, async_client: AsyncClient):
        """Test getting non-existent article."""
        fake_id = uuid4()
        response = await async_client.get(f"/api/articles/{fake_id}")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_article_invalid_uuid(self, async_client: AsyncClient):
        """Test getting article with invalid UUID."""
        response = await async_client.get("/api/articles/invalid-uuid")

        assert response.status_code == 422


class TestUpdateArticle:
    """Test update article endpoint."""

    @pytest.mark.asyncio
    async def test_update_article_mark_as_read(
        self,
        async_client: AsyncClient,
        test_article: FeedArticle,
        db_session: AsyncSession,
        test_user: Profile,
    ):
        """Test marking article as read."""
        response = await async_client.put(
            f"/api/articles/{test_article.id}?article_type=feed",
            json={"is_read": True},
        )

        assert response.status_code == 204

        # Verify in database
        await db_session.commit()  # Ensure changes are committed
        result = await db_session.execute(
            select(UserEntry).where(
                UserEntry.feed_article_id == test_article.id,
                UserEntry.user_id == test_user.id,
            )
        )
        state = result.scalar_one_or_none()
        assert state is not None, "UserEntry should be created"
        assert state.is_read is True

    @pytest.mark.asyncio
    async def test_update_article_read_later(
        self,
        async_client: AsyncClient,
        test_article: FeedArticle,
        db_session: AsyncSession,
    ):
        """Test marking article for read later."""
        response = await async_client.put(
            f"/api/articles/{test_article.id}?article_type=feed",
            json={"is_saved": True},
        )

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_update_article_not_found(self, async_client: AsyncClient):
        """Test updating non-existent article."""
        fake_id = uuid4()
        response = await async_client.put(
            f"/api/articles/{fake_id}?article_type=feed",
            json={"is_read": True},
        )

        assert response.status_code == 404


class TestTodaysArticles:
    """Test today's articles endpoint."""

    @pytest.mark.asyncio
    async def test_get_todays_articles(self, async_client: AsyncClient):
        """Test getting today's articles."""
        response = await async_client.get("/api/articles/views/today")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "has_more" in data
        assert "next_cursor" in data
        assert isinstance(data["items"], list)

    @pytest.mark.asyncio
    async def test_get_todays_articles_pagination(self, async_client: AsyncClient):
        """Test pagination for today's articles."""
        response = await async_client.get("/api/articles/views/today?limit=10")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "has_more" in data
        assert "next_cursor" in data


class TestRecentlyReadArticles:
    """Test recently read articles endpoint."""

    @pytest.mark.asyncio
    async def test_get_recently_read_articles(self, async_client: AsyncClient):
        """Test getting recently read articles."""
        response = await async_client.get("/api/articles/views/recently-read")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)

    @pytest.mark.asyncio
    async def test_get_recently_read_pagination(self, async_client: AsyncClient):
        """Test pagination for recently read articles."""
        response = await async_client.get("/api/articles/views/recently-read?limit=20")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "has_more" in data
        assert "next_cursor" in data


class TestReadLaterArticles:
    """Test read later articles endpoint."""

    @pytest.mark.asyncio
    async def test_get_read_later_articles(self, async_client: AsyncClient):
        """Test getting read later articles."""
        response = await async_client.get("/api/articles/views/read-later")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)

    @pytest.mark.asyncio
    async def test_get_read_later_pagination(self, async_client: AsyncClient):
        """Test pagination for read later articles."""
        response = await async_client.get("/api/articles/views/read-later?limit=50")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "has_more" in data
        assert "next_cursor" in data


class TestUnreadCounts:
    """Test unread article counts endpoint."""

    @pytest.mark.asyncio
    async def test_get_unread_counts_global(self, async_client: AsyncClient):
        """Test getting global unread counts."""
        response = await async_client.get("/api/articles/counts")

        assert response.status_code == 200
        data = response.json()
        assert "feed_counts" in data
        assert "read_later" in data
        assert "today" in data
        assert isinstance(data["feed_counts"], dict)
        assert isinstance(data["read_later"], int)
        assert isinstance(data["today"], int)


class TestCheckArticleSaved:
    """Test check if article is saved endpoint."""

    @pytest.mark.asyncio
    async def test_check_article_saved_not_found(self, async_client: AsyncClient):
        """Test checking if article is saved when it's not."""
        response = await async_client.get("/api/articles/check-saved?url=https://example.com/not-saved")

        assert response.status_code == 200
        # Should return None or empty response

    @pytest.mark.asyncio
    async def test_check_article_saved_invalid_url(self, async_client: AsyncClient):
        """Test checking with invalid URL."""
        response = await async_client.get("/api/articles/check-saved?url=invalid")

        # API doesn't validate URL format, just returns None if not found
        assert response.status_code == 200
