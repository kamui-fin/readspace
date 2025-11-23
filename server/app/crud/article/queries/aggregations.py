"""Complex aggregation queries for articles using optimized raw SQL."""

import time
from datetime import datetime, timedelta, timezone
from uuid import UUID

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger(__name__)


async def get_all_unread_counts(db: AsyncSession, *, user_id: UUID) -> dict[str, int]:
    """
    Get all unread counts in a single optimized query.

    Returns a dict with:
    - total_unread: int - count of unread articles (feed + clipped)
    - read_later_count: int - ALL articles with is_read_later=TRUE (regardless of read status)
    - today_count: int - unread articles from last 24 hours

    Optimization notes:
    - Uses COALESCE to eliminate OR conditions for better index usage
    - No longer calculates per-folder counts (frontend calculates from per-feed counts)
    """
    now_utc = datetime.now(timezone.utc)
    twenty_four_hours_ago = now_utc - timedelta(hours=24)

    # Optimized query using COALESCE pattern for SARGable queries
    query = text("""
        WITH feed_unreads AS (
            SELECT
                COUNT(*) as feed_unread_count,
                COUNT(*) FILTER (
                    WHERE ac.published_at >= :twenty_four_hours_ago
                      AND ac.published_at <= :now_utc
                ) as feed_today_count
            FROM feed_articles fa
            INNER JOIN feed_subscriptions fs ON fa.feed_id = fs.feed_id
            INNER JOIN article_contents ac ON fa.content_id = ac.id
            LEFT JOIN user_article_states uas
                ON uas.article_id = fa.id AND uas.user_id = :user_id
            WHERE fs.user_id = :user_id
              AND COALESCE(uas.is_read, FALSE) = FALSE
              AND ac.published_at > COALESCE(fs.last_read_cutoff, '1970-01-01'::timestamptz)
        ),
        clipped_counts AS (
            SELECT
                COUNT(*) FILTER (
                    WHERE COALESCE(ca.is_read, FALSE) = FALSE
                ) as clipped_unread_count,
                COUNT(*) FILTER (
                    WHERE COALESCE(ca.is_read, FALSE) = FALSE
                      AND ac.published_at >= :twenty_four_hours_ago
                      AND ac.published_at <= :now_utc
                ) as clipped_today_count
            FROM clipped_articles ca
            INNER JOIN article_contents ac ON ca.content_id = ac.id
            WHERE ca.user_id = :user_id
        ),
        read_later_counts AS (
            SELECT COUNT(*) as read_later_count FROM (
                SELECT fa.id
                FROM feed_articles fa
                INNER JOIN feed_subscriptions fs ON fa.feed_id = fs.feed_id
                INNER JOIN user_article_states uas
                    ON uas.article_id = fa.id AND uas.user_id = :user_id
                WHERE fs.user_id = :user_id AND uas.is_read_later = TRUE

                UNION ALL

                SELECT ca.id
                FROM clipped_articles ca
                WHERE ca.user_id = :user_id AND ca.is_read_later = TRUE
            ) all_read_later
        )
        SELECT
            COALESCE(fu.feed_unread_count, 0) + COALESCE(cc.clipped_unread_count, 0) as total_unread,
            COALESCE(fu.feed_today_count, 0) + COALESCE(cc.clipped_today_count, 0) as today_count,
            COALESCE(rl.read_later_count, 0) as read_later_count
        FROM feed_unreads fu
        CROSS JOIN clipped_counts cc
        CROSS JOIN read_later_counts rl
    """)

    # Track query execution time for performance monitoring
    start_time = time.perf_counter()

    logger.info("get_all_unread_counts: Starting query execution", user_id=str(user_id))

    result = await db.execute(
        query,
        {
            "user_id": user_id,
            "twenty_four_hours_ago": twenty_four_hours_ago,
            "now_utc": now_utc,
        },
    )

    execute_time_ms = (time.perf_counter() - start_time) * 1000
    logger.info("get_all_unread_counts: Query executed", duration_ms=round(execute_time_ms, 2))

    fetch_start = time.perf_counter()
    row = result.fetchone()
    fetch_time_ms = (time.perf_counter() - fetch_start) * 1000

    execution_time_ms = (time.perf_counter() - start_time) * 1000

    logger.info(
        "get_all_unread_counts: Query complete",
        user_id=str(user_id),
        execution_time_ms=round(execution_time_ms, 2),
        fetch_time_ms=round(fetch_time_ms, 2),
    )

    # Extract counts from single result row
    if row:
        total_unread = row.total_unread or 0
        today_count = row.today_count or 0
        read_later_count = row.read_later_count or 0
    else:
        total_unread = 0
        today_count = 0
        read_later_count = 0

    logger.debug(
        "Aggregated unread counts",
        user_id=str(user_id),
        total_unread=total_unread,
        read_later_count=read_later_count,
        today_count=today_count,
    )

    return {
        "total_unread": total_unread,
        "read_later_count": read_later_count,
        "today_count": today_count,
    }
