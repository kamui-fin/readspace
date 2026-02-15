import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
from app.services.feeds.service import add_feed
from app.models.feed import Feed
from sqlalchemy import select


@pytest.mark.asyncio
async def test_add_feed_persists_metadata(db_session, test_user):
    user_id = test_user.id

    # Create a folder
    from app.models.folder import Folder

    folder = Folder(name="Test Folder", user_id=user_id)
    db_session.add(folder)
    await db_session.flush()

    # Mock fetching
    mock_fetch_result = {
        "content": "dummy content",
        "headers": {
            "etag": "test-etag",
            "last-modified": "Mon, 01 Jan 2024 00:00:00 GMT",
        },
        "status_code": 200,
        "not_modified": False,
        "error": None,
        "final_url": "http://example.com/feed",
        "permanent_redirect": False,
    }

    # Mock parsing
    mock_parsed = MagicMock()
    mock_parsed.title = "Test Feed"
    mock_parsed.description = "Test Description"
    mock_parsed.link = "http://example.com"
    mock_parsed.language = "en"
    mock_parsed.image_url = None
    mock_parsed.last_updated_at = datetime(2025, 12, 1, 2, 11, 30, tzinfo=timezone.utc)
    mock_parsed.articles = []
    mock_parsed.tags = []
    mock_parsed.author = None
    mock_parsed.content_type = None

    with patch(
        "app.services.feeds.service.fetching.fetch_feed_content", new_callable=AsyncMock
    ) as mock_fetch:
        mock_fetch.return_value = mock_fetch_result

        with patch(
            "app.services.feeds.service.parsing.parse_feed_content"
        ) as mock_parse:
            mock_parse.return_value = mock_parsed

            # Mock calculate_feed_content_hash
            with patch(
                "app.services.feeds.service.calculate_feed_content_hash",
                return_value="hash",
            ):
                # Mock domain authority
                with patch(
                    "app.services.feeds.service.get_domain_authority_score"
                ) as mock_score:
                    mock_score.return_value.score = 50.0

                    # Mock scheduling
                    with patch(
                        "app.services.feeds.service.scheduling.calculate_optimal_interval",
                        new_callable=AsyncMock,
                    ) as mock_interval:
                        mock_interval.return_value = 60

                        # Mock sync_feed
                        with patch(
                            "app.services.feeds.service.sync_feed",
                            new_callable=AsyncMock,
                        ):

                            # Call add_feed
                            class AsyncContextManager:
                                async def __aenter__(self):
                                    return db_session

                                async def __aexit__(self, exc_type, exc, tb):
                                    pass

                            await add_feed(
                                session_factory=lambda: AsyncContextManager(),
                                user_id=user_id,
                                url="http://example.com/feed",
                                folder_id=folder.id,
                            )

    # Verify
    result = await db_session.execute(
        select(Feed).filter(Feed.url == "https://example.com/feed")
    )
    feed = result.scalars().first()

    assert feed is not None
    assert feed.etag_header == "test-etag"
    assert feed.last_modified_header == "Mon, 01 Jan 2024 00:00:00 GMT"
    assert feed.last_updated_at == datetime(2025, 12, 1, 2, 11, 30, tzinfo=timezone.utc)
