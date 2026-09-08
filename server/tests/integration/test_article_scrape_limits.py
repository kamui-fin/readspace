"""Integration tests for the daily article-scrape quota (free tier: 5/day, pro: unlimited)."""

import hashlib
from datetime import UTC, datetime
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import ArticleContent, FeedArticle, UserEntry
from app.models.enums import UserRole
from app.models.feed import Feed, FeedSubscription
from app.models.user import Profile

SCRAPE_RESULT = ("<p>extracted body</p>", None)


@pytest_asyncio.fixture
async def short_article(db_session: AsyncSession, test_feed: Feed, test_user: Profile, test_folder) -> FeedArticle:
    """An article whose stored content is shorter than MIN_CONTENT_LENGTH, so it triggers auto-extract."""
    subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
    db_session.add(subscription)
    await db_session.flush()

    link = "https://example.com/short-article"
    content = ArticleContent(
        title="Short Article",
        link=link,
        content_hash=hashlib.sha256(link.encode()).hexdigest(),
        description="Short description",
        content="Too short to be considered complete.",
    )
    db_session.add(content)
    await db_session.flush()

    article = FeedArticle(
        feed_id=test_feed.id,
        content_id=content.id,
        guid_hash="scrape-limit-guid",
        published_at=datetime.now(UTC),
    )
    db_session.add(article)
    await db_session.flush()

    db_session.add(UserEntry(user_id=test_user.id, content_id=content.id, feed_article_id=article.id, is_read=False))
    await db_session.flush()

    return article


@pytest.mark.asyncio
async def test_free_tier_scrape_quota_blocks_sixth_explicit_extraction(
    async_client: AsyncClient, short_article: FeedArticle
):
    """A basic user gets 5 successful explicit extractions, then a 429."""
    with patch(
        "app.routers.articles.articles_enhancements.extract_full_content",
        return_value=SCRAPE_RESULT,
    ):
        for _ in range(5):
            resp = await async_client.post(f"/api/articles/{short_article.id}/extract-full-text")
            assert resp.status_code == 200

        blocked = await async_client.post(f"/api/articles/{short_article.id}/extract-full-text")

    assert blocked.status_code == 429
    assert blocked.json()["error_code"] == "SCRAPE_LIMIT_EXCEEDED"


@pytest.mark.asyncio
async def test_pro_tier_scrape_is_unlimited(
    async_client: AsyncClient, short_article: FeedArticle, test_user: Profile, db_session: AsyncSession
):
    """A pro user is never blocked, regardless of how many extractions they run."""
    test_user.role = UserRole.PRO
    db_session.add(test_user)
    await db_session.flush()

    with patch(
        "app.routers.articles.articles_enhancements.extract_full_content",
        return_value=SCRAPE_RESULT,
    ):
        for _ in range(8):
            resp = await async_client.post(f"/api/articles/{short_article.id}/extract-full-text")
            assert resp.status_code == 200


@pytest.mark.asyncio
async def test_auto_extract_counts_toward_quota_and_degrades_gracefully(
    async_client: AsyncClient, short_article: FeedArticle
):
    """
    Implicit auto-extract on GET /articles/{id} also consumes the quota. Once exhausted,
    the article still loads (200) but without extracted_content -- no 429.
    """
    with patch(
        "app.services.articles.scrape.extract_full_content",
        return_value=SCRAPE_RESULT,
    ) as mock_extract:
        # 5 opens -> 5 auto-extracts
        for _ in range(5):
            resp = await async_client.get(f"/api/articles/{short_article.id}")
            assert resp.status_code == 200
            assert resp.json().get("extracted_content") == SCRAPE_RESULT[0]

        assert mock_extract.call_count == 5

        # 6th open: quota exhausted -> extraction skipped, article still returned
        resp = await async_client.get(f"/api/articles/{short_article.id}")
        assert resp.status_code == 200
        assert resp.json().get("extracted_content") is None
        assert mock_extract.call_count == 5  # not called again


@pytest.mark.asyncio
async def test_limits_endpoint_reports_scrape_usage(async_client: AsyncClient, short_article: FeedArticle):
    """GET /api/users/limits exposes max_daily_scrapes and daily_scrapes usage."""
    with patch(
        "app.routers.articles.articles_enhancements.extract_full_content",
        return_value=SCRAPE_RESULT,
    ):
        await async_client.post(f"/api/articles/{short_article.id}/extract-full-text")
        await async_client.post(f"/api/articles/{short_article.id}/extract-full-text")

    resp = await async_client.get("/api/users/limits")
    assert resp.status_code == 200
    data = resp.json()
    assert data["limits"]["max_daily_scrapes"] == 5
    assert data["usage"]["daily_scrapes"] == 2
