import re  # Import re at the top level
import xml.etree.ElementTree as ET  # For building OPML for export
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

import feedparser  # For parsing RSS/Atom feeds
import httpx  # For fetching feed data
import opml  # For parsing OPML
import structlog  # For logging
from app.core.redis_cache import RedisCache  # Added
from app.crud import crud_article, crud_feed, crud_folder, crud_tag
from app.models.rss_models import Tag
from app.schemas.rss_schemas import (
    ArticleCreate,
    ArticleResponse,
    ArticleUpdate,
    FeedBase,
    FeedCreate,
    FeedResponse,
    FeedUpdate,
    FolderCreate,
    FolderResponse,
    FolderUpdate,
    PaginatedResponse,
    TagCreate,
    TagResponse,
    TagUpdate,
)
from bs4 import BeautifulSoup  # Added for HTML parsing
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

# from app.core.redis_cache import RedisCache # Assuming a Redis cache utility exists for now

logger = structlog.get_logger(__name__)

# Placeholder for feedparser result type hinting, if available or can be created
# from feedparser import FeedParserDict # Example, actual type might be different

DEFAULT_CACHE_TTL_SECONDS = 15 * 60  # 15 minutes

class RssService:
    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id
        self.redis_cache = RedisCache() # Initialized

    async def _fetch_feed_content(self, url: str, etag: Optional[str] = None, last_modified: Optional[str] = None) -> Dict[str, Any]:
        """Fetches feed content using httpx with ETag and Last-Modified headers, using cache."""
        cache_key = f"feed_content:{url}"
        cached_data = await self.redis_cache.get(cache_key)

        request_headers = {}
        if etag:
            request_headers["If-None-Match"] = etag
        if last_modified:
            request_headers["If-Modified-Since"] = last_modified
        
        # If cached_data exists, it might contain headers to use for conditional GET
        # However, the etag/last_modified args to this function take precedence (from DB)
        if cached_data and not (etag or last_modified):
             # If we have cached headers, use them for conditional GET if no specific ones are passed
            if cached_data.get("headers", {}).get("ETag"):
                 request_headers["If-None-Match"] = cached_data["headers"]["ETag"]
            if cached_data.get("headers", {}).get("Last-Modified"):
                 request_headers["If-Modified-Since"] = cached_data["headers"]["Last-Modified"]

        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                response = await client.get(url, headers=request_headers)
            
            response_headers_dict = {k.lower(): v for k, v in response.headers.items()} # Store lowercased keys

            if response.status_code == 304: # Not Modified
                logger.info("Feed not modified (304), serving from cache or confirming no change", url=url, etag=etag, last_modified=last_modified)
                # If original request was conditional based on DB values, and we get 304,
                # it means DB state is current. No need to update cache with empty content.
                # If the 304 was due to cache's own headers, the cache is still valid.
                return {"status": 304, "content": None, "headers": response_headers_dict}
            
            response.raise_for_status()
            logger.info("Feed content fetched successfully from network", url=url, status_code=response.status_code)
            
            # Use text content for feedparser, assuming UTF-8 or that httpx handles decoding
            content_text = response.text 
            data_to_cache = {"status": response.status_code, "content_text": content_text, "headers": response_headers_dict}
            await self.redis_cache.set(cache_key, data_to_cache, ttl_seconds=DEFAULT_CACHE_TTL_SECONDS) # Adjust TTL as needed
            return {"status": response.status_code, "content": content_text, "headers": response_headers_dict}

        except httpx.HTTPStatusError as e:
            logger.error("HTTP error fetching feed", url=url, status_code=e.response.status_code, error=str(e))
            # If fetch fails, and we have stale cache, consider returning stale data? For now, no.
            # If error is e.g. 404 or 410, might want to clear/invalidate cache for this URL.
            if e.response.status_code in [404, 410]:
                await self.redis_cache.delete(cache_key)
            raise ConnectionError(f"HTTP error {e.response.status_code} while fetching feed: {url}") from e
        except httpx.RequestError as e:
            logger.error("Request error fetching feed", url=url, error=str(e))
            # If we have cached data, we could serve it stale here if preferred
            if cached_data and cached_data.get("content_text"):
                logger.warning("Network error, serving stale content from cache", url=url, error=str(e))
                return {
                    "status": cached_data.get("status", 200), # Original status
                    "content": cached_data["content_text"],
                    "headers": cached_data.get("headers", {}),
                    "stale": True
                }
            raise ConnectionError(f"Error connecting to feed: {url}. Details: {str(e)}") from e

    def _parse_feed_data(self, feed_content_text: str, url: str) -> feedparser.FeedParserDict:
        """Parses feed content (string) using feedparser."""
        try:
            # feedparser.parse can take a string directly
            parsed_feed = feedparser.parse(feed_content_text)
            if parsed_feed.bozo:
                bozo_exception = parsed_feed.bozo_exception
                logger.warning(
                    "Feed parsed with issues (bozo)", 
                    url=url, 
                    bozo_type=type(bozo_exception).__name__,
                    bozo_message=str(bozo_exception)
                )
            return parsed_feed
        except Exception as e:
            logger.error("Failed to parse feed content", url=url, error=str(e))
            raise ValueError(f"Could not parse feed content from {url}. Error: {str(e)}") from e

    def _extract_feed_metadata(self, parsed_feed: feedparser.FeedParserDict, feed_url: str) -> FeedBase:
        """Extracts relevant FeedBase data from parsed feed."""
        feed_info = parsed_feed.get("feed", {})
        title = feed_info.get("title", feed_url) # Default to URL if no title
        description = feed_info.get("subtitle") or feed_info.get("description")
        link = feed_info.get("link")
        language = feed_info.get("language")
        image_url = feed_info.get("image", {}).get("href") or feed_info.get("logo")
        
        # If no image is found and we have a link, use favicon from the link domain
        if not image_url and link:
            try:
                # Extract domain from link and create favicon URL
                from urllib.parse import urlparse
                parsed_url = urlparse(link)
                domain = f"{parsed_url.scheme}://{parsed_url.netloc}"
                image_url = f"{domain}/favicon.ico"
                logger.info("Using favicon as fallback for feed image", feed_url=feed_url, favicon_url=image_url)
            except Exception as e:
                logger.warning("Failed to create favicon URL", feed_url=feed_url, link=link, error=str(e))
        
        # RSS TTL, skipHours, skipDays (these are less common but good to support)
        ttl = feed_info.get("ttl") # In minutes
        skip_hours_data = feed_info.get("skipHours", {}).get("hour", [])
        skip_days_data = feed_info.get("skipDays", {}).get("day", [])

        return FeedBase(
            url=str(feed_url), # The original URL used to fetch
            title=title,
            description=description,
            link=str(link) if link is not None else None,
            language=language,
            image_url=str(image_url) if image_url is not None else None
            # ttl, skip_hours, skip_days will be set on the DB model directly
        )
    
    def _extract_article_data(self, entry: Any, feed_id: UUID, user_id: UUID) -> Optional[ArticleCreate]:
        """Extracts ArticleCreate data from a single feed entry."""
        guid = entry.get("id") or entry.get("guid") or entry.get("link") # GUID is critical
        if not guid:
            logger.warning("Skipping entry with no GUID or link", entry_title=entry.get("title"))
            return None

        title = entry.get("title")
        link = entry.get("link")
        if not link: # A link is also essential
            logger.warning("Skipping entry with no link", guid=guid, entry_title=title)
            return None

        description = entry.get("summary") or entry.get("description")
        content = None
        if "content" in entry:
            # feedparser returns a list of content dicts, usually we want the first HTML or text
            for content_item in entry.content:
                if content_item.type == "text/html":
                    content = content_item.value
                    break
                if content_item.type == "text/plain" and not content: # Prefer HTML but take plain if no HTML
                    content = content_item.value
        if not content and description and len(description) > 200: # Fallback if description is rich
             content = description # Or if description is substantially longer than a typical summary

        published_dt: Optional[datetime] = None
        if "published_parsed" in entry and entry.published_parsed:
            try:
                published_dt = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
            except Exception:
                logger.warning("Failed to parse published_parsed", guid=guid, published_parsed=entry.published_parsed)
        elif "updated_parsed" in entry and entry.updated_parsed: # Fallback to updated if published not available
            try:
                published_dt = datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)
            except Exception:
                logger.warning("Failed to parse updated_parsed", guid=guid, updated_parsed=entry.updated_parsed)

        # Placeholder for image extraction and read time calculation
        image_url = self._find_best_article_image(entry, content)
        estimated_read_time = self._calculate_estimated_read_time(content or description)

        return ArticleCreate(
            feed_id=feed_id,
            user_id=user_id,
            guid=str(guid)[:1024], # Ensure GUID fits in model
            title=title,
            link=str(link) if link is not None else None,
            description=description,
            content=content,
            image_url=str(image_url) if image_url is not None else None,
            published_at=published_dt,
            estimated_read_time_minutes=estimated_read_time,
            is_read=False, # New articles are unread
            is_read_later=False,
            is_favorite=False
        )

    def _find_best_article_image(self, entry: Any, content_html: Optional[str]) -> Optional[str]:
        """Tries to find the best image for an article."""
        if "media_content" in entry and entry.media_content:
            for media in entry.media_content:
                if media.get("medium") == "image" and media.get("url"):
                    return media.get("url")
        if "enclosures" in entry and entry.enclosures:
            for enclosure in entry.enclosures:
                if enclosure.get("type", "").startswith("image/") and enclosure.get("href"):
                    return enclosure.get("href")
        
        if content_html:
            try:
                soup = BeautifulSoup(content_html, 'html.parser')
                img_tag = soup.find('img')
                if img_tag and img_tag.get('src'):
                    # Basic check for placeholder/tiny images, can be expanded
                    src = img_tag.get('src')
                    if not (src.startswith('data:') or (img_tag.get('width') == '1' and img_tag.get('height') == '1')):
                         return src
            except Exception as e:
                logger.warning("BeautifulSoup failed to parse content for image extraction", error=str(e), guid=entry.get("id"))
                # Fallback to regex if BeautifulSoup fails, or remove regex entirely
                # For now, keeping the regex as a last resort if BS fails.
                img_match = re.search(r'<img [^>]*src=(["\'])(.*?)\1', content_html, re.IGNORECASE | re.DOTALL)
                if img_match:
                    return img_match.group(2)
        return None

    def _calculate_estimated_read_time(self, text_content: Optional[str], wpm: int = 230) -> Optional[int]: # Changed WPM to 230
        """Calculates estimated read time in minutes."""
        if not text_content:
            return None
        
        try:
            soup = BeautifulSoup(text_content, 'html.parser')
            text_only = soup.get_text(separator=' ', strip=True)
        except Exception as e:
            logger.warning("BeautifulSoup failed to parse content for read time calculation, falling back to regex strip.", error=str(e))
            # Fallback to regex-based stripping if BeautifulSoup fails
            text_only = re.sub(r'<[^>]+>', ' ', text_content) 
            text_only = ' '.join(text_only.split()) # Normalize spaces

        if not text_only.strip(): # Check if text_only is empty or just whitespace
            return None
            
        words = len(text_only.split())
        if words == 0:
            return None
        return max(1, round(words / wpm))

    async def add_new_feed(
        self, url: str, folder_id: UUID, tag_names: Optional[List[str]] = None
    ) -> FeedResponse:
        """Adds a new feed by URL, parses it, and stores initial articles."""
        logger.info("Attempting to add new feed", url=url, folder_id=folder_id, user_id=self.user_id)
        
        # 0. Check if this feed URL already exists for the user
        existing_feed = await crud_feed.get_feed_by_url(self.db, url=url, user_id=self.user_id)
        if existing_feed:
            logger.info("Feed URL already exists for user", url=url, user_id=self.user_id, existing_feed_id=existing_feed.id)
            # Option 1: Raise an error
            raise ValueError(f"Feed with URL '{url}' already exists.")
            # Option 2: Return the existing feed (potentially after updating its folder/tags if different)
            # For now, raising an error is simpler.

        # 1. Check if folder exists and belongs to user (implicitly handled by FK constraint, but good to check)
        folder = await crud_folder.get_folder(self.db, folder_id=folder_id, user_id=self.user_id)
        if not folder:
            logger.warning("Folder not found or does not belong to user", folder_id=folder_id, user_id=self.user_id)
            raise ValueError(f"Folder with ID '{folder_id}' not found or access denied.")

        # 2. Fetch and parse the feed content
        try:
            fetch_result = await self._fetch_feed_content(url)
            if fetch_result["status"] != 200 or not fetch_result["content"]:
                logger.error("Failed to fetch content for new feed", url=url, status=fetch_result.get("status"))
                raise ValueError("Could not fetch feed content.")
            
            parsed_feed = self._parse_feed_data(fetch_result["content"], url)
        except ConnectionError as e:
            logger.error("Connection error adding new feed", url=url, error=str(e))
            # Potentially create the feed entry as errored but available for retry?
            # For now, fail the operation.
            raise
        except ValueError as e:
            logger.error("Parsing error adding new feed", url=url, error=str(e))
            raise

        # 3. Extract feed metadata from parsed data
        initial_feed_data = self._extract_feed_metadata(parsed_feed, url)
        feed_http_headers = fetch_result.get("headers", {})
        
        # 4. Prepare tags
        db_tags_to_associate: List[Tag] = []
        if tag_names:
            for name in tag_names:
                # Normalize tag name (e.g., lowercase, strip whitespace)
                normalized_name = name.strip().lower()
                if normalized_name:
                    tag = await crud_tag.get_or_create_tag(self.db, name=normalized_name, user_id=self.user_id)
                    db_tags_to_associate.append(tag)
        
        # 5. Create the Feed DB entry
        feed_create_schema = FeedCreate(
            url=initial_feed_data.url, # Use the URL from parsed data or original
            folder_id=folder_id,
            tag_ids=[t.id for t in db_tags_to_associate] if db_tags_to_associate else []
        )
        try:
            db_feed = await crud_feed.create_feed(
                self.db, 
                feed_in=feed_create_schema, 
                user_id=self.user_id,
                initial_feed_data=initial_feed_data # Pass title, desc etc.
            )
        except IntegrityError as e: # Catch potential race condition if feed was added between check and create
            logger.warning("Integrity error creating feed, likely duplicate (race condition)", url=url, user_id=self.user_id, error=str(e))
            await self.db.rollback() # Rollback the session
            # Check again to be sure
            existing_feed_after_race = await crud_feed.get_feed_by_url(self.db, url=url, user_id=self.user_id)
            if existing_feed_after_race:
                raise ValueError(f"Feed with URL '{url}' already exists (detected after race condition).")
            else:
                # This case should be rare, something else went wrong with IntegrityError
                raise ValueError(f"Failed to create feed due to a database integrity issue: {str(e)}") from e
        except Exception as e:
            logger.error("Unexpected error during feed DB creation", url=url, user_id=self.user_id, error=str(e))
            await self.db.rollback()
            raise

        # 6. Update the feed with metadata from the first fetch (ETag, Last-Modified, TTL etc.)
        await crud_feed.update_feed_fetch_metadata(
            self.db, 
            feed_db=db_feed, 
            title=initial_feed_data.title, # Already part of initial_feed_data in create
            description=initial_feed_data.description,
            link=str(initial_feed_data.link) if initial_feed_data.link else None,
            language=initial_feed_data.language,
            image_url=str(initial_feed_data.image_url) if initial_feed_data.image_url else None,
            ttl=parsed_feed.feed.get("ttl"),
            skip_hours=parsed_feed.feed.get("skipHours", {}).get("hour", []),
            skip_days=parsed_feed.feed.get("skipDays", {}).get("day", []),
            last_modified=feed_http_headers.get("Last-Modified"),
            etag=feed_http_headers.get("ETag"),
            last_fetched_at=datetime.now(timezone.utc)
        )

        # 7. Extract and store initial articles
        articles_to_create: List[ArticleCreate] = []
        for entry in parsed_feed.entries:
            article_schema = self._extract_article_data(entry, db_feed.id, self.user_id)
            if article_schema:
                articles_to_create.append(article_schema)
        
        if articles_to_create:
            await crud_article.create_articles_batch(self.db, articles_in=articles_to_create)
            logger.info(f"Created {len(articles_to_create)} initial articles for feed", feed_id=db_feed.id, url=url)
        
        # Always re-fetch to ensure relationships are loaded for Pydantic
        db_feed_with_rels = await crud_feed.get_feed(self.db, feed_id=db_feed.id, user_id=self.user_id)
        return FeedResponse.model_validate(db_feed_with_rels)

    async def refresh_feed(self, feed_id: UUID, force_refetch: bool = False) -> Optional[FeedResponse]:
        """Refreshes an existing feed, fetches new articles, and updates the database."""
        db_feed = await crud_feed.get_feed(self.db, feed_id=feed_id, user_id=self.user_id)
        if not db_feed:
            logger.warning("Feed not found for refresh", feed_id=feed_id, user_id=self.user_id)
            return None

        logger.info("Refreshing feed", feed_id=feed_id, url=db_feed.url, user_id=self.user_id)

        etag = None if force_refetch else db_feed.etag_header
        last_modified = None if force_refetch else db_feed.last_modified_header

        try:
            fetch_result = await self._fetch_feed_content(str(db_feed.url), etag=etag, last_modified=last_modified)
            
            if fetch_result["status"] == 304: # Not Modified
                # Update last_fetched_at even if not modified
                await crud_feed.update_feed_fetch_metadata(self.db, feed_db=db_feed, last_fetched_at=datetime.now(timezone.utc))
                logger.info("Feed not modified, refresh skipped", feed_id=feed_id, url=db_feed.url)
                return FeedResponse.model_validate(db_feed)

            if fetch_result["status"] != 200 or not fetch_result["content"]:
                await crud_feed.update_feed_fetch_error(self.db, feed_db=db_feed, error_message="Failed to fetch content during refresh")
                logger.error("Failed to fetch content for feed refresh", feed_id=feed_id, url=db_feed.url, status=fetch_result.get("status"))
                return FeedResponse.model_validate(db_feed) # Return current state with error logged

            parsed_feed = self._parse_feed_data(fetch_result["content"], str(db_feed.url))
        except (ConnectionError, ValueError) as e:
            await crud_feed.update_feed_fetch_error(self.db, feed_db=db_feed, error_message=str(e))
            logger.error("Error refreshing feed", feed_id=feed_id, url=db_feed.url, error=str(e))
            return FeedResponse.model_validate(db_feed) # Return current state with error logged

        # Update feed metadata (title, description, link might change)
        # User-settable fields like is_favorite, folder_id, tags are NOT changed here.
        feed_http_headers = fetch_result.get("headers", {})
        updated_feed_info = self._extract_feed_metadata(parsed_feed, str(db_feed.url))

        db_feed = await crud_feed.update_feed_fetch_metadata(
            self.db, 
            feed_db=db_feed, 
            title=updated_feed_info.title,
            description=updated_feed_info.description,
            link=str(updated_feed_info.link) if updated_feed_info.link else None,
            language=updated_feed_info.language,
            image_url=str(updated_feed_info.image_url) if updated_feed_info.image_url else None,
            ttl=parsed_feed.feed.get("ttl"),
            skip_hours=parsed_feed.feed.get("skipHours", {}).get("hour", []),
            skip_days=parsed_feed.feed.get("skipDays", {}).get("day", []),
            last_modified=feed_http_headers.get("Last-Modified"),
            etag=feed_http_headers.get("ETag"),
            last_fetched_at=datetime.now(timezone.utc)
        )
        
        # Extract and store new articles
        articles_to_create: List[ArticleCreate] = []
        for entry in parsed_feed.entries:
            article_schema = self._extract_article_data(entry, db_feed.id, self.user_id)
            if article_schema:
                articles_to_create.append(article_schema)
        
        newly_created_articles_count = 0
        if articles_to_create:
            await crud_article.create_articles_batch(self.db, articles_in=articles_to_create)
            newly_created_articles_count = len(articles_to_create)
            logger.info(f"Created {newly_created_articles_count} new articles for feed", feed_id=db_feed.id, url=db_feed.url)
        else:
            logger.info("No new articles found for feed", feed_id=db_feed.id, url=db_feed.url)
        
        # Optionally, add newly_created_articles_count to the response or log it.
        # The FeedResponse itself doesn't have a field for this, but it's useful info.
        
        # Eager load relationships for the response again
        refreshed_db_feed_with_relations = await crud_feed.get_feed(self.db, feed_id=db_feed.id, user_id=self.user_id)
        return FeedResponse.model_validate(refreshed_db_feed_with_relations)

    # --- Folder Methods ---
    async def create_folder(self, folder_in: FolderCreate) -> FolderResponse:
        try:
            folder = await crud_folder.create_folder(self.db, folder_in=folder_in, user_id=self.user_id)
            return FolderResponse.model_validate(folder)
        except IntegrityError as e:
            logger.warning("Folder creation integrity error", name=folder_in.name, user_id=self.user_id, error=str(e))
            raise ValueError(str(e)) # Re-raise as ValueError for API layer to catch as 4xx

    async def get_folder(self, folder_id: UUID) -> Optional[FolderResponse]:
        folder = await crud_folder.get_folder(self.db, folder_id=folder_id, user_id=self.user_id)
        if not folder:
            return None
        return FolderResponse.model_validate(folder)

    async def list_folders(self, skip: int = 0, limit: int = 100) -> List[FolderResponse]:
        folders = await crud_folder.get_folders_by_user(self.db, user_id=self.user_id, skip=skip, limit=limit)
        return [FolderResponse.model_validate(f) for f in folders]

    async def update_folder(self, folder_id: UUID, folder_in: FolderUpdate) -> Optional[FolderResponse]:
        folder_db = await crud_folder.get_folder(self.db, folder_id=folder_id, user_id=self.user_id)
        if not folder_db:
            return None
        try:
            updated_folder = await crud_folder.update_folder(self.db, folder_db=folder_db, folder_in=folder_in)
            return FolderResponse.model_validate(updated_folder)
        except IntegrityError as e:
            logger.warning("Folder update integrity error", name=folder_in.name, user_id=self.user_id, error=str(e))
            raise ValueError(str(e))

    async def delete_folder(self, folder_id: UUID) -> bool:
        folder_db = await crud_folder.get_folder(self.db, folder_id=folder_id, user_id=self.user_id)
        if not folder_db:
            return False # Or raise NotFound
        
        # Check if folder has any feeds associated with it
        feeds_in_folder = await crud_feed.get_feeds_by_user(self.db, user_id=self.user_id, folder_id=folder_id, limit=1)
        if feeds_in_folder:
            logger.warning("Attempt to delete folder with associated feeds", folder_id=folder_id, user_id=self.user_id)
            # Raise an error or return a specific status indicating it can't be deleted
            raise ValueError("Folder cannot be deleted: it contains feeds. Please move or delete the feeds first.")

        deleted_folder = await crud_folder.delete_folder(self.db, folder_id=folder_id, user_id=self.user_id)
        return deleted_folder is not None

    # --- Tag Methods ---
    async def create_tag(self, tag_in: TagCreate) -> TagResponse:
        # Normalize tag name (e.g., lowercase, strip whitespace)
        normalized_name = tag_in.name.strip().lower()
        if not normalized_name:
            raise ValueError("Tag name cannot be empty.")
        
        tag_in_normalized = TagCreate(name=normalized_name)
        try:
            tag = await crud_tag.get_or_create_tag(self.db, name=tag_in_normalized.name, user_id=self.user_id)
            return TagResponse.model_validate(tag)
        except IntegrityError as e:
            logger.warning("Tag creation integrity error", name=normalized_name, user_id=self.user_id, error=str(e))
            raise ValueError(str(e)) # Re-raise for API layer

    async def get_tag(self, tag_id: UUID) -> Optional[TagResponse]:
        tag = await crud_tag.get_tag(self.db, tag_id=tag_id, user_id=self.user_id)
        if not tag:
            return None
        return TagResponse.model_validate(tag)

    async def list_tags(self, skip: int = 0, limit: int = 100) -> List[TagResponse]:
        tags = await crud_tag.get_tags_by_user(self.db, user_id=self.user_id, skip=skip, limit=limit)
        return [TagResponse.model_validate(t) for t in tags]

    async def update_tag(self, tag_id: UUID, tag_in: TagUpdate) -> Optional[TagResponse]:
        tag_db = await crud_tag.get_tag(self.db, tag_id=tag_id, user_id=self.user_id)
        if not tag_db:
            return None
        
        # Normalize new tag name if provided
        if tag_in.name:
            normalized_name = tag_in.name.strip().lower()
            if not normalized_name:
                raise ValueError("Tag name cannot be empty when updating.")
            tag_in.name = normalized_name
        
        try:
            updated_tag = await crud_tag.update_tag(self.db, tag_db=tag_db, tag_in=tag_in)
            return TagResponse.model_validate(updated_tag)
        except IntegrityError as e:
            logger.warning("Tag update integrity error", name=tag_in.name, user_id=self.user_id, error=str(e))
            raise ValueError(str(e))

    async def delete_tag(self, tag_id: UUID) -> bool:
        # Deleting a tag will automatically remove its associations from feeds due to the M2M setup.
        # No need to check for associated feeds explicitly before deleting the tag itself.
        tag_db = await crud_tag.get_tag(self.db, tag_id=tag_id, user_id=self.user_id)
        if not tag_db:
            return False # Or raise NotFound

        deleted_tag = await crud_tag.delete_tag(self.db, tag_id=tag_id, user_id=self.user_id)
        return deleted_tag is not None

    # --- Feed Methods ---
    async def get_feed(self, feed_id: UUID) -> Optional[FeedResponse]:
        feed = await crud_feed.get_feed(self.db, feed_id=feed_id, user_id=self.user_id)
        if not feed:
            return None
        return FeedResponse.model_validate(feed)

    async def list_feeds(
        self,
        folder_id: Optional[UUID] = None,
        tag_names: Optional[List[str]] = None,
        is_favorite: Optional[bool] = None,
        search_query: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[FeedResponse]:
        feeds = await crud_feed.get_feeds_by_user(
            self.db,
            user_id=self.user_id,
            folder_id=folder_id,
            tag_names=tag_names,
            is_favorite=is_favorite,
            search_query=search_query,
            skip=skip,
            limit=limit,
        )
        return [FeedResponse.model_validate(f) for f in feeds]

    async def update_feed_user_settings(self, feed_id: UUID, feed_in: FeedUpdate) -> Optional[FeedResponse]:
        """Updates user-configurable settings for a feed (folder, tags, favorite, title override)."""
        feed_db = await crud_feed.get_feed(self.db, feed_id=feed_id, user_id=self.user_id)
        if not feed_db:
            return None
        
        # FeedUpdate schema expects tag_ids. crud_feed.update_feed handles fetching and validating them.
        # If tag names were passed, normalization and get_or_create_tag would happen here or in CRUD.

        updated_feed = await crud_feed.update_feed(self.db, feed_db=feed_db, feed_in=feed_in)
        return FeedResponse.model_validate(updated_feed)

    async def delete_feed(self, feed_id: UUID) -> bool:
        # Articles associated with this feed will be cascade-deleted by the DB.
        deleted_feed = await crud_feed.delete_feed(self.db, feed_id=feed_id, user_id=self.user_id)
        return deleted_feed is not None

    # --- Article Methods (Continued) ---
    async def get_article(self, article_id: UUID) -> Optional[ArticleResponse]:
        article = await crud_article.get_article(self.db, article_id=article_id, user_id=self.user_id)
        if not article:
            return None
        return ArticleResponse.model_validate(article)

    async def list_articles(
        self,
        feed_ids: Optional[List[UUID]] = None,
        folder_id: Optional[UUID] = None,
        is_read: Optional[bool] = None,
        is_read_later: Optional[bool] = None,
        is_favorite: Optional[bool] = None,
        feed_is_favorite: Optional[bool] = None,
        published_since: Optional[datetime] = None,
        published_until: Optional[datetime] = None,
        search_query: Optional[str] = None,
        sort_by: str = "published_at",
        sort_order: str = "desc",
        page: int = 1,
        size: int = 20,
    ) -> PaginatedResponse[ArticleResponse]: # Using the PaginatedResponse schema
        skip = (page - 1) * size
        articles, total_count = await crud_article.get_articles_by_user(
            self.db,
            user_id=self.user_id,
            feed_ids=feed_ids,
            folder_id=folder_id,
            is_read=is_read,
            is_read_later=is_read_later,
            is_favorite=is_favorite,
            feed_is_favorite=feed_is_favorite,
            published_since=published_since,
            published_until=published_until,
            search_query=search_query,
            sort_by=sort_by,
            sort_order=sort_order,
            skip=skip,
            limit=size,
        )
        return PaginatedResponse(
            items=[ArticleResponse.model_validate(art) for art in articles],
            total=total_count,
            page=page,
            size=size,
            pages=(total_count + size - 1) // size if total_count > 0 else 0
        )

    async def update_article_status(self, article_id: UUID, article_in: ArticleUpdate) -> Optional[ArticleResponse]:
        article_db = await crud_article.get_article(self.db, article_id=article_id, user_id=self.user_id)
        if not article_db:
            return None
        
        updated_article = await crud_article.update_article(self.db, article_db=article_db, article_in=article_in)
        return ArticleResponse.model_validate(updated_article)

    async def bulk_update_articles_status(
        self, article_ids: List[UUID], action: str # e.g. "mark_as_read", "toggle_favorite"
    ) -> int:
        """Bulk updates status of articles. Returns number of affected articles."""
        updates: Dict[str, Any] = {}
        if action == "mark_as_read":
            updates["is_read"] = True
        elif action == "mark_as_unread":
            updates["is_read"] = False
            updates["read_at"] = None 
        elif action == "mark_as_read_later":
            updates["is_read_later"] = True
        elif action == "unmark_as_read_later":
            updates["is_read_later"] = False
        elif action == "mark_as_favorite":
            updates["is_favorite"] = True
        elif action == "unmark_as_favorite":
            updates["is_favorite"] = False
        else:
            raise ValueError(f"Invalid bulk action: {action}")

        if not updates:
            return 0
            
        affected_rows = await crud_article.bulk_update_articles_status(
            self.db, article_ids=article_ids, user_id=self.user_id, updates=updates
        )
        return affected_rows

    async def get_recently_read_articles(self, page: int = 1, size: int = 20) -> PaginatedResponse[ArticleResponse]:
        skip = (page - 1) * size
        articles, total_count = await crud_article.get_recently_read_articles(
            self.db, user_id=self.user_id, skip=skip, limit=size
        )
        return PaginatedResponse(
            items=[ArticleResponse.model_validate(art) for art in articles],
            total=total_count,
            page=page,
            size=size,
            pages=(total_count + size - 1) // size if total_count > 0 else 0
        )

    async def get_read_later_articles(self, page: int = 1, size: int = 100) -> PaginatedResponse[ArticleResponse]:
        skip = (page - 1) * size
        articles, total_count = await crud_article.get_read_later_articles(
            self.db, user_id=self.user_id, skip=skip, limit=size
        )
        return PaginatedResponse(
            items=[ArticleResponse.model_validate(art) for art in articles],
            total=total_count,
            page=page,
            size=size,
            pages=(total_count + size - 1) // size if total_count > 0 else 0
        )

    async def get_unread_counts(self, folder_id_filter: Optional[UUID] = None) -> Dict[str, Any]:
        """Provides unread counts: total, and per folder."""
        # Overall total unread for the user
        total_unread_overall = await crud_article.count_unread_articles(self.db, user_id=self.user_id)
        response_data = {"total_unread": total_unread_overall}

        if folder_id_filter:
            # If a specific folder is requested, get its count directly
            folder_specific_unread = await crud_article.count_unread_articles(
                self.db, user_id=self.user_id, folder_id=folder_id_filter
            )
            folder_db = await crud_folder.get_folder(self.db, folder_id=folder_id_filter, user_id=self.user_id)
            response_data["folder_unread"] = {
                "folder_id": folder_id_filter,
                "name": folder_db.name if folder_db else "Unknown Folder",
                "count": folder_specific_unread
            }
        else:
            # Get all folders for the user
            user_folders = await crud_folder.get_folders_by_user(self.db, user_id=self.user_id, limit=500) # Adjust limit as necessary
            
            # Get unread counts grouped by folder_id in one query
            unread_counts_map = await crud_article.get_unread_counts_by_folder(self.db, user_id=self.user_id)
            
            folder_counts_list = []
            for folder in user_folders:
                unread_in_folder = unread_counts_map.get(folder.id, 0)
                # Only include if you want to show folders with 0 unread, or add: if unread_in_folder > 0:
                folder_counts_list.append({
                    "folder_id": folder.id, 
                    "name": folder.name, 
                    "unread_count": unread_in_folder
                })
            
            # Optional: filter out folders with zero unread counts if not desired in response
            # folder_counts_list = [fc for fc in folder_counts_list if fc["unread_count"] > 0]
            
            if folder_counts_list:
                response_data["unread_by_folder"] = folder_counts_list
        
        return response_data

    # --- OPML Methods ---
    async def import_opml(self, opml_content: str, default_folder_name: str = "Imported Feeds") -> Dict[str, Any]:
        """Imports feeds from an OPML string content."""
        logger.info("Starting OPML import process", user_id=self.user_id)
        imported_count = 0
        failed_count = 0
        errors = []
        created_folders = {} # Cache for created folder IDs: name -> UUID

        try:
            opml_data = opml.parse(opml_content)
        except Exception as e:
            logger.error("Failed to parse OPML content", user_id=self.user_id, error=str(e))
            raise ValueError(f"Invalid OPML content: {str(e)}") from e

        # Ensure the default folder exists or create it
        default_folder_db = await crud_folder.get_folder_by_name(self.db, name=default_folder_name, user_id=self.user_id)
        if not default_folder_db:
            try:
                default_folder_db = await crud_folder.create_folder(
                    self.db, folder_in=FolderCreate(name=default_folder_name), user_id=self.user_id
                )
                created_folders[default_folder_name] = default_folder_db.id
            except IntegrityError: # Should not happen if get_by_name was None, but as a safeguard
                default_folder_db = await crud_folder.get_folder_by_name(self.db, name=default_folder_name, user_id=self.user_id)
                if not default_folder_db: # Still not found, critical error
                     errors.append({"message": f"Could not create or find default folder: {default_folder_name}"})
                     # Cannot proceed without a default folder if outlines are at root
                     return {"imported_count": 0, "failed_count": len(opml_data), "errors": errors}
        
        default_folder_id_to_use = default_folder_db.id

        async def process_outline(outline, current_folder_id: UUID):
            nonlocal imported_count, failed_count # Allow modification of outer scope variables
            
            is_feed_outline = hasattr(outline, 'xmlUrl') and outline.xmlUrl is not None
            is_category_folder = not is_feed_outline and hasattr(outline, 'text') and outline.text is not None

            folder_to_use_for_children = current_folder_id

            if is_category_folder:
                folder_name = outline.text.strip()
                if folder_name:
                    if folder_name in created_folders:
                        folder_id_for_category = created_folders[folder_name]
                    else:
                        folder_db = await crud_folder.get_folder_by_name(self.db, name=folder_name, user_id=self.user_id)
                        if not folder_db:
                            try:
                                folder_db = await crud_folder.create_folder(
                                    self.db, folder_in=FolderCreate(name=folder_name), user_id=self.user_id
                                )
                                created_folders[folder_name] = folder_db.id
                                folder_id_for_category = folder_db.id
                            except IntegrityError:
                                folder_db = await crud_folder.get_folder_by_name(self.db, name=folder_name, user_id=self.user_id)
                                if not folder_db: # Should not happen
                                    errors.append({"message": f"Could not create or find folder: {folder_name} for outline {outline.text}"})
                                    # Feeds under this outline will go to current_folder_id or default
                                    folder_id_for_category = current_folder_id 
                                else:
                                    created_folders[folder_name] = folder_db.id
                                    folder_id_for_category = folder_db.id
                        else:
                            created_folders[folder_name] = folder_db.id
                            folder_id_for_category = folder_db.id
                    folder_to_use_for_children = folder_id_for_category

            if is_feed_outline:
                feed_url = outline.xmlUrl
                feed_title = outline.title or outline.text # OPML might use text or title for feed name
                
                # Extract tags if present as 'category' attribute (comma-separated)
                feed_tags_names = []
                if hasattr(outline, 'category') and outline.category:
                    feed_tags_names = [t.strip() for t in outline.category.split(',') if t.strip()]
                
                try:
                    # Check if feed already exists for this user by URL
                    existing_feed = await crud_feed.get_feed_by_url(self.db, url=feed_url, user_id=self.user_id)
                    if existing_feed:
                        logger.info("Skipping already existing feed from OPML", url=feed_url, user_id=self.user_id)
                        # Optionally, could update folder/tags if specified differently in OPML
                        imported_count +=1 # Count as imported if already exists and we are skipping
                    else:
                        await self.add_new_feed(url=feed_url, folder_id=folder_to_use_for_children, tag_names=feed_tags_names)
                        imported_count += 1
                        logger.info("Successfully imported feed from OPML", url=feed_url, title=feed_title, folder_id=folder_to_use_for_children)
                except Exception as e:
                    failed_count += 1
                    error_detail = {"url": feed_url, "title": feed_title, "error": str(e)}
                    errors.append(error_detail)
                    logger.error("Failed to import feed from OPML", **error_detail, user_id=self.user_id)
            
            # Recursively process children outlines
            if hasattr(outline, 'outlines') and outline.outlines:
                for child_outline in outline.outlines:
                    await process_outline(child_outline, folder_to_use_for_children)

        # Process root outlines
        for outline_item in opml_data:
            await process_outline(outline_item, default_folder_id_to_use)

        logger.info("OPML import finished", user_id=self.user_id, imported=imported_count, failed=failed_count)
        return {"imported_count": imported_count, "failed_count": failed_count, "errors": errors}

    async def export_opml(self) -> str:
        """Exports all user feeds to an OPML string."""
        logger.info("Starting OPML export process", user_id=self.user_id)
        
        opml_element = ET.Element("opml", version="2.0")
        head = ET.SubElement(opml_element, "head")
        title_el = ET.SubElement(head, "title")
        title_el.text = f"User Feeds Export - {self.user_id}"
        date_created_el = ET.SubElement(head, "dateCreated")
        date_created_el.text = datetime.now(timezone.utc).isoformat()
        body = ET.SubElement(opml_element, "body")

        user_folders = await crud_folder.get_folders_by_user(self.db, user_id=self.user_id, limit=1000) # High limit for export
        feeds_without_folder = await crud_feed.get_feeds_by_user(self.db, user_id=self.user_id, folder_id=None, limit=0) # Should be 0 if folder_id is mandatory

        folder_map: Dict[Optional[UUID], ET.Element] = {None: body} # Feeds without folder go to root body

        for folder in user_folders:
            folder_outline = ET.SubElement(body, "outline", text=folder.name, title=folder.name)
            folder_map[folder.id] = folder_outline
        
        all_user_feeds = crud_feed.get_all_feeds_for_user_by_url(self.db, user_id=self.user_id) # Fetches all, already eager loads folder and tags via get_feed
        # Or, more efficiently if get_all_feeds_for_user_by_url doesn't eager load folder/tags for this specific use-case:
        # all_user_feeds = self.db.query(Feed).options(selectinload(Feed.folder), selectinload(Feed.tags)).filter(Feed.user_id == self.user_id).all()

        for feed in all_user_feeds:
            parent_element = folder_map.get(feed.folder_id, body) # Default to body if folder somehow not in map
            
            feed_attrs = {
                "type": "rss", # Common practice, though could be atom etc.
                "text": feed.title or str(feed.url), # OPML viewers use text or title
                "title": feed.title or str(feed.url),
                "xmlUrl": str(feed.url)
            }
            if feed.link:
                feed_attrs["htmlUrl"] = str(feed.link)
            
            # Add tags as comma-separated 'category' attribute
            if feed.tags:
                tag_names = sorted([tag.name for tag in feed.tags])
                if tag_names:
                    feed_attrs["category"] = ",".join(tag_names)
            
            ET.SubElement(parent_element, "outline", **feed_attrs)

        # ET.indent(opml_element) # For pretty printing, available in Python 3.9+
        opml_string = ET.tostring(opml_element, encoding="unicode", method="xml")
        logger.info("OPML export finished", user_id=self.user_id)
        return opml_string

    async def mark_feed_articles_as_read(self, feed_id: UUID) -> int:
        """Marks all articles in a given feed as read for the current user."""
        logger.info("Marking all articles as read for feed", feed_id=feed_id, user_id=self.user_id)
        affected_count = await crud_article.mark_articles_as_read_for_feed(
            self.db, user_id=self.user_id, feed_id=feed_id
        )
        logger.info(f"{affected_count} articles marked as read for feed", feed_id=feed_id, user_id=self.user_id)
        return affected_count

    async def mark_folder_articles_as_read(self, folder_id: UUID) -> int:
        """Marks all articles in a given folder as read for the current user."""
        logger.info("Marking all articles as read for folder", folder_id=folder_id, user_id=self.user_id)
        affected_count = await crud_article.mark_articles_as_read_for_folder(
            self.db, user_id=self.user_id, folder_id=folder_id
        )
        logger.info(f"{affected_count} articles marked as read for folder", folder_id=folder_id, user_id=self.user_id)
        return affected_count

    # ... (rest of RssService, if any) ... 