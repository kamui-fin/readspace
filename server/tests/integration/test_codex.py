"""Integration tests for the Codex Digest router, quota enforcement, and pipeline.

Follows the OPML test pattern: monkeypatch `.kiq` to run the underlying task function
synchronously against the isolated test DB, so the whole flow is deterministic without a real
Taskiq broker. LLM calls (Gemini) are mocked - these are not meant to hit the real API.
"""

import hashlib
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import ArticleContent, FeedArticle
from app.models.enums import CodexDigestStatus, UserRole
from app.models.feed import Feed, FeedSubscription
from app.models.folder import Folder
from app.models.user import Profile
from app.typing.codex import (
    CodexSynthesisOutput,
    CodexTriageOutput,
    CodexWorthReadingItem,
)
from app.workers.codex_tasks import generate_codex_digest_task


async def _seed_article(
    db_session: AsyncSession,
    *,
    feed: Feed,
    title: str,
    link: str,
    published_at: datetime,
) -> FeedArticle:
    content = ArticleContent(
        id=uuid4(),
        content_hash=hashlib.sha256(link.encode()).hexdigest(),
        title=title,
        link=link,
        description=f"Description for {title}",
    )
    db_session.add(content)
    await db_session.flush()

    article = FeedArticle(
        id=uuid4(),
        feed_id=feed.id,
        content_id=content.id,
        guid_hash=hashlib.sha256(link.encode()).hexdigest(),
        published_at=published_at,
    )
    db_session.add(article)
    await db_session.flush()
    return article


async def _seed_feed_and_subscription(db_session: AsyncSession, *, user: Profile, folder: Folder, title: str) -> Feed:
    feed = Feed(
        id=uuid4(),
        url=f"https://example.com/{uuid4().hex[:8]}/feed.xml",
        title=title,
        link=f"https://example.com/{uuid4().hex[:8]}",
        language="en",
        tags=[],
        tags_native=[],
    )
    db_session.add(feed)
    await db_session.flush()

    subscription = FeedSubscription(
        id=uuid4(),
        user_id=user.id,
        feed_id=feed.id,
        folder_id=folder.id,
    )
    db_session.add(subscription)
    await db_session.flush()
    return feed


def _fake_triage_output(article_ids: list[int]) -> CodexTriageOutput:
    return CodexTriageOutput(
        gist="A quiet day with one small story.",
        clusters=[],
        worth_reading_ids=article_ids[:4],
        themes=["Small Story", "Slow news day"],
    )


def _fake_synthesis_output(article_ids: list[int]) -> CodexSynthesisOutput:
    return CodexSynthesisOutput(
        scale_setter="A handful of articles, nothing major.",
        developments=[],
        worth_reading=[CodexWorthReadingItem(article_id=aid, reason="Worth a look.") for aid in article_ids[:4]],
        closing_line="0 developments found - a quiet day.",
    )


@pytest.mark.asyncio
class TestCodexGenerateEndpoint:
    async def test_generate_returns_202_and_pending_row(
        self, async_client: AsyncClient, test_user: Profile, test_folder: Folder, db_session: AsyncSession, monkeypatch
    ):
        """POST /codex/generate enqueues a task and returns a PENDING row immediately."""
        dispatched: list[tuple] = []

        async def fake_kiq(user_id: str, digest_id: str):
            dispatched.append((user_id, digest_id))
            return SimpleNamespace(task_id="fake-task-id")

        monkeypatch.setattr(generate_codex_digest_task, "kiq", fake_kiq, raising=False)

        response = await async_client.post("/api/codex/generate")

        assert response.status_code == 202
        body = response.json()
        assert body["status"] == "pending"
        assert body["digest_date"] == datetime.now(timezone.utc).date().isoformat()
        assert len(dispatched) == 1
        assert dispatched[0][0] == str(test_user.id)

    async def test_generate_is_idempotent_same_day(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession, monkeypatch
    ):
        """A second request the same day returns the existing row instead of enqueueing again."""
        dispatched: list[tuple] = []

        async def fake_kiq(user_id: str, digest_id: str):
            dispatched.append((user_id, digest_id))
            return SimpleNamespace(task_id="fake-task-id")

        monkeypatch.setattr(generate_codex_digest_task, "kiq", fake_kiq, raising=False)

        first = await async_client.post("/api/codex/generate")
        second = await async_client.post("/api/codex/generate")

        assert first.status_code == 202
        assert second.status_code == 202
        assert first.json()["id"] == second.json()["id"]
        # Only the first request should have enqueued a task.
        assert len(dispatched) == 1

    @pytest.mark.parametrize("stale_status", [CodexDigestStatus.SKIPPED, CodexDigestStatus.FAILED])
    async def test_generate_retries_after_skipped_or_failed_same_day(
        self,
        async_client: AsyncClient,
        test_user: Profile,
        db_session: AsyncSession,
        monkeypatch,
        stale_status: CodexDigestStatus,
    ):
        """Retrying the same day after a SKIPPED/FAILED run recycles the latest edition into
        PENDING - it does not spend a fresh per-day slot.

        Regression: `create_pending_digest` used to blindly INSERT, hitting the unique
        constraint and 500ing on "Try again" / "Check again".
        """
        from app.crud import codex as crud_codex

        today = datetime.now(timezone.utc).date()
        stale = await crud_codex.create_pending_digest(db_session, test_user.id, today)
        await crud_codex.finalize_digest(
            db_session,
            stale.id,
            stale_status,
            error="boom" if stale_status is CodexDigestStatus.FAILED else None,
        )
        await db_session.commit()

        dispatched: list[tuple] = []

        async def fake_kiq(user_id: str, digest_id: str):
            dispatched.append((user_id, digest_id))
            return SimpleNamespace(task_id="fake-task-id")

        monkeypatch.setattr(generate_codex_digest_task, "kiq", fake_kiq, raising=False)

        response = await async_client.post("/api/codex/generate")

        assert response.status_code == 202
        body = response.json()
        assert body["id"] == str(stale.id)  # same row, recycled
        assert body["status"] == CodexDigestStatus.PENDING.value
        assert body["progress_phase"] is None
        assert body["error"] is None
        assert len(dispatched) == 1

    async def test_generate_disabled_when_ai_off(self, async_client: AsyncClient, test_user: Profile, monkeypatch):
        """When ENABLE_AI is False, the endpoint returns a not-entitled response, no enqueue."""
        from app.routers import codex as codex_router_module

        monkeypatch.setattr(codex_router_module, "get_settings", lambda: SimpleNamespace(ENABLE_AI=False))

        response = await async_client.post("/api/codex/generate")

        assert response.status_code == 202
        body = response.json()
        assert body["entitled"] is False
        assert body["error_code"] == "AI_DISABLED"

    async def test_generate_enforces_basic_monthly_quota(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession, monkeypatch
    ):
        """A BASIC user with 3 COMPLETED digests this month is refused a 4th."""
        from app.crud import codex as crud_codex

        today = datetime.now(timezone.utc).date()
        for days_ago in range(1, 4):
            digest_date = today - timedelta(days=days_ago)
            digest = await crud_codex.create_pending_digest(db_session, test_user.id, digest_date)
            await crud_codex.finalize_digest(db_session, digest.id, CodexDigestStatus.COMPLETED, payload={})
        await db_session.commit()

        dispatched: list[tuple] = []

        async def fake_kiq(user_id: str, digest_id: str):
            dispatched.append((user_id, digest_id))
            return SimpleNamespace(task_id="fake-task-id")

        monkeypatch.setattr(generate_codex_digest_task, "kiq", fake_kiq, raising=False)

        response = await async_client.post("/api/codex/generate")

        assert response.status_code == 202
        body = response.json()
        assert body["entitled"] is False
        assert body["error_code"] == "CODEX_LIMIT_EXCEEDED"
        assert len(dispatched) == 0

    async def test_admin_bypasses_quota(
        self, async_admin_client: AsyncClient, admin_user: Profile, db_session: AsyncSession, monkeypatch
    ):
        """ADMIN role is always allowed, regardless of existing digests this month."""
        from app.crud import codex as crud_codex

        today = datetime.now(timezone.utc).date()
        for days_ago in range(1, 6):
            digest_date = today - timedelta(days=days_ago)
            digest = await crud_codex.create_pending_digest(db_session, admin_user.id, digest_date)
            await crud_codex.finalize_digest(db_session, digest.id, CodexDigestStatus.COMPLETED, payload={})
        await db_session.commit()

        async def fake_kiq(user_id: str, digest_id: str):
            return SimpleNamespace(task_id="fake-task-id")

        monkeypatch.setattr(generate_codex_digest_task, "kiq", fake_kiq, raising=False)

        response = await async_admin_client.post("/api/codex/generate")

        assert response.status_code == 202
        assert response.json()["status"] == "pending"


@pytest.mark.asyncio
class TestCodexTodayEndpoint:
    async def test_today_returns_404_when_no_digest(self, async_client: AsyncClient, test_user: Profile):
        response = await async_client.get("/api/codex/today")
        assert response.status_code == 404

    async def test_today_returns_latest_digest(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession
    ):
        from app.crud import codex as crud_codex

        today = datetime.now(timezone.utc).date()
        digest = await crud_codex.create_pending_digest(db_session, test_user.id, today)
        await crud_codex.finalize_digest(
            db_session,
            digest.id,
            CodexDigestStatus.COMPLETED,
            payload={
                "gist": "Quiet day.",
                "scale_setter": "Nothing much happened.",
                "developments": [],
                "worth_reading": [],
                "closing_line": "0 developments found.",
            },
        )
        await db_session.commit()

        response = await async_client.get("/api/codex/today")

        assert response.status_code == 200
        body = response.json()
        assert body["id"] == str(digest.id)
        assert body["status"] == "completed"
        assert body["payload"]["gist"] == "Quiet day."


@pytest.mark.asyncio
class TestCodexPipelineViaTask:
    """Exercise the whole pipeline through the real worker task, LLM calls mocked."""

    async def test_full_pipeline_persists_completed_digest(
        self, test_user: Profile, test_folder: Folder, db_session: AsyncSession, monkeypatch
    ):
        from app.crud import codex as crud_codex

        feed = await _seed_feed_and_subscription(db_session, user=test_user, folder=test_folder, title="Test Feed")
        now = datetime.now(timezone.utc)
        for i in range(5):
            await _seed_article(
                db_session,
                feed=feed,
                title=f"Story {i}",
                link=f"https://example.com/story-{i}",
                published_at=now - timedelta(hours=i),
            )
        await db_session.commit()

        today = now.date()
        digest = await crud_codex.create_pending_digest(db_session, test_user.id, today)
        await db_session.commit()

        # Mock the LLM calls - integration tests never hit the real Gemini API.
        async def fake_triage(prompt: str) -> CodexTriageOutput:
            return _fake_triage_output([1, 2, 3, 4, 5])

        async def fake_synthesis(prompt: str) -> CodexSynthesisOutput:
            return _fake_synthesis_output([1, 2, 3, 4, 5])

        monkeypatch.setattr("app.services.codex.pipeline.run_codex_triage", fake_triage)
        monkeypatch.setattr("app.services.codex.pipeline.run_codex_synthesis", fake_synthesis)

        # Mock full-text fetch + image probing - no real HTTP calls in integration tests.
        async def fake_fetch_full_texts(items):
            return {item.id: item.description or "" for item in items}

        async def fake_select_imagery(articles):
            from app.services.codex.imagery import DevelopmentImagery

            return DevelopmentImagery()

        monkeypatch.setattr("app.services.codex.pipeline.fetch_full_texts", fake_fetch_full_texts)
        monkeypatch.setattr("app.services.codex.pipeline.select_development_imagery", fake_select_imagery)

        await generate_codex_digest_task(str(test_user.id), str(digest.id))

        await db_session.refresh(digest)
        assert digest.status == CodexDigestStatus.COMPLETED.value
        assert digest.input_article_count == 5
        assert digest.payload is not None
        assert digest.payload["gist"] == "A quiet day with one small story."
        assert len(digest.payload["worth_reading"]) == 4
        assert digest.payload["themes"] == ["Small Story", "Slow news day"]
        # No developments on a quiet day -> nothing was condensed.
        assert digest.payload["stats"] is None
        # article_count / articles-shown alignment regression guard
        for wr in digest.payload["worth_reading"]:
            assert "article" in wr
            assert wr["article"]["title"].startswith("Story")

    async def test_pipeline_skips_with_no_articles(self, test_user: Profile, db_session: AsyncSession, monkeypatch):
        from app.crud import codex as crud_codex

        today = datetime.now(timezone.utc).date()
        digest = await crud_codex.create_pending_digest(db_session, test_user.id, today)
        await db_session.commit()

        await generate_codex_digest_task(str(test_user.id), str(digest.id))

        await db_session.refresh(digest)
        assert digest.status == CodexDigestStatus.SKIPPED.value
        assert digest.input_article_count == 0

    async def test_pipeline_tracks_progress_phase(
        self, test_user: Profile, test_folder: Folder, db_session: AsyncSession, monkeypatch
    ):
        """progress_phase advances through the pipeline and holds its last value at completion."""
        from app.crud import codex as crud_codex

        feed = await _seed_feed_and_subscription(db_session, user=test_user, folder=test_folder, title="Test Feed")
        now = datetime.now(timezone.utc)
        await _seed_article(
            db_session, feed=feed, title="Only Story", link="https://example.com/only", published_at=now
        )
        await db_session.commit()

        digest = await crud_codex.create_pending_digest(db_session, test_user.id, now.date())
        await db_session.commit()

        observed_phases: list[str] = []

        async def fake_triage(prompt: str) -> CodexTriageOutput:
            observed_phases.append((await db_session.get(type(digest), digest.id)).progress_phase)
            return _fake_triage_output([1])

        async def fake_synthesis(prompt: str) -> CodexSynthesisOutput:
            observed_phases.append((await db_session.get(type(digest), digest.id)).progress_phase)
            return _fake_synthesis_output([1])

        async def fake_fetch_full_texts(items):
            observed_phases.append((await db_session.get(type(digest), digest.id)).progress_phase)
            return {item.id: item.description or "" for item in items}

        async def fake_select_imagery(articles):
            from app.services.codex.imagery import DevelopmentImagery

            return DevelopmentImagery()

        monkeypatch.setattr("app.services.codex.pipeline.run_codex_triage", fake_triage)
        monkeypatch.setattr("app.services.codex.pipeline.run_codex_synthesis", fake_synthesis)
        monkeypatch.setattr("app.services.codex.pipeline.fetch_full_texts", fake_fetch_full_texts)
        monkeypatch.setattr("app.services.codex.pipeline.select_development_imagery", fake_select_imagery)

        await generate_codex_digest_task(str(test_user.id), str(digest.id))

        assert observed_phases == ["triaging", "reading", "synthesizing"]

        await db_session.refresh(digest)
        assert digest.status == CodexDigestStatus.COMPLETED.value
        # Phase holds its last value once terminal, per the CodexDigestPhase docstring.
        assert digest.progress_phase == "synthesizing"

    async def test_pipeline_marks_failed_on_generation_error(
        self, test_user: Profile, test_folder: Folder, db_session: AsyncSession, monkeypatch
    ):
        from app.crud import codex as crud_codex
        from app.services.ai.codex import CodexGenerationError

        feed = await _seed_feed_and_subscription(db_session, user=test_user, folder=test_folder, title="Test Feed")
        now = datetime.now(timezone.utc)
        await _seed_article(
            db_session, feed=feed, title="A Story", link="https://example.com/a-story", published_at=now
        )
        await db_session.commit()

        digest = await crud_codex.create_pending_digest(db_session, test_user.id, now.date())
        await db_session.commit()

        async def failing_triage(prompt: str):
            raise CodexGenerationError("Malformed model output")

        monkeypatch.setattr("app.services.codex.pipeline.run_codex_triage", failing_triage)

        await generate_codex_digest_task(str(test_user.id), str(digest.id))

        await db_session.refresh(digest)
        assert digest.status == CodexDigestStatus.FAILED.value
        assert digest.error == "Malformed model output"


@pytest.mark.asyncio
class TestCodexQuotaAcrossRoles:
    async def test_basic_role_limits_from_resource_limits_module(self, db_session: AsyncSession, test_user: Profile):
        from app.core.resource_limits import CODEX_LIMITS

        assert CODEX_LIMITS["basic"] == {"per_day": 1, "per_month": 3}
        assert CODEX_LIMITS["pro"] == {"per_day": 2}

    async def test_pro_role_allows_two_editions_per_day(
        self, db_session: AsyncSession, test_user: Profile, monkeypatch
    ):
        from app.crud import codex as crud_codex
        from app.services.user.resource_limits import enforce_codex_quota

        test_user.role = UserRole.PRO
        await db_session.commit()
        today = datetime.now(timezone.utc).date()

        # No digest yet today -> allowed (None = "create a new edition").
        assert await enforce_codex_quota(db_session, test_user.id, local_date=today) is None

        e1 = await crud_codex.create_pending_digest(db_session, test_user.id, today)
        await db_session.commit()
        assert e1.edition == 1

        # One edition today -> still under the per_day=2 cap, so a second is allowed.
        assert await enforce_codex_quota(db_session, test_user.id, local_date=today) is None

        e2 = await crud_codex.create_pending_digest(db_session, test_user.id, today)
        await db_session.commit()
        assert e2.edition == 2
        assert e2.id != e1.id

        # Two editions today -> capped; dedupe to the latest edition.
        result = await enforce_codex_quota(db_session, test_user.id, local_date=today)
        assert result is not None
        assert result.id == e2.id

    async def test_basic_role_one_edition_per_local_day(self, db_session: AsyncSession, test_user: Profile):
        from app.crud import codex as crud_codex
        from app.services.user.resource_limits import enforce_codex_quota

        today = datetime.now(timezone.utc).date()

        assert await enforce_codex_quota(db_session, test_user.id, local_date=today) is None

        e1 = await crud_codex.create_pending_digest(db_session, test_user.id, today)
        await db_session.commit()

        # Basic gets exactly one per local day -> the same row is served back, not a new one.
        result = await enforce_codex_quota(db_session, test_user.id, local_date=today)
        assert result is not None
        assert result.id == e1.id

    async def test_local_date_scopes_the_day(self, db_session: AsyncSession, test_user: Profile):
        """A digest on the caller's *previous* local day doesn't block today's request."""
        from app.crud import codex as crud_codex
        from app.services.user.resource_limits import enforce_codex_quota

        today = datetime.now(timezone.utc).date()
        yesterday = today - timedelta(days=1)

        y = await crud_codex.create_pending_digest(db_session, test_user.id, yesterday)
        await crud_codex.finalize_digest(db_session, y.id, CodexDigestStatus.COMPLETED, payload={})
        await db_session.commit()

        # Today has no edition yet -> allowed.
        assert await enforce_codex_quota(db_session, test_user.id, local_date=today) is None
