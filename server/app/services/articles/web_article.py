import re
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import crud_article_content, crud_clipped_article
from app.schemas import (
    ArticleContentCreate,
    ClippedArticleCreate,
    ClippedArticleResponse,
)
from app.utils.reading_time import calculate_reading_time

logger = structlog.get_logger(__name__)


class WebArticleService:
    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id

    async def save_article_from_url(
        self,
        url: str,
        title: str | None = None,
        content: str | None = None,  # Extracted content from extension
        metadata: dict[str, Any] | None = None,
        # tag_ids removed - using ARRAY field on feeds
        note: str | None = None,
        priority: str | None = None,
    ) -> ClippedArticleResponse:
        """Save a web article with content provided by the extension."""

        if not content:
            raise ValueError("No content provided. Content must be extracted by the extension.")

        # First, check if we already have content extracted by the chrome extension for this URL
        existing_extracted_content = await crud_article_content.get_by_link_extracted_by_extension(self.db, link=url)

        if existing_extracted_content:
            # We have extension-extracted content, use it
            content_record = existing_extracted_content
            logger.info(
                "Found existing chrome extension extracted content",
                url=url,
                content_id=content_record.id,
                content_length=len(content_record.content or ""),
            )
        else:
            # No extension-extracted content exists, create new content from extension data
            logger.info(
                "Creating new article content from extension data",
                url=url,
                content_length=len(content),
                title=title,
            )

            # Parse published date from metadata if provided
            published_at = None
            if metadata and metadata.get("published_at"):
                published_override = metadata["published_at"]
                if isinstance(published_override, str):
                    published_at = self._parse_datetime_string(published_override)
                    logger.debug(
                        "Parsed metadata published_at",
                        original=published_override,
                        parsed=published_at,
                    )
                else:
                    published_at = published_override

            # Create new content with full extracted content
            content_create = ArticleContentCreate(
                title=title or "Untitled Article",
                link=str(url),
                description=metadata.get("description") if metadata else None,
                content=content,  # Full extracted HTML content
                author=metadata.get("author") if metadata else None,
                image_url=metadata.get("image_url") if metadata else None,
                published_at=published_at,
                estimated_read_time_minutes=self._calculate_reading_time(content),
                custom_metadata={
                    "extraction_timestamp": datetime.now(timezone.utc).isoformat(),
                    "source_url": url,
                    "extracted_by": "chrome_extension",  # Mark as extension-extracted
                    "content_length": len(content),
                    **(metadata or {}),
                },
            )

            logger.debug(
                "Creating ArticleContentCreate",
                title=content_create.title,
                published_at=content_create.published_at,
            )
            content_record = await crud_article_content.create(self.db, obj_in=content_create)

        # Now check if user already has this specific content clipped
        # Type ignore needed due to SQLAlchemy mypy plugin issue with UUID columns
        existing_clipped = await crud_clipped_article.get_by_user_and_content(
            self.db,
            user_id=self.user_id,
            content_id=content_record.id,  # type: ignore[arg-type]
        )
        if existing_clipped:
            # If article exists but is_read_later is false, update it to true (re-save)
            needs_update = False
            if not existing_clipped.is_read_later:
                existing_clipped.is_read_later = True
                needs_update = True
                logger.info(
                    "Re-saving article by setting is_read_later=True",
                    article_id=existing_clipped.id,
                    user_id=self.user_id,
                    url=url,
                )

            # Also update priority and note if provided
            if priority and existing_clipped.priority != priority:
                existing_clipped.priority = priority
                needs_update = True
            if note is not None and existing_clipped.note != note:
                existing_clipped.note = note
                needs_update = True

            if needs_update:
                await self.db.commit()
                await self.db.refresh(existing_clipped)
                logger.info(
                    "Article updated successfully",
                    article_id=existing_clipped.id,
                    is_read_later=existing_clipped.is_read_later,
                    priority=existing_clipped.priority,
                )
            else:
                logger.info(
                    "Article already clipped by user with no changes, returning existing",
                    article_id=existing_clipped.id,
                    user_id=self.user_id,
                    url=url,
                )

            # Return the existing (potentially updated) clipped article
            return ClippedArticleResponse.model_validate(existing_clipped)

        # Create clipped article with the extension-extracted content
        clipped_article_create = ClippedArticleCreate(
            user_id=self.user_id,
            content_id=content_record.id,
            priority=priority or "medium",
            note=note,
            is_read=False,
            is_favorite=priority == "high",  # High priority articles become favorites
        )

        # Save to database
        clipped_article = await crud_clipped_article.create(self.db, obj_in=clipped_article_create)

        # Load with content for response
        # Type ignore needed due to SQLAlchemy mypy plugin issue with UUID columns
        clipped_with_content = await crud_clipped_article.get_with_content(
            self.db,
            article_id=clipped_article.id,  # type: ignore[arg-type]
        )

        # Tags are now handled as ARRAY field on feeds - no association needed

        logger.info(
            "Web article clipped successfully",
            article_id=clipped_article.id,
            user_id=self.user_id,
            url=url,
            priority=priority,
        )

        return ClippedArticleResponse.model_validate(clipped_with_content)

    async def get_article_by_url(self, url: str) -> ClippedArticleResponse | None:
        """
        Get clipped article by URL for the current user.

        This method queries the database to check if a user has already saved
        an article with the given URL. It joins clipped_articles and article_contents
        tables to find the article by its link.

        Args:
            url: The URL of the article to check

        Returns:
            ClippedArticleResponse with full metadata if found, None otherwise
        """
        clipped_article = await crud_clipped_article.get_by_user_and_url(self.db, user_id=self.user_id, url=url)

        if not clipped_article:
            return None

        return ClippedArticleResponse.model_validate(clipped_article)

    def _parse_datetime_string(self, date_str: str) -> datetime | None:
        """Parse datetime string with various formats."""
        if not date_str:
            return None

        logger.debug("Parsing datetime string", date_str=date_str)

        try:
            # Handle ISO format with Z
            if date_str.endswith("Z"):
                result = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                logger.debug("Parsed ISO Z format", result=result)
                return result

            # Handle timezone with space separator like '2023-05-31 07:02:04 -0500'
            space_tz_pattern = r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{4}$"
            if re.match(space_tz_pattern, date_str):
                logger.debug("Matched space timezone pattern")
                # Convert space-separated timezone to colon format
                parts = date_str.rsplit(" ", 1)
                date_part = parts[0].replace(" ", "T")
                tz_part = parts[1]
                # Insert colon in timezone: -0500 -> -05:00
                tz_formatted = f"{tz_part[:3]}:{tz_part[3:]}"
                formatted_str = f"{date_part}{tz_formatted}"
                result = datetime.fromisoformat(formatted_str)
                logger.debug("Successfully parsed space timezone format", result=result)
                return result

            # Handle timezone with T separator like '2023-05-31T07:02:04-0500'
            t_tz_pattern = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{4}$"
            if re.match(t_tz_pattern, date_str):
                logger.debug("Matched T timezone pattern")
                if date_str[-5] in ["+", "-"]:
                    formatted_str = f"{date_str[:-2]}:{date_str[-2:]}"
                    result = datetime.fromisoformat(formatted_str)
                    logger.debug("Successfully parsed T timezone format", result=result)
                    return result

            # Try standard ISO format
            result = datetime.fromisoformat(date_str)
            logger.debug("Parsed standard ISO format", result=result)
            return result

        except ValueError:
            try:
                # Try parsing common formats with strptime
                formats = [
                    "%Y-%m-%d %H:%M:%S",
                    "%Y-%m-%dT%H:%M:%S",
                    "%Y-%m-%d",
                    "%Y/%m/%d %H:%M:%S",
                    "%Y/%m/%d",
                    "%d/%m/%Y %H:%M:%S",
                    "%d/%m/%Y",
                    "%m/%d/%Y %H:%M:%S",
                    "%m/%d/%Y",
                ]

                for fmt in formats:
                    try:
                        result = datetime.strptime(date_str, fmt).replace(tzinfo=timezone.utc)
                        logger.debug("Parsed with strptime", format=fmt, result=result)
                        return result
                    except ValueError:
                        continue

            except Exception as e:
                logger.debug("Failed to parse with strptime", error=str(e))

        logger.warning("Failed to parse datetime string", date_str=date_str)
        return None

    def _calculate_reading_time(self, content: str | None) -> int | None:
        """Calculate estimated reading time in minutes with CJK support."""
        if not content:
            return None

        return calculate_reading_time(content, default_wpm=230)
