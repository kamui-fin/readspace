"""
OPML import progress tracking utilities.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncIterator

import orjson
import redis.asyncio as aioredis  # Fixed import alias
import structlog

from app.core.config import get_settings
from app.core.constants import OPML_IMPORT_TASK_TTL_SECONDS
from app.core.redis_cache import get_pool
from app.typing.common import ImportStatus
from app.typing.opml import FeedImportError, OpmlImportState

logger = structlog.get_logger(__name__)

class OpmlImportTracker:
    """
    Encapsulates state management for a specific OPML import task.
    """

    def __init__(self, task_id: str):
        self.task_id = task_id
        self.pool = get_pool()
        self._ttl = OPML_IMPORT_TASK_TTL_SECONDS

    # --- Key Management ---
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

    # --- Context Helper ---
    @asynccontextmanager
    async def _client(self) -> AsyncIterator[aioredis.Redis]:
        """Provides a Redis client from the pool."""
        async with aioredis.Redis(connection_pool=self.pool) as client:
            yield client

    # --- Public API ---

    async def initialize(self, user_id: str, filename: str, total_feeds: int) -> OpmlImportState:
        """Sets up the initial state and zeroed counters."""
        state = OpmlImportState(
            task_id=self.task_id,
            user_id=user_id,
            filename=filename,
            total=total_feeds,
            status=ImportStatus.PENDING,
            completed=0,
            successful=0,
            failed=0,
            already_existed=0,
            skipped_limit=0,
            cancelled_count=0,
            errors=[],
        )

        # Store static metadata
        meta_data = {
            "task_id": self.task_id,
            "user_id": user_id,
            "filename": filename,
            "total": total_feeds,
            "status": ImportStatus.PENDING.value,
            "created_at": state.created_at,
        }

        async with self._client() as r:
            async with r.pipeline() as pipe:
                # 1. Set Metadata
                pipe.setex(self.key_meta, self._ttl, orjson.dumps(meta_data))
                
                # 2. Init Counters
                pipe.hset(
                    self.key_counters,
                    mapping={
                        "completed": 0,
                        "successful": 0,
                        "failed": 0,
                        "already_existed": 0,
                        "skipped_limit": 0,
                        "cancelled_count": 0,
                    },
                )
                pipe.expire(self.key_counters, self._ttl)
                await pipe.execute()

        logger.info("Initialized import", task_id=self.task_id, user=user_id, total=total_feeds)
        return state

    async def get_state(self) -> OpmlImportState | None:
        """Retrieves the full reconstructed state."""
        async with self._client() as r:
            # Fetch everything in parallel
            meta_raw, counters, errors_raw = await r.mget(self.key_meta), await r.hgetall(self.key_counters), await r.lrange(self.key_errors, 0, -1)
            
            # Since mget returns a list for the first item, we need to handle the structure
            # Wait, mget is for standard keys. We need distinct calls or a pipeline.
            # Let's use a pipeline for reading to reduce latency.
            async with r.pipeline() as pipe:
                pipe.get(self.key_meta)
                pipe.hgetall(self.key_counters)
                pipe.lrange(self.key_errors, 0, -1)
                meta_raw, counters, errors_raw = await pipe.execute()

        if not meta_raw:
            return None

        meta = orjson.loads(meta_raw)
        
        # Parse Errors
        errors = [FeedImportError(**orjson.loads(e)) for e in errors_raw] if errors_raw else []

        return OpmlImportState(
            **meta, # Unpacks task_id, user_id, filename, status, total, timestamps
            completed=int(counters.get("completed", 0)),
            successful=int(counters.get("successful", 0)),
            failed=int(counters.get("failed", 0)),
            already_existed=int(counters.get("already_existed", 0)),
            skipped_limit=int(counters.get("skipped_limit", 0)),
            cancelled_count=int(counters.get("cancelled_count", 0)),
            errors=errors,
        )

    async def cancel(self) -> None:
        """Sets the cancellation flag."""
        async with self._client() as r:
            await r.setex(self.key_cancel, self._ttl, "1")
        logger.info("Import cancelled", task_id=self.task_id)

    async def is_cancelled(self) -> bool:
        async with self._client() as r:
            return bool(await r.exists(self.key_cancel))

    # --- Atomic Updates ---

    async def mark_success(self, already_exists: bool = False) -> None:
        """Increments success (or existed) counter."""
        field = "already_existed" if already_exists else "successful"
        await self._increment_stats(field)

    async def mark_skipped(self) -> None:
        """Increments skipped counter."""
        await self._increment_stats("skipped_limit")

    async def mark_failure(self, error: FeedImportError) -> None:
        """Increments failed counter and pushes error details."""
        async with self._client() as r:
            async with r.pipeline() as pipe:
                pipe.hincrby(self.key_counters, "failed", 1)
                pipe.hincrby(self.key_counters, "completed", 1)
                pipe.rpush(self.key_errors, error.model_dump_json())
                # Refresh TTLs
                pipe.expire(self.key_counters, self._ttl)
                pipe.expire(self.key_errors, self._ttl)
                results = await pipe.execute()
                
                # Check for completion using the new 'completed' value
                # results[1] is the result of the second command (hincrby completed)
                await self._check_completion(new_completed_count=results[1])

    async def _increment_stats(self, field: str) -> None:
        """Helper to atomically update counters."""
        async with self._client() as r:
            async with r.pipeline() as pipe:
                pipe.hincrby(self.key_counters, field, 1)
                pipe.hincrby(self.key_counters, "completed", 1)
                pipe.expire(self.key_counters, self._ttl)
                results = await pipe.execute()
                
                # results[1] is the new 'completed' value
                await self._check_completion(new_completed_count=results[1])

    # --- Internal Logic ---

    async def _check_completion(self, new_completed_count: int) -> None:
        """
        Checks if the import is finished based on the atomic counter result.
        If finished, updates the metadata status to COMPLETED.
        """
        # We need the 'total' to compare. 
        # Optimization: Pass 'total' into the class init if it's immutable, 
        # otherwise we have to fetch it. Fetching is safer.
        
        async with self._client() as r:
            meta_raw = await r.get(self.key_meta)
            if not meta_raw:
                return
            
            meta = orjson.loads(meta_raw)
            total = meta["total"]
            current_status = meta.get("status")

            if new_completed_count >= total and current_status == ImportStatus.IN_PROGRESS.value:
                await self._finalize_import(meta, r)

    async def _finalize_import(self, meta: dict, r: aioredis.Redis) -> None:
        """Calculates final stats string and sets status to COMPLETED."""
        counters = await r.hgetall(self.key_counters)
        
        successful = int(counters.get("successful", 0))
        failed = int(counters.get("failed", 0))
        existed = int(counters.get("already_existed", 0))
        skipped = int(counters.get("skipped_limit", 0))
        
        msg = f"{successful} feeds added. {existed} already existed."
        if failed: msg += f" {failed} failed."
        if skipped: msg += f" {skipped} skipped (limit)."

        meta["status"] = ImportStatus.COMPLETED.value
        meta["completed_at"] = datetime.now(timezone.utc).isoformat()
        meta["message"] = msg
        
        await r.setex(self.key_meta, self._ttl, orjson.dumps(meta))
        logger.info("Import auto-completed", task_id=self.task_id)