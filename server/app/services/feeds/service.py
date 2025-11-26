"""
Core feed business logic.
Orchestrates fetching, parsing, and database persistence.
Follows the 'Surgical Session' pattern: DB -> IO -> DB.
"""

from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.custom_exceptions import (
    FeedConnectionError,
    FeedParsingError,
    FeedSubscriptionError,
    NotFoundError,
)
from app.crud.article.ingester import create_articles_batch
from app.crud.feed.core import create_feed, get_feed_by_id, get_feed_by_url, update_feed
from app.crud.feed.subscription import (
    create_subscription,
    delete_subscription,
    get_subscription_by_feed_id,
    get_subscriptions_by_user,
)
from app.crud.folder import get_by_id as get_folder
from app.models.feed import Feed
from app.services.feeds import fetching, parsing, scheduling
from app.typing.articles import ArticleCreate
from app.typing.feeds import FeedBase
from app.typing.subscriptions import SubscriptionCreate
from app.utils.common import normalize_feed_url, resolve_feed_url
from app.utils.text import calculate_feed_content_hash

logger = structlog.get_logger(__name__)

SessionFactory = Callable[[], Any]


async def add_feed(
    session_factory: SessionFactory,
    user_id: UUID,
    url: str,
    folder_id: UUID,
    custom_title: str | None = None,
) -> Any:
    logger.info("Adding feed", url=url, user_id=user_id)

    resolved_url = await resolve_feed_url(url)
    normalized_url = normalize_feed_url(resolved_url)

    async with session_factory() as db:
        folder = await get_folder(db, folder_id=folder_id, user_id=user_id)
        if not folder:
            raise NotFoundError(f"Folder {folder_id} not found")

        existing_feed = await get_feed_by_url(db, url=normalized_url)
        if existing_feed:
            return await _subscribe_to_existing_feed(db, user_id, existing_feed, folder_id, custom_title)

    fetch_result = await fetching.fetch_feed_content(resolved_url)

    if fetch_result["error"]:
        raise FeedConnectionError(f"Failed to fetch feed: {fetch_result['error']}")

    if not fetch_result["content"]:
        raise FeedParsingError("Empty feed content")

    try:
        parsed = parsing.parse_feed_content(fetch_result["content"], resolved_url)
    except Exception as e:
        raise FeedParsingError(f"Failed to parse feed: {e}") from e

    async with session_factory() as db:
        existing_feed = await get_feed_by_url(db, url=normalized_url)
        if existing_feed:
            return await _subscribe_to_existing_feed(db, user_id, existing_feed, folder_id, custom_title)

        feed_data = {
            "url": normalized_url,
            "title": parsed["title"],
            "description": parsed["description"],
            "link": parsed["link"],
            "language": parsed["language"],
            "image_url": parsed["image_url"],
            "ttl": parsed["ttl"],
            "last_fetched_at": datetime.now(timezone.utc),
            "last_modified_header": fetch_result["headers"].get("Last-Modified"),
            "etag_header": fetch_result["headers"].get("ETag"),
            "content_hash": calculate_feed_content_hash(parsed["articles"]),
        }

        feed_in = FeedBase(**feed_data)
        created_feed = await create_feed(db, feed_data=feed_in)

        # Add feed_id to articles and save
        await _save_articles(db, created_feed, parsed["articles"])

        interval = await scheduling.calculate_optimal_interval(db, created_feed)
        await update_feed(db, feed=created_feed, update_data={"adaptive_fetch_interval_minutes": interval})

        sub = await _subscribe_to_existing_feed(db, user_id, created_feed, folder_id, custom_title)
        return sub


async def refresh_feed(session_factory: SessionFactory, feed_id: UUID, force: bool = False) -> None:
    """Refresh a feed. Does not return data."""
    async with session_factory() as db:
        feed = await get_feed_by_id(db, feed_id=feed_id)
        if not feed:
            return

        url = str(feed.url)
        etag = feed.etag_header if not force else None
        last_modified = feed.last_modified_header if not force else None
        current_hash = feed.content_hash

    fetch_result = await fetching.fetch_feed_content(url, etag=etag, last_modified=last_modified)

    if fetch_result["status_code"] == 304:
        logger.info("Feed not modified", feed_id=feed_id)
        async with session_factory() as db:
            feed = await get_feed_by_id(db, feed_id=feed_id)
            if feed:
                await update_feed(db, feed=feed, update_data={"last_fetched_at": datetime.now(timezone.utc)})
        return

    if fetch_result["error"]:
        logger.error("Feed refresh failed", feed_id=feed_id, error=fetch_result["error"])
        async with session_factory() as db:
            feed = await get_feed_by_id(db, feed_id=feed_id)
            if feed:
                count = feed.fetch_error_count + 1
                await update_feed(
                    db, feed=feed, update_data={"fetch_error_count": count, "last_error_message": fetch_result["error"]}
                )
        return

    try:
        parsed = parsing.parse_feed_content(fetch_result["content"], url)
    except Exception as e:
        logger.error("Feed parse failed", feed_id=feed_id, error=str(e))
        return

    new_hash = calculate_feed_content_hash(parsed["articles"])
    if not force and new_hash == current_hash:
        logger.info("Feed content unchanged (hash match)", feed_id=feed_id)
        async with session_factory() as db:
            feed = await get_feed_by_id(db, feed_id=feed_id)
            if feed:
                await update_feed(db, feed=feed, update_data={"last_fetched_at": datetime.now(timezone.utc)})
        return

    async with session_factory() as db:
        feed = await get_feed_by_id(db, feed_id=feed_id)
        if not feed:
            return

        update_data = {
            "title": parsed["title"],
            "description": parsed["description"],
            "image_url": parsed["image_url"],
            "last_fetched_at": datetime.now(timezone.utc),
            "last_modified_header": fetch_result["headers"].get("Last-Modified"),
            "etag_header": fetch_result["headers"].get("ETag"),
            "content_hash": new_hash,
            "fetch_error_count": 0,
            "last_error_message": None,
        }

        if parsed["articles"]:
            await _save_articles(db, feed, parsed["articles"])
            latest = max((a.published_at for a in parsed["articles"] if a.published_at), default=None)
            if latest:
                update_data["last_article_published_at"] = latest

        await update_feed(db, feed=feed, update_data=update_data)

        # Refetch to calculate optimal interval
        feed = await get_feed_by_id(db, feed_id=feed_id)
        if feed:
            interval = await scheduling.calculate_optimal_interval(db, feed)
            if interval != feed.adaptive_fetch_interval_minutes:
                await update_feed(db, feed=feed, update_data={"adaptive_fetch_interval_minutes": interval})


async def get_user_feeds(
    session_factory: SessionFactory, user_id: UUID, folder_id: UUID | None = None, skip: int = 0, limit: int = 100
) -> list[Any]:
    async with session_factory() as db:
        subs = await get_subscriptions_by_user(db, user_id=user_id, folder_id=folder_id, skip=skip, limit=limit)
        return subs


async def unsubscribe(session_factory: SessionFactory, user_id: UUID, subscription_id: UUID) -> bool:
    async with session_factory() as db:
        return await delete_subscription(db, subscription_id=subscription_id, user_id=user_id)


async def _subscribe_to_existing_feed(
    db: AsyncSession, user_id: UUID, feed: Feed, folder_id: UUID, custom_title: str | None
) -> Any:
    existing = await get_subscription_by_feed_id(db, feed_id=feed.id, user_id=user_id)
    if existing:
        raise FeedSubscriptionError("Already subscribed to this feed")

    sub_in = SubscriptionCreate(url=str(feed.url), folder_id=folder_id, custom_title=custom_title)

    return await create_subscription(db, subscription_in=sub_in, user_id=user_id, feed_db=feed)


async def _save_articles(db: AsyncSession, feed: Feed, articles: list[ArticleCreate]) -> int:
    if not articles:
        return 0

    # Update feed_id in place or create new objects
    # articles are already ArticleCreate objects, but feed_id might be dummy
    for article in articles:
        article.feed_id = feed.id

    created = await create_articles_batch(db, articles_data=articles)
    return len(created)
