"""Integration tests for clipped articles (saved web articles)."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import ArticleContent, UserEntry
from app.models.user import Profile


@pytest_asyncio.fixture
async def test_clipped_article(db_session: AsyncSession, test_user: Profile):
    """Create a test clipped article for the user."""
    from app.models.enums import ArticlePriority

    # Create article content
    # Note: published_at is not on ArticleContent - it's on FeedArticle for RSS feeds
    # For clipped articles, we use created_at timestamp
    from app.utils.hashing import get_content_hash

    content = ArticleContent(
        title="Test Clipped Article",
        link="https://example.com/test-clipped-article",
        description="A test clipped article description",
        content="<p>Full HTML content of the article</p>",
        content_hash=get_content_hash("https://example.com/test-clipped-article"),
    )
    db_session.add(content)
    await db_session.flush()

    # Create clipped article (UserEntry without feed_article_id)
    clipped = UserEntry(
        user_id=test_user.id,
        content_id=content.id,
        feed_article_id=None,
        priority=ArticlePriority.MEDIUM.value,
        is_read=False,
        is_saved=True,
    )
    db_session.add(clipped)
    await db_session.flush()
    await db_session.commit()  # Commit to ensure data is persisted
    await db_session.refresh(clipped)  # Refresh to load relationships

    return clipped


class TestSaveWebArticle:
    """Test saving web articles."""

    @pytest.mark.asyncio
    async def test_save_article_success(self, async_client: AsyncClient):
        """Test successfully saving a web article."""
        response = await async_client.post(
            "/api/articles/",
            json={
                "url": "https://example.com/new-article",
                "title": "New Article",
                "content": "<p>Article content goes here</p>",
                "metadata": {
                    "author": "Test Author",
                    "description": "Test description",
                },
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert "article_id" in data

    @pytest.mark.asyncio
    async def test_save_article_without_content_succeeds(
        self, async_client: AsyncClient
    ):
        """Test saving article without content succeeds (content is optional)."""
        response = await async_client.post(
            "/api/articles/",
            json={
                "url": "https://example.com/article-without-content",
                "title": "Article Without Content",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert "article_id" in data

    @pytest.mark.asyncio
    async def test_save_article_with_priority(self, async_client: AsyncClient):
        """Test saving article with custom priority."""
        response = await async_client.post(
            "/api/articles/",
            json={
                "url": "https://example.com/high-priority-article",
                "title": "High Priority Article",
                "content": "<p>Important content</p>",
                "priority": "high",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert "article_id" in data

    @pytest.mark.asyncio
    async def test_save_article_with_note(self, async_client: AsyncClient):
        """Test saving article with a note."""
        response = await async_client.post(
            "/api/articles/",
            json={
                "url": "https://example.com/article-with-note",
                "title": "Article With Note",
                "content": "<p>Article content</p>",
                "note": "This is my personal note about this article",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert "article_id" in data

    @pytest.mark.asyncio
    async def test_save_duplicate_article_updates_read_later(
        self,
        async_client: AsyncClient,
        test_clipped_article: UserEntry,
        db_session: AsyncSession,
    ):
        """Test saving an already clipped article re-enables is_saved."""
        # First, mark the existing article as NOT read later
        test_clipped_article.is_saved = False
        await db_session.commit()

        # Try to save the same URL again
        response = await async_client.post(
            "/api/articles/",
            json={
                "url": "https://example.com/test-clipped-article",
                "title": "Re-saved Article",
                "content": "<p>Re-saved content</p>",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert "article_id" in data


class TestCheckArticleSaved:
    """Test checking if an article is already saved."""

    @pytest.mark.asyncio
    async def test_check_saved_article_exists(
        self, async_client: AsyncClient, test_clipped_article: UserEntry
    ):
        """Test checking a saved article returns the article data."""
        response = await async_client.get(
            "/api/articles/check-saved",
            params={"url": "https://example.com/test-clipped-article"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_saved"] is True
        assert data["article_id"] == str(test_clipped_article.id)

    @pytest.mark.asyncio
    async def test_check_saved_article_not_exists(self, async_client: AsyncClient):
        """Test checking a non-saved article returns is_saved: false."""
        response = await async_client.get(
            "/api/articles/check-saved",
            params={"url": "https://example.com/non-existent-article"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_saved"] is False
        assert data["article_id"] is None


class TestUpdateClippedArticle:
    """Test updating clipped article properties."""

    @pytest.mark.asyncio
    async def test_update_clipped_article_priority(
        self,
        async_client: AsyncClient,
        test_clipped_article: UserEntry,
        db_session: AsyncSession,
    ):
        """Test updating the priority of a clipped article."""
        response = await async_client.put(
            f"/api/articles/{test_clipped_article.id}?article_type=clipped",
            json={"priority": "HIGH"},
        )

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_update_clipped_article_note(
        self, async_client: AsyncClient, test_clipped_article: UserEntry
    ):
        """Test updating the note of a clipped article."""
        response = await async_client.put(
            f"/api/articles/{test_clipped_article.id}?article_type=clipped",
            json={"user_note": "Updated note content"},
        )

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_update_clipped_article_read_status(
        self, async_client: AsyncClient, test_clipped_article: UserEntry
    ):
        """Test marking a clipped article as read."""
        response = await async_client.put(
            f"/api/articles/{test_clipped_article.id}?article_type=clipped",
            json={"is_read": True},
        )

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_update_clipped_article_read_later(
        self, async_client: AsyncClient, test_clipped_article: UserEntry
    ):
        """Test toggling read_later status on a clipped article."""
        response = await async_client.put(
            f"/api/articles/{test_clipped_article.id}?article_type=clipped",
            json={"is_saved": False},
        )

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_update_clipped_article_priority_high(
        self, async_client: AsyncClient, test_clipped_article: UserEntry
    ):
        """Test updating priority to high."""
        response = await async_client.put(
            f"/api/articles/{test_clipped_article.id}?article_type=clipped",
            json={"priority": "HIGH"},
        )

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_update_clipped_article_multiple_fields(
        self, async_client: AsyncClient, test_clipped_article: UserEntry
    ):
        """Test updating multiple fields at once."""
        response = await async_client.put(
            f"/api/articles/{test_clipped_article.id}?article_type=clipped",
            json={
                "priority": "LOW",
                "user_note": "New comprehensive note",
                "is_read": True,
            },
        )

        assert response.status_code == 204


class TestReadLaterEndpoint:
    """Test the /read-later endpoint that combines feed and clipped articles."""

    @pytest.mark.asyncio
    async def test_read_later_empty(self, async_client: AsyncClient):
        """Test read-later endpoint with no articles."""
        response = await async_client.get("/api/articles/views/read-later")

        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["has_more"] is False
        assert data["next_cursor"] is None

    @pytest.mark.asyncio
    async def test_read_later_with_clipped_article(
        self, async_client: AsyncClient, test_clipped_article: UserEntry
    ):
        """Test read-later endpoint includes clipped articles."""
        response = await async_client.get("/api/articles/views/read-later")

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1

        # Find our test clipped article
        clipped_item = next(
            (
                item
                for item in data["items"]
                if item["id"] == str(test_clipped_article.id)
            ),
            None,
        )
        assert clipped_item is not None
        assert clipped_item["article_type"] == "clipped"
        assert clipped_item["is_saved"] is True

    @pytest.mark.asyncio
    async def test_read_later_excludes_non_read_later_articles(
        self,
        async_client: AsyncClient,
        test_clipped_article: UserEntry,
        db_session: AsyncSession,
    ):
        """Test that read-later endpoint only includes articles marked as read_later."""
        # Mark the test article as NOT read later
        test_clipped_article.is_saved = False
        await db_session.commit()

        response = await async_client.get("/api/articles/views/read-later")

        assert response.status_code == 200
        data = response.json()

        # The test article should NOT be in the results
        article_ids = [item["id"] for item in data["items"]]
        assert str(test_clipped_article.id) not in article_ids

    @pytest.mark.asyncio
    async def test_read_later_pagination(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
    ):
        """Test pagination in read-later endpoint."""
        # Create multiple clipped articles
        from app.utils.hashing import get_content_hash

        from datetime import timedelta

        base_time = datetime.now(UTC)
        for i in range(5):
            content = ArticleContent(
                title=f"Article {i}",
                link=f"https://example.com/article-{i}",
                content=f"<p>Content {i}</p>",
                content_hash=get_content_hash(f"https://example.com/article-{i}"),
            )
            db_session.add(content)
            await db_session.flush()

            clipped = UserEntry(
                id=uuid4(),
                user_id=test_user.id,
                content_id=content.id,
                feed_article_id=None,
                is_saved=True,
                created_at=base_time
                - timedelta(seconds=i),  # Ensure different timestamps
            )
            db_session.add(clipped)

        await db_session.commit()

        # Test pagination with limit
        response = await async_client.get("/api/articles/views/read-later?limit=3")

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 3
        assert data["has_more"] is True
        assert data["next_cursor"] is not None

        # Test fetching next page
        next_response = await async_client.get(
            f"/api/articles/views/read-later?limit=3&cursor={data['next_cursor']}"
        )

        assert next_response.status_code == 200
        next_data = next_response.json()
        assert len(next_data["items"]) >= 1

        # Ensure no duplicates between pages
        first_page_ids = {item["id"] for item in data["items"]}
        second_page_ids = {item["id"] for item in next_data["items"]}
        assert first_page_ids.isdisjoint(second_page_ids)
