from datetime import timedelta
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import ArticleContent, FeedArticle
from app.models.enums import UserRole
from app.models.feed import Feed, FeedSubscription
from app.models.folder import Folder
from app.models.user import Profile
from app.utils.hashing import get_content_hash
from app.utils.time import get_sync_cutoff


@pytest.mark.asyncio
async def test_basic_user_feed_refresh_delay(
    db_session: AsyncSession,
    async_client: AsyncClient,
    test_user: Profile,
    test_feed: Feed,
):
    """
    Test that BASIC users are limited by the 2-hour block sync cutoff,
    while PRO users bypass the limit and see everything.
    """
    # 1. Setup subscription & folder
    folder = Folder(id=uuid4(), name="Triage Folder", user_id=test_user.id)
    db_session.add(folder)
    await db_session.flush()

    subscription = FeedSubscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=folder.id)
    db_session.add(subscription)
    await db_session.flush()

    # 2. Calculate the global sync cutoff
    sync_cutoff = get_sync_cutoff()

    # 3. Create two articles: one before cutoff (visible), one after cutoff (hidden for BASIC)
    # Article A: Published before cutoff (should be visible to both BASIC and PRO)
    link_a = "https://example.com/article-a"
    content_a = ArticleContent(
        title="Article A (Older)",
        link=link_a,
        content_hash=get_content_hash(link_a),
        description="Older article",
    )
    db_session.add(content_a)
    await db_session.flush()

    article_a = FeedArticle(
        feed_id=test_feed.id,
        content_id=content_a.id,
        guid_hash="guid-a",
        published_at=sync_cutoff - timedelta(minutes=10),
    )
    db_session.add(article_a)
    await db_session.flush()

    # Article B: Published after cutoff (should be hidden to BASIC, visible to PRO)
    link_b = "https://example.com/article-b"
    content_b = ArticleContent(
        title="Article B (Newer)",
        link=link_b,
        content_hash=get_content_hash(link_b),
        description="Newer article",
    )
    db_session.add(content_b)
    await db_session.flush()

    article_b = FeedArticle(
        feed_id=test_feed.id,
        content_id=content_b.id,
        guid_hash="guid-b",
        published_at=sync_cutoff + timedelta(minutes=10),
    )
    db_session.add(article_b)
    await db_session.flush()

    # Commit transactions to ensure database is updated for the API client
    await db_session.commit()

    # 4. Verify BASIC user limits (test_user role defaults to BASIC)
    # Check timeline list
    list_response = await async_client.get("/api/articles/")
    assert list_response.status_code == 200
    list_data = list_response.json()
    items = list_data["items"]

    # Basic user should only see Article A (older than cutoff)
    item_ids = [item["id"] for item in items]
    assert str(article_a.id) in item_ids
    assert str(article_b.id) not in item_ids

    # Check unread counts
    counts_response = await async_client.get("/api/articles/counts")
    assert counts_response.status_code == 200
    counts_data = counts_response.json()

    # Should only count Article A
    assert counts_data["feed_counts"].get(str(test_feed.id)) == 1

    # Check /views/today
    today_response = await async_client.get("/api/articles/views/today")
    assert today_response.status_code == 200
    today_data = today_response.json()
    today_item_ids = [item["id"] for item in today_data["items"]]

    # Today view for BASIC should also filter out Article B
    assert str(article_a.id) in today_item_ids
    assert str(article_b.id) not in today_item_ids

    # 5. Upgrade user to PRO in database
    test_user.role = UserRole.PRO
    db_session.add(test_user)
    await db_session.commit()

    # 6. Verify PRO user bypasses the limits
    # Check timeline list (should see both articles)
    pro_list_response = await async_client.get("/api/articles/")
    assert pro_list_response.status_code == 200
    pro_list_data = pro_list_response.json()
    pro_item_ids = [item["id"] for item in pro_list_data["items"]]
    assert str(article_a.id) in pro_item_ids
    assert str(article_b.id) in pro_item_ids

    # Check unread counts (should count both articles)
    pro_counts_response = await async_client.get("/api/articles/counts")
    assert pro_counts_response.status_code == 200
    pro_counts_data = pro_counts_response.json()
    assert pro_counts_data["feed_counts"].get(str(test_feed.id)) == 2

    # Check /views/today (should see both articles)
    pro_today_response = await async_client.get("/api/articles/views/today")
    assert pro_today_response.status_code == 200
    pro_today_data = pro_today_response.json()
    pro_today_item_ids = [item["id"] for item in pro_today_data["items"]]
    assert str(article_a.id) in pro_today_item_ids
    assert str(article_b.id) in pro_today_item_ids
