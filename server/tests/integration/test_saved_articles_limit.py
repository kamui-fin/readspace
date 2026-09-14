"""Integration tests for the saved-articles cap (Basic: capped, Pro/Admin: unlimited).

Saved articles no longer expire; instead a Basic user can hold at most
RESOURCE_LIMITS["basic"]["max_saved_articles"] saved articles at a time.
"""

import hashlib
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.resource_limits import RESOURCE_LIMITS
from app.models.article import ArticleContent, FeedArticle, UserEntry
from app.models.enums import UserRole
from app.models.feed import Feed
from app.models.user import Profile
from app.utils.hashing import get_content_hash

BASIC_SAVED_LIMIT: int = RESOURCE_LIMITS["basic"]["max_saved_articles"]
LIMIT_ERROR_CODE = "SAVED_ARTICLES_LIMIT_EXCEEDED"


async def _seed_saved_clips(db_session: AsyncSession, user: Profile, count: int) -> list[tuple[UserEntry, str]]:
    """Create ``count`` saved clipped articles for ``user``; returns (entry, url) pairs."""
    contents = []
    entries = []
    for _ in range(count):
        url = f"https://example.com/saved-{uuid4().hex}"
        content = ArticleContent(id=uuid4(), title="Saved Article", link=url, content_hash=get_content_hash(url))
        contents.append(content)
        entries.append((UserEntry(id=uuid4(), user_id=user.id, content_id=content.id, is_saved=True), url))
    db_session.add_all(contents)
    await db_session.flush()
    db_session.add_all([entry for entry, _ in entries])
    await db_session.flush()
    return entries


async def _seed_feed_article(db_session: AsyncSession, feed: Feed) -> FeedArticle:
    """Create one feed article (not yet saved by anyone)."""
    url = f"https://example.com/feed-article-{uuid4().hex}"
    content = ArticleContent(id=uuid4(), title="Feed Article", link=url, content_hash=get_content_hash(url))
    db_session.add(content)
    await db_session.flush()
    feed_article = FeedArticle(
        id=uuid4(),
        feed_id=feed.id,
        content_id=content.id,
        guid_hash=hashlib.sha256(url.encode()).hexdigest(),
        published_at=datetime.now(UTC),
    )
    db_session.add(feed_article)
    await db_session.flush()
    return feed_article


async def _saved_count(db_session: AsyncSession, user: Profile) -> int:
    result = await db_session.execute(
        select(func.count()).select_from(UserEntry).where(UserEntry.user_id == user.id, UserEntry.is_saved)
    )
    return result.scalar_one()


def _new_clip_payload() -> dict[str, str]:
    return {
        "url": f"https://example.com/new-{uuid4().hex}",
        "title": "A New Article",
        "content": "<p>Body</p>",
    }


class TestBasicSavedArticlesLimit:
    """A Basic user may hold up to the cap, and no more."""

    @pytest.fixture(autouse=True)
    async def _ensure_basic_role(self, test_user: Profile, db_session: AsyncSession) -> None:
        test_user.role = UserRole.BASIC
        await db_session.flush()

    async def test_can_clip_into_the_last_free_slot(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession
    ) -> None:
        await _seed_saved_clips(db_session, test_user, BASIC_SAVED_LIMIT - 1)

        response = await async_client.post("/api/articles/", json=_new_clip_payload())

        assert response.status_code == 201
        assert await _saved_count(db_session, test_user) == BASIC_SAVED_LIMIT

    async def test_clipping_past_the_limit_is_rejected(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession
    ) -> None:
        await _seed_saved_clips(db_session, test_user, BASIC_SAVED_LIMIT)

        response = await async_client.post("/api/articles/", json=_new_clip_payload())

        assert response.status_code == 429
        body = response.json()
        assert body["error_code"] == LIMIT_ERROR_CODE
        assert body["details"] == {"current_usage": BASIC_SAVED_LIMIT, "limit": BASIC_SAVED_LIMIT}
        assert await _saved_count(db_session, test_user) == BASIC_SAVED_LIMIT

    async def test_saving_a_feed_article_past_the_limit_is_rejected(
        self, async_client: AsyncClient, test_user: Profile, test_feed: Feed, db_session: AsyncSession
    ) -> None:
        await _seed_saved_clips(db_session, test_user, BASIC_SAVED_LIMIT)
        feed_article = await _seed_feed_article(db_session, test_feed)

        response = await async_client.put(f"/api/articles/{feed_article.id}", json={"is_saved": True})

        assert response.status_code == 429
        assert response.json()["error_code"] == LIMIT_ERROR_CODE
        assert await _saved_count(db_session, test_user) == BASIC_SAVED_LIMIT

    async def test_resaving_an_already_saved_article_at_the_limit_is_allowed(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession
    ) -> None:
        seeded = await _seed_saved_clips(db_session, test_user, BASIC_SAVED_LIMIT)
        entry, url = seeded[0]

        # Extension re-save of the same URL (e.g. editing the note)
        clip_response = await async_client.post(
            "/api/articles/", json={"url": url, "title": "Saved Article", "note": "edited"}
        )
        # Update endpoint with is_saved=True on an entry that's already saved
        update_response = await async_client.put(
            f"/api/articles/{entry.id}?article_type=clipped", json={"is_saved": True, "priority": "HIGH"}
        )

        assert clip_response.status_code == 201
        assert update_response.status_code == 204
        assert await _saved_count(db_session, test_user) == BASIC_SAVED_LIMIT

    async def test_resaving_a_saved_feed_article_at_the_limit_is_allowed(
        self, async_client: AsyncClient, test_user: Profile, test_feed: Feed, db_session: AsyncSession
    ) -> None:
        await _seed_saved_clips(db_session, test_user, BASIC_SAVED_LIMIT - 1)
        feed_article = await _seed_feed_article(db_session, test_feed)
        first = await async_client.put(f"/api/articles/{feed_article.id}", json={"is_saved": True})
        assert first.status_code == 204
        assert await _saved_count(db_session, test_user) == BASIC_SAVED_LIMIT

        again = await async_client.put(f"/api/articles/{feed_article.id}", json={"is_saved": True})

        assert again.status_code == 204

    async def test_unsaving_frees_a_slot(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession
    ) -> None:
        seeded = await _seed_saved_clips(db_session, test_user, BASIC_SAVED_LIMIT)
        entry, _ = seeded[0]

        unsave = await async_client.put(f"/api/articles/{entry.id}?article_type=clipped", json={"is_saved": False})
        save_new = await async_client.post("/api/articles/", json=_new_clip_payload())

        assert unsave.status_code == 204
        assert save_new.status_code == 201
        assert await _saved_count(db_session, test_user) == BASIC_SAVED_LIMIT

    async def test_non_save_updates_are_not_blocked_at_the_limit(
        self, async_client: AsyncClient, test_user: Profile, test_feed: Feed, db_session: AsyncSession
    ) -> None:
        await _seed_saved_clips(db_session, test_user, BASIC_SAVED_LIMIT)
        feed_article = await _seed_feed_article(db_session, test_feed)

        mark_read = await async_client.put(f"/api/articles/{feed_article.id}", json={"is_read": True})
        explicit_unsaved = await async_client.put(f"/api/articles/{feed_article.id}", json={"is_saved": False})

        assert mark_read.status_code == 204
        assert explicit_unsaved.status_code == 204

    async def test_limits_endpoint_reports_saved_articles(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession
    ) -> None:
        await _seed_saved_clips(db_session, test_user, 3)

        response = await async_client.get("/api/users/limits")

        assert response.status_code == 200
        data = response.json()
        assert data["limits"]["max_saved_articles"] == BASIC_SAVED_LIMIT
        assert "read_later_retention_days" not in data["limits"]
        assert data["usage"]["saved_articles"] == 3


class TestUnlimitedSavedArticles:
    """Admin (and Pro) are not capped."""

    async def test_admin_can_save_past_the_basic_limit(
        self, async_admin_client: AsyncClient, admin_user: Profile, db_session: AsyncSession
    ) -> None:
        await _seed_saved_clips(db_session, admin_user, BASIC_SAVED_LIMIT)

        response = await async_admin_client.post("/api/articles/", json=_new_clip_payload())

        assert response.status_code == 201
        assert await _saved_count(db_session, admin_user) == BASIC_SAVED_LIMIT + 1

    async def test_pro_can_save_past_the_basic_limit(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession
    ) -> None:
        test_user.role = UserRole.PRO
        await db_session.flush()
        await _seed_saved_clips(db_session, test_user, BASIC_SAVED_LIMIT)

        response = await async_client.post("/api/articles/", json=_new_clip_payload())

        assert response.status_code == 201
        assert await _saved_count(db_session, test_user) == BASIC_SAVED_LIMIT + 1
