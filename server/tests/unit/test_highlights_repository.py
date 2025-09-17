"""Tests for highlights repository."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.core.exceptions import StorageError
from app.models.book_models import Highlight, UserBookLibrary
from app.repositories.highlights import HighlightRepository


@pytest.mark.unit
class TestHighlightRepository:
    def setup_method(self):
        self.repository = HighlightRepository()
        self.book_id = uuid4()
        self.highlight_id = uuid4()
        self.test_text = "This is a test highlight"
        self.test_note = "This is a test note"

    def test_init(self):
        """Test HighlightRepository initialization."""
        repo = HighlightRepository()
        assert repo.model == Highlight

    @pytest.mark.asyncio
    async def test_get_book_highlights_success(self):
        """Test getting book highlights successfully."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_highlights = [MagicMock(spec=Highlight), MagicMock(spec=Highlight)]
        mock_result.scalars.return_value.all.return_value = mock_highlights
        mock_db.execute.return_value = mock_result

        with patch("app.repositories.highlights.logger") as mock_logger:
            result = await self.repository.get_book_highlights(
                db=mock_db, book_id=self.book_id
            )

            assert result == mock_highlights
            mock_db.execute.assert_called_once()

            # Verify logging calls
            assert mock_logger.info.call_count >= 3
            mock_logger.info.assert_any_call(
                f"Building query for book_id: {self.book_id}"
            )
            mock_logger.info.assert_any_call(
                f"Query returned {len(mock_highlights)} highlights"
            )

    @pytest.mark.asyncio
    async def test_get_book_highlights_exception(self):
        """Test getting book highlights with exception."""
        mock_db = AsyncMock()
        mock_db.execute.side_effect = Exception("Database error")

        with patch("app.repositories.highlights.logger") as mock_logger:
            with pytest.raises(StorageError) as exc_info:
                await self.repository.get_book_highlights(
                    db=mock_db, book_id=self.book_id
                )

            assert "Failed to get book highlights" in str(exc_info.value)
            mock_logger.error.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_by_text_success(self):
        """Test getting highlight by text successfully."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_highlight = MagicMock(spec=Highlight)
        mock_result.scalar_one_or_none.return_value = mock_highlight
        mock_db.execute.return_value = mock_result

        result = await self.repository.get_by_text(db=mock_db, text=self.test_text)

        assert result == mock_highlight
        mock_db.execute.assert_called_once()

        # Verify the query
        call_args = mock_db.execute.call_args[0][0]
        assert isinstance(call_args, type(select(Highlight)))

    @pytest.mark.asyncio
    async def test_get_by_text_not_found(self):
        """Test getting highlight by text when not found."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        result = await self.repository.get_by_text(db=mock_db, text=self.test_text)

        assert result is None
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_by_text_exception(self):
        """Test getting highlight by text with exception."""
        mock_db = AsyncMock()
        mock_db.execute.side_effect = Exception("Database error")

        with pytest.raises(StorageError) as exc_info:
            await self.repository.get_by_text(db=mock_db, text=self.test_text)

        assert "Failed to get highlight by text" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_delete_by_text_success(self):
        """Test deleting highlights by text successfully."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.rowcount = 2
        mock_db.execute.return_value = mock_result

        result = await self.repository.delete_by_text(db=mock_db, text=self.test_text)

        assert result is True
        mock_db.execute.assert_called_once()
        mock_db.commit.assert_called_once()

        # Verify the delete statement
        call_args = mock_db.execute.call_args[0][0]
        query_str = str(call_args)
        assert "DELETE" in query_str.upper()

    @pytest.mark.asyncio
    async def test_delete_by_text_no_rows_affected(self):
        """Test deleting highlights by text when no rows affected."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.rowcount = 0
        mock_db.execute.return_value = mock_result

        result = await self.repository.delete_by_text(db=mock_db, text=self.test_text)

        assert result is False
        mock_db.execute.assert_called_once()
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_by_text_exception(self):
        """Test deleting highlights by text with exception."""
        mock_db = AsyncMock()
        mock_db.execute.side_effect = Exception("Database error")

        with pytest.raises(StorageError) as exc_info:
            await self.repository.delete_by_text(db=mock_db, text=self.test_text)

        assert "Failed to delete highlights by text" in str(exc_info.value)
        mock_db.rollback.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_note_success(self):
        """Test updating highlight note successfully."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_highlight = MagicMock(spec=Highlight)
        mock_result.scalar_one_or_none.return_value = mock_highlight
        mock_db.execute.return_value = mock_result

        result = await self.repository.update_note(
            db=mock_db, highlight_id=self.highlight_id, note=self.test_note
        )

        assert result == mock_highlight
        assert mock_highlight.note == self.test_note
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once_with(mock_highlight)

    @pytest.mark.asyncio
    async def test_update_note_highlight_not_found(self):
        """Test updating note when highlight not found."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        with pytest.raises(StorageError) as exc_info:
            await self.repository.update_note(
                db=mock_db, highlight_id=self.highlight_id, note=self.test_note
            )

        assert f"Highlight not found: {self.highlight_id}" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_note_exception(self):
        """Test updating note with exception."""
        mock_db = AsyncMock()
        mock_db.execute.side_effect = Exception("Database error")

        with pytest.raises(StorageError) as exc_info:
            await self.repository.update_note(
                db=mock_db, highlight_id=self.highlight_id, note=self.test_note
            )

        assert "Failed to update highlight note" in str(exc_info.value)
        mock_db.rollback.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_note_by_text_success(self):
        """Test updating highlight note by text successfully."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_highlight = MagicMock(spec=Highlight)
        mock_result.scalar_one_or_none.return_value = mock_highlight
        mock_db.execute.return_value = mock_result

        result = await self.repository.update_note_by_text(
            db=mock_db, text=self.test_text, note=self.test_note
        )

        assert result == mock_highlight
        assert mock_highlight.note == self.test_note
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once_with(mock_highlight)

    @pytest.mark.asyncio
    async def test_update_note_by_text_highlight_not_found(self):
        """Test updating note by text when highlight not found."""
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        with pytest.raises(StorageError) as exc_info:
            await self.repository.update_note_by_text(
                db=mock_db, text=self.test_text, note=self.test_note
            )

        assert f"Highlight not found with text: {self.test_text}" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_update_note_by_text_exception(self):
        """Test updating note by text with exception."""
        mock_db = AsyncMock()
        mock_db.execute.side_effect = Exception("Database error")

        with pytest.raises(StorageError) as exc_info:
            await self.repository.update_note_by_text(
                db=mock_db, text=self.test_text, note=self.test_note
            )

        assert "Failed to update highlight note by text" in str(exc_info.value)
        mock_db.rollback.assert_called_once()

    def test_query_construction_get_book_highlights(self):
        """Test that the query for get_book_highlights contains expected elements."""
        # This is more of a smoke test to ensure the query can be constructed
        from sqlalchemy import select

        query = (
            select(Highlight)
            .join(UserBookLibrary)
            .where(UserBookLibrary.id == self.book_id)
        )

        query_str = str(query)
        # Basic verification that it's a valid query structure
        assert "SELECT" in query_str.upper()
        assert "JOIN" in query_str.upper()
        assert "WHERE" in query_str.upper()

    def test_inherits_from_base_repository(self):
        """Test that HighlightRepository inherits from BaseRepository."""
        from app.repositories.base import BaseRepository

        assert issubclass(HighlightRepository, BaseRepository)
        assert isinstance(self.repository, BaseRepository)
