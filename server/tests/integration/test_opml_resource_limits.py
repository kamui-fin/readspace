"""Integration tests for OPML import resource limit enforcement.

This tests the fix for the bug where OPML import was bypassing subscription limits.
"""

import io
from unittest.mock import patch
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.feed import Feed, FeedSubscription
from app.models.folder import Folder
from app.models.user import Profile


class TestOPMLImportLimits:
    """Test that OPML import enforces subscription limits (bug fix verification)."""

    @pytest.mark.asyncio
    async def test_opml_import_respects_admin_unlimited(
        self,
        async_admin_client: AsyncClient,
        admin_user: Profile,
        db_session: AsyncSession,
    ):
        """Test that admin users can import OPML without subscription limits."""
        # Verify user has ADMIN role
        result = await db_session.execute(
            text("SELECT role FROM profiles WHERE id = :user_id"), {"user_id": admin_user.id}
        )
        role = result.scalar_one()
        assert role == "ADMIN"

        # Import OPML with 10 feeds (admin should have no limit)
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Test Feeds</title>
    </head>
    <body>
        <outline text="Tech">
"""
        # Add 10 feeds to test unlimited capacity for admin
        for i in range(10):
            opml_content += (
                f'            <outline type="rss" text="Feed {i}" xmlUrl="https://example.com/feed{i}.xml" />\n'
            )

        opml_content += """        </outline>
    </body>
</opml>"""

        files = {"opml_file": ("admin_feeds.opml", io.BytesIO(opml_content.encode()), "application/xml")}
        response = await async_admin_client.post("/api/opml/import/", files=files)

        # Should succeed for admin (unlimited access)
        assert response.status_code == 202
        data = response.json()
        assert data["estimated_feeds"] == 10

    @pytest.mark.asyncio
    async def test_opml_import_within_limit_succeeds(
        self,
        async_client: AsyncClient,
        test_user: Profile,
        db_session: AsyncSession,
    ):
        """Test that OPML import succeeds when within subscription limit.

        This verifies the limit is checked and allows imports within capacity.
        """
        # Basic users have 1000 limit by default, importing 5 feeds should work
        opml_content = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Test Feeds</title>
    </head>
    <body>
        <outline text="Tech">
            <outline type="rss" text="Feed 1" xmlUrl="https://example.com/feed1.xml" />
            <outline type="rss" text="Feed 2" xmlUrl="https://example.com/feed2.xml" />
            <outline type="rss" text="Feed 3" xmlUrl="https://example.com/feed3.xml" />
            <outline type="rss" text="Feed 4" xmlUrl="https://example.com/feed4.xml" />
            <outline type="rss" text="Feed 5" xmlUrl="https://example.com/feed5.xml" />
        </outline>
    </body>
</opml>"""

        files = {"opml_file": ("test_feeds.opml", io.BytesIO(opml_content.encode()), "application/xml")}
        response = await async_client.post("/api/opml/import/", files=files)

        # Should succeed - well within limit
        assert response.status_code == 202
        data = response.json()
        assert data["estimated_feeds"] == 5

    @pytest.mark.asyncio
    async def test_opml_import_blocked_when_exceeds_limit(
        self,
        async_client: AsyncClient,
        test_user: Profile,
        test_folder: Folder,
        db_session: AsyncSession,
    ):
        """Test that OPML import is blocked when it would exceed subscription limit.

        This is the core test for the bug fix - OPML was previously bypassing limits.
        """
        # Patch resource limits to set a low limit for testing
        test_limits = {
            "basic": {"max_subscriptions": 3},
            "pro": {"max_subscriptions": 3},
            "admin": {"max_subscriptions": -1},
        }

        with patch("app.services.user.resource_limits.RESOURCE_LIMITS", test_limits):
            # Try to import 10 feeds when limit is 3
            opml_content = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Large Feed Collection</title>
    </head>
    <body>
        <outline text="Tech">
            <outline type="rss" text="Feed 1" xmlUrl="https://example.com/feed1.xml" />
            <outline type="rss" text="Feed 2" xmlUrl="https://example.com/feed2.xml" />
            <outline type="rss" text="Feed 3" xmlUrl="https://example.com/feed3.xml" />
            <outline type="rss" text="Feed 4" xmlUrl="https://example.com/feed4.xml" />
            <outline type="rss" text="Feed 5" xmlUrl="https://example.com/feed5.xml" />
            <outline type="rss" text="Feed 6" xmlUrl="https://example.com/feed6.xml" />
            <outline type="rss" text="Feed 7" xmlUrl="https://example.com/feed7.xml" />
            <outline type="rss" text="Feed 8" xmlUrl="https://example.com/feed8.xml" />
            <outline type="rss" text="Feed 9" xmlUrl="https://example.com/feed9.xml" />
            <outline type="rss" text="Feed 10" xmlUrl="https://example.com/feed10.xml" />
        </outline>
    </body>
</opml>"""

            files = {"opml_file": ("large_feeds.opml", io.BytesIO(opml_content.encode()), "application/xml")}
            response = await async_client.post("/api/opml/import/", files=files)

            # Should be rejected with 429 (Too Many Requests)
            assert response.status_code == 429
            error_data = response.json()
            assert "exceed your feed subscription limit" in error_data["detail"]
            # Check that the message contains capacity info (format: "X/Y left")
            assert "/3 left" in error_data["detail"]  # Shows remaining capacity out of limit

    @pytest.mark.asyncio
    async def test_opml_import_blocked_with_partial_capacity(
        self,
        async_client: AsyncClient,
        test_user: Profile,
        test_folder: Folder,
        db_session: AsyncSession,
    ):
        """Test OPML import when user has some subscriptions already."""
        test_limits = {
            "basic": {"max_subscriptions": 10},
            "pro": {"max_subscriptions": 10},
            "admin": {"max_subscriptions": -1},
        }

        with patch("app.services.user.resource_limits.RESOURCE_LIMITS", test_limits):
            # Create 7 existing subscriptions
            for i in range(7):
                feed = Feed(
                    id=uuid4(),
                    url=f"https://example.com/existing{i}.xml",
                    title=f"Existing Feed {i}",
                    link=f"https://example.com/existing{i}",
                )
                db_session.add(feed)
                await db_session.flush()

                subscription = FeedSubscription(
                    user_id=test_user.id,
                    feed_id=feed.id,
                    folder_id=test_folder.id,
                )
                db_session.add(subscription)
            await db_session.flush()

            # Try to import 5 feeds (would need 12 total, but limit is 10)
            opml_content = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Test Feeds</title>
    </head>
    <body>
        <outline text="Tech">
            <outline type="rss" text="Feed 1" xmlUrl="https://example.com/new1.xml" />
            <outline type="rss" text="Feed 2" xmlUrl="https://example.com/new2.xml" />
            <outline type="rss" text="Feed 3" xmlUrl="https://example.com/new3.xml" />
            <outline type="rss" text="Feed 4" xmlUrl="https://example.com/new4.xml" />
            <outline type="rss" text="Feed 5" xmlUrl="https://example.com/new5.xml" />
        </outline>
    </body>
</opml>"""

            files = {"opml_file": ("partial.opml", io.BytesIO(opml_content.encode()), "application/xml")}
            response = await async_client.post("/api/opml/import/", files=files)

            # Should be rejected - only 3 slots remaining but importing 5
            assert response.status_code == 429
            error_data = response.json()
            assert "exceed your feed subscription limit" in error_data["detail"]
            # Check that the message contains capacity info (format: "X/Y left")
            assert "3/10 left" in error_data["detail"]  # Shows 3 remaining out of 10 total

    @pytest.mark.asyncio
    async def test_opml_import_exactly_at_capacity(
        self,
        async_client: AsyncClient,
        test_user: Profile,
        test_folder: Folder,
        db_session: AsyncSession,
    ):
        """Test that importing exactly to the limit is allowed."""
        test_limits = {
            "basic": {"max_subscriptions": 5},
            "pro": {"max_subscriptions": 5},
            "admin": {"max_subscriptions": -1},
        }

        with patch("app.services.user.resource_limits.RESOURCE_LIMITS", test_limits):
            # Create 2 existing subscriptions
            for i in range(2):
                feed = Feed(
                    id=uuid4(),
                    url=f"https://example.com/existing{i}.xml",
                    title=f"Existing Feed {i}",
                    link=f"https://example.com/existing{i}",
                )
                db_session.add(feed)
                await db_session.flush()

                subscription = FeedSubscription(
                    user_id=test_user.id,
                    feed_id=feed.id,
                    folder_id=test_folder.id,
                )
                db_session.add(subscription)
            await db_session.flush()

            # Import 3 feeds (exactly fills remaining capacity: 2 + 3 = 5)
            opml_content = """<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>Test Feeds</title>
    </head>
    <body>
        <outline text="Tech">
            <outline type="rss" text="Feed 1" xmlUrl="https://example.com/new1.xml" />
            <outline type="rss" text="Feed 2" xmlUrl="https://example.com/new2.xml" />
            <outline type="rss" text="Feed 3" xmlUrl="https://example.com/new3.xml" />
        </outline>
    </body>
</opml>"""

            files = {"opml_file": ("exact.opml", io.BytesIO(opml_content.encode()), "application/xml")}
            response = await async_client.post("/api/opml/import/", files=files)

            # Should succeed - exactly at limit is allowed
            assert response.status_code == 202
            data = response.json()
            assert data["estimated_feeds"] == 3

    @pytest.mark.asyncio
    async def test_opml_validation_runs_before_limit_check(
        self,
        async_client: AsyncClient,
        test_user: Profile,
        db_session: AsyncSession,
    ):
        """Test that invalid OPML is rejected before limit checking.

        This ensures validation happens in the correct order.
        """
        # Send invalid OPML (not valid XML)
        invalid_opml = b"not valid xml content"

        files = {"opml_file": ("invalid.opml", io.BytesIO(invalid_opml), "application/xml")}
        response = await async_client.post("/api/opml/import/", files=files)

        # Should fail validation before limit check (400 Bad Request)
        assert response.status_code == 400
        error_data = response.json()
        assert "Invalid XML" in error_data["detail"] or "XML" in error_data["detail"]
