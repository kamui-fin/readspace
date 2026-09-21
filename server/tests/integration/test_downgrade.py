"""Integration tests for the plan-downgrade flow.

A Pro user who drops to Basic while holding more than Basic allows must pick which feeds to
keep before content endpoints serve them again; the pick is applied atomically by
POST /api/users/downgrade/resolve.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import DOWNGRADE_ACTION_REQUIRED_ERROR_CODE
from app.core.resource_limits import RESOURCE_LIMITS
from app.models.article import ArticleContent, UserEntry
from app.models.enums import ContentType, UserRole
from app.models.feed import Feed, FeedSubscription
from app.models.folder import Folder
from app.models.user import Profile
from app.utils.hashing import get_content_hash

pytestmark = pytest.mark.integration

BASIC_FEED_LIMIT: int = RESOURCE_LIMITS["basic"]["max_subscriptions"]
BASIC_SAVED_LIMIT: int = RESOURCE_LIMITS["basic"]["max_saved_articles"]
RESOLVE_URL = "/api/users/downgrade/resolve"


async def _seed_subscriptions(
    db_session: AsyncSession, user: Profile, folder: Folder, count: int, *, newsletter: bool = False
) -> list[Feed]:
    """Subscribe ``user`` to ``count`` fresh feeds (newsletter virtual feeds when ``newsletter``)."""
    feeds = []
    for _ in range(count):
        suffix = uuid4().hex
        url = f"newsletter://{user.id}/{suffix}@example.com" if newsletter else f"https://example.com/{suffix}.xml"
        feeds.append(
            Feed(
                id=uuid4(),
                url=url,
                title=f"Feed {suffix[:6]}",
                description="Seeded feed",
                language="en",
                tags=[],
                tags_native=[],
                content_type=ContentType.NEWSLETTER if newsletter else None,
            )
        )
    db_session.add_all(feeds)
    await db_session.flush()
    db_session.add_all([FeedSubscription(user_id=user.id, feed_id=feed.id, folder_id=folder.id) for feed in feeds])
    await db_session.flush()
    return feeds


async def _seed_saved(db_session: AsyncSession, user: Profile, count: int) -> None:
    """Give ``user`` ``count`` saved clipped articles."""
    contents = []
    for _ in range(count):
        url = f"https://example.com/saved-{uuid4().hex}"
        contents.append(ArticleContent(id=uuid4(), title="Saved", link=url, content_hash=get_content_hash(url)))
    db_session.add_all(contents)
    await db_session.flush()
    db_session.add_all([UserEntry(id=uuid4(), user_id=user.id, content_id=c.id, is_saved=True) for c in contents])
    await db_session.flush()


async def _subscription_feed_ids(db_session: AsyncSession, user: Profile) -> set:
    result = await db_session.execute(select(FeedSubscription.feed_id).where(FeedSubscription.user_id == user.id))
    return set(result.scalars().all())


async def _set_role(db_session: AsyncSession, user: Profile, role: UserRole) -> None:
    user.role = role
    await db_session.flush()


class TestDowngradeGate:
    """A downgraded user over the feed cap is blocked from content until they resolve."""

    async def test_limits_report_downgrade_required(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile, test_folder: Folder
    ) -> None:
        await _seed_subscriptions(db_session, test_user, test_folder, BASIC_FEED_LIMIT + 5)
        await _seed_subscriptions(db_session, test_user, test_folder, 2, newsletter=True)
        await _set_role(db_session, test_user, UserRole.BASIC)

        response = await async_client.get("/api/users/limits")

        assert response.status_code == 200
        over_limit = response.json()["over_limit"]
        assert over_limit["downgrade_required"] is True
        assert over_limit["subscriptions"] == {"usage": BASIC_FEED_LIMIT + 7, "limit": BASIC_FEED_LIMIT, "over": True}
        assert over_limit["newsletters"]["over"] is True

    async def test_content_endpoints_refused_while_flow_endpoints_stay_open(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile, test_folder: Folder
    ) -> None:
        await _seed_subscriptions(db_session, test_user, test_folder, BASIC_FEED_LIMIT + 1)
        await _set_role(db_session, test_user, UserRole.BASIC)

        articles = await async_client.get("/api/articles/")
        assert articles.status_code == 403
        assert articles.json()["error_code"] == DOWNGRADE_ACTION_REQUIRED_ERROR_CODE

        for open_path in ("/api/feeds/", "/api/folders/", "/api/users/profile", "/api/users/limits"):
            response = await async_client.get(open_path)
            assert response.status_code == 200, open_path

    async def test_pro_user_with_many_feeds_is_not_blocked(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile, test_folder: Folder
    ) -> None:
        await _seed_subscriptions(db_session, test_user, test_folder, BASIC_FEED_LIMIT + 5)
        await _set_role(db_session, test_user, UserRole.PRO)

        response = await async_client.get("/api/articles/")

        assert response.status_code == 200

    async def test_excess_saved_articles_alone_do_not_block(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
    ) -> None:
        await _seed_saved(db_session, test_user, BASIC_SAVED_LIMIT + 10)
        await _set_role(db_session, test_user, UserRole.BASIC)

        limits = (await async_client.get("/api/users/limits")).json()["over_limit"]
        articles = await async_client.get("/api/articles/")

        assert limits["downgrade_required"] is False
        assert limits["saved_articles"]["over"] is True
        assert articles.status_code == 200


class TestResolveDowngrade:
    """POST /users/downgrade/resolve keeps the picked feeds and removes the rest."""

    async def test_keeps_picked_feeds_and_removes_everything_else(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile, test_folder: Folder
    ) -> None:
        feeds = await _seed_subscriptions(db_session, test_user, test_folder, BASIC_FEED_LIMIT + 5)
        await _seed_subscriptions(db_session, test_user, test_folder, 2, newsletter=True)
        await _set_role(db_session, test_user, UserRole.BASIC)
        keep = {feed.id for feed in feeds[:BASIC_FEED_LIMIT]}

        response = await async_client.post(RESOLVE_URL, json={"keep_feed_ids": [str(i) for i in keep]})

        assert response.status_code == 200
        body = response.json()
        assert {key: body[key] for key in ("kept_count", "removed_feed_count", "removed_newsletter_count")} == {
            "kept_count": BASIC_FEED_LIMIT,
            "removed_feed_count": 5,
            "removed_newsletter_count": 2,
        }
        # The post-resolve state rides along so clients can lift their gate without a refetch race
        assert body["over_limit"]["downgrade_required"] is False
        assert body["over_limit"]["subscriptions"] == {
            "usage": BASIC_FEED_LIMIT,
            "limit": BASIC_FEED_LIMIT,
            "over": False,
        }
        assert await _subscription_feed_ids(db_session, test_user) == keep
        assert (await async_client.get("/api/articles/")).status_code == 200

    async def test_picking_more_than_the_limit_is_rejected(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile, test_folder: Folder
    ) -> None:
        feeds = await _seed_subscriptions(db_session, test_user, test_folder, BASIC_FEED_LIMIT + 5)
        await _set_role(db_session, test_user, UserRole.BASIC)
        before = await _subscription_feed_ids(db_session, test_user)

        response = await async_client.post(
            RESOLVE_URL, json={"keep_feed_ids": [str(f.id) for f in feeds[: BASIC_FEED_LIMIT + 1]]}
        )

        assert response.status_code == 400
        assert response.json()["error_code"] == "DOWNGRADE_TOO_MANY_FEEDS"
        assert await _subscription_feed_ids(db_session, test_user) == before

    async def test_picking_a_feed_the_user_does_not_follow_is_rejected(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile, test_folder: Folder
    ) -> None:
        feeds = await _seed_subscriptions(db_session, test_user, test_folder, BASIC_FEED_LIMIT + 1)
        await _set_role(db_session, test_user, UserRole.BASIC)

        response = await async_client.post(RESOLVE_URL, json={"keep_feed_ids": [str(feeds[0].id), str(uuid4())]})

        assert response.status_code == 400
        assert response.json()["error_code"] == "DOWNGRADE_INVALID_FEEDS"

    async def test_newsletters_cannot_be_kept_on_basic(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile, test_folder: Folder
    ) -> None:
        await _seed_subscriptions(db_session, test_user, test_folder, 3)
        newsletters = await _seed_subscriptions(db_session, test_user, test_folder, 1, newsletter=True)
        await _set_role(db_session, test_user, UserRole.BASIC)

        response = await async_client.post(RESOLVE_URL, json={"keep_feed_ids": [str(newsletters[0].id)]})

        assert response.status_code == 400
        assert response.json()["error_code"] == "DOWNGRADE_INVALID_FEEDS"

    async def test_compliant_user_cannot_resolve(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile, test_folder: Folder
    ) -> None:
        await _seed_subscriptions(db_session, test_user, test_folder, BASIC_FEED_LIMIT + 5)
        await _set_role(db_session, test_user, UserRole.PRO)

        response = await async_client.post(RESOLVE_URL, json={"keep_feed_ids": []})

        assert response.status_code == 400
        assert response.json()["error_code"] == "DOWNGRADE_NOT_REQUIRED"
        count = await db_session.execute(
            select(func.count()).select_from(FeedSubscription).where(FeedSubscription.user_id == test_user.id)
        )
        assert count.scalar_one() == BASIC_FEED_LIMIT + 5


class TestNewsletterClassification:
    """Only virtual email feeds (newsletter:// URLs) are newsletters, not RSS tagged by enrichment."""

    async def test_rss_feed_tagged_newsletter_by_enrichment_is_a_keepable_feed(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile, test_folder: Folder
    ) -> None:
        feeds = await _seed_subscriptions(db_session, test_user, test_folder, BASIC_FEED_LIMIT + 1)
        # e.g. a Substack RSS feed that content enrichment classified as a "newsletter"
        feeds[0].content_type = ContentType.NEWSLETTER
        await _set_role(db_session, test_user, UserRole.BASIC)

        limits = (await async_client.get("/api/users/limits")).json()["over_limit"]
        response = await async_client.post(RESOLVE_URL, json={"keep_feed_ids": [str(feeds[0].id)]})

        assert limits["newsletters"]["usage"] == 0
        assert response.status_code == 200
        assert response.json()["removed_newsletter_count"] == 0
        assert await _subscription_feed_ids(db_session, test_user) == {feeds[0].id}
