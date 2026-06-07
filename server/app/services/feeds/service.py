"""
Core feed business logic.
Orchestrates fetching, parsing, and database persistence.
Follows the 'Surgical Session' pattern: DB -> IO -> DB.
"""

from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.custom_exceptions import (
    FeedConnectionError,
    FeedParsingError,
    NotFoundError,
)
from app.crud.article.ingester import create_articles_batch
from app.crud.feed import core as feed_crud
from app.crud.feed.core import update_feed_after_fetch
from app.crud.feed.subscription import (
    create_subscription,
    get_subscription_by_feed_id,
)
from app.crud.folder import get_by_id as get_folder
from app.models.feed import Feed
from app.services.feeds import fetching, parsing, scheduling
from app.services.feeds.domain_authority import get_domain_authority_score
from app.services.feeds.http_cache import parse_ttl_from_headers
from app.services.feeds.language_detection import detect_feed_language
from app.services.feeds.meilisearch import sync_feed
from app.typing.entries import ArticleCreate
from app.typing.feeds import FeedCreateInternal
from app.typing.subscriptions import SubscriptionCreate
from app.utils.hashing import calculate_feed_content_hash
from app.utils.urls import normalize_feed_url

logger = structlog.get_logger(__name__)

SessionFactory = Callable[[], Any]


async def add_feed(
    session_factory: SessionFactory,
    user_id: UUID,
    url: str,
    folder_id: UUID,
    custom_title: str | None = None,
) -> tuple[Any, bool]:
    """
    Add a new feed, fetch initial content, and subscribe the user.
    """
    logger.info("Adding feed", url=url, user_id=user_id)

    # 1. Normalize URL first to check for existence
    # This saves a network request if we already have the feed
    normalized_url = normalize_feed_url(url)

    async with session_factory() as db:
        # Check for existing feed
        existing_feed = await feed_crud.get_feed_by_url(db, url=normalized_url)
        if existing_feed:
            logger.info(
                "Feed already exists, subscribing",
                url=normalized_url,
                feed_id=existing_feed.id,
            )
            return await _subscribe_to_existing_feed(db, user_id, existing_feed, folder_id, custom_title)

    # 2. Fetch content (let fetcher handle redirects)
    # We pass the original URL because it might be a redirect that we haven't resolved yet
    # (normalize_feed_url doesn't resolve redirects, it just cleans the string)
    fetch_result = await fetching.fetch_feed_content(url)

    if fetch_result["error"]:
        raise FeedConnectionError(f"Failed to fetch feed: {fetch_result['error']}")

    if not fetch_result["content"]:
        raise FeedParsingError("Empty feed content")

    # 3. Determine canonical URL from fetch result
    final_url = fetch_result.get("final_url") or url
    final_normalized_url = normalize_feed_url(final_url)

    async with session_factory() as db:
        folder = await get_folder(db, folder_id=folder_id, user_id=user_id)
        if not folder:
            raise NotFoundError(f"Folder {folder_id} not found")

        # Check for existing feed AGAIN (in case it was found via redirect resolution)
        if final_normalized_url != normalized_url:
            existing_feed = await feed_crud.get_feed_by_url(db, url=final_normalized_url)
            if existing_feed:
                logger.info(
                    "Feed already exists (via redirect), subscribing",
                    url=final_normalized_url,
                    feed_id=existing_feed.id,
                )
                return await _subscribe_to_existing_feed(db, user_id, existing_feed, folder_id, custom_title)

        # Parse Content
        try:
            parsed = parsing.parse_feed_content(fetch_result["content"], final_url)
        except Exception as e:
            raise FeedParsingError(f"Failed to parse feed: {e}") from e

        # Detect Language if missing
        language = parsed.language
        if not language:
            article_texts = [f"{a.title or ''} {a.description or ''}".strip() for a in parsed.articles]
            language = detect_feed_language(
                title=parsed.title,
                description=parsed.description,
                articles=article_texts,
            )
            logger.info("Auto-detected language", url=final_normalized_url, language=language)

        # Ensure language is never None
        if not language:
            language = "en"  # Default to English if detection fails

        ttl = parse_ttl_from_headers(fetch_result["headers"])
        domain_score = get_domain_authority_score(final_normalized_url)

        # Fallback: Use domain as title
        domain = urlparse(url).netloc
        # Strip www. if present
        if domain.startswith("www."):
            domain = domain[4:]
        fallback_title = domain

        # Prepare Feed Data
        feed_in = FeedCreateInternal(
            url=final_normalized_url,
            title=parsed.title or fallback_title,
            description=parsed.description or "Follow recent articles from this feed",
            link=parsed.link,
            language=language,
            image_url=parsed.image_url,
            last_fetched_at=datetime.now(timezone.utc),
            last_updated_at=parsed.last_updated_at
            or (parsed.articles[0].published_at if parsed.articles and parsed.articles[0].published_at else None),
            last_modified_header=fetch_result["headers"].get("last-modified"),
            etag_header=fetch_result["headers"].get("etag"),
            content_hash=calculate_feed_content_hash(parsed.articles),
            popularity_score=domain_score.score,
            tags=parsed.tags,
            tags_native=parsed.tags_native,
            author=parsed.author,
            content_type=parsed.content_type,
        )

        created_feed = await feed_crud.create_feed(db, feed_data=feed_in)
        await _save_articles(db, created_feed, parsed.articles)

        # Calculate initial interval
        interval = await scheduling.calculate_optimal_interval(db, created_feed)
        await feed_crud.update_feed(
            db,
            feed=created_feed,
            update_data={"adaptive_fetch_interval_minutes": interval},
        )

        # Recalculate next_fetch with the new interval and ttl
        next_fetch = feed_crud.calculate_next_fetch(created_feed, ttl=ttl)
        await feed_crud.update_feed(db, feed=created_feed, update_data={"next_fetch_at": next_fetch})

        sub, created = await _subscribe_to_existing_feed(db, user_id, created_feed, folder_id, custom_title)

    # Sync to search engine
    try:
        await sync_feed(get_settings(), created_feed)
    except Exception as e:
        logger.warning("Meilisearch sync failed", feed_id=str(created_feed.id), error=str(e))

    # Queue background task to fetch favicon if not already set
    if created_feed and not created_feed.image_url:
        try:
            from app.workers.feed_tasks import fetch_favicon_task

            await fetch_favicon_task.kiq(feed_id=str(created_feed.id))
        except Exception as e:
            logger.warning(
                "Failed to queue background favicon task",
                feed_id=str(created_feed.id),
                error=str(e),
            )

    return sub, created


async def refresh_feed(session_factory: SessionFactory, feed_id: UUID) -> None:
    """
    Refreshes a feed's content.
    Handles 304 Not Modified, 226 IM Used, and error backoffs.
    """
    async with session_factory() as db:
        feed = await feed_crud.get_feed_by_id(db, feed_id=feed_id)
        if not feed:
            return

        url = str(feed.url)
        etag = feed.etag_header
        last_modified = feed.last_modified_header
        current_hash = feed.content_hash

    # Conditional Fetch
    fetch_result = await fetching.fetch_feed_content(url, etag=etag, last_modified=last_modified)

    # Case: Error
    if fetch_result["error"]:
        logger.error("Feed refresh failed", feed_id=feed_id, error=fetch_result["error"])
        async with session_factory() as db:
            if feed := await feed_crud.get_feed_by_id(db, feed_id=feed_id):
                await update_feed_after_fetch(db, feed=feed, success=False, error_msg=fetch_result["error"])
        return

    # Case: 304 Not Modified
    if fetch_result["status_code"] == 304:
        logger.info("Feed not modified", feed_id=feed_id)
        async with session_factory() as db:
            if feed := await feed_crud.get_feed_by_id(db, feed_id=feed_id):
                ttl = parse_ttl_from_headers(fetch_result["headers"])
                await update_feed_after_fetch(db, feed=feed, success=True, ttl=ttl)
        return

    # Parse Content
    try:
        parsed = parsing.parse_feed_content(fetch_result["content"], url)
    except Exception as e:
        logger.error("Feed parse failed", feed_id=feed_id, error=str(e))
        async with session_factory() as db:
            if feed := await feed_crud.get_feed_by_id(db, feed_id=feed_id):
                await update_feed_after_fetch(db, feed=feed, success=False, error_msg=f"Parse error: {str(e)}")
        return

    # Hash Check (if not 304 but content still identical)
    new_hash = calculate_feed_content_hash(parsed.articles)
    if new_hash == current_hash:
        logger.info("Feed content unchanged (hash match)", feed_id=feed_id)
        async with session_factory() as db:
            if feed := await feed_crud.get_feed_by_id(db, feed_id=feed_id):
                ttl = parse_ttl_from_headers(fetch_result["headers"])
                await update_feed_after_fetch(db, feed=feed, success=True, ttl=ttl)
        return

    # Update Feed Data
    async with session_factory() as db:
        if not (feed := await feed_crud.get_feed_by_id(db, feed_id=feed_id)):
            return

        final_url = fetch_result.get("final_url")
        if fetch_result.get("permanent_redirect") and final_url:
            logger.info("Permanent redirect during refresh", feed_id=feed_id, new_url=final_url)

        metadata = {
            "title": parsed.title,
            "description": parsed.description,
            "image_url": parsed.image_url,
            "last_updated_at": parsed.last_updated_at
            or (parsed.articles[0].published_at if parsed.articles and parsed.articles[0].published_at else None),
            "last_modified": fetch_result["headers"].get("last-modified"),
            "etag": fetch_result["headers"].get("etag"),
        }

        if fetch_result.get("permanent_redirect") and final_url:
            new_url = feed_crud.normalize_url(final_url)
            existing_feed = await feed_crud.get_feed_by_url(db, url=new_url)
            if existing_feed and existing_feed.id != feed.id:
                logger.warning(
                    "Permanent redirect new URL already exists, skipping URL update",
                    feed_id=feed.id,
                    new_url=new_url,
                )
            else:
                feed.url = new_url

        if parsed.articles:
            await _save_articles(db, feed, parsed.articles)

        feed.content_hash = new_hash
        ttl = parse_ttl_from_headers(fetch_result["headers"])

        await update_feed_after_fetch(db, feed=feed, success=True, metadata=metadata, ttl=ttl)

        # Recalculate Interval
        if feed := await feed_crud.get_feed_by_id(db, feed_id=feed_id):
            interval = await scheduling.calculate_optimal_interval(db, feed)
            if interval != feed.adaptive_fetch_interval_minutes:
                await feed_crud.update_feed(
                    db,
                    feed=feed,
                    update_data={"adaptive_fetch_interval_minutes": interval},
                )
                # Update next_fetch_at with new interval
                next_fetch = feed_crud.calculate_next_fetch(feed, ttl=ttl)
                await feed_crud.update_feed(db, feed=feed, update_data={"next_fetch_at": next_fetch})

            # Sync
            try:
                await sync_feed(get_settings(), feed)
            except Exception as e:
                logger.warning("Meilisearch sync failed", feed_id=str(feed.id), error=str(e))


async def _subscribe_to_existing_feed(
    db: AsyncSession,
    user_id: UUID,
    feed: Feed,
    folder_id: UUID,
    custom_title: str | None,
) -> tuple[Any, bool]:
    existing = await get_subscription_by_feed_id(db, feed_id=feed.id, user_id=user_id)
    if existing:
        return existing, False

    sub_in = SubscriptionCreate(url=str(feed.url), folder_id=folder_id, custom_title=custom_title)

    new_sub = await create_subscription(db, subscription_in=sub_in, user_id=user_id, feed_db=feed)
    return new_sub, True


async def _save_articles(db: AsyncSession, feed: Feed, articles: list[ArticleCreate]) -> int:
    if not articles:
        return 0

    # Update feed_id in place or create new objects
    # articles are already ArticleCreate objects, but feed_id might be dummy
    for article in articles:
        article.feed_id = feed.id

    created = await create_articles_batch(db, articles_data=articles)
    return len(created)
