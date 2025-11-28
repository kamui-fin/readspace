"""E2E tests for folder routes."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.folder import Folder
from app.models.user import Profile


class TestFolderCreate:
    """Test folder creation endpoint."""

    @pytest.mark.asyncio
    async def test_create_folder_success(
        self, async_client: AsyncClient, test_user: Profile
    ):
        """Test creating a folder successfully."""
        response = await async_client.post(
            "/api/folders/",
            json={"name": "My Folder"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "My Folder"
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_create_folder_minimal(self, async_client: AsyncClient):
        """Test creating folder with minimal data."""
        response = await async_client.post(
            "/api/folders/", json={"name": "Minimal Folder"}
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Minimal Folder"
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_create_folder_empty_name(self, async_client: AsyncClient):
        """Test creating folder with empty name fails."""
        response = await async_client.post("/api/folders/", json={"name": ""})

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_folder_missing_name(self, async_client: AsyncClient):
        """Test creating folder without name fails."""
        response = await async_client.post("/api/folders/", json={})

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_folder_persists_to_db(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession
    ):
        """Test that created folder is persisted to database."""
        response = await async_client.post(
            "/api/folders/", json={"name": "DB Test Folder"}
        )

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
    async def test_list_folders_empty(self, async_client: AsyncClient):
        """Test listing folders when user has none."""
        response = await async_client.get("/api/folders/")

        assert response.status_code == 200
        # Note: User might have a default "My Feeds" folder created by trigger
        data = response.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_list_folders_with_data(
        self, async_client: AsyncClient, test_folder: Folder
    ):
        """Test listing folders returns user's folders."""
        response = await async_client.get("/api/folders/")

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(f["id"] == str(test_folder.id) for f in data)

    @pytest.mark.asyncio
    async def test_list_folders_pagination(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession
    ):
        """Test folder listing pagination."""
        # Create multiple folders
        for i in range(5):
            folder = Folder(user_id=test_user.id, name=f"Folder {i}")
            db_session.add(folder)
        await db_session.flush()

        # Test with limit
        response = await async_client.get("/api/folders/?limit=3")
        assert response.status_code == 200
        assert len(response.json()) == 3

        # Test with skip
        response = await async_client.get("/api/folders/?skip=2&limit=3")
        assert response.status_code == 200
        assert len(response.json()) == 3

    @pytest.mark.asyncio
    async def test_list_folders_isolation(
        self, async_client: AsyncClient, test_folder: Folder, db_session: AsyncSession
    ):
        """Test that users only see their own folders."""
        # Create another user with profile first
        from uuid import uuid4
        from sqlalchemy import text

        other_user_id = str(uuid4())
        other_email = f"other-{uuid4().hex[:8]}@example.com"

        # Create auth user and profile
        await db_session.execute(
            text(
                """
                INSERT INTO auth.users (
                    id, aud, role, email, encrypted_password, 
                    email_confirmed_at, confirmation_sent_at, 
                    recovery_sent_at, created_at, updated_at,
                    raw_app_meta_data, raw_user_meta_data,
                    is_super_admin, is_sso_user, is_anonymous
                ) VALUES (
                    :user_id, 'authenticated', 'authenticated', :email, '', 
                    NOW(), NOW(), NOW(), NOW(), NOW(),
                    '{}', '{}', FALSE, FALSE, FALSE
                ) ON CONFLICT (id) DO NOTHING
                """
            ),
            {"user_id": other_user_id, "email": other_email},
        )
        await db_session.flush()

        # Now create the folder
        other_folder = Folder(user_id=other_user_id, name="Other User Folder")
        db_session.add(other_folder)
        await db_session.flush()

        response = await async_client.get("/api/folders/")
        assert response.status_code == 200
        data = response.json()

        # Should not see other user's folder
        assert not any(f["id"] == str(other_folder.id) for f in data)


class TestFolderGet:
    """Test get single folder endpoint."""

    @pytest.mark.asyncio
    async def test_get_folder_success(
        self, async_client: AsyncClient, test_folder: Folder
    ):
        """Test getting a folder by ID."""
        response = await async_client.get(f"/api/folders/{test_folder.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_folder.id)
        assert data["name"] == test_folder.name

    @pytest.mark.asyncio
    async def test_get_folder_not_found(self, async_client: AsyncClient):
        """Test getting non-existent folder."""
        from uuid import uuid4

        fake_id = uuid4()
        response = await async_client.get(f"/api/folders/{fake_id}")

        assert response.status_code == 404
        assert "not found" in response.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_get_folder_invalid_uuid(self, async_client: AsyncClient):
        """Test getting folder with invalid UUID."""
        response = await async_client.get("/api/folders/invalid-uuid")

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_folder_access_control(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        """Test that users cannot access other users' folders."""
        from uuid import uuid4
        from sqlalchemy import text

        # Create another user with profile first
        other_user_id = str(uuid4())
        other_email = f"other-{uuid4().hex[:8]}@example.com"

        # Create auth user and profile
        await db_session.execute(
            text(
                """
                INSERT INTO auth.users (
                    id, aud, role, email, encrypted_password, 
                    email_confirmed_at, confirmation_sent_at, 
                    recovery_sent_at, created_at, updated_at,
                    raw_app_meta_data, raw_user_meta_data,
                    is_super_admin, is_sso_user, is_anonymous
                ) VALUES (
                    :user_id, 'authenticated', 'authenticated', :email, '', 
                    NOW(), NOW(), NOW(), NOW(), NOW(),
                    '{}', '{}', FALSE, FALSE, FALSE
                ) ON CONFLICT (id) DO NOTHING
                """
            ),
            {"user_id": other_user_id, "email": other_email},
        )
        await db_session.flush()

        # Create another user's folder
        other_folder = Folder(user_id=other_user_id, name="Other User Folder")
        db_session.add(other_folder)
        await db_session.flush()

        response = await async_client.get(f"/api/folders/{other_folder.id}")
        assert response.status_code == 404


class TestFolderUpdate:
    """Test folder update endpoint."""

    @pytest.mark.asyncio
    async def test_update_folder_name(
        self, async_client: AsyncClient, test_folder: Folder
    ):
        """Test updating folder name."""
        response = await async_client.put(
            f"/api/folders/{test_folder.id}", json={"name": "Updated Name"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["id"] == str(test_folder.id)

    @pytest.mark.asyncio
    async def test_update_folder_name_only(
        self, async_client: AsyncClient, test_folder: Folder
    ):
        """Test updating folder name only."""
        response = await async_client.put(
            f"/api/folders/{test_folder.id}",
            json={"name": "Updated Name Only"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name Only"

    @pytest.mark.asyncio
    async def test_update_folder_empty_body(
        self, async_client: AsyncClient, test_folder: Folder
    ):
        """Test updating folder with empty body."""
        response = await async_client.put(
            f"/api/folders/{test_folder.id}",
            json={},
        )

        assert response.status_code == 200
        data = response.json()
        # Should return the folder unchanged
        assert data["name"] == test_folder.name
        assert data["id"] == str(test_folder.id)

    @pytest.mark.asyncio
    async def test_update_folder_not_found(self, async_client: AsyncClient):
        """Test updating non-existent folder."""
        from uuid import uuid4

        fake_id = uuid4()
        response = await async_client.put(
            f"/api/folders/{fake_id}", json={"name": "New Name"}
        )

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_folder_persists(
        self, async_client: AsyncClient, test_folder: Folder, db_session: AsyncSession
    ):
        """Test that folder updates persist to database."""
        response = await async_client.put(
            f"/api/folders/{test_folder.id}", json={"name": "Persisted Name"}
        )

        assert response.status_code == 200

        # Verify in database
        await db_session.refresh(test_folder)
        assert test_folder.name == "Persisted Name"

    @pytest.mark.asyncio
    async def test_update_folder_access_control(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        """Test that users cannot update other users' folders."""
        from uuid import uuid4
        from sqlalchemy import text

        # Create another user with profile first
        other_user_id = str(uuid4())
        other_email = f"other-{uuid4().hex[:8]}@example.com"

        # Create auth user and profile
        await db_session.execute(
            text(
                """
                INSERT INTO auth.users (
                    id, aud, role, email, encrypted_password, 
                    email_confirmed_at, confirmation_sent_at, 
                    recovery_sent_at, created_at, updated_at,
                    raw_app_meta_data, raw_user_meta_data,
                    is_super_admin, is_sso_user, is_anonymous
                ) VALUES (
                    :user_id, 'authenticated', 'authenticated', :email, '', 
                    NOW(), NOW(), NOW(), NOW(), NOW(),
                    '{}', '{}', FALSE, FALSE, FALSE
                ) ON CONFLICT (id) DO NOTHING
                """
            ),
            {"user_id": other_user_id, "email": other_email},
        )
        await db_session.flush()

        other_folder = Folder(user_id=other_user_id, name="Other Folder")
        db_session.add(other_folder)
        await db_session.flush()

        response = await async_client.put(
            f"/api/folders/{other_folder.id}", json={"name": "Hacked"}
        )
        assert response.status_code == 404


class TestFolderDelete:
    """Test folder deletion endpoint."""

    @pytest.mark.asyncio
    async def test_delete_folder_success(
        self, async_client: AsyncClient, test_folder: Folder, db_session: AsyncSession
    ):
        """Test deleting a folder successfully."""
        folder_id = test_folder.id
        response = await async_client.delete(f"/api/folders/{folder_id}")

        assert response.status_code == 204

        # Verify deleted from database
        result = await db_session.execute(select(Folder).where(Folder.id == folder_id))
        folder = result.scalar_one_or_none()
        assert folder is None

    @pytest.mark.asyncio
    async def test_delete_folder_not_found(self, async_client: AsyncClient):
        """Test deleting non-existent folder."""
        from uuid import uuid4

        fake_id = uuid4()
        response = await async_client.delete(f"/api/folders/{fake_id}")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_folder_access_control(
        self, async_client: AsyncClient, db_session: AsyncSession
    ):
        """Test that users cannot delete other users' folders."""
        from uuid import uuid4
        from sqlalchemy import text

        # Create another user with profile first
        other_user_id = str(uuid4())
        other_email = f"other-{uuid4().hex[:8]}@example.com"

        # Create auth user and profile
        await db_session.execute(
            text(
                """
                INSERT INTO auth.users (
                    id, aud, role, email, encrypted_password, 
                    email_confirmed_at, confirmation_sent_at, 
                    recovery_sent_at, created_at, updated_at,
                    raw_app_meta_data, raw_user_meta_data,
                    is_super_admin, is_sso_user, is_anonymous
                ) VALUES (
                    :user_id, 'authenticated', 'authenticated', :email, '', 
                    NOW(), NOW(), NOW(), NOW(), NOW(),
                    '{}', '{}', FALSE, FALSE, FALSE
                ) ON CONFLICT (id) DO NOTHING
                """
            ),
            {"user_id": other_user_id, "email": other_email},
        )
        await db_session.flush()

        other_folder = Folder(user_id=other_user_id, name="Other Folder")
        db_session.add(other_folder)
        await db_session.flush()

        response = await async_client.delete(f"/api/folders/{other_folder.id}")
        assert response.status_code == 404

        # Verify folder still exists
        result = await db_session.execute(
            select(Folder).where(Folder.id == other_folder.id)
        )
        folder = result.scalar_one_or_none()
        assert folder is not None
