"""Complex business logic for bulk article operations."""

from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ArticleContent, FeedArticle
from app.schemas import ArticleCreate
from app.utils.text import get_content_hash, get_guid_hash


# Note: guid column removed from FeedArticle - we only store guid_hash now
# This saves ~1KB per article and simplifies deduplication


async def create_articles_batch(db: AsyncSession, *, articles_data: list[ArticleCreate]) -> list[FeedArticle]:
    """Create multiple articles in batch using optimized bulk inserts."""
    if not articles_data:
        return []

    try:
        current_time = datetime.now(timezone.utc)

        content_mappings = []
        link_to_article: dict[str, ArticleCreate] = {}
        all_articles_by_link: dict[str, list[ArticleCreate]] = {}

        for article_in in articles_data:
            link_str = str(article_in.link)

            if link_str not in all_articles_by_link:
                all_articles_by_link[link_str] = []
            all_articles_by_link[link_str].append(article_in)

            if link_str not in link_to_article:
                content_mappings.append(
                    {
                        "title": article_in.title,
                        "link": link_str,
                        "content_hash": get_content_hash(link_str),
                        "description": article_in.content,
                        "content": article_in.content,
                        "author": article_in.author,
                        "published_at": article_in.published_at,
                        "image_url": str(article_in.image_url) if article_in.image_url else None,
                        "estimated_read_time_minutes": getattr(article_in, "estimated_read_time_minutes", None),
                        "created_at": current_time,
                    }
                )
                link_to_article[link_str] = article_in

        content_insert_stmt = pg_insert(ArticleContent).values(content_mappings)
        content_insert_stmt = content_insert_stmt.on_conflict_do_nothing(index_elements=["content_hash"]).returning(
            ArticleContent.id, ArticleContent.link
        )

        content_result = await db.execute(content_insert_stmt)
        content_rows = content_result.fetchall()

        returned_links = {row.link for row in content_rows}
        missing_links = [link for link in link_to_article.keys() if link not in returned_links]

        if missing_links:
            from sqlalchemy import select

            existing_content_result = await db.execute(
                select(ArticleContent.id, ArticleContent.link).where(ArticleContent.link.in_(missing_links))
            )
            existing_rows = existing_content_result.fetchall()
            content_rows = list(content_rows) + list(existing_rows)

        await db.flush()

        link_to_content_id = {row.link: row.id for row in content_rows}

        article_mappings = []
        for link_str, articles_list in all_articles_by_link.items():
            content_id = link_to_content_id.get(link_str)
            if content_id:
                for article_in in articles_list:
                    article_mappings.append(
                        {
                            "feed_id": article_in.feed_id,
                            "content_id": content_id,
                            "guid_hash": get_guid_hash(article_in.guid, fallback_link=link_str),
                            "published_at": article_in.published_at,
                            "created_at": current_time,
                        }
                    )

        if not article_mappings:
            return []

        article_insert_stmt = pg_insert(FeedArticle).values(article_mappings)
        article_returning_stmt = article_insert_stmt.on_conflict_do_nothing(
            index_elements=["feed_id", "guid_hash"]
        ).returning(
            FeedArticle.id,
            FeedArticle.feed_id,
            FeedArticle.guid_hash,
            FeedArticle.content_id,
            FeedArticle.published_at,
            FeedArticle.created_at,
        )

        result = await db.execute(article_returning_stmt)
        newly_inserted_articles_data = result.fetchall()

        created_articles_list = []
        for article_data_tuple in newly_inserted_articles_data:
            temp_article = FeedArticle(
                id=article_data_tuple[0],
                feed_id=article_data_tuple[1],
                guid_hash=article_data_tuple[2],
                content_id=article_data_tuple[3],
                published_at=article_data_tuple[4],
                created_at=article_data_tuple[5],
            )
            created_articles_list.append(temp_article)

        await db.flush()

        return created_articles_list

    except Exception:
        raise
