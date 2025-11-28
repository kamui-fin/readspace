"""OPML import progress tracking utilities."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

import orjson
import redis.asyncio as aioredis
import structlog

from app.core.constants import OPML_IMPORT_TASK_TTL_SECONDS
from app.core.redis_cache import get_pool
from app.typing.common import ImportStatus
from app.typing.opml import FeedImportError, OpmlImportState

logger = structlog.get_logger(__name__)


class OpmlImportTracker:
    """Encapsulates Redis state management for OPML tasks."""

    def __init__(self, task_id: str):
        self.task_id = task_id
        self.pool = get_pool()
        self._ttl = OPML_IMPORT_TASK_TTL_SECONDS

    @property
    def key_base(self) -> str:
        return f"opml_import:{self.task_id}"

    @property
    def key_meta(self) -> str:
        return f"{self.key_base}:meta"

    @property
    def key_counters(self) -> str:
        return f"{self.key_base}:counters"

    @property
    def key_errors(self) -> str:
        return f"{self.key_base}:errors"

    @property
    def key_cancel(self) -> str:
        return f"{self.key_base}:cancel"

    @asynccontextmanager
    async def _client(self) -> AsyncIterator[aioredis.Redis]:
        async with aioredis.Redis(connection_pool=self.pool) as client:
            yield client

    def _to_int(self, value: Any) -> int:
        """Safely convert Redis byte/string/none response to int."""
        if value is None:
            return 0
        if isinstance(value, bytes):
            return int(value.decode())
        return int(value)

    async def initialize(
        self,
        user_id: str,
        filename: str,
        total_feeds: int,
        opml_title: str | None = None,
        opml_author: str | None = None,
    ) -> OpmlImportState:
        """Sets up initial state with parsed OPML metadata."""
        state = OpmlImportState(
            task_id=self.task_id,
            user_id=user_id,
            filename=filename,
            opml_title=opml_title,
            opml_author=opml_author,
            total=total_feeds,
            status=ImportStatus.PENDING,
            created_at=datetime.now(timezone.utc).isoformat(),
            completed=0,
            successful=0,
            failed=0,
            already_existed=0,
            skipped_limit=0,
            cancelled_count=0,
            errors=[],
        )

        meta_data = {
            "task_id": self.task_id,
            "user_id": user_id,
            "filename": filename,
            "opml_title": opml_title,
            "opml_author": opml_author,
            "total": total_feeds,
            "status": ImportStatus.PENDING.value,
            "created_at": state.created_at,
        }

        async with self._client() as r:
            async with r.pipeline() as pipe:
                pipe.setex(self.key_meta, self._ttl, orjson.dumps(meta_data))
                pipe.hset(
                    self.key_counters,
                    mapping=dict.fromkeys(
                        ["completed", "successful", "failed", "already_existed", "skipped_limit", "cancelled_count"], 0
                    ),
                )
                pipe.expire(self.key_counters, self._ttl)
                await pipe.execute()

        return state

    async def get_state(self) -> OpmlImportState | None:
        """Reconstruct full state from Redis."""
        async with self._client() as r:
            async with r.pipeline() as pipe:
                pipe.get(self.key_meta)
                pipe.hgetall(self.key_counters)
                pipe.lrange(self.key_errors, 0, -1)
                meta_raw, counters_raw, errors_raw = await pipe.execute()

        if not meta_raw:
            return None

        meta = orjson.loads(meta_raw)
        counters = {k.decode(): int(v) for k, v in counters_raw.items()} if counters_raw else {}
        errors = [FeedImportError(**orjson.loads(e)) for e in errors_raw] if errors_raw else []

        return OpmlImportState(
            **meta,
            completed=counters.get("completed", 0),
            successful=counters.get("successful", 0),
            failed=counters.get("failed", 0),
            already_existed=counters.get("already_existed", 0),
            skipped_limit=counters.get("skipped_limit", 0),
            cancelled_count=counters.get("cancelled_count", 0),
            errors=errors,
        )

    async def cancel(self) -> None:
        """Sets the cancellation flag (lightweight)."""
        async with self._client() as r:
            await r.setex(self.key_cancel, self._ttl, "1")

    async def mark_cancelled(self) -> None:
        """
        Finalizes the metadata state as Cancelled.
        Updates the JSON blob atomically so the UI sees the stopped state.
        """
        async with self._client() as r:
            meta_raw = await r.get(self.key_meta)
            if not meta_raw:
                return

            # Read current counters to give an accurate final report
            counters_raw = await r.hgetall(self.key_counters)
            counters = {k.decode(): int(v) for k, v in counters_raw.items()}

            completed = counters.get("completed", 0)

            meta = orjson.loads(meta_raw)
            meta["status"] = ImportStatus.CANCELLED.value
            meta["completed_at"] = datetime.now(timezone.utc).isoformat()
            meta["message"] = f"Import cancelled. {completed} of {meta['total']} feeds processed."

            await r.setex(self.key_meta, self._ttl, orjson.dumps(meta))

    async def is_cancelled(self) -> bool:
        async with self._client() as r:
            return bool(await r.exists(self.key_cancel))

    async def mark_success(self, already_exists: bool = False) -> None:
        field = "already_existed" if already_exists else "successful"
        await self._increment_stats(field)

    async def mark_failure(self, error: FeedImportError) -> None:
        async with self._client() as r:
            async with r.pipeline() as pipe:
                pipe.hincrby(self.key_counters, "failed", 1)
                pipe.hincrby(self.key_counters, "completed", 1)
                pipe.rpush(self.key_errors, error.model_dump_json())
                pipe.expire(self.key_counters, self._ttl)
                pipe.expire(self.key_errors, self._ttl)
                results = await pipe.execute()
                await self._check_completion(new_completed_count=results[1])

    async def _increment_stats(self, field: str) -> None:
        async with self._client() as r:
            async with r.pipeline() as pipe:
                pipe.hincrby(self.key_counters, field, 1)
                pipe.hincrby(self.key_counters, "completed", 1)
                pipe.expire(self.key_counters, self._ttl)
                results = await pipe.execute()
                await self._check_completion(new_completed_count=results[1])

    async def _check_completion(self, new_completed_count: int) -> None:
        """Atomic check if import is finished."""
        async with self._client() as r:
            meta_raw = await r.get(self.key_meta)
            if not meta_raw:
                return

            meta = orjson.loads(meta_raw)
            if new_completed_count >= meta["total"] and meta.get("status") == ImportStatus.IN_PROGRESS.value:
                await self._finalize_import(meta, r)

    async def _finalize_import(self, meta: dict, r: aioredis.Redis) -> None:
        counters_raw = await r.hgetall(self.key_counters)
        counters = {k.decode(): int(v) for k, v in counters_raw.items()}

        msg_parts = [f"{counters.get('successful', 0)} added", f"{counters.get('already_existed', 0)} existed"]
        if failed := counters.get("failed", 0):
            msg_parts.append(f"{failed} failed")

        meta.update(
            {
                "status": ImportStatus.COMPLETED.value,
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "message": ". ".join(msg_parts),
            }
        )

        await r.setex(self.key_meta, self._ttl, orjson.dumps(meta))
