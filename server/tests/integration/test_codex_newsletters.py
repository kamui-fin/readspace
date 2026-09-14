"""Integration tests: the Codex Daily Digest covers newsletter articles, not just RSS feed articles.

Newsletters arrive by email into a per-user virtual feed (``newsletter://`` URL) with a normal
subscription and FeedArticle rows, so Phase 0 picks them up like any feed. Phase 1.5 must read
their stored email body rather than trying to scrape the ``newsletter://`` link.
"""

import hashlib
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import NEWSLETTER_URL_SCHEME
from app.crud.article.reader import get_feed_article_bodies
from app.models.article import ArticleContent, FeedArticle
from app.models.enums import ContentType
from app.models.feed import Feed, FeedSubscription
from app.models.folder import Folder
from app.models.user import Profile
from app.services.codex.gather import fetch_full_texts, gather_catalog
from app.utils.hashing import get_content_hash

NEWSLETTER_TITLE = "Chip Weekly #12"
NEWSLETTER_BODY = (
    "<table><tr><td><h1>Issue #12</h1><p>Everything that happened in chips this week.</p></td></tr></table>"
)


async def _seed_subscribed_article(
    db_session: AsyncSession,
    *,
    user: Profile,
    folder: Folder,
    feed_url: str,
    feed_title: str,
    title: str,
    link: str,
    body: str,
    content_type: ContentType | None = None,
) -> FeedArticle:
    """Create a feed the user is subscribed to, with one article published two hours ago."""
    feed = Feed(id=uuid4(), url=feed_url, title=feed_title, description="", language="en")
    if content_type is not None:
        feed.content_type = content_type
    db_session.add(feed)
    await db_session.flush()

    db_session.add(FeedSubscription(id=uuid4(), user_id=user.id, feed_id=feed.id, folder_id=folder.id))
    content = ArticleContent(
        id=uuid4(),
        title=title,
        link=link,
        content_hash=get_content_hash(link),
        description=f"{title} excerpt",
        content=body,
    )
    db_session.add(content)
    await db_session.flush()

    feed_article = FeedArticle(
        id=uuid4(),
        feed_id=feed.id,
        content_id=content.id,
        guid_hash=hashlib.sha256(link.encode()).hexdigest(),
        published_at=datetime.now(UTC) - timedelta(hours=2),
    )
    db_session.add(feed_article)
    await db_session.flush()
    return feed_article


async def _seed_newsletter_article(db_session: AsyncSession, user: Profile, folder: Folder) -> FeedArticle:
    """Mirror what the inbound email webhook stores for one newsletter issue."""
    sender = f"writer-{uuid4().hex[:8]}@example.com"
    return await _seed_subscribed_article(
        db_session,
        user=user,
        folder=folder,
        feed_url=f"{NEWSLETTER_URL_SCHEME}{user.id}/{sender}",
        feed_title="Chip Weekly",
        title=NEWSLETTER_TITLE,
        link=f"{NEWSLETTER_URL_SCHEME}{user.id}/{sender}/{uuid4().hex}",
        body=NEWSLETTER_BODY,
        content_type=ContentType.NEWSLETTER,
    )


async def test_gather_catalog_includes_newsletter_and_feed_articles(
    db_session: AsyncSession, test_user: Profile, test_folder: Folder
) -> None:
    newsletter_article = await _seed_newsletter_article(db_session, test_user, test_folder)
    rss_article = await _seed_subscribed_article(
        db_session,
        user=test_user,
        folder=test_folder,
        feed_url=f"https://example.com/{uuid4().hex}.xml",
        feed_title="Example RSS",
        title="An RSS Story",
        link=f"https://example.com/story-{uuid4().hex}",
        body="<p>RSS body</p>",
    )

    gathered = await gather_catalog(db_session, test_user.id, now=datetime.now(UTC))

    gathered_ids = {item.id for item in gathered.items_by_id.values()}
    assert newsletter_article.id in gathered_ids
    assert rss_article.id in gathered_ids

    newsletter_entry = next(entry for entry in gathered.catalog if entry["title"] == NEWSLETTER_TITLE)
    assert newsletter_entry["source"] == "Chip Weekly"
    assert newsletter_entry["snippet"] == f"{NEWSLETTER_TITLE} excerpt"


async def test_newsletter_full_text_comes_from_stored_email_body(
    db_session: AsyncSession, test_user: Profile, test_folder: Folder, monkeypatch: pytest.MonkeyPatch
) -> None:
    newsletter_article = await _seed_newsletter_article(db_session, test_user, test_folder)
    scrape = AsyncMock(return_value=(None, "should never be called"))
    monkeypatch.setattr("app.services.codex.gather.extract_full_content", scrape)

    gathered = await gather_catalog(db_session, test_user.id, now=datetime.now(UTC))
    item = next(i for i in gathered.items_by_id.values() if i.id == newsletter_article.id)

    bodies = await get_feed_article_bodies(db_session, [item.id, uuid4()])
    full_texts = await fetch_full_texts([item], stored_bodies=bodies)

    assert bodies == {item.id: NEWSLETTER_BODY}
    scrape.assert_not_called()
    assert "Everything that happened in chips this week." in full_texts[item.id]
    assert "<table>" not in full_texts[item.id]
