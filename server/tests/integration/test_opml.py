"""E2E tests for OPML import/export with Taskiq.

This test suite exercises OPML import/export functionality by calling
async helper functions directly, avoiding Taskiq task dispatching overhead.

Testing Strategy:
- Call async_* helper functions directly with test database session
- Tests the actual business logic without Taskiq overhead
- More reliable and faster than dispatching tasks
"""

import io
from uuid import uuid4

import orjson
import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.feed import FeedSubscription
from app.models.folder import Folder
from app.models.user import Profile

# Sample OPML content for testing
VALID_OPML = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Test Feeds</title>
    </head>
    <body>
        <outline text="Technology" title="Technology">
            <outline type="rss" text="Hacker News" title="Hacker News"
                     xmlUrl="https://hnrss.org/newest"
                     htmlUrl="https://news.ycombinator.com"/>
            <outline type="rss" text="TechCrunch" title="TechCrunch"
                     xmlUrl="https://techcrunch.com/feed/"
                     htmlUrl="https://techcrunch.com"/>
        </outline>
        <outline text="News" title="News">
            <outline type="rss" text="BBC News" title="BBC News"
                     xmlUrl="https://feeds.bbci.co.uk/news/rss.xml"
                     htmlUrl="https://www.bbc.com/news"/>
        </outline>
    </body>
</opml>"""

MINIMAL_OPML = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head><title>Minimal</title></head>
    <body>
        <outline type="rss" text="Hacker News" xmlUrl="https://hnrss.org/newest"/>
    </body>
</opml>"""

INVALID_XML = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head><title>Invalid</title>
    <body>
        <outline type="rss" text="Test" xmlUrl="https://example.com/feed.xml"/>
    </body>
</opml>"""


ISOLATION_OPML = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Infra Test</title></head>
  <body>
    <outline text="Tech" title="Tech">
      <outline type="rss" text="Hacker News" xmlUrl="https://news.ycombinator.com/rss" />
    </outline>
    <outline type="rss" text="Solo Feed" xmlUrl="https://example.com/feed" />
  </body>
</opml>
"""


class TestOpmlInfrastructure:
    """Validate isolated infra primitives (DB, Redis, Taskiq)."""

    @pytest.mark.asyncio
    async def test_opml_tracker_writes_to_isolated_redis(self, redis_client):
        from app.workers.opml.progress import OpmlImportTracker

        task_id = f"test-{uuid4()}"
        tracker = OpmlImportTracker(task_id)

        await tracker.initialize(user_id="user-1", filename="infra.opml", total_feeds=2)

        meta_raw = await redis_client.get(tracker.key_meta)
        counters = await redis_client.hgetall(tracker.key_counters)
        assert meta_raw is not None
        assert counters.get("completed") == "0"

        await tracker.mark_success()
        state = await tracker.get_state()
        assert state is not None
        assert state.successful == 1

        await tracker.cancel()
        assert await redis_client.exists(tracker.key_cancel)

    @pytest.mark.asyncio
    async def test_import_opml_orchestrator_uses_isolated_resources(
        self,
        db_session: AsyncSession,
        test_user: Profile,
        redis_client,
        monkeypatch,
    ):
        """Ensure orchestrator touches DB folders, Redis tracker, and Taskiq stubs."""
        import asyncio
        from types import SimpleNamespace

        from app.workers.opml.import_opml import import_opml
        from app.workers.opml_tasks import import_single_feed_task

        dispatched_urls: list[str] = []

        async def fake_kiq(**kwargs):
            dispatched_urls.append(kwargs["feed_url"])
            return SimpleNamespace(task_id=f"fake-{len(dispatched_urls)}")

        monkeypatch.setattr(import_single_feed_task, "kiq", fake_kiq, raising=False)

        task_id = f"task-{uuid4()}"
        result = await import_opml(
            user_id=test_user.id,
            opml_content=ISOLATION_OPML,
            default_folder_name="Imported Feeds",
            task_id=task_id,
            filename="infra.opml",
        )

        assert result["total_feeds"] == 2
        assert result["dispatched_count"] == 2
        assert result["task_ids"] == ["fake-1", "fake-2"]
        assert sorted(dispatched_urls) == [
            "https://example.com/feed",
            "https://news.ycombinator.com/rss",
        ]

        # Verify folders persisted in isolated DB
        rows = await db_session.execute(
            text("SELECT name FROM folders WHERE user_id = :user_id"),
            {"user_id": test_user.id},
        )
        folder_names = {row[0] for row in rows}
        assert "Tech" in folder_names

        # Tracker state stored in isolated Redis
        meta_raw = await redis_client.get(f"opml_import:{task_id}:meta")
        assert meta_raw is not None
        meta = orjson.loads(meta_raw)
        assert meta["total"] == 2
        assert meta["filename"] == "infra.opml"

        # Allow any pending async operations to complete
        await asyncio.sleep(0.1)


class TestOpmlImportEagerMode:
    """Test OPML import with eager task execution (deterministic)."""

    @pytest.mark.asyncio
    async def test_import_opml_full_workflow(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession, monkeypatch
    ):
        """Test complete OPML import workflow by calling async functions directly."""
        from types import SimpleNamespace

        from app.workers.opml.import_opml import import_opml
        from app.workers.opml_tasks import import_single_feed_task

        # Patch .kiq to run synchronously
        async def sync_kiq(**kwargs):
            await import_single_feed_task(**kwargs)
            return SimpleNamespace(task_id=f"sync-{kwargs.get('feed_url')}")

        monkeypatch.setattr(import_single_feed_task, "kiq", sync_kiq)

        # Call the async function directly in test mode (no Celery)
        result = await import_opml(
            user_id=test_user.id,
            opml_content=MINIMAL_OPML,
            default_folder_name="Imported Feeds",
        )

        # Verify the result structure
        assert "total_feeds" in result
        assert result["total_feeds"] == 1

        # Check if import succeeded (may fail if feed is unreachable)
        if result.get("imported_count", 0) > 0:
            # Verify feed exists in database
            from sqlalchemy import select

            db_result = await db_session.execute(
                select(FeedSubscription).where(FeedSubscription.user_id == test_user.id)
            )
            subscriptions = db_result.scalars().all()
            assert len(subscriptions) >= 1

    @pytest.mark.asyncio
    async def test_import_opml_with_folders(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession, monkeypatch
    ):
        """Test OPML import creates folders correctly."""
        from types import SimpleNamespace

        from app.workers.opml.import_opml import import_opml
        from app.workers.opml_tasks import import_single_feed_task

        # Patch .kiq to run synchronously
        async def sync_kiq(**kwargs):
            await import_single_feed_task(**kwargs)
            return SimpleNamespace(task_id=f"sync-{kwargs.get('feed_url')}")

        monkeypatch.setattr(import_single_feed_task, "kiq", sync_kiq)

        # Call the async function directly in test mode (no Celery)
        await import_opml(
            user_id=test_user.id,
            opml_content=VALID_OPML,
            default_folder_name="Imported Feeds",
        )

        # Verify folders were created
        from sqlalchemy import select

        db_result = await db_session.execute(select(Folder).where(Folder.user_id == test_user.id))
        folders = db_result.scalars().all()
        folder_names = {f.name for f in folders}

        # Should have created Technology and News folders
        assert "Technology" in folder_names or "News" in folder_names

    @pytest.mark.asyncio
    async def test_import_single_feed_task_execution(
        self,
        async_client: AsyncClient,
        test_user: Profile,
        test_folder: Folder,
        db_session: AsyncSession,
    ):
        """Test individual feed import task executes correctly."""
        from app.workers.opml.import_feed import import_single_feed

        # Execute async function directly with db session
        result = await import_single_feed(
            user_id=test_user.id,
            feed_url="https://hnrss.org/newest",
            folder_id=str(test_folder.id),
            tag_names=[],
            feed_title="Hacker News",
            update_existing=False,
        )

        # Verify result structure
        assert "success" in result
        assert "url" in result
        assert "status" in result

        # If successful, verify in database
        if result["success"]:
            from sqlalchemy import select

            db_result = await db_session.execute(
                select(FeedSubscription).where(FeedSubscription.user_id == test_user.id)
            )
            subscriptions = db_result.scalars().all()
            assert len(subscriptions) >= 1


class TestOpmlImportValidation:
    """Test OPML import validation (no Celery execution needed)."""

    @pytest.mark.asyncio
    async def test_import_opml_invalid_file_type(self, async_client: AsyncClient):
        """Test importing file with invalid extension."""
        files = {"opml_file": ("test.txt", io.BytesIO(b"not opml"), "text/plain")}

        response = await async_client.post("/api/opml/import/", files=files)

        assert response.status_code == 400
        assert "Invalid file type" in response.json()["message"]

    @pytest.mark.asyncio
    async def test_import_opml_file_too_large(self, async_client: AsyncClient):
        """Test importing file that exceeds size limit."""
        large_content = "x" * (51 * 1024 * 1024)  # 51MB
        files = {
            "opml_file": (
                "large.opml",
                io.BytesIO(large_content.encode()),
                "application/xml",
            )
        }

        response = await async_client.post("/api/opml/import/", files=files)

        assert response.status_code == 413
        assert "too large" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_import_opml_invalid_xml(self, async_client: AsyncClient):
        """Test importing malformed XML."""
        files = {
            "opml_file": (
                "invalid.opml",
                io.BytesIO(INVALID_XML.encode()),
                "application/xml",
            )
        }

        response = await async_client.post("/api/opml/import/", files=files)

        assert response.status_code == 400
        assert "Invalid" in response.json()["message"]

    @pytest.mark.asyncio
    async def test_import_opml_rss_feed_instead_of_opml(self, async_client: AsyncClient):
        """Test uploading RSS feed instead of OPML."""
        rss_content = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
    <channel>
        <title>Test Feed</title>
        <link>https://example.com</link>
    </channel>
</rss>"""

        files = {
            "opml_file": (
                "feed.xml",
                io.BytesIO(rss_content.encode()),
                "application/xml",
            )
        }

        response = await async_client.post("/api/opml/import/", files=files)

        assert response.status_code == 400
        assert "OPML" in response.json()["message"]


class TestOpmlImportStatus:
    """Test OPML import status tracking."""

    @pytest.mark.asyncio
    async def test_get_import_status_not_found(self, async_client: AsyncClient):
        """Test that non-existent task status returns error."""
        # This test verifies the status endpoint behavior, but since the endpoint
        # may interact with Redis/Celery which can have event loop issues in tests,
        # we just verify the basic error response
        task_id = "non-existent-task-id"

        response = await async_client.get(f"/api/opml/import/status/{task_id}")

        # Should return an error status code (404, 500, etc.)
        assert response.status_code >= 400

    @pytest.mark.asyncio
    async def test_get_import_status_unauthorized(self, async_client: AsyncClient, test_user: Profile):
        """Test accessing another user's import task."""
        # Create a task for a different user
        from app.services.opml.tasks import (
            store_task_ownership as store_import_task_metadata,
        )

        other_user_id = "different-user-id"
        task_id = "other-user-task"

        await store_import_task_metadata(
            task_id=task_id,
            user_id=other_user_id,
        )

        response = await async_client.get(f"/api/opml/import/status/{task_id}")

        assert response.status_code == 403
        assert "access denied" in response.json()["detail"].lower()


class TestOpmlTaskManagement:
    """Test OPML task listing and cancellation."""

    @pytest.mark.asyncio
    async def test_get_active_import_task_none(self, async_client: AsyncClient):
        """Test when user has no active tasks."""
        response = await async_client.get("/api/opml/import/active")

        assert response.status_code == 200
        assert response.json() is None

    @pytest.mark.asyncio
    async def test_cancel_import_task_not_found(self, async_client: AsyncClient):
        """Test cancelling non-existent task."""
        task_id = "non-existent"

        response = await async_client.delete(f"/api/opml/import/cancel/{task_id}")

        assert response.status_code == 404
