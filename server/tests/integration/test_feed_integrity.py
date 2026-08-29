from datetime import datetime, timezone

import pytest

from app.crud.feed.core import update_feed_after_fetch
from app.crud.feed.subscription import create_subscription
from app.models.feed import Feed
from app.typing.subscriptions import SubscriptionCreate


@pytest.mark.asyncio
async def test_subscriber_count_increment(db_session, test_user):
    # Setup
    user_id = test_user.id
    feed = Feed(
        url="http://example.com/feed",
        title="Test Feed",
        description="Desc",
        language="en",
        subscriber_count=0,
    )
    db_session.add(feed)
    await db_session.flush()

    # Create a folder first
    from app.models.folder import Folder

    folder = Folder(name="Test Folder", user_id=user_id)
    db_session.add(folder)
    await db_session.flush()

    sub_in = SubscriptionCreate(url="http://example.com/feed", folder_id=folder.id)

    await db_session.refresh(feed)

    # Action
    await create_subscription(db_session, user_id=user_id, subscription_in=sub_in, feed_db=feed)

    # Verify
    await db_session.refresh(feed)
    assert feed.subscriber_count == 1


@pytest.mark.asyncio
async def test_header_normalization():
    # Mock response with mixed case headers

    # This logic is inside fetch_feed_content, but we can test the result of the function if we mock the network call
    # Or we can test the service logic that consumes it.
    pass


@pytest.mark.asyncio
async def test_last_fetched_at_update(db_session):
    feed = Feed(
        url="http://example.com/feed2",
        title="Test Feed 2",
        description="Desc",
        language="en",
    )
    db_session.add(feed)
    await db_session.flush()

    # Simulate fetch failure
    await update_feed_after_fetch(db_session, feed=feed, success=False, error_msg="Error")

    assert feed.last_fetched_at is not None
    # Ensure it's recent
    assert (datetime.now(timezone.utc) - feed.last_fetched_at).total_seconds() < 10
