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

# A realistic scrape: substantially longer than the feed's teaser, so it clears the
# "is this actually an improvement?" bar that discards paywall stubs.
SCRAPE_RESULT = ("<p>" + "The extracted article body continues. " * 40 + "</p>", None)


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


@pytest_asyncio.fixture
async def short_articles(
    db_session: AsyncSession, test_feed: Feed, test_user: Profile, test_folder
) -> list[FeedArticle]:
    """Six distinct teaser-only articles, so each extraction is a genuine cache miss."""
    subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
    db_session.add(subscription)
    await db_session.flush()

    articles: list[FeedArticle] = []
    for index in range(6):
        link = f"https://example.com/short-article-{index}"
        content = ArticleContent(
            title=f"Short Article {index}",
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
            guid_hash=f"scrape-limit-guid-{index}",
            published_at=datetime.now(UTC),
        )
        db_session.add(article)
        await db_session.flush()

        db_session.add(
            UserEntry(user_id=test_user.id, content_id=content.id, feed_article_id=article.id, is_read=False)
        )
        await db_session.flush()
        articles.append(article)

    return articles


@pytest.mark.asyncio
async def test_free_tier_scrape_quota_blocks_sixth_explicit_extraction(
    async_client: AsyncClient, short_articles: list[FeedArticle]
):
    """
    A basic user gets 5 successful explicit extractions, then a 429.

    Each extraction targets a different article: re-extracting the *same* article is served
    from the stored result and deliberately costs no quota.
    """
    with patch(
        "app.routers.articles.articles_enhancements.extract_full_content",
        return_value=SCRAPE_RESULT,
    ):
        for article in short_articles[:5]:
            resp = await async_client.post(f"/api/articles/{article.id}/extract-full-text")
            assert resp.status_code == 200

        blocked = await async_client.post(f"/api/articles/{short_articles[5].id}/extract-full-text")

    assert blocked.status_code == 429
    assert blocked.json()["error_code"] == "SCRAPE_LIMIT_EXCEEDED"


@pytest.mark.asyncio
async def test_re_extracting_the_same_article_is_free(async_client: AsyncClient, short_article: FeedArticle):
    """One scrape per article, however many times it is opened or re-requested."""
    url = f"/api/articles/{short_article.id}/extract-full-text"
    with patch(
        "app.routers.articles.articles_enhancements.extract_full_content",
        return_value=SCRAPE_RESULT,
    ) as mock_extract:
        for _ in range(6):
            resp = await async_client.post(url)
            assert resp.status_code == 200
            assert resp.json()["content"] == SCRAPE_RESULT[0]

    assert mock_extract.call_count == 1
    usage = await async_client.get("/api/users/limits")
    assert usage.json()["usage"]["daily_scrapes"] == 1


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
async def test_auto_extract_runs_once_then_serves_stored_content(async_client: AsyncClient, short_article: FeedArticle):
    """
    A teaser-only article is scraped on the first open and persisted. Later opens are served
    from the database: no scrape, and no further quota spent.
    """
    with patch(
        "app.services.articles.scrape.extract_full_content",
        return_value=SCRAPE_RESULT,
    ) as mock_extract:
        for _ in range(6):
            resp = await async_client.get(f"/api/articles/{short_article.id}")
            assert resp.status_code == 200
            assert resp.json().get("extracted_content") == SCRAPE_RESULT[0]

    assert mock_extract.call_count == 1

    # The single scrape left 4 of the 5 daily units unspent.
    usage = await async_client.get("/api/users/limits")
    assert usage.json()["usage"]["daily_scrapes"] == 1


@pytest.mark.asyncio
async def test_failed_extraction_is_not_retried_on_every_open(async_client: AsyncClient, short_article: FeedArticle):
    """
    A paywalled or unscrapable article records the failed attempt, so opening it repeatedly
    doesn't burn the whole daily quota. The article still loads with its feed content.
    """
    with patch(
        "app.services.articles.scrape.extract_full_content",
        return_value=(None, "Could not extract readable content"),
    ) as mock_extract:
        for _ in range(4):
            resp = await async_client.get(f"/api/articles/{short_article.id}")
            assert resp.status_code == 200
            assert resp.json().get("extracted_content") is None

    assert mock_extract.call_count == 1


@pytest.mark.asyncio
async def test_extraction_shorter_than_feed_content_is_discarded(async_client: AsyncClient, short_article: FeedArticle):
    """A paywall stub must never replace the content the feed already provided."""
    with patch(
        "app.services.articles.scrape.extract_full_content",
        return_value=("<p>Subscribe to keep reading.</p>", None),
    ):
        resp = await async_client.get(f"/api/articles/{short_article.id}")

    assert resp.status_code == 200
    assert resp.json().get("extracted_content") is None


@pytest.mark.asyncio
async def test_auto_extract_degrades_gracefully_when_quota_exhausted(
    async_client: AsyncClient, short_article: FeedArticle, db_session: AsyncSession, test_feed: Feed, test_user: Profile
):
    """
    With the quota already spent, opening an un-extracted article still returns 200 with the
    feed's own content -- never a 429, so no paywall pops up just from opening an article.
    """
    url = f"/api/articles/{short_article.id}/extract-full-text"
    with patch(
        "app.routers.articles.articles_enhancements.extract_full_content",
        return_value=(None, "Could not extract readable content"),
    ):
        # Spend the 5 daily units on explicit extractions of other URLs.
        for _ in range(5):
            await async_client.post(url)

    with patch(
        "app.services.articles.scrape.extract_full_content",
        return_value=SCRAPE_RESULT,
    ) as mock_extract:
        resp = await async_client.get(f"/api/articles/{short_article.id}")

    assert resp.status_code == 200
    assert resp.json().get("extracted_content") is None
    assert mock_extract.call_count == 0


@pytest.mark.asyncio
async def test_background_extraction_falls_back_silently_when_quota_exhausted(
    async_client: AsyncClient, short_article: FeedArticle
):
    """
    Reader-initiated background extraction (auto=true) extracts while quota remains, then returns
    content=None with a 200 -- never a 429, so no paywall pops up just from opening an article.
    A user-initiated extraction after that still gets the 429 that opens the paywall.
    """
    url = f"/api/articles/{short_article.id}/extract-full-text"
    # Extraction keeps failing, so nothing is cached and each call spends a unit.
    with patch(
        "app.routers.articles.articles_enhancements.extract_full_content",
        return_value=(None, "Could not extract readable content"),
    ) as mock_extract:
        for _ in range(5):
            resp = await async_client.post(url, params={"auto": "true"})
            assert resp.status_code == 400

        exhausted = await async_client.post(url, params={"auto": "true"})
        explicit = await async_client.post(url)

    assert exhausted.status_code == 200
    assert exhausted.json()["content"] is None
    assert mock_extract.call_count == 5  # quota-skipped requests never scrape
    assert explicit.status_code == 429
    assert explicit.json()["error_code"] == "SCRAPE_LIMIT_EXCEEDED"


@pytest.mark.asyncio
async def test_limits_endpoint_reports_scrape_usage(async_client: AsyncClient, short_article: FeedArticle):
    """GET /api/users/limits exposes max_daily_scrapes and daily_scrapes usage."""
    # Failing extractions, so the second call re-scrapes instead of being served from cache.
    with patch(
        "app.routers.articles.articles_enhancements.extract_full_content",
        return_value=(None, "Could not extract readable content"),
    ):
        await async_client.post(f"/api/articles/{short_article.id}/extract-full-text")
        await async_client.post(f"/api/articles/{short_article.id}/extract-full-text")

    resp = await async_client.get("/api/users/limits")
    assert resp.status_code == 200
    data = resp.json()
    assert data["limits"]["max_daily_scrapes"] == 5
    assert data["usage"]["daily_scrapes"] == 2
