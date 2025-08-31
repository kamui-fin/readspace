"""Unit tests for FolderService."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from app.services.folder_service import FolderService
from app.schemas.rss_schemas import FolderCreate, FolderResponse, FolderUpdate


@pytest.mark.unit
class TestFolderService:
    """Test cases for FolderService."""

    def setup_method(self):
        """Set up test fixtures."""
        self.db = AsyncMock()
        self.user_id = uuid4()
        self.service = FolderService(db=self.db, user_id=self.user_id)

    @pytest.mark.asyncio
    async def test_create_folder_success(self):
        """Test successful folder creation."""
        from datetime import datetime
        
        folder_in = FolderCreate(name="Test Folder")
        expected_folder = MagicMock()
        expected_folder.id = uuid4()
        expected_folder.name = "Test Folder"
        expected_folder.user_id = self.user_id
        expected_folder.created_at = datetime.now()
        expected_folder.updated_at = datetime.now()
        
        # Mock the CRUD operation
        with pytest.MonkeyPatch().context() as m:
            mock_crud_folder = AsyncMock()
            mock_crud_folder.create_folder.return_value = expected_folder
            m.setattr("app.services.folder_service.crud_folder", mock_crud_folder)
            
            result = await self.service.create_folder(folder_in)
            
            assert isinstance(result, FolderResponse)
            mock_crud_folder.create_folder.assert_called_once_with(
                db=self.db, folder_in=folder_in, user_id=self.user_id
            )

    @pytest.mark.asyncio
    async def test_get_folder_exists(self):
        """Test getting an existing folder."""
        from datetime import datetime
        
        folder_id = uuid4()
        expected_folder = MagicMock()
        expected_folder.id = folder_id
        expected_folder.name = "Test Folder"
        expected_folder.user_id = self.user_id
        expected_folder.created_at = datetime.now()
        expected_folder.updated_at = datetime.now()
        
        with pytest.MonkeyPatch().context() as m:
            mock_crud_folder = AsyncMock()
            mock_crud_folder.get_folder.return_value = expected_folder
            m.setattr("app.services.folder_service.crud_folder", mock_crud_folder)
            
            result = await self.service.get_folder(folder_id)
            
            assert isinstance(result, FolderResponse)
            mock_crud_folder.get_folder.assert_called_once_with(
                db=self.db, folder_id=folder_id, user_id=self.user_id
            )

    @pytest.mark.asyncio
    async def test_get_folder_not_found(self):
        """Test getting a non-existent folder."""
        folder_id = uuid4()
        
        with pytest.MonkeyPatch().context() as m:
            mock_crud_folder = AsyncMock()
            mock_crud_folder.get_folder.return_value = None
            m.setattr("app.services.folder_service.crud_folder", mock_crud_folder)
            
            result = await self.service.get_folder(folder_id)
            
            assert result is None

    @pytest.mark.asyncio
    async def test_list_folders(self):
        """Test listing folders with pagination."""
        from datetime import datetime
        
        mock_folder1 = MagicMock()
        mock_folder1.id = uuid4()
        mock_folder1.name = "Folder 1"
        mock_folder1.user_id = self.user_id
        mock_folder1.created_at = datetime.now()
        mock_folder1.updated_at = datetime.now()
        
        mock_folder2 = MagicMock()
        mock_folder2.id = uuid4()
        mock_folder2.name = "Folder 2"
        mock_folder2.user_id = self.user_id
        mock_folder2.created_at = datetime.now()
        mock_folder2.updated_at = datetime.now()
        
        mock_folders = [mock_folder1, mock_folder2]
        
        with pytest.MonkeyPatch().context() as m:
            mock_crud_folder = AsyncMock()
            mock_crud_folder.get_folders_by_user.return_value = mock_folders
            m.setattr("app.services.folder_service.crud_folder", mock_crud_folder)
            
            result = await self.service.list_folders(skip=10, limit=20)
            
            assert len(result) == 2
            mock_crud_folder.get_folders_by_user.assert_called_once_with(
                db=self.db, user_id=self.user_id, skip=10, limit=20
            )

    @pytest.mark.asyncio
    async def test_update_folder_success(self):
        """Test successful folder update."""
        from datetime import datetime
        
        folder_id = uuid4()
        folder_update = FolderUpdate(name="Updated Folder")
        updated_folder = MagicMock()
        updated_folder.id = folder_id
        updated_folder.name = "Updated Folder"
        updated_folder.user_id = self.user_id
        updated_folder.created_at = datetime.now()
        updated_folder.updated_at = datetime.now()
        
        with pytest.MonkeyPatch().context() as m:
            mock_crud_folder = AsyncMock()
            existing_folder = MagicMock()
            existing_folder.id = folder_id
            existing_folder.user_id = self.user_id
            mock_crud_folder.get_folder.return_value = existing_folder
            mock_crud_folder.update_folder.return_value = updated_folder
            m.setattr("app.services.folder_service.crud_folder", mock_crud_folder)
            
            result = await self.service.update_folder(folder_id, folder_update)
            
            assert isinstance(result, FolderResponse)
            mock_crud_folder.update_folder.assert_called_once_with(
                db=self.db, folder_db=existing_folder, folder_in=folder_update
            )

    @pytest.mark.asyncio
    async def test_update_folder_not_found(self):
        """Test updating a non-existent folder."""
        folder_id = uuid4()
        folder_update = FolderUpdate(name="Updated Folder")
        
        with pytest.MonkeyPatch().context() as m:
            mock_crud_folder = AsyncMock()
            mock_crud_folder.get_folder.return_value = None
            m.setattr("app.services.folder_service.crud_folder", mock_crud_folder)
            
            result = await self.service.update_folder(folder_id, folder_update)
            
            assert result is None

    @pytest.mark.asyncio
    async def test_delete_folder_success(self):
        """Test successful folder deletion."""
        folder_id = uuid4()
        
        with pytest.MonkeyPatch().context() as m:
            mock_crud_folder = AsyncMock()
            mock_crud_folder.delete_folder.return_value = True
            m.setattr("app.services.folder_service.crud_folder", mock_crud_folder)
            
            result = await self.service.delete_folder(folder_id)
            
            assert result is True
            mock_crud_folder.delete_folder.assert_called_once_with(
                db=self.db, folder_id=folder_id, user_id=self.user_id
            )

    @pytest.mark.asyncio
    async def test_delete_folder_not_found(self):
        """Test deleting a non-existent folder."""
        folder_id = uuid4()
        
        with pytest.MonkeyPatch().context() as m:
            mock_crud_folder = AsyncMock()
            mock_crud_folder.delete_folder.return_value = False
            m.setattr("app.services.folder_service.crud_folder", mock_crud_folder)
            
            result = await self.service.delete_folder(folder_id)
            
            assert result is False