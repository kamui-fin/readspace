"""Central module for user actions - handles state management and user interactions."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.article import ArticleContent, FeedArticle, UserEntry
from app.models.feed import FeedSubscription
from app.typing.entries import EntryUpdate

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
    is_saved: bool | None = None,
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
    if is_saved is not None:
        insert_values["is_saved"] = is_saved
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
    article_in: EntryUpdate,
    user_id: UUID,
    is_clipped: bool = False,
) -> tuple[FeedArticle, UserEntry] | tuple[ArticleContent, UserEntry] | None:
    """
    Update article status - convenience wrapper that fetches article and updates state.

    Returns both the FeedArticle (or ArticleContent for clipped) and UserEntry for API responses.
    Uses atomic UPSERT internally via set_article_state().

    Args:
        is_clipped: If True, treat article_id as UserEntry.id for clipped articles
    """
    if is_clipped:
        # For clipped articles, article_id is the UserEntry.id
        user_entry_result = await db.execute(
            select(UserEntry)
            .options(
                selectinload(UserEntry.content).undefer(ArticleContent.description).undefer(ArticleContent.content),
            )
            .filter(UserEntry.id == article_id, UserEntry.user_id == user_id)
        )
        user_entry = user_entry_result.scalar_one_or_none()

        if not user_entry:
            return None

        # Extract update data
        update_data = article_in.model_dump(exclude_unset=True)

        # Update the user entry directly
        if update_data.get("is_read") is not None:
            user_entry.is_read = update_data["is_read"]
            if update_data["is_read"]:
                user_entry.read_at = datetime.now(timezone.utc)
            else:
                user_entry.read_at = None
        if update_data.get("is_saved") is not None:
            user_entry.is_saved = update_data["is_saved"]
        if update_data.get("priority") is not None:
            user_entry.priority = update_data["priority"]
        if update_data.get("user_note") is not None:
            user_entry.user_note = update_data["user_note"]
        if update_data.get("title") is not None:
            user_entry.content.title = update_data["title"]

        await db.flush()

        # Return ArticleContent and UserEntry for clipped articles
        return user_entry.content, user_entry
    else:
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
            is_saved=update_data.get("is_saved"),
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
):
    """
    Mark all articles as read by updating last_read_cutoff.

    Uses a single optimized query with a correlated subquery to avoid N+1 problem.
    Each subscription's cutoff is set to its own feed's most recent article timestamp.

    If feed_id is provided, updates only that subscription.
    If folder_id is provided, updates all subscriptions in that folder.
    Otherwise, updates all user's subscriptions.
    """
    # Define a correlated subquery that finds the max published_at for each feed
    # This runs once per row being updated, but all within a single SQL statement
    latest_article_subquery = (
        select(func.max(FeedArticle.published_at))
        .where(FeedArticle.feed_id == FeedSubscription.feed_id)
        .correlate(FeedSubscription)
        .scalar_subquery()
    )

    # Build the update statement
    stmt = update(FeedSubscription).where(FeedSubscription.user_id == user_id)

    # Apply filters based on context
    if feed_id:
        stmt = stmt.where(FeedSubscription.feed_id == feed_id)
    elif folder_id:
        stmt = stmt.where(FeedSubscription.folder_id == folder_id)

    # Set last_read_cutoff to the feed's most recent article, or now() if no articles
    stmt = stmt.values(last_read_cutoff=func.coalesce(latest_article_subquery, func.now()))

    # Execute the single query
    result = await db.execute(stmt)
    await db.flush()

    return result.rowcount or 0


async def delete_old_article_contents(db: AsyncSession, *, retention_days: int, min_articles_per_feed: int) -> int:
    """
    Delete old article_contents that are eligible for cleanup.

    IMPORTANT: This deletes article_contents (which cascade deletes feed_articles),
    not feed_articles directly. Deleting feed_articles would leave orphaned content.

    Eligibility criteria:
    - Published more than retention_days ago
    - Not in the top min_articles_per_feed newest articles for their feed
    - Not saved (no user_entries with is_saved=True)
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
                fa.published_at AS published_or_created,
                ROW_NUMBER() OVER (
                    PARTITION BY fa.feed_id
                    ORDER BY fa.published_at DESC
                ) AS rn
            FROM feed_articles fa
            JOIN article_contents ac ON fa.content_id = ac.id
        ),
        eligible_contents AS (
            SELECT ra.content_id
            FROM ranked_articles ra
            LEFT JOIN user_entries ue
                ON ue.content_id = ra.content_id
            WHERE ra.published_or_created < NOW() - MAKE_INTERVAL(days => :retention_days)
              AND ue.id IS NULL       -- no user entries (saved, clipped, or any interaction)
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

    return result.rowcount or 0
