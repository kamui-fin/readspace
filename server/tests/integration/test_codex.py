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

    async def test_generate_recycles_stale_orphaned_in_progress_digest(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession, monkeypatch
    ):
        """An IN_PROGRESS row orphaned well past the task's own timeout (crashed worker, a
        dev restart mid-task) must not be served back forever as "still generating" - it
        should self-heal to FAILED and then be recycled fresh, exactly like a real
        SKIPPED/FAILED retry: same row, `requested_at` reset to now, one task enqueued.

        Regression: `enforce_codex_quota` used to hand an in-flight row back unconditionally,
        so a stuck task would make every future click of "Generate" re-show that same
        ever-more-stale digest with a timer that never resets.
        """
        from app.core.constants import CODEX_STALE_IN_FLIGHT_MINUTES
        from app.crud import codex as crud_codex
        from app.models.enums import CodexDigestPhase

        today = datetime.now(timezone.utc).date()
        stale = await crud_codex.create_pending_digest(db_session, test_user.id, today)
        await crud_codex.mark_in_progress(db_session, stale.id, CodexDigestPhase.TRIAGING)
        await db_session.commit()
        await _backdate_requested_at(db_session, stale.id, hours_ago=(CODEX_STALE_IN_FLIGHT_MINUTES + 1) / 60)
        await db_session.commit()

        dispatched: list[tuple] = []

        async def fake_kiq(user_id: str, digest_id: str):
            dispatched.append((user_id, digest_id))
            return SimpleNamespace(task_id="fake-task-id")

        monkeypatch.setattr(generate_codex_digest_task, "kiq", fake_kiq, raising=False)

        before = datetime.now(timezone.utc)
        response = await async_client.post("/api/codex/generate")

        assert response.status_code == 202
        body = response.json()
        assert body["id"] == str(stale.id)  # same row, recycled
        assert body["status"] == CodexDigestStatus.PENDING.value
        assert body["error"] is None
        # requested_at reset to now, not the 2-hour-old timestamp we backdated it to.
        assert datetime.fromisoformat(body["requested_at"]) >= before
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

    async def test_today_self_heals_orphaned_in_progress_digest(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession
    ):
        """An IN_PROGRESS row far past the generation task's own timeout is orphaned - the
        worker crashed, or something (a dev restart, an uncaught cancellation) killed it
        mid-task without ever reaching a terminal status. GET /today should self-heal it to
        FAILED rather than serving it back forever with a `requested_at` that only gets
        staler, which read on the client as a "Building..." screen whose elapsed timer starts
        from however long ago the task actually died.
        """
        from app.core.constants import CODEX_STALE_IN_FLIGHT_MINUTES
        from app.crud import codex as crud_codex
        from app.models.enums import CodexDigestPhase

        today = datetime.now(timezone.utc).date()
        digest = await crud_codex.create_pending_digest(db_session, test_user.id, today)
        await crud_codex.mark_in_progress(db_session, digest.id, CodexDigestPhase.TRIAGING)
        await db_session.commit()
        await _backdate_requested_at(db_session, digest.id, hours_ago=(CODEX_STALE_IN_FLIGHT_MINUTES + 1) / 60)
        await db_session.commit()

        response = await async_client.get("/api/codex/today")

        assert response.status_code == 200
        body = response.json()
        assert body["id"] == str(digest.id)
        assert body["status"] == "failed"

    async def test_today_leaves_recent_in_progress_digest_alone(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession
    ):
        """A digest still comfortably inside the task's own timeout is a real in-flight
        generation, not an orphan - it must not be healed away mid-run."""
        from app.crud import codex as crud_codex
        from app.models.enums import CodexDigestPhase

        today = datetime.now(timezone.utc).date()
        digest = await crud_codex.create_pending_digest(db_session, test_user.id, today)
        await crud_codex.mark_in_progress(db_session, digest.id, CodexDigestPhase.TRIAGING)
        await db_session.commit()

        response = await async_client.get("/api/codex/today")

        assert response.status_code == 200
        assert response.json()["status"] == "in_progress"


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
class TestCodexPreferencesEndpoint:
    async def test_get_preferences_defaults_to_empty(self, async_client: AsyncClient, test_user: Profile):
        """A user who has never saved preferences gets an empty excluded set."""
        response = await async_client.get("/api/codex/preferences")
        assert response.status_code == 200
        assert response.json() == {"excluded_folder_ids": []}

    async def test_put_preferences_round_trips(
        self, async_client: AsyncClient, test_user: Profile, test_folder: Folder
    ):
        """PUT stores the excluded folder ids; a subsequent GET reads them back."""
        put = await async_client.put(
            "/api/codex/preferences",
            json={"excluded_folder_ids": [str(test_folder.id)]},
        )
        assert put.status_code == 200
        assert put.json()["excluded_folder_ids"] == [str(test_folder.id)]

        get = await async_client.get("/api/codex/preferences")
        assert get.json()["excluded_folder_ids"] == [str(test_folder.id)]

        # Clearing it works too.
        cleared = await async_client.put("/api/codex/preferences", json={"excluded_folder_ids": []})
        assert cleared.json()["excluded_folder_ids"] == []

    async def test_put_preferences_rejects_foreign_folder(
        self, async_client: AsyncClient, test_user: Profile, admin_user: Profile, db_session: AsyncSession
    ):
        """A folder id that doesn't belong to the caller is refused with a 4xx."""
        from app.models.folder import Folder as FolderModel

        other = FolderModel(id=uuid4(), user_id=admin_user.id, name="Someone else's folder")
        db_session.add(other)
        await db_session.commit()

        response = await async_client.put(
            "/api/codex/preferences",
            json={"excluded_folder_ids": [str(other.id)]},
        )
        assert response.status_code >= 400
        assert response.json()["error_code"] == "CODEX_UNKNOWN_FOLDER"


@pytest.mark.asyncio
class TestCodexPipelineRespectsPreferences:
    async def test_excluded_folder_articles_are_omitted(
        self, test_user: Profile, db_session: AsyncSession, monkeypatch
    ):
        """Articles from feeds in an excluded folder never reach the digest catalog."""
        from app.crud import codex as crud_codex

        included_folder = Folder(id=uuid4(), user_id=test_user.id, name="Included")
        excluded_folder = Folder(id=uuid4(), user_id=test_user.id, name="Excluded")
        db_session.add_all([included_folder, excluded_folder])
        await db_session.flush()

        included_feed = await _seed_feed_and_subscription(
            db_session, user=test_user, folder=included_folder, title="Included Feed"
        )
        excluded_feed = await _seed_feed_and_subscription(
            db_session, user=test_user, folder=excluded_folder, title="Excluded Feed"
        )
        now = datetime.now(timezone.utc)
        for i in range(3):
            await _seed_article(
                db_session,
                feed=included_feed,
                title=f"Kept {i}",
                link=f"https://example.com/kept-{i}",
                published_at=now - timedelta(hours=i),
            )
            await _seed_article(
                db_session,
                feed=excluded_feed,
                title=f"Dropped {i}",
                link=f"https://example.com/dropped-{i}",
                published_at=now - timedelta(hours=i),
            )

        await crud_codex.upsert_preferences(db_session, test_user.id, excluded_folder_ids=[excluded_folder.id])
        digest = await crud_codex.create_pending_digest(db_session, test_user.id, now.date())
        await db_session.commit()

        seen_titles: list[str] = []

        async def fake_triage(prompt: str) -> CodexTriageOutput:
            seen_titles.append(prompt)
            return _fake_triage_output([1, 2, 3])

        async def fake_synthesis(prompt: str) -> CodexSynthesisOutput:
            return _fake_synthesis_output([1, 2, 3])

        async def fake_fetch_full_texts(items):
            return {item.id: item.description or "" for item in items}

        async def fake_select_imagery(articles):
            from app.services.codex.imagery import DevelopmentImagery

            return DevelopmentImagery()

        monkeypatch.setattr("app.services.codex.pipeline.run_codex_triage", fake_triage)
        monkeypatch.setattr("app.services.codex.pipeline.run_codex_synthesis", fake_synthesis)
        monkeypatch.setattr("app.services.codex.pipeline.fetch_full_texts", fake_fetch_full_texts)
        monkeypatch.setattr("app.services.codex.pipeline.select_development_imagery", fake_select_imagery)

        await generate_codex_digest_task(str(test_user.id), str(digest.id))

        await db_session.refresh(digest)
        assert digest.status == CodexDigestStatus.COMPLETED.value
        # Only the 3 included-folder articles from a single source made the catalog.
        assert digest.input_article_count == 3
        assert digest.input_source_count == 1
        triage_prompt = seen_titles[0]
        assert "Kept 0" in triage_prompt
        assert "Dropped 0" not in triage_prompt


class TestResolveLocalDate:
    """The router's ±1-day clamp on the client-supplied local calendar day. It's a display
    label only (``digest_date``) - a real timezone is at most UTC±14h so legit values pass
    straight through and only a spoof gets clamped. It never affects the quota."""

    def test_none_body_falls_back_to_utc_today(self):
        from app.routers.codex import _resolve_local_date

        assert _resolve_local_date(None) == datetime.now(timezone.utc).date()

    def test_missing_local_date_falls_back_to_utc_today(self):
        from app.routers.codex import _resolve_local_date
        from app.typing.codex import CodexGenerateRequest

        assert _resolve_local_date(CodexGenerateRequest()) == datetime.now(timezone.utc).date()

    @pytest.mark.parametrize("offset_days", [-1, 0, 1])
    def test_within_one_day_passes_through_unchanged(self, offset_days: int):
        from app.routers.codex import _resolve_local_date
        from app.typing.codex import CodexGenerateRequest

        supplied = datetime.now(timezone.utc).date() + timedelta(days=offset_days)
        assert _resolve_local_date(CodexGenerateRequest(local_date=supplied)) == supplied

    def test_far_future_is_clamped_to_utc_tomorrow(self):
        from app.routers.codex import _resolve_local_date
        from app.typing.codex import CodexGenerateRequest

        utc_today = datetime.now(timezone.utc).date()
        supplied = utc_today + timedelta(days=30)
        assert _resolve_local_date(CodexGenerateRequest(local_date=supplied)) == utc_today + timedelta(days=1)

    def test_far_past_is_clamped_to_utc_yesterday(self):
        from app.routers.codex import _resolve_local_date
        from app.typing.codex import CodexGenerateRequest

        utc_today = datetime.now(timezone.utc).date()
        supplied = utc_today - timedelta(days=30)
        assert _resolve_local_date(CodexGenerateRequest(local_date=supplied)) == utc_today - timedelta(days=1)


def _fake_kiq_recorder(sink: list) -> "callable":
    async def fake_kiq(user_id: str, digest_id: str):
        sink.append((user_id, digest_id))
        return SimpleNamespace(task_id="fake-task-id")

    return fake_kiq


async def _backdate_requested_at(db: AsyncSession, digest_id, *, hours_ago: float) -> None:
    """Push a digest's requested_at into the past so it sits outside the rolling quota window."""
    from app.models.codex import CodexDigest

    row = await db.get(CodexDigest, digest_id)
    assert row is not None
    row.requested_at = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
    await db.flush()


@pytest.mark.asyncio
class TestCodexRollingQuota:
    """The generation cap is a server-clock rolling window (CODEX_QUOTA_WINDOW_HOURS), not a
    calendar day. It can't be moved by the client's clock or its supplied local_date, and it
    resets continuously as old generations age out of the window."""

    async def test_limits_config_shape(self):
        from app.core.resource_limits import CODEX_LIMITS, CODEX_QUOTA_WINDOW_HOURS

        assert CODEX_LIMITS["basic"] == {"per_window": 1, "per_month": 3}
        assert CODEX_LIMITS["pro"] == {"per_window": 2}
        assert 12 <= CODEX_QUOTA_WINDOW_HOURS <= 24  # "a little under a day"

    async def test_pro_gets_two_per_window_then_is_capped(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession, monkeypatch
    ):
        test_user.role = UserRole.PRO
        await db_session.commit()

        dispatched: list[tuple] = []
        monkeypatch.setattr(generate_codex_digest_task, "kiq", _fake_kiq_recorder(dispatched), raising=False)

        first = await async_client.post("/api/codex/generate")
        second = await async_client.post("/api/codex/generate")
        assert first.status_code == second.status_code == 202
        b1, b2 = first.json(), second.json()
        assert b1["status"] == b2["status"] == "pending"
        assert b1["id"] != b2["id"]
        assert len(dispatched) == 2

        # Third within the window -> capped. No new enqueue; the client is handed the latest row.
        third = await async_client.post("/api/codex/generate")
        assert third.status_code == 202
        b3 = third.json()
        if b3.get("entitled") is False:
            assert b3["error_code"] == "CODEX_PRO_RATE_LIMITED"
        else:
            assert b3["id"] == b2["id"]
        assert len(dispatched) == 2

    async def test_pro_window_cap_uses_pacing_error_code_not_quota(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession
    ):
        """Pro at the window cap (both editions already COMPLETED, so no in-flight row to hand
        back) is refused with a distinct error_code from Basic's quota exhaustion - the client
        renders a plain pacing explainer for Pro instead of the upgrade-to-Pro paywall."""
        from app.crud import codex as crud_codex

        test_user.role = UserRole.PRO
        await db_session.commit()

        for _ in range(2):
            d = await crud_codex.create_pending_digest(db_session, test_user.id, datetime.now(timezone.utc).date())
            await crud_codex.finalize_digest(db_session, d.id, CodexDigestStatus.COMPLETED, payload={})
        await db_session.commit()

        resp = await async_client.post("/api/codex/generate")
        assert resp.status_code == 202
        body = resp.json()
        assert body["entitled"] is False
        assert body["error_code"] == "CODEX_PRO_RATE_LIMITED"

    async def test_basic_window_cap_keeps_quota_error_code(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession
    ):
        """Basic at the window cap (but still under the monthly cap) keeps the upgrade-path
        error_code - Basic always has Pro to upgrade to, unlike Pro at its own window cap."""
        from app.crud import codex as crud_codex

        d = await crud_codex.create_pending_digest(db_session, test_user.id, datetime.now(timezone.utc).date())
        await crud_codex.finalize_digest(db_session, d.id, CodexDigestStatus.COMPLETED, payload={})
        await db_session.commit()

        resp = await async_client.post("/api/codex/generate")
        assert resp.status_code == 202
        body = resp.json()
        assert body["entitled"] is False
        assert body["error_code"] == "CODEX_LIMIT_EXCEEDED"

    async def test_spoofed_future_local_date_does_not_unlock_more(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession, monkeypatch
    ):
        """The timezone/clock attack: after using the window, POST again with local_date set a
        day ahead. The clamp passes it through as a label, but the quota (server clock) still
        refuses."""
        test_user.role = UserRole.PRO
        await db_session.commit()

        dispatched: list[tuple] = []
        monkeypatch.setattr(generate_codex_digest_task, "kiq", _fake_kiq_recorder(dispatched), raising=False)

        today = datetime.now(timezone.utc).date()
        await async_client.post("/api/codex/generate", json={"local_date": today.isoformat()})
        await async_client.post("/api/codex/generate", json={"local_date": today.isoformat()})
        assert len(dispatched) == 2

        tomorrow = (today + timedelta(days=1)).isoformat()
        spoof = await async_client.post("/api/codex/generate", json={"local_date": tomorrow})
        assert spoof.status_code == 202
        body = spoof.json()
        # No third generation: either refused, or deduped to an existing row. Never a new enqueue.
        assert body.get("entitled") is False or body["status"] in ("pending", "completed", "in_progress")
        assert len(dispatched) == 2

        # And a day-behind spoof is likewise ignored.
        yesterday = (today - timedelta(days=1)).isoformat()
        spoof2 = await async_client.post("/api/codex/generate", json={"local_date": yesterday})
        assert spoof2.status_code == 202
        assert len(dispatched) == 2

    async def test_window_resets_as_old_generations_age_out(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession, monkeypatch
    ):
        """A PRO user who used both slots >window ago can generate again; one still inside the
        window leaves only one slot free."""
        from app.core.resource_limits import CODEX_QUOTA_WINDOW_HOURS
        from app.crud import codex as crud_codex

        test_user.role = UserRole.PRO
        await db_session.commit()

        # Two completed generations, both just outside the window.
        for _ in range(2):
            d = await crud_codex.create_pending_digest(db_session, test_user.id, datetime.now(timezone.utc).date())
            await crud_codex.finalize_digest(db_session, d.id, CodexDigestStatus.COMPLETED, payload={})
            await _backdate_requested_at(db_session, d.id, hours_ago=CODEX_QUOTA_WINDOW_HOURS + 1)
        await db_session.commit()

        dispatched: list[tuple] = []
        monkeypatch.setattr(generate_codex_digest_task, "kiq", _fake_kiq_recorder(dispatched), raising=False)

        # Both old ones aged out -> a fresh generation is allowed.
        r1 = await async_client.post("/api/codex/generate")
        assert r1.status_code == 202 and r1.json()["status"] == "pending"
        assert len(dispatched) == 1

        # That new one is inside the window; one slot left, so a second is allowed...
        r2 = await async_client.post("/api/codex/generate")
        assert r2.json()["status"] == "pending"
        assert len(dispatched) == 2

        # ...but a third (two inside the window now) is not.
        r3 = await async_client.post("/api/codex/generate")
        assert r3.json().get("entitled") is False or r3.json()["id"] == r2.json()["id"]
        assert len(dispatched) == 2

    async def test_generation_just_inside_window_still_blocks_basic(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession, monkeypatch
    ):
        """Basic: one generation ~1h short of the window boundary still counts -> refused."""
        from app.core.resource_limits import CODEX_QUOTA_WINDOW_HOURS
        from app.crud import codex as crud_codex

        d = await crud_codex.create_pending_digest(db_session, test_user.id, datetime.now(timezone.utc).date())
        await crud_codex.finalize_digest(db_session, d.id, CodexDigestStatus.COMPLETED, payload={})
        await _backdate_requested_at(db_session, d.id, hours_ago=CODEX_QUOTA_WINDOW_HOURS - 1)
        await db_session.commit()

        dispatched: list[tuple] = []
        monkeypatch.setattr(generate_codex_digest_task, "kiq", _fake_kiq_recorder(dispatched), raising=False)

        resp = await async_client.post("/api/codex/generate")
        assert resp.status_code == 202
        body = resp.json()
        assert body.get("entitled") is False or body["id"] == str(d.id)
        assert len(dispatched) == 0

    async def test_generation_just_outside_window_frees_basic(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession, monkeypatch
    ):
        """Basic: one generation ~1h past the window boundary has aged out -> allowed again."""
        from app.core.resource_limits import CODEX_QUOTA_WINDOW_HOURS
        from app.crud import codex as crud_codex

        d = await crud_codex.create_pending_digest(db_session, test_user.id, datetime.now(timezone.utc).date())
        await crud_codex.finalize_digest(db_session, d.id, CodexDigestStatus.COMPLETED, payload={})
        await _backdate_requested_at(db_session, d.id, hours_ago=CODEX_QUOTA_WINDOW_HOURS + 1)
        await db_session.commit()

        dispatched: list[tuple] = []
        monkeypatch.setattr(generate_codex_digest_task, "kiq", _fake_kiq_recorder(dispatched), raising=False)

        resp = await async_client.post("/api/codex/generate")
        assert resp.status_code == 202
        assert resp.json()["status"] == "pending"
        assert len(dispatched) == 1

    async def test_skipped_generation_does_not_count_and_retries_in_place(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession, monkeypatch
    ):
        """A SKIPPED latest generation is retried in place - same row, no slot spent."""
        from app.crud import codex as crud_codex

        test_user.role = UserRole.PRO
        await db_session.commit()

        d = await crud_codex.create_pending_digest(db_session, test_user.id, datetime.now(timezone.utc).date())
        await crud_codex.finalize_digest(db_session, d.id, CodexDigestStatus.SKIPPED)
        await db_session.commit()

        dispatched: list[tuple] = []
        monkeypatch.setattr(generate_codex_digest_task, "kiq", _fake_kiq_recorder(dispatched), raising=False)

        resp = await async_client.post("/api/codex/generate")
        assert resp.status_code == 202
        body = resp.json()
        assert body["id"] == str(d.id)
        assert body["status"] == "pending"
        assert len(dispatched) == 1

        # Even a SKIPPED row that is now stale (outside the window) still just retries in place.
        await crud_codex.finalize_digest(db_session, d.id, CodexDigestStatus.SKIPPED)
        await _backdate_requested_at(db_session, d.id, hours_ago=48)
        await db_session.commit()
        resp2 = await async_client.post("/api/codex/generate")
        assert resp2.json()["id"] == str(d.id)

    async def test_in_flight_generation_is_served_back_at_cap_not_duplicated(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession, monkeypatch
    ):
        """At the per-window cap, if the newest of those generations is still running, a repeat
        POST is handed that row (keep polling) instead of queueing a duplicate."""
        from app.crud import codex as crud_codex
        from app.models.enums import CodexDigestPhase

        # BASIC: per_window is 1, so one in-flight generation already hits the cap.
        today = datetime.now(timezone.utc).date()
        d = await crud_codex.create_pending_digest(db_session, test_user.id, today)
        await crud_codex.mark_in_progress(db_session, d.id, CodexDigestPhase.GATHERING)
        await db_session.commit()

        dispatched: list[tuple] = []
        monkeypatch.setattr(generate_codex_digest_task, "kiq", _fake_kiq_recorder(dispatched), raising=False)

        resp = await async_client.post("/api/codex/generate")
        assert resp.status_code == 202
        assert resp.json()["id"] == str(d.id)
        assert resp.json()["status"] == "in_progress"
        assert len(dispatched) == 0

    async def test_pro_two_in_flight_then_repeat_is_served_the_newer_one(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession, monkeypatch
    ):
        """PRO: two concurrent in-flight editions = at cap. A 3rd POST returns the newer of the
        two, no duplicate."""
        test_user.role = UserRole.PRO
        await db_session.commit()

        dispatched: list[tuple] = []
        monkeypatch.setattr(generate_codex_digest_task, "kiq", _fake_kiq_recorder(dispatched), raising=False)

        r1 = await async_client.post("/api/codex/generate")
        r2 = await async_client.post("/api/codex/generate")
        assert r1.json()["id"] != r2.json()["id"]
        assert len(dispatched) == 2

        r3 = await async_client.post("/api/codex/generate")
        assert r3.status_code == 202
        # r2 is the newer edition; the cap-hit path serves the newest in-flight row.
        assert r3.json()["id"] == r2.json()["id"]
        assert len(dispatched) == 2

    async def test_basic_monthly_cap_uses_server_clock(
        self, async_client: AsyncClient, test_user: Profile, db_session: AsyncSession, monkeypatch
    ):
        """Basic: 3 COMPLETED this calendar month (server clock) -> a 4th is refused even
        though each is well outside the rolling window."""
        from app.core.resource_limits import CODEX_QUOTA_WINDOW_HOURS
        from app.crud import codex as crud_codex

        for i in range(3):
            d = await crud_codex.create_pending_digest(db_session, test_user.id, datetime.now(timezone.utc).date())
            await crud_codex.finalize_digest(db_session, d.id, CodexDigestStatus.COMPLETED, payload={})
            await _backdate_requested_at(db_session, d.id, hours_ago=CODEX_QUOTA_WINDOW_HOURS + 24 * (i + 1))
        await db_session.commit()

        dispatched: list[tuple] = []
        monkeypatch.setattr(generate_codex_digest_task, "kiq", _fake_kiq_recorder(dispatched), raising=False)

        resp = await async_client.post("/api/codex/generate")
        assert resp.status_code == 202
        body = resp.json()
        assert body["entitled"] is False
        assert body["error_code"] == "CODEX_LIMIT_EXCEEDED"
        assert len(dispatched) == 0

    async def test_admin_is_unlimited(
        self, async_admin_client: AsyncClient, admin_user: Profile, db_session: AsyncSession, monkeypatch
    ):
        from app.crud import codex as crud_codex

        for _ in range(5):
            d = await crud_codex.create_pending_digest(db_session, admin_user.id, datetime.now(timezone.utc).date())
            await crud_codex.finalize_digest(db_session, d.id, CodexDigestStatus.COMPLETED, payload={})
        await db_session.commit()

        monkeypatch.setattr(generate_codex_digest_task, "kiq", _fake_kiq_recorder([]), raising=False)

        resp = await async_admin_client.post("/api/codex/generate")
        assert resp.status_code == 202
        assert resp.json()["status"] == "pending"
