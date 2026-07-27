import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func
from uuid import uuid4

from app.models.feed import Feed, FeedSubscription
from app.models.article import ArticleContent, FeedArticle
from app.models.folder import Folder
from app.models.user import Profile


@pytest.mark.asyncio
async def test_admin_delete_feed_cascade(
    async_admin_client: AsyncClient,
    test_user: Profile,
    test_folder: Folder,
    db_session: AsyncSession,
):
    """Test that deleting a feed cascades to articles and subscriptions without error."""

    # 1. Create a Feed
    feed = Feed(
        url=f"https://cascade-test-{uuid4().hex[:8]}.com/feed",
        title="Cascade Test Feed",
        language="en",
    )
    db_session.add(feed)
    await db_session.flush()

    # 2. Create Content
    content = ArticleContent(
        content_hash=uuid4().hex,
        title="Test Article",
        link="https://example.com/article",
    )
    db_session.add(content)
    await db_session.flush()

    # 3. Create FeedArticle (link)
    feed_article = FeedArticle(
        feed_id=feed.id,
        content_id=content.id,
        guid_hash=uuid4().hex,
        published_at=func.now(),
    )
    db_session.add(feed_article)
    await db_session.flush()

    # 4. Create Subscription
    subscription = FeedSubscription(
        user_id=test_user.id,
        feed_id=feed.id,
        folder_id=test_folder.id,
    )
    db_session.add(subscription)
    await db_session.commit()

    # 5. Delete the Feed via Admin API
    response = await async_admin_client.delete(f"/api/feeds/{feed.id}/admin")

    assert response.status_code == 204

    # 6. Verify Deletion
    # Feed should be gone
    result = await db_session.execute(select(Feed).where(Feed.id == feed.id))
    assert result.scalar_one_or_none() is None

    # Subscription should be gone (cascade)
    result = await db_session.execute(select(FeedSubscription).where(FeedSubscription.id == subscription.id))
    assert result.scalar_one_or_none() is None

    # FeedArticle should be gone (cascade)
    result = await db_session.execute(select(FeedArticle).where(FeedArticle.id == feed_article.id))
    assert result.scalar_one_or_none() is None

    # Content should REMAIN (we don't cascade delete content when feed is deleted, usually)
    # Checking this assumption - typically content is shared.
    result = await db_session.execute(select(ArticleContent).where(ArticleContent.id == content.id))
    assert result.scalar_one_or_none() is not None
