"""Unit tests for feed task workers."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.workers.feed_tasks import (
    async_refresh_single_feed,
    async_schedule_all_feeds,
    refresh_single_feed_task,
    schedule_all_feed_refreshes_task,
)


@pytest.mark.asyncio
async def test_async_refresh_single_feed():
    """Test async refresh single feed implementation."""
    feed_id = uuid4()

    with (
        patch("app.workers.feed_tasks.get_worker_db") as mock_get_worker_db,
        patch("app.workers.feed_tasks.FeedService") as mock_feed_service_class,
    ):
        # Setup mocks
        mock_session = AsyncMock()

        # Make get_worker_db return an async generator
        async def async_gen():
            yield mock_session

        mock_get_worker_db.return_value = async_gen()

        mock_feed_service = AsyncMock()
        mock_feed_service.refresh_feed = AsyncMock()
        mock_feed_service_class.return_value = mock_feed_service

        # Execute
        await async_refresh_single_feed(feed_id=feed_id)

        # Verify
        mock_get_worker_db.assert_called_once()
        mock_feed_service_class.assert_called_once_with(db=mock_session)
        mock_feed_service.refresh_feed.assert_called_once_with(feed_id=feed_id)


@pytest.mark.asyncio
async def test_async_schedule_all_feeds_with_group():
    """Test async schedule all feeds uses Celery group for parallel dispatch."""
    feed1_id = uuid4()
    feed2_id = uuid4()
    feed3_id = uuid4()

    # Mock feeds
    mock_feeds = [
        MagicMock(id=feed1_id),
        MagicMock(id=feed2_id),
        MagicMock(id=feed3_id),
    ]

    with (
        patch("app.workers.feed_tasks.get_worker_db") as mock_get_worker_db,
        patch("app.workers.feed_tasks.FeedService") as mock_feed_service_class,
        patch("app.workers.feed_tasks.group") as mock_group,
        patch("app.workers.feed_tasks.refresh_single_feed_task") as mock_task,
    ):
        # Setup mocks
        mock_session = AsyncMock()

        # Make get_worker_db return an async generator
        async def async_gen():
            yield mock_session

        mock_get_worker_db.return_value = async_gen()

        mock_feed_service = AsyncMock()
        mock_feed_service.get_feeds_needing_refresh = AsyncMock(return_value=mock_feeds)
        mock_feed_service_class.return_value = mock_feed_service

        # Setup task mock
        mock_task.s = MagicMock(side_effect=lambda x: MagicMock(feed_id=x))

        # Setup group mock
        mock_group_result = MagicMock()
        mock_group_result.id = "test-group-id"
        mock_group_result.apply_async = MagicMock(return_value=mock_group_result)
        mock_group.return_value = mock_group_result

        # Execute
        await async_schedule_all_feeds()

        # Verify
        mock_get_worker_db.assert_called_once()
        mock_feed_service.get_feeds_needing_refresh.assert_called_once()

        # Verify group was called once
        mock_group.assert_called_once()

        # Verify the group was called with a generator - convert to list to verify
        call_args = mock_group.call_args
        assert call_args is not None
        # The first argument should be a generator
        tasks_generator = call_args[0][0]
        tasks_list = list(tasks_generator)

        # Verify we got task signatures for all 3 feeds
        assert len(tasks_list) == 3

        # Verify apply_async was called
        mock_group_result.apply_async.assert_called_once()


@pytest.mark.asyncio
async def test_async_schedule_all_feeds_no_feeds():
    """Test async schedule all feeds when no feeds need refresh."""
    with (
        patch("app.workers.feed_tasks.get_worker_db") as mock_get_worker_db,
        patch("app.workers.feed_tasks.FeedService") as mock_feed_service_class,
        patch("app.workers.feed_tasks.group") as mock_group,
    ):
        # Setup mocks
        mock_session = AsyncMock()

        # Make get_worker_db return an async generator
        async def async_gen():
            yield mock_session

        mock_get_worker_db.return_value = async_gen()

        mock_feed_service = AsyncMock()
        mock_feed_service.get_feeds_needing_refresh = AsyncMock(return_value=[])
        mock_feed_service_class.return_value = mock_feed_service

        # Execute
        await async_schedule_all_feeds()

        # Verify
        mock_feed_service.get_feeds_needing_refresh.assert_called_once()

        # Verify group was NOT called when no feeds
        mock_group.assert_not_called()


def test_refresh_single_feed_task():
    """Test Celery task wrapper for refresh single feed."""
    feed_id = uuid4()

    with (
        patch("app.workers.feed_tasks.get_task_event_loop") as mock_get_loop,
        patch("app.workers.feed_tasks.async_refresh_single_feed") as mock_async_refresh,
    ):
        # Setup mocks
        mock_loop = MagicMock()
        mock_get_loop.return_value = mock_loop
        mock_loop.run_until_complete = MagicMock(return_value=None)

        # Execute
        refresh_single_feed_task(feed_id=feed_id)

        # Verify
        mock_get_loop.assert_called_once()
        mock_async_refresh.assert_called_once_with(feed_id=feed_id)
        mock_loop.run_until_complete.assert_called_once()


def test_refresh_single_feed_task_string_uuid():
    """Test Celery task wrapper handles string UUID from serialization."""
    feed_id = str(uuid4())

    with (
        patch("app.workers.feed_tasks.get_task_event_loop") as mock_get_loop,
        patch("app.workers.feed_tasks.async_refresh_single_feed") as mock_async_refresh,
    ):
        # Setup mocks
        mock_loop = MagicMock()
        mock_get_loop.return_value = mock_loop
        mock_loop.run_until_complete = MagicMock(return_value=None)

        # Execute
        refresh_single_feed_task(feed_id=feed_id)

        # Verify - should convert string to UUID
        mock_async_refresh.assert_called_once()
        call_args = mock_async_refresh.call_args
        # The feed_id should be converted to UUID
        assert str(call_args[1]["feed_id"]) == feed_id


def test_schedule_all_feed_refreshes_task():
    """Test Celery task wrapper for schedule all feed refreshes."""
    with (
        patch("app.workers.feed_tasks.get_task_event_loop") as mock_get_loop,
        patch("app.workers.feed_tasks.async_schedule_all_feeds") as mock_async_schedule,
    ):
        # Setup mocks
        mock_loop = MagicMock()
        mock_get_loop.return_value = mock_loop
        mock_loop.run_until_complete = MagicMock(return_value=None)

        # Execute
        schedule_all_feed_refreshes_task()

        # Verify
        mock_get_loop.assert_called_once()
        mock_async_schedule.assert_called_once()
        mock_loop.run_until_complete.assert_called_once()
