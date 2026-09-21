from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.crud.article.reader import get_article_by_id
from app.models.enums import ContentType


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("url", "subscribed", "allowed"),
    [
        ("https://publication.example/feed", False, True),
        ("newsletter://owner/sender@example.com", False, False),
        ("newsletter://owner/sender@example.com", True, True),
    ],
)
async def test_only_virtual_email_feeds_require_subscription_for_preview(url, subscribed, allowed):
    article = SimpleNamespace(feed=SimpleNamespace(url=url, content_type=ContentType.NEWSLETTER))
    row = (article, None, object() if subscribed else None)
    result = MagicMock()
    result.first.return_value = row
    db = AsyncMock()
    db.execute.return_value = result
    actual = await get_article_by_id(db, article_id=uuid4(), user_id=uuid4(), allow_preview=True)
    assert actual == (row if allowed else None)
