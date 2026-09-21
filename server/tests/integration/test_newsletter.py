"""Integration tests for newsletter intake and subscription features."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.constants import NEWSLETTER_PLAN_REQUIRED_ERROR_CODE
from app.models.article import ArticleContent, FeedArticle
from app.models.feed import Feed, FeedSubscription
from app.models.user import Profile


class TestNewsletterFeature:
    """Test suite for newsletter feature endpoints."""

    @pytest.mark.asyncio
    async def test_get_or_generate_token_success(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
    ):
        """Test getting/generating the newsletter inbound email token."""
        # Upgrade user to PRO to pass premium check
        from app.models.enums import UserRole

        test_user.role = UserRole.PRO
        db_session.add(test_user)
        await db_session.commit()

        # 1. First call - should generate a new token
        response = await async_client.get("/api/intake/token")
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "email" in data
        assert data["email"].endswith(f".{data['token']}@newsletters.readspace.ai")

        # Verify it was saved to DB
        await db_session.refresh(test_user)
        assert test_user.newsletter_token == data["token"]

        # 2. Second call - should return the same token
        response2 = await async_client.get("/api/intake/token")
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["token"] == data["token"]

    @pytest.mark.asyncio
    async def test_webhook_intake_success(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
    ):
        """Test that inbound webhook correctly parses email and saves it as a feed article."""
        # Upgrade user to PRO to pass premium check
        from app.models.enums import UserRole

        test_user.role = UserRole.PRO
        db_session.add(test_user)

        # Set token on test user
        token = "testtoken123"  # noqa: S105 - synthetic fixture value
        test_user.newsletter_token = token
        db_session.add(test_user)
        await db_session.commit()

        # Send webhook payload
        settings = get_settings()
        payload = {
            "token": token,
            "from": "Python Weekly <newsletter@pythonweekly.com>",
            "subject": "Issue 500",
            "html": "<p>Awesome Python stuff</p>",
        }

        response = await async_client.post(
            "/api/intake/webhook",
            json=payload,
            headers={"X-Readspace-Secret": settings.INBOUND_WEBHOOK_SECRET.get_secret_value()},
        )

        assert response.status_code == 201
        assert response.json() == {"status": "success"}

        # Verify feed was created
        virtual_url = f"newsletter://{test_user.id}/newsletter@pythonweekly.com"
        result_feed = await db_session.execute(select(Feed).where(Feed.url == virtual_url))
        feed = result_feed.scalar_one_or_none()
        assert feed is not None
        assert feed.title == "Python Weekly"
        assert feed.content_type == "newsletter"

        # Verify subscription was created
        result_sub = await db_session.execute(
            select(FeedSubscription).where(
                FeedSubscription.feed_id == feed.id, FeedSubscription.user_id == test_user.id
            )
        )
        sub = result_sub.scalar_one_or_none()
        assert sub is not None

        # Verify it went to Newsletters folder
        from app.models.folder import Folder

        result_folder = await db_session.execute(select(Folder).where(Folder.id == sub.folder_id))
        folder = result_folder.scalar_one_or_none()
        assert folder is not None
        assert folder.name == "Newsletters"

        # Verify article content was saved
        result_article = await db_session.execute(select(ArticleContent).where(ArticleContent.title == "Issue 500"))
        article_content = result_article.scalar_one_or_none()
        assert article_content is not None
        assert article_content.content == "<p>Awesome Python stuff</p>"
        assert article_content.author == "Python Weekly"

        # Verify feed article link
        result_link = await db_session.execute(
            select(FeedArticle).where(FeedArticle.feed_id == feed.id, FeedArticle.content_id == article_content.id)
        )
        link = result_link.scalar_one_or_none()
        assert link is not None

    @pytest.mark.asyncio
    async def test_webhook_intake_invalid_secret(self, async_client: AsyncClient):
        """Test webhook fails with invalid X-Readspace-Secret."""
        payload = {
            "token": "token",
            "from": "Python Weekly <newsletter@pythonweekly.com>",
            "subject": "Subject",
            "html": "<p>Content</p>",
        }

        response = await async_client.post(
            "/api/intake/webhook", json=payload, headers={"X-Readspace-Secret": "wrong-secret"}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_webhook_intake_invalid_token(self, async_client: AsyncClient):
        """Test webhook fails with non-existent user token."""
        settings = get_settings()
        payload = {
            "token": "non-existent-token",
            "from": "Python Weekly <newsletter@pythonweekly.com>",
            "subject": "Subject",
            "html": "<p>Content</p>",
        }

        response = await async_client.post(
            "/api/intake/webhook",
            json=payload,
            headers={"X-Readspace-Secret": settings.INBOUND_WEBHOOK_SECRET.get_secret_value()},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_subscribe_newsletter_success(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
    ):
        """Test manually subscribing to a newsletter before any email is received."""
        # Upgrade user to PRO to pass premium check
        from app.models.enums import UserRole

        test_user.role = UserRole.PRO
        db_session.add(test_user)
        await db_session.commit()

        payload = {"name": "Python Weekly", "sender_email": "newsletter@pythonweekly.com"}

        response = await async_client.post("/api/intake/subscribe", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert "feed" in data
        assert "id" in data["feed"]

        # Verify DB entries
        virtual_url = f"newsletter://{test_user.id}/newsletter@pythonweekly.com"
        result_feed = await db_session.execute(select(Feed).where(Feed.url == virtual_url))
        feed = result_feed.scalar_one_or_none()
        assert feed is not None
        assert feed.title == "Python Weekly"

        result_sub = await db_session.execute(
            select(FeedSubscription).where(
                FeedSubscription.feed_id == feed.id, FeedSubscription.user_id == test_user.id
            )
        )
        sub = result_sub.scalar_one_or_none()
        assert sub is not None

        # Verify it went to Newsletters folder
        from app.models.folder import Folder

        result_folder = await db_session.execute(select(Folder).where(Folder.id == sub.folder_id))
        folder = result_folder.scalar_one_or_none()
        assert folder is not None
        assert folder.name == "Newsletters"

    @pytest.mark.asyncio
    async def test_subscribe_newsletter_invalid_email(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
    ):
        """Test subscribing with an invalid sender email format."""
        # Upgrade user to PRO to pass premium check
        from app.models.enums import UserRole

        test_user.role = UserRole.PRO
        db_session.add(test_user)
        await db_session.commit()

        payload = {"name": "Python Weekly", "sender_email": "not-an-email"}

        response = await async_client.post("/api/intake/subscribe", json=payload)
        assert response.status_code == 400
        assert "sender email" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_premium_endpoints_forbidden_for_basic_user(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
    ):
        """Test that BASIC users are blocked from generating tokens or manually subscribing."""
        # Ensure user is BASIC
        from app.models.enums import UserRole

        test_user.role = UserRole.BASIC
        db_session.add(test_user)
        await db_session.commit()

        # 1. Test get token is forbidden
        response = await async_client.get("/api/intake/token")
        assert response.status_code == 403
        assert "premium subscription required" in response.json()["detail"].lower()

        # 2. Test manual subscribe is forbidden
        payload = {"name": "Python Weekly", "sender_email": "newsletter@pythonweekly.com"}
        response = await async_client.post("/api/intake/subscribe", json=payload)
        assert response.status_code == 403
        assert "premium subscription required" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_webhook_intake_forbidden_for_basic_user(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
    ):
        """Test that webhook fails with 403 if the matching profile is a BASIC user."""
        token = "basic_user_token"  # noqa: S105 - synthetic fixture value
        test_user.newsletter_token = token
        # Ensure user is BASIC
        from app.models.enums import UserRole

        test_user.role = UserRole.BASIC
        db_session.add(test_user)
        await db_session.commit()

        settings = get_settings()
        payload = {
            "token": token,
            "from": "Python Weekly <newsletter@pythonweekly.com>",
            "subject": "Issue 500",
            "html": "<p>Awesome Python stuff</p>",
        }

        response = await async_client.post(
            "/api/intake/webhook",
            json=payload,
            headers={"X-Readspace-Secret": settings.INBOUND_WEBHOOK_SECRET.get_secret_value()},
        )
        assert response.status_code == 403
        detail = response.json()["detail"]
        assert detail["error_code"] == NEWSLETTER_PLAN_REQUIRED_ERROR_CODE
        assert "premium subscription required" in detail["message"].lower()


TEST_NEWSLETTER_TOKEN = "limittoken123"  # noqa: S105 - synthetic fixture value


class TestNewsletterLimitAndFolderStability:
    """Newsletter cap and 'user moved the feed' behaviour on the intake webhook."""

    @staticmethod
    async def _make_pro(db_session: AsyncSession, user: Profile) -> dict[str, str]:
        from app.models.enums import UserRole

        user.role = UserRole.PRO
        user.newsletter_token = TEST_NEWSLETTER_TOKEN
        db_session.add(user)
        await db_session.commit()
        return {"X-Readspace-Secret": get_settings().INBOUND_WEBHOOK_SECRET.get_secret_value()}

    @staticmethod
    def _payload(sender: str, subject: str) -> dict[str, str]:
        return {"token": TEST_NEWSLETTER_TOKEN, "from": sender, "subject": subject, "html": f"<p>{subject}</p>"}

    @pytest.mark.asyncio
    async def test_moved_newsletter_stays_in_new_folder(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
    ):
        """A later email must not create a second feed or pull the subscription back to Newsletters."""
        from app.models.folder import Folder

        headers = await self._make_pro(db_session, test_user)
        user_id = test_user.id
        sender = "news@example.com"

        first = await async_client.post("/api/intake/webhook", json=self._payload(sender, "One"), headers=headers)
        assert first.status_code == 201

        feed = (
            await db_session.execute(select(Feed).where(Feed.url == f"newsletter://{user_id}/{sender}"))
        ).scalar_one()
        sub = (
            await db_session.execute(select(FeedSubscription).where(FeedSubscription.feed_id == feed.id))
        ).scalar_one()

        # User moves the newsletter into their own folder
        target = Folder(user_id=user_id, name="Reading List")
        db_session.add(target)
        await db_session.flush()
        target_id = target.id
        sub.folder_id = target_id
        await db_session.commit()

        second = await async_client.post("/api/intake/webhook", json=self._payload(sender, "Two"), headers=headers)
        assert second.status_code == 201

        db_session.expire_all()
        feeds = (await db_session.execute(select(Feed).where(Feed.url.like(f"newsletter://{user_id}/%")))).all()
        subs = (
            (await db_session.execute(select(FeedSubscription).where(FeedSubscription.user_id == user_id)))
            .scalars()
            .all()
        )
        assert len(feeds) == 1
        assert len(subs) == 1
        assert subs[0].folder_id == target_id

    @pytest.mark.asyncio
    async def test_newsletter_cap_blocks_new_sender_but_not_existing(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile, monkeypatch: pytest.MonkeyPatch
    ):
        """At the cap a new sender is rejected (no orphan Feed); existing senders keep ingesting."""
        from app.core.resource_limits import RESOURCE_LIMITS

        monkeypatch.setitem(RESOURCE_LIMITS["pro"], "max_newsletters", 1)
        headers = await self._make_pro(db_session, test_user)

        ok = await async_client.post("/api/intake/webhook", json=self._payload("a@example.com", "A1"), headers=headers)
        assert ok.status_code == 201

        blocked = await async_client.post(
            "/api/intake/webhook", json=self._payload("b@example.com", "B1"), headers=headers
        )
        assert blocked.status_code == 429

        orphan = await db_session.execute(select(Feed).where(Feed.url == f"newsletter://{test_user.id}/b@example.com"))
        assert orphan.scalar_one_or_none() is None

        again = await async_client.post(
            "/api/intake/webhook", json=self._payload("a@example.com", "A2"), headers=headers
        )
        assert again.status_code == 201

    @pytest.mark.asyncio
    async def test_manual_subscribe_respects_newsletter_cap(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile, monkeypatch: pytest.MonkeyPatch
    ):
        """/intake/subscribe is subject to the same cap."""
        from app.core.resource_limits import RESOURCE_LIMITS

        monkeypatch.setitem(RESOURCE_LIMITS["pro"], "max_newsletters", 1)
        await self._make_pro(db_session, test_user)

        first = await async_client.post("/api/intake/subscribe", json={"name": "A", "sender_email": "a@example.com"})
        assert first.status_code == 201
        second = await async_client.post("/api/intake/subscribe", json={"name": "B", "sender_email": "b@example.com"})
        assert second.status_code == 429

    @pytest.mark.asyncio
    async def test_unsubscribed_user_cannot_preview_newsletter(
        self, async_client: AsyncClient, db_session: AsyncSession, test_user: Profile
    ):
        """Security: Verify private newsletter articles cannot be previewed by other users (IDOR prevention)."""
        from uuid import uuid4
        from app.models.article import FeedArticle
        from app.models.enums import UserRole
        from app.services.user.auth import get_current_user
        from app.typing.user import TokenData
        from app.main import app

        headers = await self._make_pro(db_session, test_user)
        post_res = await async_client.post(
            "/api/intake/webhook",
            json=self._payload("private@sender.com", "Secret Newsletter"),
            headers=headers,
        )
        assert post_res.status_code == 201

        # Find the newly created newsletter article
        stmt = select(FeedArticle).join(Feed).where(Feed.url == f"newsletter://{test_user.id}/private@sender.com")
        result = await db_session.execute(stmt)
        article = result.scalar_one()

        # Create another user
        other_user_id = uuid4()
        other_profile = Profile(id=other_user_id, email="other@example.com", role=UserRole.BASIC)
        db_session.add(other_profile)
        await db_session.commit()

        # Override get_current_user to simulate other_user accessing test_user's newsletter
        app.dependency_overrides[get_current_user] = lambda: TokenData(
            sub=str(other_user_id), email="other@example.com", role="authenticated"
        )
        try:
            get_res = await async_client.get(f"/api/articles/{article.id}")
            assert get_res.status_code == 404
        finally:
            app.dependency_overrides.pop(get_current_user, None)
