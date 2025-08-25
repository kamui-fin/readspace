"""Unit tests for TagService."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from app.services.tag_service import TagService
from app.schemas.rss_schemas import TagCreate, TagResponse, TagUpdate


@pytest.mark.unit
class TestTagService:
    """Test cases for TagService."""

    def setup_method(self):
        """Set up test fixtures."""
        self.db = AsyncMock()
        self.user_id = uuid4()
        self.service = TagService(db=self.db, user_id=self.user_id)

    @pytest.mark.asyncio
    async def test_create_tag_new_tag(self):
        """Test creating a new tag."""
        from datetime import datetime
        
        tag_in = TagCreate(name="Technology")
        new_tag = MagicMock()
        new_tag.id = uuid4()
        new_tag.name = "Technology"
        new_tag.user_id = self.user_id
        new_tag.created_at = datetime.now()
        new_tag.updated_at = datetime.now()
        
        with pytest.MonkeyPatch().context() as m:
            mock_crud_tag = AsyncMock()
            mock_crud_tag.get_tag_by_name.return_value = None  # Tag doesn't exist
            mock_crud_tag.create_tag.return_value = new_tag
            m.setattr("app.services.tag_service.crud_tag", mock_crud_tag)
            
            result = await self.service.create_tag(tag_in)
            
            assert isinstance(result, TagResponse)
            mock_crud_tag.get_tag_by_name.assert_called_once_with(
                db=self.db, name="Technology", user_id=self.user_id
            )
            mock_crud_tag.create_tag.assert_called_once_with(
                db=self.db, tag=tag_in, user_id=self.user_id
            )

    @pytest.mark.asyncio
    async def test_create_tag_existing_tag(self):
        """Test creating a tag that already exists."""
        from datetime import datetime
        
        tag_in = TagCreate(name="Technology")
        existing_tag = MagicMock()
        existing_tag.id = uuid4()
        existing_tag.name = "Technology"
        existing_tag.user_id = self.user_id
        existing_tag.created_at = datetime.now()
        existing_tag.updated_at = datetime.now()
        
        with pytest.MonkeyPatch().context() as m:
            mock_crud_tag = AsyncMock()
            mock_crud_tag.get_tag_by_name.return_value = existing_tag  # Tag exists
            m.setattr("app.services.tag_service.crud_tag", mock_crud_tag)
            
            result = await self.service.create_tag(tag_in)
            
            assert isinstance(result, TagResponse)
            mock_crud_tag.get_tag_by_name.assert_called_once_with(
                db=self.db, name="Technology", user_id=self.user_id
            )
            # Should not call create_tag since tag already exists
            mock_crud_tag.create_tag.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_tag_exists(self):
        """Test getting an existing tag."""
        from datetime import datetime
        
        tag_id = uuid4()
        expected_tag = MagicMock()
        expected_tag.id = tag_id
        expected_tag.name = "Technology"
        expected_tag.user_id = self.user_id
        expected_tag.created_at = datetime.now()
        expected_tag.updated_at = datetime.now()
        
        with pytest.MonkeyPatch().context() as m:
            mock_crud_tag = AsyncMock()
            mock_crud_tag.get_tag.return_value = expected_tag
            m.setattr("app.services.tag_service.crud_tag", mock_crud_tag)
            
            result = await self.service.get_tag(tag_id)
            
            assert isinstance(result, TagResponse)
            mock_crud_tag.get_tag.assert_called_once_with(
                db=self.db, tag_id=tag_id, user_id=self.user_id
            )

    @pytest.mark.asyncio
    async def test_get_tag_not_found(self):
        """Test getting a non-existent tag."""
        tag_id = uuid4()
        
        with pytest.MonkeyPatch().context() as m:
            mock_crud_tag = AsyncMock()
            mock_crud_tag.get_tag.return_value = None
            m.setattr("app.services.tag_service.crud_tag", mock_crud_tag)
            
            result = await self.service.get_tag(tag_id)
            
            assert result is None

    @pytest.mark.asyncio
    async def test_update_tag_success(self):
        """Test successful tag update."""
        from datetime import datetime
        
        tag_id = uuid4()
        tag_update = TagUpdate(name="Updated Tag")
        updated_tag = MagicMock()
        updated_tag.id = tag_id
        updated_tag.name = "Updated Tag"
        updated_tag.user_id = self.user_id
        updated_tag.created_at = datetime.now()
        updated_tag.updated_at = datetime.now()
        
        with pytest.MonkeyPatch().context() as m:
            mock_crud_tag = AsyncMock()
            mock_crud_tag.get_tag_by_name.return_value = None  # No name conflict
            mock_crud_tag.update_tag.return_value = updated_tag
            m.setattr("app.services.tag_service.crud_tag", mock_crud_tag)
            
            result = await self.service.update_tag(tag_id, tag_update)
            
            assert isinstance(result, TagResponse)
            mock_crud_tag.update_tag.assert_called_once_with(
                db=self.db, tag_id=tag_id, tag_in=tag_update, user_id=self.user_id
            )

    @pytest.mark.asyncio
    async def test_update_tag_name_conflict(self):
        """Test updating tag with conflicting name."""
        tag_id = uuid4()
        conflicting_tag_id = uuid4()
        tag_update = TagUpdate(name="Existing Tag")
        
        existing_tag = MagicMock()
        existing_tag.id = conflicting_tag_id  # Different ID
        existing_tag.name = "Existing Tag"
        
        with pytest.MonkeyPatch().context() as m:
            mock_crud_tag = AsyncMock()
            mock_crud_tag.get_tag_by_name.return_value = existing_tag  # Name conflict
            m.setattr("app.services.tag_service.crud_tag", mock_crud_tag)
            
            with pytest.raises(ValueError, match="Tag with name 'Existing Tag' already exists"):
                await self.service.update_tag(tag_id, tag_update)

    @pytest.mark.asyncio
    async def test_delete_tag_success(self):
        """Test successful tag deletion."""
        tag_id = uuid4()
        
        with pytest.MonkeyPatch().context() as m:
            mock_crud_tag = AsyncMock()
            mock_crud_tag.delete_tag.return_value = True
            m.setattr("app.services.tag_service.crud_tag", mock_crud_tag)
            
            result = await self.service.delete_tag(tag_id)
            
            assert result is True
            mock_crud_tag.delete_tag.assert_called_once_with(
                db=self.db, tag_id=tag_id, user_id=self.user_id
            )

    @pytest.mark.asyncio
    async def test_get_or_create_tags_by_names_mixed(self):
        """Test getting or creating tags for mixed existing/new names."""
        from datetime import datetime
        
        tag_names = ["Existing", "New Tag"]
        
        existing_tag = MagicMock()
        existing_tag.id = uuid4()
        existing_tag.name = "Existing"
        existing_tag.user_id = self.user_id
        existing_tag.created_at = datetime.now()
        existing_tag.updated_at = datetime.now()
        
        new_tag = MagicMock()
        new_tag.id = uuid4()
        new_tag.name = "New Tag"
        new_tag.user_id = self.user_id
        new_tag.created_at = datetime.now()
        new_tag.updated_at = datetime.now()
        
        with pytest.MonkeyPatch().context() as m:
            mock_crud_tag = AsyncMock()
            # First call returns existing tag, second call returns None
            mock_crud_tag.get_tag_by_name.side_effect = [existing_tag, None]
            mock_crud_tag.create_tag.return_value = new_tag
            m.setattr("app.services.tag_service.crud_tag", mock_crud_tag)
            
            result = await self.service.get_or_create_tags_by_names(tag_names)
            
            assert len(result) == 2
            assert existing_tag in result
            assert new_tag in result
            
            # Should check for both tags
            assert mock_crud_tag.get_tag_by_name.call_count == 2
            # Should only create one tag (the new one)
            mock_crud_tag.create_tag.assert_called_once()