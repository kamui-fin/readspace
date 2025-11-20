"""Complex business logic for bulk article operations."""

from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ArticleContent, FeedArticle
from app.schemas import ArticleCreate


async def create_articles_batch(db: AsyncSession, *, articles_data: list[ArticleCreate]) -> list[FeedArticle]:
    """Create multiple articles in batch using optimized bulk inserts.

    This method uses true bulk operations with PostgreSQL's INSERT ... ON CONFLICT
    to efficiently handle large batches of articles. It:
    1. Bulk upserts article_contents by link (gets IDs for both new and existing)
    2. Bulk inserts feed_articles with ON CONFLICT DO NOTHING

    Note: This method no longer creates UserArticleState entries.
    States are created lazily when users interact with articles.
    """
    if not articles_data:
        return []

    try:
        current_time = datetime.now(timezone.utc)

        # Step 1: Prepare article_contents mappings, deduplicating by link
        # When multiple articles have the same link, keep the first one for content
        # but track ALL articles for feed_articles creation
        content_mappings = []
        link_to_article: dict[str, ArticleCreate] = {}
        all_articles_by_link: dict[str, list[ArticleCreate]] = {}

        for article_in in articles_data:
            link_str = str(article_in.link)

            # Track all articles for this link
            if link_str not in all_articles_by_link:
                all_articles_by_link[link_str] = []
            all_articles_by_link[link_str].append(article_in)

            # Only add content mapping once per unique link
            if link_str not in link_to_article:
                content_mappings.append(
                    {
                        "title": article_in.title,
                        "link": link_str,
                        "description": article_in.content,
                        "content": article_in.content,
                        "author": article_in.author,
                        "published_at": article_in.published_at,
                        "image_url": str(article_in.image_url) if article_in.image_url else None,
                        "estimated_read_time_minutes": getattr(article_in, "estimated_read_time_minutes", None),
                        "created_at": current_time,
                        "updated_at": current_time,
                    }
                )
                link_to_article[link_str] = article_in

        # Step 2: Bulk upsert article_contents using ON CONFLICT DO UPDATE pattern
        # This returns IDs for BOTH newly inserted AND existing content
        # (following the pattern from folder.py for consistent behavior)
        content_insert_stmt = pg_insert(ArticleContent).values(content_mappings)
        content_insert_stmt = content_insert_stmt.on_conflict_do_update(
            index_elements=["link"],
            set_={"updated_at": current_time},  # Touch updated_at to trigger RETURNING
        ).returning(ArticleContent.id, ArticleContent.link)

        content_result = await db.execute(content_insert_stmt)
        content_rows = content_result.fetchall()
        await db.flush()

        # Step 3: Build link -> content_id mapping
        link_to_content_id = {row.link: row.id for row in content_rows}

        # Step 4: Prepare feed_articles mappings using the content IDs
        # Create a feed_article for EACH article, even if they share the same link/content
        article_mappings = []
        for link_str, articles_list in all_articles_by_link.items():
            content_id = link_to_content_id.get(link_str)
            if content_id:  # Should always exist after upsert
                # Create a feed_article entry for each article with this link
                for article_in in articles_list:
                    article_mappings.append(
                        {
                            "feed_id": article_in.feed_id,
                            "content_id": content_id,
                            "guid": article_in.guid,
                            "created_at": current_time,
                            "updated_at": current_time,
                        }
                    )

        if not article_mappings:
            return []

        # Step 5: Bulk insert feed_articles with ON CONFLICT DO NOTHING
        # Only newly created articles are returned (duplicates are silently skipped)
        article_insert_stmt = pg_insert(FeedArticle).values(article_mappings)
        article_returning_stmt = article_insert_stmt.on_conflict_do_nothing(
            index_elements=["feed_id", "guid"]
        ).returning(
            FeedArticle.id,
            FeedArticle.feed_id,
            FeedArticle.guid,
            FeedArticle.content_id,
            FeedArticle.created_at,
            FeedArticle.updated_at,
        )

        result = await db.execute(article_returning_stmt)
        newly_inserted_articles_data = result.fetchall()

        # Step 6: Reconstruct FeedArticle objects from returned data
        created_articles_list = []
        for article_data_tuple in newly_inserted_articles_data:
            temp_article = FeedArticle(
                id=article_data_tuple[0],
                feed_id=article_data_tuple[1],
                guid=article_data_tuple[2],
                content_id=article_data_tuple[3],
                created_at=article_data_tuple[4],
                updated_at=article_data_tuple[5],
            )
            created_articles_list.append(temp_article)

        # Note: Commit is handled by the dependency injection layer (get_db)
        await db.flush()  # Ensure changes are flushed to get IDs

        return created_articles_list

    except Exception:
        # Note: Rollback is handled automatically by get_db() dependency
        # Re-raising exception for proper error handling upstream
        raise
