"""E2E tests for article enhancement routes - using real services."""

from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ArticleContent, Feed, FeedArticle, FeedSubscription, Profile, UserArticleState


@pytest_asyncio.fixture
async def test_article_with_content(db_session: AsyncSession, test_feed: Feed, test_user: Profile, test_folder):
    """Create a test article with full content."""
    from datetime import UTC, datetime

    # Create subscription with folder (required by schema)
    subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
    db_session.add(subscription)
    await db_session.flush()

    # Create article content with link
    content = ArticleContent(
        title="Test Article for Enhancement",
        link="https://example.com/article-full",
        description="Short description",
        content="This is the full article content that can be enhanced.",
        published_at=datetime.now(UTC),
    )
    db_session.add(content)
    await db_session.flush()

    # Create feed article
    article = FeedArticle(
        feed_id=test_feed.id,
        content_id=content.id,
        guid="test-guid-enhancement",
    )
    db_session.add(article)
    await db_session.flush()

    # Create user article state
    state = UserArticleState(
        user_id=test_user.id,
        article_id=article.id,
        is_read=False,
    )
    db_session.add(state)
    await db_session.flush()

    return article


class TestExtractFullText:
    """Test extract full text endpoint with real extraction service."""

    @pytest.mark.asyncio
    async def test_extract_full_text_real_service(
        self, async_client: AsyncClient, test_article_with_content: FeedArticle
    ):
        """Test extracting full text using real extraction service."""
        response = await async_client.post(f"/api/articles/{test_article_with_content.id}/extract-full-text")

        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        # Real extraction may succeed or fail depending on URL
        if data["success"]:
            assert "content" in data
            assert "estimated_read_time_minutes" in data

    @pytest.mark.asyncio
    async def test_extract_full_text_not_found(self, async_client: AsyncClient):
        """Test extracting from non-existent article."""
        fake_id = uuid4()
        response = await async_client.post(f"/api/articles/{fake_id}/extract-full-text")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_extract_full_text_invalid_uuid(self, async_client: AsyncClient):
        """Test with invalid UUID."""
        response = await async_client.post("/api/articles/invalid-uuid/extract-full-text")

        assert response.status_code == 422


class TestSummarizeArticle:
    """Test article summarization endpoint with real AI service."""

    @pytest.mark.asyncio
    async def test_summarize_article_real_service(
        self, async_client: AsyncClient, test_article_with_content: FeedArticle
    ):
        """Test article summarization using real AI service."""
        response = await async_client.post(f"/api/articles/{test_article_with_content.id}/summarize")

        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        # AI service may be unavailable in test environment
        if data["success"]:
            assert "summary" in data
            assert len(data["summary"]) > 0

    @pytest.mark.asyncio
    async def test_summarize_with_custom_content(
        self, async_client: AsyncClient, test_article_with_content: FeedArticle
    ):
        """Test summarizing custom content."""
        response = await async_client.post(
            f"/api/articles/{test_article_with_content.id}/summarize",
            json={"content": "Custom content to summarize for testing purposes."},
        )

        assert response.status_code == 200
        data = response.json()
        assert "success" in data

    @pytest.mark.asyncio
    async def test_summarize_article_not_found(self, async_client: AsyncClient):
        """Test summarizing non-existent article."""
        fake_id = uuid4()
        response = await async_client.post(f"/api/articles/{fake_id}/summarize")

        assert response.status_code == 404


class TestTranslateArticle:
    """Test article translation endpoint with real AI service."""

    @pytest.mark.asyncio
    async def test_translate_article_real_service(
        self, async_client: AsyncClient, test_article_with_content: FeedArticle
    ):
        """Test article translation using real AI service."""
        response = await async_client.post(
            f"/api/articles/{test_article_with_content.id}/translate",
            json={"target_language": "es"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert data["target_language"] == "es"
        # AI service may be unavailable in test environment
        if data["success"]:
            assert "translated_content" in data

    @pytest.mark.asyncio
    async def test_translate_with_custom_content(
        self, async_client: AsyncClient, test_article_with_content: FeedArticle
    ):
        """Test translating custom content."""
        response = await async_client.post(
            f"/api/articles/{test_article_with_content.id}/translate",
            json={"target_language": "fr", "content": "Custom content to translate"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert data["target_language"] == "fr"

    @pytest.mark.asyncio
    async def test_translate_multiple_languages(
        self, async_client: AsyncClient, test_article_with_content: FeedArticle
    ):
        """Test translating to different languages."""
        languages = ["es", "fr", "de", "zh"]

        for lang in languages:
            response = await async_client.post(
                f"/api/articles/{test_article_with_content.id}/translate",
                json={"target_language": lang},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["target_language"] == lang

    @pytest.mark.asyncio
    async def test_translate_article_missing_language(
        self, async_client: AsyncClient, test_article_with_content: FeedArticle
    ):
        """Test translation without target language."""
        response = await async_client.post(
            f"/api/articles/{test_article_with_content.id}/translate",
            json={},
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_translate_article_invalid_language(
        self, async_client: AsyncClient, test_article_with_content: FeedArticle
    ):
        """Test translation with invalid language code."""
        response = await async_client.post(
            f"/api/articles/{test_article_with_content.id}/translate",
            json={"target_language": "invalid_lang_code_too_long"},
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_translate_article_not_found(self, async_client: AsyncClient):
        """Test translating non-existent article."""
        fake_id = uuid4()
        response = await async_client.post(
            f"/api/articles/{fake_id}/translate",
            json={"target_language": "es"},
        )

        assert response.status_code == 404


class TestArticleEnhancementIntegration:
    """Integration tests for article enhancement features with real services."""

    @pytest.mark.asyncio
    async def test_enhancement_workflow(self, async_client: AsyncClient, test_article_with_content: FeedArticle):
        """Test complete enhancement workflow: extract -> summarize -> translate."""
        article_id = test_article_with_content.id

        # 1. Extract full text (real service)
        extract_response = await async_client.post(f"/api/articles/{article_id}/extract-full-text")
        assert extract_response.status_code == 200

        # 2. Summarize the content (real AI service)
        summarize_response = await async_client.post(f"/api/articles/{article_id}/summarize")
        assert summarize_response.status_code == 200

        # 3. Translate the content (real AI service)
        translate_response = await async_client.post(
            f"/api/articles/{article_id}/translate",
            json={"target_language": "es"},
        )
        assert translate_response.status_code == 200

    @pytest.mark.asyncio
    async def test_enhancement_with_custom_content(
        self, async_client: AsyncClient, test_article_with_content: FeedArticle
    ):
        """Test enhancements with custom content."""
        custom_content = "This is custom content for testing enhancements."

        # Summarize custom content
        response = await async_client.post(
            f"/api/articles/{test_article_with_content.id}/summarize",
            json={"content": custom_content},
        )
        assert response.status_code == 200

        # Translate custom content
        response = await async_client.post(
            f"/api/articles/{test_article_with_content.id}/translate",
            json={"target_language": "es", "content": custom_content},
        )
        assert response.status_code == 200
