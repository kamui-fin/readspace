from uuid import uuid4

import orjson
import pytest
from fastapi import HTTPException

from app.services.opml.tasks import (
    TaskRepository,
    cancel_user_task,
    get_task_status,
    list_user_tasks,
    store_task_ownership,
)
from app.typing.common import ImportStatus
from app.typing.opml import FeedImportError
from app.workers.opml.progress import OpmlImportTracker


@pytest.fixture
def task_repo():
    return TaskRepository()


@pytest.mark.asyncio
class TestOpmlTaskRepository:
    """Tests for the TaskRepository class in tasks.py"""

    async def test_assign_and_get_owner(self, task_repo, redis_client):
        task_id = f"task-{uuid4()}"
        user_id = f"user-{uuid4()}"

        await task_repo.assign_ownership(task_id, user_id)

        owner = await task_repo.get_owner(task_id)
        assert owner == user_id

        # Verify directly in Redis
        stored_owner = await redis_client.get(task_repo._owner_key(task_id))
        assert stored_owner == user_id

    async def test_user_task_list_management(self, task_repo, redis_client):
        user_id = f"user-{uuid4()}"
        task1 = f"task-{uuid4()}"
        task2 = f"task-{uuid4()}"

        await task_repo.assign_ownership(task1, user_id)
        await task_repo.assign_ownership(task2, user_id)

        tasks = await task_repo.get_user_task_ids(user_id)
        assert task1 in tasks
        assert task2 in tasks
        assert len(tasks) == 2

    async def test_remove_ownership(self, task_repo, redis_client):
        user_id = f"user-{uuid4()}"
        task_id = f"task-{uuid4()}"

        await task_repo.assign_ownership(task_id, user_id)
        await task_repo.remove_ownership(task_id, user_id)

        owner = await task_repo.get_owner(task_id)
        assert owner is None

        tasks = await task_repo.get_user_task_ids(user_id)
        assert task_id not in tasks


@pytest.mark.asyncio
class TestOpmlImportTracker:
    """Tests for OpmlImportTracker in progress.py"""

    async def test_initialization(self, redis_client):
        task_id = f"task-{uuid4()}"
        tracker = OpmlImportTracker(task_id)
        user_id = "user-123"

        state = await tracker.initialize(
            user_id=user_id,
            filename="test.opml",
            total_feeds=10,
            opml_title="Test OPML",
        )

        assert state.task_id == task_id
        assert state.status == ImportStatus.PENDING
        assert state.total == 10

        # Verify Redis state
        meta_raw = await redis_client.get(tracker.key_meta)
        meta = orjson.loads(meta_raw)
        assert meta["status"] == ImportStatus.PENDING.value
        assert meta["total"] == 10

    async def test_progress_updates(self, redis_client):
        task_id = f"task-{uuid4()}"
        tracker = OpmlImportTracker(task_id)
        await tracker.initialize("user-1", "test.opml", 5)

        # Simulate success
        await tracker.mark_success()
        state = await tracker.get_state()
        assert state.successful == 1
        assert state.completed == 1
        assert state.progress_percentage == 20  # 1/5

        # Simulate already exists
        await tracker.mark_success(already_exists=True)
        state = await tracker.get_state()
        assert state.already_existed == 1
        assert state.completed == 2
        assert state.progress_percentage == 40  # 2/5

    async def test_failure_tracking(self, redis_client):
        task_id = f"task-{uuid4()}"
        tracker = OpmlImportTracker(task_id)
        await tracker.initialize("user-1", "test.opml", 5)

        error = FeedImportError(url="http://bad.url", error="Connection failed", status="failed")
        await tracker.mark_failure(error)

        state = await tracker.get_state()
        assert state.failed == 1
        assert state.completed == 1
        assert len(state.errors) == 1
        assert state.errors[0].url == "http://bad.url"

    async def test_completion_logic(self, redis_client):
        task_id = f"task-{uuid4()}"
        tracker = OpmlImportTracker(task_id)
        await tracker.initialize("user-1", "test.opml", 2)

        # First feed
        await tracker.mark_success()
        state = await tracker.get_state()
        assert (
            state.status == ImportStatus.PENDING
        )  # Still pending/in-progress (logic keeps it pending until explicitly set or completed? initialize sets PENDING)
        # Wait, initialize sets PENDING. mark_success increments counters.
        # _check_completion checks if completed >= total.

        # Actually, initialize sets PENDING. Usually the worker would set it to IN_PROGRESS when it starts processing.
        # But let's check if _check_completion handles PENDING -> COMPLETED transition or if it expects IN_PROGRESS.
        # Code says: if new_completed_count >= meta["total"] and meta.get("status") == ImportStatus.IN_PROGRESS.value:
        # So we must manually set it to IN_PROGRESS for auto-completion to work.

        # Manually set to IN_PROGRESS
        async with tracker._client() as r:
            meta_raw = await r.get(tracker.key_meta)
            meta = orjson.loads(meta_raw)
            meta["status"] = ImportStatus.IN_PROGRESS.value
            await r.set(tracker.key_meta, orjson.dumps(meta))

        # Second feed
        await tracker.mark_success()

        state = await tracker.get_state()
        assert state.status == ImportStatus.COMPLETED
        assert state.completed == 2
        assert "added" in state.message

    async def test_cancellation_flag(self, redis_client):
        task_id = f"task-{uuid4()}"
        tracker = OpmlImportTracker(task_id)

        assert not await tracker.is_cancelled()
        await tracker.cancel()
        assert await tracker.is_cancelled()


@pytest.mark.asyncio
class TestOpmlServiceIntegration:
    """Integration tests for services/opml/tasks.py interacting with progress.py"""

    async def test_list_user_tasks_cleanup(self, redis_client):
        """Test that list_user_tasks cleans up expired tasks."""
        user_id = f"user-{uuid4()}"
        task_id = f"task-{uuid4()}"

        # Assign ownership but create no tracker state (simulating expiration)
        await store_task_ownership(task_id, user_id)

        # list_user_tasks should see it as PENDING if owner exists but state is missing
        tasks = await list_user_tasks(user_id)
        assert len(tasks) == 1
        assert tasks[0].status == ImportStatus.PENDING

        # Now simulate that even ownership is gone (or we want to test the cleanup logic for orphaned IDs in the set)
        # If we manually add a task ID to the user list but don't set the owner key:
        repo = TaskRepository()
        orphaned_task = f"task-{uuid4()}"
        async with redis_client.pipeline() as pipe:
            pipe.sadd(repo._user_list_key(user_id), orphaned_task)
            await pipe.execute()

        # list_user_tasks should detect orphaned_task has no owner and remove it
        tasks = await list_user_tasks(user_id)
        # Should still have the first task (PENDING)
        assert len(tasks) == 1
        assert tasks[0].task_id == task_id

        # Verify orphaned task was removed from set
        stored_tasks = await repo.get_user_task_ids(user_id)
        assert orphaned_task not in stored_tasks

    async def test_get_task_status_flow(self, redis_client):
        user_id = f"user-{uuid4()}"
        task_id = f"task-{uuid4()}"

        # 1. Setup ownership
        await store_task_ownership(task_id, user_id)

        # 2. Check status (should be PENDING as no state exists yet)
        status_resp = await get_task_status(task_id, user_id)
        assert status_resp.status == ImportStatus.PENDING

        # 3. Initialize tracker (simulating worker start)
        tracker = OpmlImportTracker(task_id)
        await tracker.initialize(user_id, "test.opml", 10)

        # Manually set to IN_PROGRESS
        async with tracker._client() as r:
            meta_raw = await r.get(tracker.key_meta)
            meta = orjson.loads(meta_raw)
            meta["status"] = ImportStatus.IN_PROGRESS.value
            await r.set(tracker.key_meta, orjson.dumps(meta))

        # 4. Check status again
        status_resp = await get_task_status(task_id, user_id)
        assert status_resp.status == ImportStatus.IN_PROGRESS
        assert status_resp.progress is not None
        assert status_resp.progress.total == 10

    async def test_get_task_status_permissions(self):
        user_id = f"user-{uuid4()}"
        other_user = f"user-{uuid4()}"
        task_id = f"task-{uuid4()}"

        await store_task_ownership(task_id, user_id)

        # Try to access as other user
        with pytest.raises(HTTPException) as exc:
            await get_task_status(task_id, other_user)
        assert exc.value.status_code == 403

        # Try to access non-existent task
        with pytest.raises(HTTPException) as exc:
            await get_task_status("fake-task", user_id)
        assert exc.value.status_code == 404

    async def test_cancel_user_task_flow(self, redis_client):
        user_id = f"user-{uuid4()}"
        task_id = f"task-{uuid4()}"

        await store_task_ownership(task_id, user_id)
        tracker = OpmlImportTracker(task_id)
        await tracker.initialize(user_id, "test.opml", 10)

        # Cancel the task
        resp = await cancel_user_task(task_id, user_id)
        assert resp.cancelled is True

        # Verify tracker state is gone (deleted)
        state = await tracker.get_state()
        assert state is None

        # Verify ownership is gone
        repo = TaskRepository()
        owner = await repo.get_owner(task_id)
        assert owner is None

    async def test_cancel_already_completed_task(self, redis_client):
        user_id = f"user-{uuid4()}"
        task_id = f"task-{uuid4()}"

        await store_task_ownership(task_id, user_id)
        tracker = OpmlImportTracker(task_id)
        await tracker.initialize(user_id, "test.opml", 1)

        # Manually set to IN_PROGRESS and complete it
        async with tracker._client() as r:
            meta_raw = await r.get(tracker.key_meta)
            meta = orjson.loads(meta_raw)
            meta["status"] = ImportStatus.IN_PROGRESS.value
            await r.set(tracker.key_meta, orjson.dumps(meta))

        await tracker.mark_success()  # Should trigger completion

        # Try to cancel
        resp = await cancel_user_task(task_id, user_id)
        assert resp.cancelled is False
        assert "Cannot cancel" in resp.message

    async def test_error_handling_in_list_tasks(self, redis_client):
        """Test that list_user_tasks handles corrupted data gracefully."""
        user_id = f"user-{uuid4()}"
        task_id = f"task-{uuid4()}"

        await store_task_ownership(task_id, user_id)

        # Corrupt the metadata
        tracker = OpmlImportTracker(task_id)
        async with tracker._client() as r:
            await r.set(tracker.key_meta, "not-json")

        tasks = await list_user_tasks(user_id)
        assert len(tasks) == 1
        assert tasks[0].status == ImportStatus.UNKNOWN
        assert tasks[0].filename == "error"
