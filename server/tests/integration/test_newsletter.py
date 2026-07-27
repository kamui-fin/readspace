"""Integration tests for newsletter intake and subscription features."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
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
        token = "testtoken123"
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
            "/api/intake/webhook", json=payload, headers={"X-Readspace-Secret": settings.INBOUND_WEBHOOK_SECRET}
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
            "/api/intake/webhook", json=payload, headers={"X-Readspace-Secret": settings.INBOUND_WEBHOOK_SECRET}
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
        token = "basic_user_token"
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
            "/api/intake/webhook", json=payload, headers={"X-Readspace-Secret": settings.INBOUND_WEBHOOK_SECRET}
        )
        assert response.status_code == 403
        assert "premium subscription required" in response.json()["detail"].lower()
