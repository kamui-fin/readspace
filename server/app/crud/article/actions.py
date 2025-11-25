"""Central module for user actions - handles state management and user interactions."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.article import ArticleContent, FeedArticle, UserEntry
from app.models.feed import FeedSubscription
from app.typing.articles import ArticleUpdate

# ============================================================================
# USER ENTRY STATE MANAGEMENT
# ============================================================================


async def set_article_state(
    db: AsyncSession,
    *,
    user_id: UUID,
    content_id: UUID,
    feed_article_id: UUID | None = None,
    is_read: bool | None = None,
    is_read_later: bool | None = None,
    priority: str | None = None,
    user_note: str | None = None,
) -> UserEntry:
    """
    Atomic UPSERT for user article state.

    Uses PostgreSQL's INSERT ... ON CONFLICT to handle everything in one DB hit.
    This replaces the race-condition-prone check-then-act pattern.
    """
    # Prepare values for insert
    insert_values = {
        "user_id": user_id,
        "content_id": content_id,
        "feed_article_id": feed_article_id,
    }

    # Add optional fields
    if is_read is not None:
        insert_values["is_read"] = is_read
        if is_read:
            insert_values["read_at"] = datetime.now(timezone.utc)
    if is_read_later is not None:
        insert_values["is_read_later"] = is_read_later
    if priority is not None:
        insert_values["priority"] = priority
    if user_note is not None:
        insert_values["user_note"] = user_note

    # Prepare update values (exclude user_id, content_id)
    update_values = {k: v for k, v in insert_values.items() if k not in ("user_id", "content_id")}

    stmt = pg_insert(UserEntry).values(insert_values)
    stmt = stmt.on_conflict_do_update(index_elements=["user_id", "content_id"], set_=update_values).returning(UserEntry)

    result = await db.execute(stmt)
    user_entry = result.scalar_one()

    await db.flush()
    return user_entry


async def update_article_status(
    db: AsyncSession,
    *,
    article_id: UUID,
    article_in: ArticleUpdate,
    user_id: UUID,
) -> tuple[FeedArticle, UserEntry] | None:
    """
    Update article status - convenience wrapper that fetches article and updates state.

    Returns both the FeedArticle and UserEntry for API responses.
    Uses atomic UPSERT internally via set_article_state().
    """
    # Get the feed article
    feed_article_result = await db.execute(
        select(FeedArticle)
        .options(
            selectinload(FeedArticle.content).undefer(ArticleContent.description).undefer(ArticleContent.content),
            selectinload(FeedArticle.feed),
        )
        .filter(FeedArticle.id == article_id)
    )
    feed_article = feed_article_result.scalar_one_or_none()

    if not feed_article:
        return None

    # Extract update data
    update_data = article_in.model_dump(exclude_unset=True)

    # Use the atomic upsert function
    user_entry = await set_article_state(
        db,
        user_id=user_id,
        content_id=feed_article.content_id,
        feed_article_id=article_id,
        is_read=update_data.get("is_read"),
        is_read_later=update_data.get("is_read_later"),
        priority=update_data.get("priority"),
        user_note=update_data.get("user_note"),
    )

    return feed_article, user_entry


async def mark_all_as_read(
    db: AsyncSession,
    *,
    user_id: UUID,
    feed_id: UUID | None = None,
    folder_id: UUID | None = None,
) -> int:
    """
    Mark all articles as read by updating last_read_cutoff.

    This is the efficient way - no need to create individual user_entries.
    Uses a single UPDATE query to avoid N+1 problem.

    If feed_id is provided, uses the most recent article's published_at timestamp
    as the cutoff. Otherwise uses current time.
    """
    # Get the most recent article's published_at timestamp for this feed
    if feed_id:
        result = await db.execute(
            select(func.max(ArticleContent.published_at))
            .join(FeedArticle, FeedArticle.content_id == ArticleContent.id)
            .where(FeedArticle.feed_id == feed_id)
        )
        max_published_at = result.scalar_one_or_none()
        cutoff_time = max_published_at if max_published_at else datetime.now(timezone.utc)
    else:
        cutoff_time = datetime.now(timezone.utc)

    stmt = update(FeedSubscription).where(FeedSubscription.user_id == user_id).values(last_read_cutoff=cutoff_time)

    if feed_id:
        stmt = stmt.where(FeedSubscription.feed_id == feed_id)
    if folder_id:
        stmt = stmt.where(FeedSubscription.folder_id == folder_id)

    result = await db.execute(stmt)
    await db.flush()

    return result.rowcount


async def delete_old_article_contents(db: AsyncSession, *, retention_days: int, min_articles_per_feed: int) -> int:
    """
    Delete old article_contents that are eligible for cleanup.

    IMPORTANT: This deletes article_contents (which cascade deletes feed_articles),
    not feed_articles directly. Deleting feed_articles would leave orphaned content.

    Eligibility criteria:
    - Published more than retention_days ago
    - Not in the top min_articles_per_feed newest articles for their feed
    - Not saved (no user_article_states with is_read_later=True)
    - Not clipped (no clipped_articles entry)

    Args:
        db: Database session
        retention_days: Minimum age in days for articles to be eligible for deletion
        min_articles_per_feed: Minimum number of newest articles to keep per feed

    Returns:
        Number of article_contents deleted
    """
    from sqlalchemy import text

    # Set timeout first (must be separate statement for asyncpg)
    await db.execute(text("SET LOCAL statement_timeout = '120min'"))

    # Execute the deletion query
    deletion_query = text(
        """
        WITH ranked_articles AS (
            SELECT
                ac.id AS content_id,
                fa.feed_id,
                ac.published_at AS published_or_created,
                ROW_NUMBER() OVER (
                    PARTITION BY fa.feed_id
                    ORDER BY ac.published_at DESC
                ) AS rn
            FROM feed_articles fa
            JOIN article_contents ac ON fa.content_id = ac.id
        ),
        eligible_contents AS (
            SELECT ra.content_id
            FROM ranked_articles ra
            LEFT JOIN user_article_states uas
                ON uas.article_id = (
                    SELECT fa2.id FROM feed_articles fa2 WHERE fa2.content_id = ra.content_id LIMIT 1
                )
                AND uas.is_read_later = TRUE
            LEFT JOIN clipped_articles ca
                ON ca.content_id = ra.content_id
            WHERE ra.published_or_created < NOW() - MAKE_INTERVAL(days => :retention_days)
              AND uas.id IS NULL       -- no saved states
              AND ca.id IS NULL        -- not clipped
              AND ra.rn > :min_articles -- not in top N newest
        )
        DELETE FROM article_contents
        WHERE id IN (SELECT content_id FROM eligible_contents)
        """
    )

    result = await db.execute(
        deletion_query,
        {
            "retention_days": retention_days,
            "min_articles": min_articles_per_feed,
        },
    )
    await db.flush()

    return result.rowcount
