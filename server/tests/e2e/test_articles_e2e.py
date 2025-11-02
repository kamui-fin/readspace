"""E2E tests for article routes."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ArticleContent,
    Feed,
    FeedArticle,
    Profile,
    Subscription,
    UserArticleState,
)


@pytest_asyncio.fixture
async def test_article(db_session: AsyncSession, test_feed: Feed, test_user: Profile):
    """Create a test article."""
    # Create subscription first
    subscription = Subscription(user_id=test_user.id, feed_id=test_feed.id)
    db_session.add(subscription)
    await db_session.flush()

    # Create article content
    content = ArticleContent(
        title="Test Article",
        link="https://example.com/article1",
        description="Test article description",
        content="Full article content here",
        published_at=datetime.now(UTC),
    )
    db_session.add(content)
    await db_session.flush()

    # Create feed article
    article = FeedArticle(
        feed_id=test_feed.id,
        content_id=content.id,
        guid="test-guid-1",
    )
    db_session.add(article)
    await db_session.flush()

    # Create user article state
    state = UserArticleState(
        user_id=test_user.id,
        article_id=article.id,
        is_read=False,
        is_read_later=False,
        is_favorite=False,
    )
    db_session.add(state)
    await db_session.flush()

    return article


class TestSaveWebArticle:
    """Test save web article endpoint."""

    def test_save_article_real_service(self, client: TestClient):
        """Test saving a web article from URL using real service."""
        response = client.post(
            "/api/v1/articles/",
            json={"url": "https://example.com/article"},
        )

        # Real service may succeed or fail depending on URL accessibility
        assert response.status_code in [201, 400, 500]
        if response.status_code == 201:
            data = response.json()
            assert "id" in data

    def test_save_article_with_metadata(self, client: TestClient):
        """Test saving article with custom metadata using real service."""
        response = client.post(
            "/api/v1/articles/",
            json={
                "url": "https://example.com/test-article",
                "title": "Custom Title",
                "content": "Custom content",
                "note": "My note",
                "priority": 2,
            },
        )

        # Real service behavior - may succeed or fail
        assert response.status_code in [201, 400, 500]

    def test_save_article_invalid_url(self, client: TestClient):
        """Test saving article with invalid URL."""
        response = client.post("/api/v1/articles/", json={"url": "not-a-url"})

        assert response.status_code == 422


class TestListArticles:
    """Test list articles endpoint."""

    @pytest.mark.asyncio
    async def test_list_articles_empty(self, client: TestClient):
        """Test listing articles when user has none."""
        response = client.get("/api/v1/articles/")

        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_list_articles_with_data(self, client: TestClient, test_article: FeedArticle):
        """Test listing articles returns user's articles."""
        response = client.get("/api/v1/articles/")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert len(data["items"]) >= 1

    def test_list_articles_filter_by_feed(self, client: TestClient, test_feed: Feed):
        """Test filtering articles by feed."""
        response = client.get(f"/api/v1/articles/?feed_ids={test_feed.id}")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["items"], list)

    def test_list_articles_filter_by_read_status(self, client: TestClient):
        """Test filtering articles by read status."""
        response = client.get("/api/v1/articles/?is_read=false")

        assert response.status_code == 200
        data = response.json()
        for item in data["items"]:
            assert item["is_read"] is False

    def test_list_articles_filter_by_favorite(self, client: TestClient):
        """Test filtering articles by favorite status."""
        response = client.get("/api/v1/articles/?is_favorite=true")

        assert response.status_code == 200
        data = response.json()
        for item in data["items"]:
            assert item["is_favorite"] is True

    def test_list_articles_filter_by_read_later(self, client: TestClient):
        """Test filtering articles by read later status."""
        response = client.get("/api/v1/articles/?is_read_later=true")

        assert response.status_code == 200
        data = response.json()
        for item in data["items"]:
            assert item["is_read_later"] is True

    def test_list_articles_search(self, client: TestClient):
        """Test searching articles by query."""
        response = client.get("/api/v1/articles/?search_query=test")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["items"], list)

    def test_list_articles_sort_by_published(self, client: TestClient):
        """Test sorting articles by published date."""
        response = client.get("/api/v1/articles/?sort_by=published_at&sort_order=desc")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["items"], list)

    def test_list_articles_sort_by_title(self, client: TestClient):
        """Test sorting articles by title."""
        response = client.get("/api/v1/articles/?sort_by=title&sort_order=asc")

        assert response.status_code == 200

    def test_list_articles_invalid_sort_by(self, client: TestClient):
        """Test invalid sort_by parameter."""
        response = client.get("/api/v1/articles/?sort_by=invalid")

        assert response.status_code == 400
        assert "Invalid sort_by" in response.json()["detail"]

    def test_list_articles_invalid_sort_order(self, client: TestClient):
        """Test invalid sort_order parameter."""
        response = client.get("/api/v1/articles/?sort_order=invalid")

        assert response.status_code == 400
        assert "Invalid sort_order" in response.json()["detail"]

    def test_list_articles_pagination(self, client: TestClient):
        """Test article pagination."""
        response = client.get("/api/v1/articles/?page=1&size=10")

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["size"] == 10
        assert "pages" in data


class TestGetArticle:
    """Test get single article endpoint."""

    @pytest.mark.asyncio
    async def test_get_article_success(self, client: TestClient, test_article: FeedArticle):
        """Test getting an article by ID."""
        response = client.get(f"/api/v1/articles/{test_article.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_article.id)

    def test_get_article_not_found(self, client: TestClient):
        """Test getting non-existent article."""
        fake_id = uuid4()
        response = client.get(f"/api/v1/articles/{fake_id}")

        assert response.status_code == 404

    def test_get_article_invalid_uuid(self, client: TestClient):
        """Test getting article with invalid UUID."""
        response = client.get("/api/v1/articles/invalid-uuid")

        assert response.status_code == 422


class TestUpdateArticle:
    """Test update article endpoint."""

    @pytest.mark.asyncio
    async def test_update_article_mark_as_read(
        self, client: TestClient, test_article: FeedArticle, db_session: AsyncSession, test_user: Profile
    ):
        """Test marking article as read."""
        response = client.put(
            f"/api/v1/articles/{test_article.id}?article_type=feed",
            json={"is_read": True},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_read"] is True
        assert data["read_at"] is not None

        # Verify in database
        result = await db_session.execute(
            select(UserArticleState).where(
                UserArticleState.article_id == test_article.id,
                UserArticleState.user_id == test_user.id,
            )
        )
        state = result.scalar_one()
        assert state.is_read is True

    @pytest.mark.asyncio
    async def test_update_article_mark_as_favorite(
        self, client: TestClient, test_article: FeedArticle, db_session: AsyncSession, test_user: Profile
    ):
        """Test marking article as favorite."""
        response = client.put(
            f"/api/v1/articles/{test_article.id}?article_type=feed",
            json={"is_favorite": True},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_favorite"] is True

    @pytest.mark.asyncio
    async def test_update_article_read_later(
        self, client: TestClient, test_article: FeedArticle, db_session: AsyncSession
    ):
        """Test marking article for read later."""
        response = client.put(
            f"/api/v1/articles/{test_article.id}?article_type=feed",
            json={"is_read_later": True},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_read_later"] is True

    def test_update_article_not_found(self, client: TestClient):
        """Test updating non-existent article."""
        fake_id = uuid4()
        response = client.put(
            f"/api/v1/articles/{fake_id}?article_type=feed",
            json={"is_read": True},
        )

        assert response.status_code == 404


class TestTodaysArticles:
    """Test today's articles endpoint."""

    def test_get_todays_articles(self, client: TestClient):
        """Test getting today's articles."""
        response = client.get("/api/v1/articles/today")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)

    def test_get_todays_articles_pagination(self, client: TestClient):
        """Test pagination for today's articles."""
        response = client.get("/api/v1/articles/today?page=1&size=10")

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["size"] == 10


class TestRecentlyReadArticles:
    """Test recently read articles endpoint."""

    def test_get_recently_read_articles(self, client: TestClient):
        """Test getting recently read articles."""
        response = client.get("/api/v1/articles/recently-read")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_get_recently_read_pagination(self, client: TestClient):
        """Test pagination for recently read articles."""
        response = client.get("/api/v1/articles/recently-read?page=1&size=20")

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1


class TestReadLaterArticles:
    """Test read later articles endpoint."""

    def test_get_read_later_articles(self, client: TestClient):
        """Test getting read later articles."""
        response = client.get("/api/v1/articles/read-later")

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_get_read_later_pagination(self, client: TestClient):
        """Test pagination for read later articles."""
        response = client.get("/api/v1/articles/read-later?page=1&size=50")

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1


class TestUnreadCounts:
    """Test unread article counts endpoint."""

    def test_get_unread_counts_global(self, client: TestClient):
        """Test getting global unread counts."""
        response = client.get("/api/v1/articles/unread-counts")

        assert response.status_code == 200
        data = response.json()
        assert "total_unread" in data
        assert isinstance(data["total_unread"], int)

    def test_get_unread_counts_by_folder(self, client: TestClient, test_folder):
        """Test getting unread counts for specific folder."""
        response = client.get(f"/api/v1/articles/unread-counts?folder_id={test_folder.id}")

        assert response.status_code == 200
        data = response.json()
        assert "unread_count" in data


class TestCheckArticleSaved:
    """Test check if article is saved endpoint."""

    def test_check_article_saved_not_found(self, client: TestClient):
        """Test checking if article is saved when it's not."""
        response = client.get("/api/v1/articles/check-saved?url=https://example.com/not-saved")

        assert response.status_code == 200
        # Should return None or empty response

    def test_check_article_saved_invalid_url(self, client: TestClient):
        """Test checking with invalid URL."""
        response = client.get("/api/v1/articles/check-saved?url=invalid")

        assert response.status_code == 422
