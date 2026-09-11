"""E2E tests for article enhancement routes - using real services."""

import hashlib
from datetime import date
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import ArticleContent, FeedArticle, UserEntry
from app.models.feed import Feed, FeedSubscription
from app.models.user import Profile
from app.services.ai.service import generate_highlights as real_generate_highlights


@pytest.fixture(autouse=True)
def mock_ai_service():
    """Mock AI service to return test responses."""
    with (
        patch("app.services.ai.service.generate_summary") as mock_summary,
        patch("app.services.ai.service.translate_content") as mock_translate,
        patch("app.services.ai.service.translate_metadata") as mock_translate_metadata,
        patch("app.services.ai.service.generate_highlights") as mock_highlights,
    ):
        mock_summary.return_value = "This is a test summary of the article content."
        mock_translate.return_value = "Este es el contenido traducido."
        mock_translate_metadata.return_value = {
            "title": "Titulo Traducido",
            "description": "Descripcion Traducida",
            "tags": ["Etiqueta 1", "Etiqueta 2"],
        }
        mock_highlights.return_value = (
            '<mark data-rank="1">This is the full article content</mark> that can be enhanced.'
        )
        yield


@pytest_asyncio.fixture
async def test_article_with_content(db_session: AsyncSession, test_feed: Feed, test_user: Profile, test_folder):
    """Create a test article with full content."""
    from datetime import UTC, datetime

    # Create subscription with folder (required by schema)
    subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
    db_session.add(subscription)
    await db_session.flush()

    # Create article content with link
    link = "https://example.com/article-full"
    content_hash = hashlib.sha256(link.encode()).hexdigest()
    content = ArticleContent(
        title="Test Article for Enhancement",
        link=link,
        content_hash=content_hash,
        description="Short description",
        content="This is the full article content that can be enhanced.",
    )
    db_session.add(content)
    await db_session.flush()

    # Create feed article
    article = FeedArticle(
        feed_id=test_feed.id,
        content_id=content.id,
        guid_hash="test-guid-enhancement",
        published_at=datetime.now(UTC),
    )
    db_session.add(article)
    await db_session.flush()

    # Create user article state
    state = UserEntry(
        user_id=test_user.id,
        content_id=content.id,
        feed_article_id=article.id,
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

        # Extraction from example.com will fail with 404, expect 400
        assert response.status_code == 400
        data = response.json()
        assert "message" in data

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
        assert "summary" in data

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
        assert data["target_language"] == "es"
        assert "translated_content" in data
        assert data["translated_title"] == "Titulo Traducido"
        assert data["translated_description"] == "Descripcion Traducida"
        assert data["translated_tags"] == ["Etiqueta 1", "Etiqueta 2"]

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
        assert data["target_language"] == "fr"
        assert "translated_content" in data

    @pytest.mark.asyncio
    async def test_translate_multiple_languages(
        self, async_client: AsyncClient, test_article_with_content: FeedArticle, redis_client
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
            await redis_client.flushdb()

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


class TestHighlightArticle:
    """Test AI Highlights (skim mode) endpoint with real AI service."""

    @pytest.mark.asyncio
    async def test_highlight_article_real_service(
        self, async_client: AsyncClient, test_article_with_content: FeedArticle
    ):
        """Test article highlighting using real AI service."""
        response = await async_client.post(f"/api/articles/{test_article_with_content.id}/highlight")

        assert response.status_code == 200
        data = response.json()
        assert "highlighted_content" in data
        assert "<mark" in data["highlighted_content"]
        assert data["highlight_count"] == 1

    @pytest.mark.asyncio
    async def test_highlight_with_custom_content(
        self, async_client: AsyncClient, test_article_with_content: FeedArticle
    ):
        """Test highlighting custom content."""
        response = await async_client.post(
            f"/api/articles/{test_article_with_content.id}/highlight",
            json={"content": "Custom content to highlight for testing purposes."},
        )

        assert response.status_code == 200
        data = response.json()
        assert "highlighted_content" in data

    @pytest.mark.asyncio
    async def test_highlight_article_not_found(self, async_client: AsyncClient):
        """Test highlighting a non-existent article."""
        fake_id = uuid4()
        response = await async_client.post(f"/api/articles/{fake_id}/highlight")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_highlight_article_invalid_uuid(self, async_client: AsyncClient):
        """Test with invalid UUID."""
        response = await async_client.post("/api/articles/invalid-uuid/highlight")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_highlight_allowed_on_newsletter(
        self, async_client: AsyncClient, db_session: AsyncSession, test_feed: Feed, test_user: Profile, test_folder
    ):
        """Unlike Translate, Highlight must not hard-block newsletter emails (PRD §5)."""
        from datetime import UTC, datetime

        subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
        db_session.add(subscription)
        await db_session.flush()

        link = "newsletter://inbound/some-token"
        content_hash = hashlib.sha256(link.encode()).hexdigest()
        content = ArticleContent(
            title="Test Newsletter",
            link=link,
            content_hash=content_hash,
            description="A newsletter digest",
            content="This is a newsletter digest with several stories in it.",
        )
        db_session.add(content)
        await db_session.flush()

        article = FeedArticle(
            feed_id=test_feed.id,
            content_id=content.id,
            guid_hash="test-guid-newsletter-highlight",
            published_at=datetime.now(UTC),
        )
        db_session.add(article)
        await db_session.flush()

        state = UserEntry(
            user_id=test_user.id,
            content_id=content.id,
            feed_article_id=article.id,
            is_read=False,
        )
        db_session.add(state)
        await db_session.flush()

        response = await async_client.post(f"/api/articles/{article.id}/highlight")

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_highlight_article_daily_quota_exceeded(
        self,
        async_client: AsyncClient,
        test_article_with_content: FeedArticle,
        test_user: Profile,
        redis_client,
    ):
        """A basic-tier user at their 5/day AI quota gets AI_LIMIT_EXCEEDED, not a highlight."""
        today_str = date.today().isoformat()
        redis_key = f"ai_usage:{test_user.id}:{today_str}"
        await redis_client.set(redis_key, 5)

        response = await async_client.post(f"/api/articles/{test_article_with_content.id}/highlight")

        assert response.status_code == 429
        data = response.json()
        assert data["error_code"] == "AI_LIMIT_EXCEEDED"

        await redis_client.flushdb()


class TestGenerateHighlightsService:
    """
    Tests the real generate_highlights service function (not the mocked endpoint) to verify
    the text-integrity fallback and nh3 sanitization actually protect the cached/returned
    content, backed by real Redis caching (PRD §6 items d/e).
    """

    @pytest.mark.asyncio
    async def test_discards_reworded_response_and_returns_none(self, redis_client):
        """A hallucinated rewrite must never reach the reader — soft-fail to None."""
        original = "<p>The quick brown fox jumps over the lazy dog near the river.</p>"

        with (
            patch("app.services.ai.service._get_client", return_value=AsyncMock()),
            patch(
                "app.services.ai.service._call_gemini",
                new=AsyncMock(return_value="<p>A completely unrelated made-up sentence about space travel.</p>"),
            ),
        ):
            result = await real_generate_highlights(content=original, article_id=str(uuid4()), language_key="original")

        assert result is None
        await redis_client.flushdb()

    @pytest.mark.asyncio
    async def test_sanitizes_injected_script_while_keeping_marks(self, redis_client):
        """A malicious response with an injected <script> must be stripped before caching."""
        original = "<p>The quick brown fox jumps over the lazy dog near the river.</p>"
        # Realistic model output: only data-rank, no class (the model is never asked for one —
        # generate_highlights must stamp it on so the frontend's mark.rs-highlight CSS matches).
        malicious = (
            '<p>The <mark data-rank="1">quick brown fox</mark> jumps over the lazy dog near the river.</p>'
            '<script>alert("xss")</script>'
        )

        with (
            patch("app.services.ai.service._get_client", return_value=AsyncMock()),
            patch("app.services.ai.service._call_gemini", new=AsyncMock(return_value=malicious)),
        ):
            article_id = str(uuid4())
            result = await real_generate_highlights(content=original, article_id=article_id, language_key="original")

            assert result is not None
            assert "<script" not in result
            assert '<mark class="rs-highlight" data-rank="1">quick brown fox</mark>' in result

            # Second call should hit the Redis cache rather than calling Gemini again
            cached = await real_generate_highlights(content=original, article_id=article_id, language_key="original")
            assert cached == result

        await redis_client.flushdb()


class TestArticleEnhancementIntegration:
    """Integration tests for article enhancement features with real services."""

    @pytest.mark.asyncio
    async def test_enhancement_workflow(self, async_client: AsyncClient, test_article_with_content: FeedArticle):
        """Test complete enhancement workflow: extract -> summarize -> translate."""
        article_id = test_article_with_content.id

        # 1. Extract full text (will fail with example.com URL)
        extract_response = await async_client.post(f"/api/articles/{article_id}/extract-full-text")
        assert extract_response.status_code == 400  # Extraction fails for example.com

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
