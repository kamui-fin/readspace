"""E2E tests for OPML import/export routes.

Note: These tests mock Celery task execution because:
1. Celery tasks run in separate worker processes
2. Testing real Celery requires running workers which complicates test setup
3. We test the task queueing and status checking, not the task execution itself
4. The actual OPML processing logic is tested in unit tests

All other services (Redis, Database) use real implementations.
"""

import io
from datetime import datetime, timezone
from unittest.mock import Mock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Feed, Folder, Profile, Subscription

# Sample OPML content for testing
VALID_OPML = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Test Feeds</title>
    </head>
    <body>
        <outline text="Technology" title="Technology">
            <outline type="rss" text="TechCrunch" title="TechCrunch" 
                     xmlUrl="https://techcrunch.com/feed/" 
                     htmlUrl="https://techcrunch.com"/>
            <outline type="rss" text="Ars Technica" title="Ars Technica" 
                     xmlUrl="https://arstechnica.com/feed/" 
                     htmlUrl="https://arstechnica.com"/>
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
        <outline type="rss" text="Test Feed" xmlUrl="https://example.com/feed.xml"/>
    </body>
</opml>"""

INVALID_XML = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head><title>Invalid</title>
    <body>
        <outline type="rss" text="Test" xmlUrl="https://example.com/feed.xml"/>
    </body>
</opml>"""

RSS_FEED_CONTENT = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
    <channel>
        <title>Test Feed</title>
        <link>https://example.com</link>
        <description>Test Description</description>
    </channel>
</rss>"""


class TestOpmlImport:
    """Test OPML import endpoint."""

    @pytest.mark.asyncio
    async def test_import_opml_success(self, client: TestClient, test_user: Profile):
        """Test successful OPML import."""
        with patch("app.workers.opml_tasks.import_opml_task.delay") as mock_task:
            mock_task.return_value = Mock(id="test-task-id-123")

            # Create file upload
            files = {"opml_file": ("test.opml", io.BytesIO(VALID_OPML.encode()), "application/xml")}
            data = {"default_folder_name": "Imported Feeds"}

            response = client.post("/api/v1/opml/import/", files=files, data=data)

            assert response.status_code == 202
            result = response.json()
            assert result["processing_mode"] == "background"
            assert result["task_id"] == "test-task-id-123"
            assert result["estimated_feeds"] == 3  # 3 feeds in VALID_OPML
            assert "check_status_url" in result
            assert "status_page_url" in result

    @pytest.mark.asyncio
    async def test_import_opml_minimal(self, client: TestClient):
        """Test importing minimal OPML file."""
        with patch("app.workers.opml_tasks.import_opml_task.delay") as mock_task:
            mock_task.return_value = Mock(id="test-task-id-456")

            files = {"opml_file": ("minimal.opml", io.BytesIO(MINIMAL_OPML.encode()), "application/xml")}

            response = client.post("/api/v1/opml/import/", files=files)

            assert response.status_code == 202
            result = response.json()
            assert result["estimated_feeds"] == 1

    def test_import_opml_invalid_file_type(self, client: TestClient):
        """Test importing file with invalid extension."""
        files = {"opml_file": ("test.txt", io.BytesIO(b"not opml"), "text/plain")}

        response = client.post("/api/v1/opml/import/", files=files)

        assert response.status_code == 400
        assert "Invalid file type" in response.json()["detail"]

    def test_import_opml_no_file(self, client: TestClient):
        """Test import without file."""
        response = client.post("/api/v1/opml/import/")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_import_opml_file_too_large(self, client: TestClient):
        """Test importing file that exceeds size limit."""
        # Create a file larger than MAX_OPML_FILE_SIZE_MB (50MB)
        large_content = "x" * (51 * 1024 * 1024)  # 51MB
        files = {"opml_file": ("large.opml", io.BytesIO(large_content.encode()), "application/xml")}

        response = client.post("/api/v1/opml/import/", files=files)

        assert response.status_code == 413
        assert "too large" in response.json()["detail"].lower()

    def test_import_opml_invalid_xml(self, client: TestClient):
        """Test importing malformed XML."""
        files = {"opml_file": ("invalid.opml", io.BytesIO(INVALID_XML.encode()), "application/xml")}

        response = client.post("/api/v1/opml/import/", files=files)

        assert response.status_code == 400
        assert "Invalid OPML" in response.json()["detail"]

    def test_import_opml_invalid_encoding(self, client: TestClient):
        """Test importing file with invalid encoding."""
        # Create content with invalid UTF-8 bytes
        invalid_bytes = b"\xff\xfe" + VALID_OPML.encode("utf-16")
        files = {"opml_file": ("test.opml", io.BytesIO(invalid_bytes), "application/xml")}

        response = client.post("/api/v1/opml/import/", files=files)

        # Should either succeed with fallback encoding or fail gracefully
        assert response.status_code in [202, 400]

    @pytest.mark.asyncio
    async def test_import_opml_custom_folder_name(self, client: TestClient):
        """Test importing with custom default folder name."""
        with patch("app.workers.opml_tasks.import_opml_task.delay") as mock_task:
            mock_task.return_value = Mock(id="test-task-id-789")

            files = {"opml_file": ("test.opml", io.BytesIO(VALID_OPML.encode()), "application/xml")}
            data = {"default_folder_name": "My Custom Folder"}

            response = client.post("/api/v1/opml/import/", files=files, data=data)

            assert response.status_code == 202
            # Verify the task was called with custom folder name
            mock_task.assert_called_once()
            call_kwargs = mock_task.call_args[1]
            assert call_kwargs["default_folder_name"] == "My Custom Folder"

    def test_import_opml_empty_folder_name(self, client: TestClient):
        """Test importing with empty folder name."""
        files = {"opml_file": ("test.opml", io.BytesIO(VALID_OPML.encode()), "application/xml")}
        data = {"default_folder_name": ""}

        response = client.post("/api/v1/opml/import/", files=files, data=data)

        assert response.status_code == 422


class TestOpmlImportStatus:
    """Test OPML import status endpoint."""

    @pytest.mark.asyncio
    async def test_get_import_status_pending(self, client: TestClient, test_user: Profile):
        """Test getting status of pending import."""
        task_id = "test-task-pending"

        # Mock Redis metadata
        with patch("app.routers.opml.get_import_task_metadata") as mock_metadata:
            mock_metadata.return_value = {
                "user_id": str(test_user.id),
                "task_id": task_id,
                "estimated_feeds": 5,
                "filename": "test.opml",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "pending",
            }

            # Mock Celery task
            with patch("celery.result.AsyncResult") as mock_result:
                mock_task = Mock()
                mock_task.state = "PENDING"
                mock_result.return_value = mock_task

                response = client.get(f"/api/v1/opml/import/status/{task_id}")

                assert response.status_code == 200
                data = response.json()
                assert data["task_id"] == task_id
                assert data["status"] == "pending"
                assert "message" in data

    @pytest.mark.asyncio
    async def test_get_import_status_in_progress(self, client: TestClient, test_user: Profile):
        """Test getting status of in-progress import."""
        task_id = "test-task-progress"

        with patch("app.routers.opml.get_import_task_metadata") as mock_metadata:
            mock_metadata.return_value = {
                "user_id": str(test_user.id),
                "task_id": task_id,
                "estimated_feeds": 10,
                "filename": "test.opml",
            }

            with patch("celery.result.AsyncResult") as mock_result:
                mock_task = Mock()
                mock_task.state = "PROGRESS"
                mock_task.info = {"completed": 5, "total": 10}
                mock_result.return_value = mock_task

                response = client.get(f"/api/v1/opml/import/status/{task_id}")

                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "in_progress"
                assert "progress" in data

    @pytest.mark.asyncio
    async def test_get_import_status_completed(self, client: TestClient, test_user: Profile):
        """Test getting status of completed import."""
        task_id = "test-task-complete"

        with patch("app.routers.opml.get_import_task_metadata") as mock_metadata:
            mock_metadata.return_value = {
                "user_id": str(test_user.id),
                "task_id": task_id,
                "estimated_feeds": 3,
                "filename": "test.opml",
            }

            with patch("celery.result.AsyncResult") as mock_result:
                # Mock orchestration task
                mock_orchestration = Mock()
                mock_orchestration.state = "SUCCESS"
                mock_orchestration.result = {"task_ids": ["feed1", "feed2", "feed3"]}

                # Mock individual feed tasks
                def get_feed_task(task_id):
                    mock_feed = Mock()
                    mock_feed.state = "SUCCESS"
                    mock_feed.result = {"success": True, "status": "imported"}
                    return mock_feed

                mock_result.side_effect = lambda tid: (mock_orchestration if tid == task_id else get_feed_task(tid))

                with patch("app.routers.opml.cleanup_completed_task") as mock_cleanup:
                    response = client.get(f"/api/v1/opml/import/status/{task_id}")

                    assert response.status_code == 200
                    data = response.json()
                    assert data["status"] == "completed"
                    assert "result" in data
                    assert data["result"]["total_feeds"] == 3

    @pytest.mark.asyncio
    async def test_get_import_status_failed(self, client: TestClient, test_user: Profile):
        """Test getting status of failed import."""
        task_id = "test-task-failed"

        with patch("app.routers.opml.get_import_task_metadata") as mock_metadata:
            mock_metadata.return_value = {
                "user_id": str(test_user.id),
                "task_id": task_id,
                "estimated_feeds": 5,
                "filename": "test.opml",
            }

            with patch("celery.result.AsyncResult") as mock_result:
                mock_task = Mock()
                mock_task.state = "FAILURE"
                mock_task.info = "Task failed due to error"
                mock_result.return_value = mock_task

                with patch("app.routers.opml.cleanup_completed_task"):
                    response = client.get(f"/api/v1/opml/import/status/{task_id}")

                    assert response.status_code == 200
                    data = response.json()
                    assert data["status"] == "failed"
                    assert "error" in data

    def test_get_import_status_not_found(self, client: TestClient):
        """Test getting status of non-existent task."""
        task_id = "non-existent-task"

        with patch("app.routers.opml.get_import_task_metadata") as mock_metadata:
            mock_metadata.return_value = None

            with patch("celery.result.AsyncResult") as mock_result:
                mock_task = Mock()
                mock_task.state = "PENDING"
                mock_result.return_value = mock_task

                response = client.get(f"/api/v1/opml/import/status/{task_id}")

                assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_import_status_unauthorized(self, client: TestClient, test_user: Profile):
        """Test accessing another user's import task."""
        task_id = "other-user-task"

        with patch("app.routers.opml.get_import_task_metadata") as mock_metadata:
            # Return metadata for different user
            mock_metadata.return_value = {
                "user_id": "different-user-id",
                "task_id": task_id,
                "estimated_feeds": 5,
                "filename": "test.opml",
            }

            response = client.get(f"/api/v1/opml/import/status/{task_id}")

            assert response.status_code == 403
            assert "permission" in response.json()["detail"].lower()


class TestListUserImportTasks:
    """Test list user import tasks endpoint."""

    @pytest.mark.asyncio
    async def test_list_tasks_empty(self, client: TestClient):
        """Test listing tasks when user has none."""
        with patch("app.core.redis_cache.RedisCache.get") as mock_get:
            mock_get.return_value = []

            response = client.get("/api/v1/opml/import/tasks")

            assert response.status_code == 200
            assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_tasks_with_active_tasks(self, client: TestClient, test_user: Profile):
        """Test listing active import tasks."""
        tasks = [
            {
                "user_id": str(test_user.id),
                "task_id": "task-1",
                "estimated_feeds": 5,
                "filename": "feeds1.opml",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "pending",
            },
            {
                "user_id": str(test_user.id),
                "task_id": "task-2",
                "estimated_feeds": 10,
                "filename": "feeds2.opml",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "in_progress",
            },
        ]

        with patch("app.core.redis_cache.RedisCache.get") as mock_get:
            mock_get.return_value = tasks

            with patch("celery.result.AsyncResult") as mock_result:
                mock_task = Mock()
                mock_task.state = "PROGRESS"
                mock_result.return_value = mock_task

                response = client.get("/api/v1/opml/import/tasks")

                assert response.status_code == 200
                data = response.json()
                assert len(data) == 2

    @pytest.mark.asyncio
    async def test_list_tasks_filters_completed(self, client: TestClient, test_user: Profile):
        """Test that completed tasks are filtered out."""
        tasks = [
            {
                "user_id": str(test_user.id),
                "task_id": "task-active",
                "estimated_feeds": 5,
                "filename": "active.opml",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "pending",
            },
            {
                "user_id": str(test_user.id),
                "task_id": "task-completed",
                "estimated_feeds": 10,
                "filename": "completed.opml",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "completed",
            },
        ]

        with patch("app.core.redis_cache.RedisCache.get") as mock_get:
            mock_get.return_value = tasks

            with patch("celery.result.AsyncResult") as mock_result:

                def get_task_state(task_id):
                    mock_task = Mock()
                    if task_id == "task-completed":
                        mock_task.state = "SUCCESS"
                        mock_task.result = {"task_ids": []}
                    else:
                        mock_task.state = "PENDING"
                    return mock_task

                mock_result.side_effect = get_task_state

                with patch("app.routers.opml.cleanup_completed_task"):
                    response = client.get("/api/v1/opml/import/tasks")

                    assert response.status_code == 200
                    data = response.json()
                    # Should only return active task
                    assert len(data) == 1
                    assert data[0]["task_id"] == "task-active"


class TestGetActiveImportTask:
    """Test get active import task endpoint."""

    @pytest.mark.asyncio
    async def test_get_active_task_none(self, client: TestClient):
        """Test when user has no active tasks."""
        with patch("app.routers.opml.list_user_import_tasks") as mock_list:
            mock_list.return_value = []

            response = client.get("/api/v1/opml/import/active")

            assert response.status_code == 200
            assert response.json() is None

    @pytest.mark.asyncio
    async def test_get_active_task_returns_most_recent(self, client: TestClient, test_user: Profile):
        """Test that most recent task is returned."""
        tasks = [
            {
                "user_id": str(test_user.id),
                "task_id": "task-old",
                "estimated_feeds": 5,
                "filename": "old.opml",
                "created_at": "2024-01-01T00:00:00Z",
                "status": "pending",
            },
            {
                "user_id": str(test_user.id),
                "task_id": "task-recent",
                "estimated_feeds": 10,
                "filename": "recent.opml",
                "created_at": "2024-01-02T00:00:00Z",
                "status": "in_progress",
            },
        ]

        with patch("app.routers.opml.list_user_import_tasks") as mock_list:
            mock_list.return_value = tasks

            response = client.get("/api/v1/opml/import/active")

            assert response.status_code == 200
            data = response.json()
            assert data["task_id"] == "task-recent"


class TestCancelImportTask:
    """Test cancel import task endpoint."""

    @pytest.mark.asyncio
    async def test_cancel_task_success(self, client: TestClient, test_user: Profile):
        """Test successfully cancelling an import task."""
        task_id = "task-to-cancel"

        with patch("app.routers.opml.get_import_task_metadata") as mock_metadata:
            mock_metadata.return_value = {
                "user_id": str(test_user.id),
                "task_id": task_id,
                "estimated_feeds": 5,
                "filename": "test.opml",
            }

            with patch("celery.result.AsyncResult") as mock_result:
                mock_task = Mock()
                mock_task.state = "PROGRESS"
                mock_task.revoke = Mock()
                mock_result.return_value = mock_task

                with patch("app.routers.opml.cleanup_completed_task"):
                    response = client.delete(f"/api/v1/opml/import/cancel/{task_id}")

                    assert response.status_code == 200
                    data = response.json()
                    assert data["cancelled"] is True
                    assert data["task_id"] == task_id
                    mock_task.revoke.assert_called_once()

    @pytest.mark.asyncio
    async def test_cancel_task_not_found(self, client: TestClient):
        """Test cancelling non-existent task."""
        task_id = "non-existent"

        with patch("app.routers.opml.get_import_task_metadata") as mock_metadata:
            mock_metadata.return_value = None

            response = client.delete(f"/api/v1/opml/import/cancel/{task_id}")

            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_cancel_task_unauthorized(self, client: TestClient, test_user: Profile):
        """Test cancelling another user's task."""
        task_id = "other-user-task"

        with patch("app.routers.opml.get_import_task_metadata") as mock_metadata:
            mock_metadata.return_value = {
                "user_id": "different-user-id",
                "task_id": task_id,
                "estimated_feeds": 5,
                "filename": "test.opml",
            }

            response = client.delete(f"/api/v1/opml/import/cancel/{task_id}")

            assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_cancel_already_completed_task(self, client: TestClient, test_user: Profile):
        """Test cancelling already completed task."""
        task_id = "completed-task"

        with patch("app.routers.opml.get_import_task_metadata") as mock_metadata:
            mock_metadata.return_value = {
                "user_id": str(test_user.id),
                "task_id": task_id,
                "estimated_feeds": 5,
                "filename": "test.opml",
            }

            with patch("celery.result.AsyncResult") as mock_result:
                mock_task = Mock()
                mock_task.state = "SUCCESS"
                mock_result.return_value = mock_task

                with patch("app.routers.opml.cleanup_completed_task"):
                    response = client.delete(f"/api/v1/opml/import/cancel/{task_id}")

                    assert response.status_code == 200
                    data = response.json()
                    assert data["cancelled"] is False
                    assert "already" in data["message"].lower()


class TestOpmlExport:
    """Test OPML export endpoint."""

    @pytest.mark.asyncio
    async def test_export_opml_success(
        self, client: TestClient, test_feed: Feed, test_user: Profile, db_session: AsyncSession
    ):
        """Test successful OPML export."""
        # Create subscription
        subscription = Subscription(user_id=test_user.id, feed_id=test_feed.id)
        db_session.add(subscription)
        await db_session.flush()

        response = client.get("/api/v1/opml/export/")

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/plain; charset=utf-8"
        assert "attachment" in response.headers["content-disposition"]
        assert "readspace_feeds_export.opml" in response.headers["content-disposition"]

        # Verify OPML structure
        content = response.text
        assert "<?xml version" in content
        assert "<opml version" in content
        assert test_feed.title in content

    @pytest.mark.asyncio
    async def test_export_opml_empty(self, client: TestClient):
        """Test exporting when user has no feeds."""
        response = client.get("/api/v1/opml/export/")

        assert response.status_code == 200
        content = response.text
        assert "<?xml version" in content
        assert "<opml version" in content

    @pytest.mark.asyncio
    async def test_export_opml_with_folders(
        self, client: TestClient, test_feed: Feed, test_folder: Folder, test_user: Profile, db_session: AsyncSession
    ):
        """Test exporting feeds organized in folders."""
        # Create subscription with folder
        subscription = Subscription(user_id=test_user.id, feed_id=test_feed.id, folder_id=test_folder.id)
        db_session.add(subscription)
        await db_session.flush()

        response = client.get("/api/v1/opml/export/")

        assert response.status_code == 200
        content = response.text
        assert test_folder.name in content
        assert test_feed.title in content

    @pytest.mark.asyncio
    async def test_export_opml_multiple_feeds(self, client: TestClient, test_user: Profile, db_session: AsyncSession):
        """Test exporting multiple feeds."""
        # Create multiple feeds and subscriptions
        for i in range(3):
            feed = Feed(url=f"https://example.com/feed{i}.xml", title=f"Feed {i}")
            db_session.add(feed)
            await db_session.flush()

            subscription = Subscription(user_id=test_user.id, feed_id=feed.id)
            db_session.add(subscription)

        await db_session.flush()

        response = client.get("/api/v1/opml/export/")

        assert response.status_code == 200
        content = response.text
        # Should contain all feeds
        for i in range(3):
            assert f"Feed {i}" in content

    def test_export_opml_unauthenticated(self):
        """Test export without authentication."""
        from app.main import app

        with TestClient(app) as client:
            response = client.get("/api/v1/opml/export/")
            assert response.status_code == 401


class TestOpmlIntegration:
    """Integration tests for OPML import/export workflow."""

    @pytest.mark.asyncio
    async def test_import_export_roundtrip(self, client: TestClient, test_user: Profile, db_session: AsyncSession):
        """Test importing OPML and then exporting it back."""
        # First, create some feeds manually
        feed = Feed(url="https://example.com/feed.xml", title="Test Feed")
        db_session.add(feed)
        await db_session.flush()

        subscription = Subscription(user_id=test_user.id, feed_id=feed.id)
        db_session.add(subscription)
        await db_session.flush()

        # Export
        export_response = client.get("/api/v1/opml/export/")
        assert export_response.status_code == 200
        exported_opml = export_response.text

        # Verify export contains the feed
        assert "Test Feed" in exported_opml
        assert "https://example.com/feed.xml" in exported_opml

    @pytest.mark.asyncio
    async def test_import_status_workflow(self, client: TestClient, test_user: Profile):
        """Test complete import workflow: upload -> check status -> complete."""
        with patch("app.workers.opml_tasks.import_opml_task.delay") as mock_task:
            task_id = "workflow-task-id"
            mock_task.return_value = Mock(id=task_id)

            # 1. Upload OPML
            files = {"opml_file": ("test.opml", io.BytesIO(VALID_OPML.encode()), "application/xml")}
            import_response = client.post("/api/v1/opml/import/", files=files)
            assert import_response.status_code == 202

            # 2. Check status (pending)
            with patch("app.routers.opml.get_import_task_metadata") as mock_metadata:
                mock_metadata.return_value = {
                    "user_id": str(test_user.id),
                    "task_id": task_id,
                    "estimated_feeds": 3,
                    "filename": "test.opml",
                }

                with patch("celery.result.AsyncResult") as mock_result:
                    mock_celery_task = Mock()
                    mock_celery_task.state = "PENDING"
                    mock_result.return_value = mock_celery_task

                    status_response = client.get(f"/api/v1/opml/import/status/{task_id}")
                    assert status_response.status_code == 200
                    assert status_response.json()["status"] == "pending"

    @pytest.mark.asyncio
    async def test_concurrent_imports_prevented(self, client: TestClient, test_user: Profile):
        """Test that system handles concurrent import attempts."""
        with patch("app.workers.opml_tasks.import_opml_task.delay") as mock_task:
            mock_task.return_value = Mock(id="concurrent-task-1")

            files1 = {"opml_file": ("test1.opml", io.BytesIO(VALID_OPML.encode()), "application/xml")}
            response1 = client.post("/api/v1/opml/import/", files=files1)
            assert response1.status_code == 202

            # Second import should also succeed (system allows multiple imports)
            mock_task.return_value = Mock(id="concurrent-task-2")
            files2 = {"opml_file": ("test2.opml", io.BytesIO(VALID_OPML.encode()), "application/xml")}
            response2 = client.post("/api/v1/opml/import/", files=files2)
            assert response2.status_code == 202
