import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.workers.tasks import create_task_db_session, queue_feed_refresh_tasks


@pytest.mark.asyncio
async def test_create_task_db_session():
    """Test that create_task_db_session creates proper database session."""
    
    with patch('app.workers.tasks.create_async_engine') as mock_create_engine, \
         patch('app.workers.tasks.sessionmaker') as mock_sessionmaker, \
         patch('app.workers.tasks.settings') as mock_settings:
        
        # Setup mocks
        mock_engine = MagicMock()
        mock_create_engine.return_value = mock_engine
        
        mock_session_class = MagicMock()
        mock_sessionmaker.return_value = mock_session_class
        
        mock_settings.SUPABASE_DB_CONNECTION = "postgresql+asyncpg://user:pass@host/db"
        
        # Execute
        engine, session_local = await create_task_db_session()
        
        # Verify
        mock_create_engine.assert_called_once()
        create_engine_call = mock_create_engine.call_args
        assert create_engine_call[0][0] == "postgresql+asyncpg://user:pass@host/db"
        
        mock_sessionmaker.assert_called_once()
        sessionmaker_call = mock_sessionmaker.call_args
        assert sessionmaker_call[1]['bind'] == mock_engine
        assert sessionmaker_call[1]['class_'] == AsyncSession
        assert sessionmaker_call[1]['autocommit'] is False
        assert sessionmaker_call[1]['autoflush'] is False
        assert sessionmaker_call[1]['expire_on_commit'] is False
        
        assert engine == mock_engine
        assert session_local == mock_session_class


@pytest.mark.asyncio
async def test_queue_feed_refresh_tasks_empty_feeds():
    """Test queue_feed_refresh_tasks with empty feed list."""
    result = await queue_feed_refresh_tasks([], "test_task")
    
    expected = {
        "total_feeds": 0,
        "queued_tasks": 0,
        "task_ids": [],
        "status": "no_feeds_found",
    }
    
    assert result == expected


@pytest.mark.asyncio
async def test_queue_feed_refresh_tasks_with_feeds():
    """Test queue_feed_refresh_tasks with actual feeds."""
    
    # Create mock feeds
    mock_feed1 = MagicMock()
    mock_feed1.id = uuid4()
    
    mock_feed2 = MagicMock()
    mock_feed2.id = uuid4()
    
    feeds = [mock_feed1, mock_feed2]
    
    # Mock the refresh_single_feed_task and group
    with patch('app.workers.tasks.refresh_single_feed_task') as mock_refresh_task, \
         patch('app.workers.tasks.group') as mock_group:
        
        # Mock task result objects
        mock_result1 = MagicMock()
        mock_result1.task_id = "task_id_1"
        
        mock_result2 = MagicMock()
        mock_result2.task_id = "task_id_2"
        
        # Mock group result
        mock_group_result = MagicMock()
        mock_group_result.results = [mock_result1, mock_result2]
        
        # Mock group and its apply_async
        mock_group_instance = MagicMock()
        mock_group_instance.apply_async.return_value = mock_group_result
        mock_group.return_value = mock_group_instance
        
        # Execute
        result = await queue_feed_refresh_tasks(feeds, "bulk_refresh")
        
        # Verify
        expected = {
            "total_feeds": 2,
            "queued_tasks": 2,
            "task_ids": ["task_id_1", "task_id_2"],
            "status": "tasks_queued",
        }
        
        assert result == expected
        # Verify group was called
        mock_group.assert_called_once()
        mock_group_instance.apply_async.assert_called_once()


@pytest.mark.asyncio
async def test_queue_feed_refresh_tasks_single_feed():
    """Test queue_feed_refresh_tasks with a single feed."""
    
    # Create mock feed
    mock_feed = MagicMock()
    mock_feed.id = uuid4()
    feeds = [mock_feed]
    
    # Mock the refresh_single_feed_task and group
    with patch('app.workers.tasks.refresh_single_feed_task') as mock_refresh_task, \
         patch('app.workers.tasks.group') as mock_group:
        
        # Mock task result
        mock_result = MagicMock()
        mock_result.task_id = "single_task_id"
        
        # Mock group result
        mock_group_result = MagicMock()
        mock_group_result.results = [mock_result]
        
        # Mock group and its apply_async
        mock_group_instance = MagicMock()
        mock_group_instance.apply_async.return_value = mock_group_result
        mock_group.return_value = mock_group_instance
        
        # Execute
        result = await queue_feed_refresh_tasks(feeds, "single_refresh")
        
        # Verify
        expected = {
            "total_feeds": 1,
            "queued_tasks": 1,
            "task_ids": ["single_task_id"],
            "status": "tasks_queued",
        }
        
        assert result == expected
        mock_group.assert_called_once()
        mock_group_instance.apply_async.assert_called_once()


@pytest.mark.asyncio
async def test_queue_feed_refresh_tasks_logging():
    """Test that queue_feed_refresh_tasks logs appropriately."""
    
    # Create mock feeds
    mock_feed = MagicMock()
    mock_feed.id = uuid4()
    feeds = [mock_feed]
    
    with patch('app.workers.tasks.refresh_single_feed_task') as mock_refresh_task, \
         patch('app.workers.tasks.group') as mock_group, \
         patch('app.workers.tasks.logger') as mock_logger:
        
        # Mock task result
        mock_result = MagicMock()
        mock_result.task_id = "test_task_id"
        
        # Mock group result
        mock_group_result = MagicMock()
        mock_group_result.results = [mock_result]
        
        # Mock group and its apply_async
        mock_group_instance = MagicMock()
        mock_group_instance.apply_async.return_value = mock_group_result
        mock_group.return_value = mock_group_instance
        
        # Execute
        await queue_feed_refresh_tasks(feeds, "logging_test")
        
        # Verify logging calls
        assert mock_logger.info.call_count == 2
        
        # Check first log call (queuing message)
        first_log = mock_logger.info.call_args_list[0][0][0]
        assert "Bulk queuing 1 feed refresh tasks for logging_test" in first_log
        
        # Check second log call (success message)
        second_log = mock_logger.info.call_args_list[1][0][0]
        assert "Successfully bulk queued 1 feed refresh tasks for logging_test" in second_log


@pytest.mark.asyncio
async def test_queue_feed_refresh_tasks_many_feeds():
    """Test queue_feed_refresh_tasks with many feeds for performance testing."""
    
    # Create many mock feeds
    feeds = []
    for i in range(10):
        mock_feed = MagicMock()
        mock_feed.id = uuid4()
        feeds.append(mock_feed)
    
    # Mock the refresh_single_feed_task and group
    with patch('app.workers.tasks.refresh_single_feed_task') as mock_refresh_task, \
         patch('app.workers.tasks.group') as mock_group:
        
        # Create mock task results
        mock_results = []
        for i in range(10):
            mock_result = MagicMock()
            mock_result.task_id = f"task_id_{i}"
            mock_results.append(mock_result)
        
        # Mock group result
        mock_group_result = MagicMock()
        mock_group_result.results = mock_results
        
        # Mock group and its apply_async
        mock_group_instance = MagicMock()
        mock_group_instance.apply_async.return_value = mock_group_result
        mock_group.return_value = mock_group_instance
        
        # Execute
        result = await queue_feed_refresh_tasks(feeds, "performance_test")
        
        # Verify
        assert result["total_feeds"] == 10
        assert result["queued_tasks"] == 10
        assert len(result["task_ids"]) == 10
        assert result["status"] == "tasks_queued"
        mock_group.assert_called_once()
        mock_group_instance.apply_async.assert_called_once()
        
        # Verify all task IDs are included
        expected_task_ids = [f"task_id_{i}" for i in range(10)]
        assert result["task_ids"] == expected_task_ids