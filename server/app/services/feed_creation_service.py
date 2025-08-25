"""Service for creating new RSS/Atom feeds."""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import feedparser
import structlog
from sqlalchemy.exc import IntegrityError

from app.crud import crud_feed, crud_folder
from app.crud.crud_article import create_articles_batch
from app.models.rss_models import Tag
from app.schemas.rss_schemas import ArticleCreate, FeedCreate, FeedResponse, FeedUpdate
from app.services.base_feed_service import BaseFeedService

logger = structlog.get_logger(__name__)


class FeedCreationService(BaseFeedService):
    """Service responsible for creating new feeds."""

    async def add_new_feed(
        self,
        url: str,
        folder_id: UUID,
        tag_names: list[str] | None = None,
        update_existing: bool = False,
    ) -> FeedResponse:
        """Adds a new feed by URL, parses it, and stores initial articles.

        Args:
            url: Feed URL to add
            folder_id: Folder to place the feed in
            tag_names: Optional list of tag names to associate
            update_existing: If True, update existing feed's folder/tags instead of raising error
        """
        logger.info(
            "Attempting to add new feed",
            url=url,
            folder_id=folder_id,
            user_id=self.user_id,
            update_existing=update_existing,
        )

        # Check if feed already exists
        existing_feed = await crud_feed.get_feed_by_url(
            self.db, url=url, user_id=self.user_id
        )
        if existing_feed:
            return await self._handle_existing_feed(
                existing_feed, url, folder_id, tag_names, update_existing
            )

        # Validate folder exists
        await self._validate_folder(folder_id)

        # Fetch and parse feed
        parsed_feed = await self._fetch_and_parse_feed(url)

        # Create the feed
        return await self._create_new_feed(url, folder_id, tag_names, parsed_feed)

    async def _handle_existing_feed(
        self,
        existing_feed: Any,
        url: str,
        folder_id: UUID,
        tag_names: list[str] | None,
        update_existing: bool,
    ) -> FeedResponse:
        """Handle case where feed already exists."""
        logger.info(
            "Feed URL already exists for user",
            url=url,
            user_id=self.user_id,
            existing_feed_id=existing_feed.id,
        )

        if not update_existing:
            raise ValueError(f"Feed with URL '{url}' already exists.")

        # Validate target folder
        await self._validate_folder(folder_id)

        # Prepare tags
        db_tags = await self._get_or_create_tags(tag_names) if tag_names else []

        # Update existing feed
        feed_update = FeedUpdate(
            folder_id=folder_id,
            tag_ids=[t.id for t in db_tags] if db_tags else [],
        )

        updated_feed = await crud_feed.update_feed(
            self.db, feed_db=existing_feed, feed_in=feed_update
        )
        logger.info(
            "Successfully updated existing feed",
            url=url,
            user_id=self.user_id,
            feed_id=updated_feed.id,
        )
        return FeedResponse.model_validate(updated_feed)

    async def _validate_folder(self, folder_id: UUID) -> None:
        """Validate that folder exists and belongs to user."""
        folder = await crud_folder.get_folder(
            self.db, folder_id=folder_id, user_id=self.user_id
        )
        if not folder:
            logger.warning(
                "Folder not found or does not belong to user",
                folder_id=folder_id,
                user_id=self.user_id,
            )
            raise ValueError(
                f"Folder with ID '{folder_id}' not found or access denied."
            )

    async def _fetch_and_parse_feed(self, url: str) -> feedparser.FeedParserDict:
        """Fetch feed content and parse it."""
        try:
            # Fetch content using parent class method
            fetch_result = await self._fetch_feed_content(url)
            if fetch_result["status"] != 200 or not fetch_result["content"]:
                logger.error(
                    "Failed to fetch content for new feed",
                    url=url,
                    status=fetch_result.get("status"),
                )
                raise ValueError("Could not fetch feed content.")

            # Parse content using parent class method
            parsed_feed = self._parse_feed_data(fetch_result["content"], url)
            return parsed_feed

        except ConnectionError as e:
            logger.error("Connection error adding new feed", url=url, error=str(e))
            raise
        except ValueError as e:
            logger.error("Parsing error adding new feed", url=url, error=str(e))
            raise

    async def _create_new_feed(
        self,
        url: str,
        folder_id: UUID,
        tag_names: list[str] | None,
        parsed_feed: feedparser.FeedParserDict,
    ) -> FeedResponse:
        """Create a new feed with articles."""
        # Extract feed metadata
        initial_feed_data = self._extract_feed_metadata(parsed_feed, url)

        # Prepare tags
        db_tags = await self._get_or_create_tags(tag_names) if tag_names else []

        # Create feed in database
        db_feed = await self._create_feed_db_entry(
            url, folder_id, db_tags, initial_feed_data
        )

        # Extract and create articles
        latest_article_date = await self._create_initial_articles(
            db_feed, parsed_feed, url
        )

        # Update feed with additional metadata
        await self._update_feed_metadata(db_feed, parsed_feed, latest_article_date)

        # Return the complete feed with relationships
        refreshed_feed = await crud_feed.get_feed(
            self.db, feed_id=db_feed.id, user_id=self.user_id
        )
        return FeedResponse.model_validate(refreshed_feed)

    async def _get_or_create_tags(self, tag_names: list[str]) -> list[Tag]:
        """Get or create tags for the feed."""
        from app.crud.crud_tag import get_or_create_tags_bulk

        return await get_or_create_tags_bulk(
            self.db, names=tag_names, user_id=self.user_id
        )

    async def _create_feed_db_entry(
        self, url: str, folder_id: UUID, db_tags: list[Tag], initial_feed_data: Any
    ) -> Any:
        """Create the feed database entry."""
        feed_create_schema = FeedCreate(
            url=initial_feed_data.url,
            folder_id=folder_id,
            tag_ids=[t.id for t in db_tags] if db_tags else [],
        )

        try:
            db_feed = await crud_feed.create_feed(
                self.db,
                feed_in=feed_create_schema,
                user_id=self.user_id,
                initial_feed_data=initial_feed_data,
            )
            return db_feed

        except IntegrityError as e:
            logger.warning(
                "Integrity error creating feed, likely duplicate (race condition)",
                url=url,
                user_id=self.user_id,
                error=str(e),
            )
            await self.db.rollback()

            # Check again for race condition
            existing_feed = await crud_feed.get_feed_by_url(
                self.db, url=url, user_id=self.user_id
            )
            if existing_feed:
                raise ValueError(
                    f"Feed with URL '{url}' already exists (detected after race condition)."
                )
            else:
                raise ValueError(
                    f"Failed to create feed due to a database integrity issue: {str(e)}"
                ) from e

        except Exception as e:
            logger.error(
                "Unexpected error during feed DB creation",
                url=url,
                user_id=self.user_id,
                error=str(e),
            )
            await self.db.rollback()
            raise

    async def _create_initial_articles(
        self, db_feed: Any, parsed_feed: feedparser.FeedParserDict, url: str
    ) -> datetime | None:
        """Extract and create initial articles from the feed."""
        articles_to_create: list[ArticleCreate] = []
        latest_article_date: datetime | None = None
        total_entries = len(parsed_feed.entries)

        for entry in parsed_feed.entries:
            article_schema = self._extract_article_data(
                entry, db_feed.id, self.user_id, url
            )
            if article_schema:
                articles_to_create.append(article_schema)
                if article_schema.published_at:
                    if (
                        latest_article_date is None
                        or article_schema.published_at > latest_article_date
                    ):
                        latest_article_date = article_schema.published_at

        # Validate feed has valid articles
        await self._validate_articles(db_feed, articles_to_create, total_entries, url)

        # Create articles in bulk
        if articles_to_create:
            created_articles = await create_articles_batch(
                db=self.db, articles_data=articles_to_create, user_id=self.user_id
            )
            logger.info(
                f"Bulk created {len(created_articles)} new articles for feed",
                feed_id=db_feed.id,
                url=url,
            )

        return latest_article_date

    async def _validate_articles(
        self,
        db_feed: Any,
        articles_to_create: list[ArticleCreate],
        total_entries: int,
        url: str,
    ) -> None:
        """Validate that the feed has sufficient valid articles."""
        valid_articles_count = len(articles_to_create)
        logger.info(
            "Feed validation",
            url=url,
            total_entries=total_entries,
            valid_articles=valid_articles_count,
        )

        if valid_articles_count == 0:
            # Delete the feed we just created since it has no articles
            await crud_feed.delete_feed(
                self.db, feed_id=db_feed.id, user_id=self.user_id
            )
            if total_entries == 0:
                logger.warning(
                    "Feed has no entries at all", url=url, user_id=self.user_id
                )
                raise ValueError("Feed appears to be broken: no entries found in feed")
            else:
                logger.warning(
                    "Feed has entries but no valid articles",
                    url=url,
                    user_id=self.user_id,
                    total_entries=total_entries,
                )
                raise ValueError(
                    "Feed appears to be broken: no valid articles found despite having entries"
                )

        # Check for sparse feeds
        if total_entries > 0 and valid_articles_count < (total_entries * 0.1):
            logger.warning(
                "Feed has very low valid article ratio",
                url=url,
                user_id=self.user_id,
                total_entries=total_entries,
                valid_articles=valid_articles_count,
            )

    async def _update_feed_metadata(
        self,
        db_feed: Any,
        parsed_feed: feedparser.FeedParserDict,
        latest_article_date: datetime | None,
    ) -> None:
        """Update feed with metadata from parsing."""
        updated_feed_info = self._extract_feed_metadata(parsed_feed, str(db_feed.url))

        # Extract TTL
        ttl_value = self._extract_ttl(parsed_feed, db_feed.id)

        # Extract skip hours/days
        skip_hours = self._extract_skip_hours(parsed_feed, db_feed.id)
        skip_days = self._extract_skip_days(parsed_feed, db_feed.id)

        # Update feed with all metadata
        await crud_feed.update_feed_fetch_metadata(
            self.db,
            feed_db=db_feed,
            title=updated_feed_info.title,
            description=updated_feed_info.description,
            link=str(updated_feed_info.link) if updated_feed_info.link else None,
            language=updated_feed_info.language,
            image_url=str(updated_feed_info.image_url)
            if updated_feed_info.image_url
            else None,
            ttl=ttl_value,
            skip_hours=skip_hours,
            skip_days=skip_days,
            last_modified=None,  # Will be set during fetch
            etag=None,  # Will be set during fetch
            last_fetched_at=datetime.now(timezone.utc),
            last_article_published_at=latest_article_date,
        )

    def _extract_ttl(
        self, parsed_feed: feedparser.FeedParserDict, feed_id: UUID
    ) -> int | None:
        """Extract TTL value from parsed feed."""
        if not parsed_feed.feed.get("ttl"):
            return None

        try:
            return int(parsed_feed.feed.get("ttl"))
        except (ValueError, TypeError):
            logger.warning(
                "Invalid TTL value in feed",
                feed_id=feed_id,
                ttl_raw=parsed_feed.feed.get("ttl"),
            )
            return None

    def _extract_skip_hours(
        self, parsed_feed: feedparser.FeedParserDict, feed_id: UUID
    ) -> list[int]:
        """Extract skip hours from parsed feed."""
        skip_hours_value = []
        skip_hours_raw = parsed_feed.feed.get("skipHours", {}).get("hour", [])

        if not skip_hours_raw:
            return skip_hours_value

        for hour in skip_hours_raw:
            try:
                hour_int = int(hour)
                if 0 <= hour_int <= 23:  # Valid hour range
                    skip_hours_value.append(hour_int)
            except (ValueError, TypeError):
                logger.warning(
                    "Invalid skip hour value", feed_id=feed_id, hour_raw=hour
                )

        return skip_hours_value

    def _extract_skip_days(
        self, parsed_feed: feedparser.FeedParserDict, feed_id: UUID
    ) -> list[str]:
        """Extract skip days from parsed feed."""
        skip_days_value = []
        skip_days_raw = parsed_feed.feed.get("skipDays", {}).get("day", [])

        if not skip_days_raw:
            return skip_days_value

        valid_days = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        ]

        for day in skip_days_raw:
            day_str = str(day).strip()
            if day_str in valid_days:
                skip_days_value.append(day_str)
            else:
                logger.warning("Invalid skip day value", feed_id=feed_id, day_raw=day)

        return skip_days_value

    async def _fetch_feed_content(
        self,
        url: str,
        etag: str | None = None,
        last_modified: str | None = None,
        timeout_seconds: int | None = None,
    ) -> dict[str, Any]:
        """Fetch feed content using the dedicated FeedFetcher service."""
        result = await self.feed_fetcher.fetch_content(
            url, etag, last_modified, timeout_seconds
        )

        # Convert FeedFetcher response format to expected format
        if result.get("not_modified"):
            return {
                "status": 304,
                "content": None,
                "headers": result.get("headers", {}),
            }

        if result.get("error"):
            error_type = result["error"]
            status_code = result.get("status_code", 500)

            if error_type == "timeout":
                raise ConnectionError(f"Feed timed out: {url}")
            elif error_type.startswith("http_"):
                if status_code == 404:
                    raise ConnectionError(f"Feed not found (404): {url}")
                elif status_code == 403:
                    raise ConnectionError(f"Access denied to feed (403): {url}")
                elif status_code in [500, 502, 503]:
                    raise ConnectionError(f"Feed server error ({status_code}): {url}")
                else:
                    raise ConnectionError(
                        f"HTTP error {status_code} while fetching feed: {url}"
                    )
            else:
                raise ConnectionError(f"Network error fetching feed: {url}")

        return {
            "status": result.get("status_code", 200),
            "content": result.get("content", ""),
            "headers": result.get("headers", {}),
        }

    def _parse_feed_data(
        self, feed_content_text: str, url: str
    ) -> feedparser.FeedParserDict:
        """Parse RSS/Atom feed content and validate its structure using FeedValidator."""
        try:
            parsed_feed = feedparser.parse(feed_content_text)
        except Exception as e:
            logger.error("Failed to parse feed content", url=url, error=str(e))
            raise ValueError(f"Unable to parse feed content: {e}")

        # Handle feedparser's bozo flag (malformed XML)
        if parsed_feed.bozo:
            bozo_type = (
                type(parsed_feed.bozo_exception).__name__
                if parsed_feed.bozo_exception
                else "Unknown"
            )
            bozo_message = (
                str(parsed_feed.bozo_exception)
                if parsed_feed.bozo_exception
                else "Unknown error"
            )
            logger.warning(
                "Feed parsed with issues (bozo)",
                url=url,
                bozo_type=bozo_type,
                bozo_message=bozo_message,
            )

            # Only fail for severe parsing errors
            if parsed_feed.bozo_exception and any(
                error_type in bozo_type
                for error_type in ["SAXParseException", "ExpatError", "XMLSyntaxError"]
            ):
                if not parsed_feed.feed or not hasattr(parsed_feed, "entries"):
                    logger.error(
                        "Feed has severe parsing errors and no valid structure",
                        url=url,
                        bozo_type=bozo_type,
                    )
                    raise ValueError(f"Feed has severe parsing errors: {bozo_message}")

        # Use FeedValidator to validate structure
        try:
            self.feed_validator.validate_feed_structure(parsed_feed)
        except Exception as e:
            raise ValueError(str(e))

        return parsed_feed

    def _extract_feed_metadata(
        self, parsed_feed: feedparser.FeedParserDict, feed_url: str
    ) -> Any:
        """Extract feed metadata using FeedValidator service."""
        from app.schemas.rss_schemas import FeedBase

        # Use FeedValidator to extract and clean metadata
        metadata = self.feed_validator.extract_feed_metadata(parsed_feed)

        # Extract additional fields specific to this implementation
        feed_info = parsed_feed.get("feed", {})
        image_url = feed_info.get("image", {}).get("href") or feed_info.get("logo")

        # If no image is found and we have a link, use favicon from the link domain
        if not image_url and metadata["link"]:
            try:
                from urllib.parse import urlparse

                parsed_url = urlparse(metadata["link"])
                domain = f"{parsed_url.scheme}://{parsed_url.netloc}"
                image_url = f"{domain}/favicon.ico"
                logger.info(
                    "Using favicon as fallback for feed image",
                    feed_url=feed_url,
                    favicon_url=image_url,
                )
            except Exception as e:
                logger.warning(
                    "Failed to create favicon URL",
                    feed_url=feed_url,
                    link=metadata["link"],
                    error=str(e),
                )

        return FeedBase(
            url=str(feed_url),  # The original URL used to fetch
            title=metadata["title"],
            description=metadata["description"],
            link=metadata["link"] if metadata["link"] else None,
            language=metadata["language"],
            image_url=str(image_url) if image_url else None,
        )

    def _extract_article_data(
        self, entry: Any, feed_id: UUID, user_id: UUID, feed_url: str = None
    ) -> ArticleCreate | None:
        """Extract ArticleCreate data from a single feed entry using FeedParsingService."""
        try:
            # Use FeedParsingService for proper article data extraction that preserves HTML
            article_dict = self.feed_parser.extract_article_data(entry, feed_url)
            if article_dict:
                return ArticleCreate(
                    title=article_dict["title"],
                    link=article_dict["link"],
                    content=article_dict["content"],
                    author=article_dict.get("author"),
                    published_at=article_dict.get("published_at"),
                    guid=article_dict["guid"],
                    feed_id=feed_id,
                    user_id=user_id,
                    image_url=article_dict.get("image_url"),
                    estimated_read_time_minutes=article_dict.get(
                        "estimated_read_time_minutes"
                    ),
                )
            return None
        except Exception as e:
            logger.warning(
                "Failed to extract article data",
                entry_id=entry.get("id"),
                entry_title=entry.get("title"),
                error=str(e),
            )
            return None
