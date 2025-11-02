"""E2E tests for folder routes."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Folder, Profile


class TestFolderCreate:
    """Test folder creation endpoint."""

    def test_create_folder_success(self, client: TestClient, test_user: Profile):
        """Test creating a folder successfully."""
        response = client.post(
            "/api/v1/folders/",
            json={"name": "My Folder", "description": "Test folder description"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "My Folder"
        assert data["description"] == "Test folder description"
        assert "id" in data
        assert "created_at" in data

    def test_create_folder_minimal(self, client: TestClient):
        """Test creating folder with minimal data."""
        response = client.post("/api/v1/folders/", json={"name": "Minimal Folder"})

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Minimal Folder"
        assert data["description"] is None

    def test_create_folder_empty_name(self, client: TestClient):
        """Test creating folder with empty name fails."""
        response = client.post("/api/v1/folders/", json={"name": ""})

        assert response.status_code == 422

    def test_create_folder_missing_name(self, client: TestClient):
        """Test creating folder without name fails."""
        response = client.post("/api/v1/folders/", json={})

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_folder_persists_to_db(self, client: TestClient, test_user: Profile, db_session: AsyncSession):
        """Test that created folder is persisted to database."""
        response = client.post("/api/v1/folders/", json={"name": "DB Test Folder"})

        assert response.status_code == 201
        folder_id = response.json()["id"]

        # Verify in database
        result = await db_session.execute(select(Folder).where(Folder.id == folder_id))
        folder = result.scalar_one_or_none()

        assert folder is not None
        assert folder.name == "DB Test Folder"
        assert folder.user_id == test_user.id


class TestFolderList:
    """Test folder listing endpoint."""

    @pytest.mark.asyncio
    async def test_list_folders_empty(self, client: TestClient):
        """Test listing folders when user has none."""
        response = client.get("/api/v1/folders/")

        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_list_folders_with_data(self, client: TestClient, test_folder: Folder):
        """Test listing folders returns user's folders."""
        response = client.get("/api/v1/folders/")

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(f["id"] == str(test_folder.id) for f in data)

    @pytest.mark.asyncio
    async def test_list_folders_pagination(self, client: TestClient, test_user: Profile, db_session: AsyncSession):
        """Test folder listing pagination."""
        # Create multiple folders
        for i in range(5):
            folder = Folder(user_id=test_user.id, name=f"Folder {i}")
            db_session.add(folder)
        await db_session.flush()

        # Test with limit
        response = client.get("/api/v1/folders/?limit=3")
        assert response.status_code == 200
        assert len(response.json()) == 3

        # Test with skip
        response = client.get("/api/v1/folders/?skip=2&limit=3")
        assert response.status_code == 200
        assert len(response.json()) == 3

    @pytest.mark.asyncio
    async def test_list_folders_isolation(self, client: TestClient, test_folder: Folder, db_session: AsyncSession):
        """Test that users only see their own folders."""
        # Create another user's folder
        from uuid import uuid4

        other_user_id = str(uuid4())
        other_folder = Folder(user_id=other_user_id, name="Other User Folder")
        db_session.add(other_folder)
        await db_session.flush()

        response = client.get("/api/v1/folders/")
        assert response.status_code == 200
        data = response.json()

        # Should not see other user's folder
        assert not any(f["id"] == str(other_folder.id) for f in data)


class TestFolderGet:
    """Test get single folder endpoint."""

    def test_get_folder_success(self, client: TestClient, test_folder: Folder):
        """Test getting a folder by ID."""
        response = client.get(f"/api/v1/folders/{test_folder.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_folder.id)
        assert data["name"] == test_folder.name

    def test_get_folder_not_found(self, client: TestClient):
        """Test getting non-existent folder."""
        from uuid import uuid4

        fake_id = uuid4()
        response = client.get(f"/api/v1/folders/{fake_id}")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_folder_invalid_uuid(self, client: TestClient):
        """Test getting folder with invalid UUID."""
        response = client.get("/api/v1/folders/invalid-uuid")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_folder_access_control(self, client: TestClient, db_session: AsyncSession):
        """Test that users cannot access other users' folders."""
        from uuid import uuid4

        # Create another user's folder
        other_user_id = str(uuid4())
        other_folder = Folder(user_id=other_user_id, name="Other User Folder")
        db_session.add(other_folder)
        await db_session.flush()

        response = client.get(f"/api/v1/folders/{other_folder.id}")
        assert response.status_code == 404


class TestFolderUpdate:
    """Test folder update endpoint."""

    def test_update_folder_name(self, client: TestClient, test_folder: Folder):
        """Test updating folder name."""
        response = client.put(f"/api/v1/folders/{test_folder.id}", json={"name": "Updated Name"})

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["id"] == str(test_folder.id)

    def test_update_folder_description(self, client: TestClient, test_folder: Folder):
        """Test updating folder description."""
        response = client.put(
            f"/api/v1/folders/{test_folder.id}",
            json={"description": "Updated description"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "Updated description"

    def test_update_folder_both_fields(self, client: TestClient, test_folder: Folder):
        """Test updating both name and description."""
        response = client.put(
            f"/api/v1/folders/{test_folder.id}",
            json={"name": "New Name", "description": "New description"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Name"
        assert data["description"] == "New description"

    def test_update_folder_not_found(self, client: TestClient):
        """Test updating non-existent folder."""
        from uuid import uuid4

        fake_id = uuid4()
        response = client.put(f"/api/v1/folders/{fake_id}", json={"name": "New Name"})

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_folder_persists(self, client: TestClient, test_folder: Folder, db_session: AsyncSession):
        """Test that folder updates persist to database."""
        response = client.put(f"/api/v1/folders/{test_folder.id}", json={"name": "Persisted Name"})

        assert response.status_code == 200

        # Verify in database
        await db_session.refresh(test_folder)
        assert test_folder.name == "Persisted Name"

    @pytest.mark.asyncio
    async def test_update_folder_access_control(self, client: TestClient, db_session: AsyncSession):
        """Test that users cannot update other users' folders."""
        from uuid import uuid4

        other_user_id = str(uuid4())
        other_folder = Folder(user_id=other_user_id, name="Other Folder")
        db_session.add(other_folder)
        await db_session.flush()

        response = client.put(f"/api/v1/folders/{other_folder.id}", json={"name": "Hacked"})
        assert response.status_code == 404


class TestFolderDelete:
    """Test folder deletion endpoint."""

    @pytest.mark.asyncio
    async def test_delete_folder_success(self, client: TestClient, test_folder: Folder, db_session: AsyncSession):
        """Test deleting a folder successfully."""
        folder_id = test_folder.id
        response = client.delete(f"/api/v1/folders/{folder_id}")

        assert response.status_code == 200

        # Verify deleted from database
        result = await db_session.execute(select(Folder).where(Folder.id == folder_id))
        folder = result.scalar_one_or_none()
        assert folder is None

    def test_delete_folder_not_found(self, client: TestClient):
        """Test deleting non-existent folder."""
        from uuid import uuid4

        fake_id = uuid4()
        response = client.delete(f"/api/v1/folders/{fake_id}")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_folder_access_control(self, client: TestClient, db_session: AsyncSession):
        """Test that users cannot delete other users' folders."""
        from uuid import uuid4

        other_user_id = str(uuid4())
        other_folder = Folder(user_id=other_user_id, name="Other Folder")
        db_session.add(other_folder)
        await db_session.flush()

        response = client.delete(f"/api/v1/folders/{other_folder.id}")
        assert response.status_code == 404

        # Verify folder still exists
        result = await db_session.execute(select(Folder).where(Folder.id == other_folder.id))
        folder = result.scalar_one_or_none()
        assert folder is not None
