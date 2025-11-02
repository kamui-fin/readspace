"""Unit tests for cursor-based pagination."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import DEFAULT_CURSOR_LIMIT, MAX_CURSOR_LIMIT
from app.crud.article.cursor_pagination import CursorPaginationParams, CursorPaginationResult
from tests.factories.rss_factories import ArticleFactory, FeedFactory, SubscriptionFactory, UserProfileFactory


@pytest.mark.unit
@pytest.mark.asyncio
async def test_cursor_pagination_params_validation() -> None:
    """Test cursor pagination parameter validation."""
    # Test default values
    params = CursorPaginationParams()
    assert params.limit == DEFAULT_CURSOR_LIMIT
    assert params.cursor is None

    # Test custom limit
    params = CursorPaginationParams(limit=100)
    assert params.limit == 100

    # Test limit clamping to max
    params = CursorPaginationParams(limit=500)
    assert params.limit == MAX_CURSOR_LIMIT

    # Test cursor parsing
    cursor_id = uuid4()
    params = CursorPaginationParams(cursor=str(cursor_id))
    assert params.cursor == cursor_id


@pytest.mark.unit
@pytest.mark.asyncio
async def test_cursor_pagination_result_structure() -> None:
    """Test cursor pagination result structure."""
    items = [{"id": uuid4()} for _ in range(10)]
    result = CursorPaginationResult(items=items, next_cursor=uuid4(), has_more=True, total_count=100)

    assert len(result.items) == 10
    assert result.has_more is True
    assert result.next_cursor is not None
    assert result.total_count == 100


@pytest.mark.unit
@pytest.mark.asyncio
async def test_cursor_pagination_first_page(db: AsyncSession) -> None:
    """Test cursor pagination returns first page correctly."""
    # Create test data
    user = UserProfileFactory.build()
    db.add(user)
    await db.flush()

    feed = FeedFactory.build()
    db.add(feed)
    await db.flush()

    subscription = SubscriptionFactory.build(user_id=user.id, feed_id=feed.id)
    db.add(subscription)
    await db.flush()

    # Create 10 articles
    articles = []
    for i in range(10):
        article = ArticleFactory.build(
            feed_id=feed.id, title=f"Article {i}", published_at=datetime.now(UTC).replace(microsecond=0)
        )
        db.add(article)
        articles.append(article)
    await db.commit()

    # Import the function we'll implement
    from app.crud.article.cursor_pagination import get_articles_cursor_paginated

    # Get first page with limit of 5
    result = await get_articles_cursor_paginated(
        db=db, user_id=user.id, params=CursorPaginationParams(limit=5), feed_ids=None
    )

    assert len(result.items) == 5
    assert result.has_more is True
    assert result.next_cursor is not None
    # First page should have articles 0-4
    assert result.items[0].title == "Article 0"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_cursor_pagination_second_page(db: AsyncSession) -> None:
    """Test cursor pagination returns second page correctly."""
    # Create test data
    user = UserProfileFactory.build()
    db.add(user)
    await db.flush()

    feed = FeedFactory.build()
    db.add(feed)
    await db.flush()

    subscription = SubscriptionFactory.build(user_id=user.id, feed_id=feed.id)
    db.add(subscription)
    await db.flush()

    # Create 10 articles
    articles = []
    for i in range(10):
        article = ArticleFactory.build(
            feed_id=feed.id, title=f"Article {i}", published_at=datetime.now(UTC).replace(microsecond=0)
        )
        db.add(article)
        articles.append(article)
    await db.commit()
    await db.refresh(articles[4])  # Refresh to get the actual ID

    from app.crud.article.cursor_pagination import get_articles_cursor_paginated

    # Get second page using cursor from first page
    result = await get_articles_cursor_paginated(
        db=db, user_id=user.id, params=CursorPaginationParams(limit=5, cursor=str(articles[4].id)), feed_ids=None
    )

    assert len(result.items) == 5
    assert result.has_more is False  # No more pages
    # Second page should have articles 5-9
    assert result.items[0].title == "Article 5"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_cursor_pagination_empty_results(db: AsyncSession) -> None:
    """Test cursor pagination with no results."""
    user = UserProfileFactory.build()
    db.add(user)
    await db.commit()

    from app.crud.article.cursor_pagination import get_articles_cursor_paginated

    result = await get_articles_cursor_paginated(
        db=db, user_id=user.id, params=CursorPaginationParams(limit=10), feed_ids=None
    )

    assert len(result.items) == 0
    assert result.has_more is False
    assert result.next_cursor is None
    assert result.total_count == 0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_cursor_pagination_last_page(db: AsyncSession) -> None:
    """Test cursor pagination on the last page."""
    user = UserProfileFactory.build()
    db.add(user)
    await db.flush()

    feed = FeedFactory.build()
    db.add(feed)
    await db.flush()

    subscription = SubscriptionFactory.build(user_id=user.id, feed_id=feed.id)
    db.add(subscription)
    await db.flush()

    # Create exactly 7 articles (less than default limit)
    articles = []
    for i in range(7):
        article = ArticleFactory.build(feed_id=feed.id, title=f"Article {i}")
        db.add(article)
        articles.append(article)
    await db.commit()

    from app.crud.article.cursor_pagination import get_articles_cursor_paginated

    result = await get_articles_cursor_paginated(
        db=db, user_id=user.id, params=CursorPaginationParams(limit=10), feed_ids=None
    )

    assert len(result.items) == 7
    assert result.has_more is False
    assert result.next_cursor is None


@pytest.mark.unit
def test_cursor_pagination_constants() -> None:
    """Test that cursor pagination constants are properly defined."""
    assert DEFAULT_CURSOR_LIMIT > 0
    assert MAX_CURSOR_LIMIT > DEFAULT_CURSOR_LIMIT
    assert MAX_CURSOR_LIMIT <= 1000  # Reasonable upper limit
