from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from app.crud import (
    crud_folder,  # To validate folder
    crud_tag,  # To get/validate tags
)
from app.models.rss_models import Feed, Tag
from app.schemas.rss_schemas import (  # FeedBase for initial data
    FeedBase,
    FeedCreate,
    FeedUpdate,
)
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

# Constants for refresh logic (in minutes)
MIN_REFRESH_INTERVAL_MINUTES = 15
DEFAULT_REFRESH_INTERVAL_MINUTES = 60
MAX_REFRESH_INTERVAL_MINUTES = 24 * 60  # 1 day
ERROR_BACKOFF_BASE_MINUTES = 30 # Base delay for first error
MAX_ERROR_BACKOFF_MINUTES = 12 * 60 # Max delay due to errors

async def get_feed(db: AsyncSession, *, feed_id: UUID, user_id: UUID) -> Optional[Feed]:
    """Get a specific feed by its ID and user ID, with folder and tags eager loaded."""
    result = await db.execute(
        select(Feed)
        .options(selectinload(Feed.folder), selectinload(Feed.tags))
        .filter(Feed.id == feed_id, Feed.user_id == user_id)
    )
    return result.scalars().first()

async def get_feed_by_id_for_system(db: AsyncSession, *, feed_id: UUID) -> Optional[Feed]:
    """Get a specific feed by its ID for system tasks (no user_id check). Eager loads folder and tags."""
    result = await db.execute(
        select(Feed)
        .options(selectinload(Feed.folder), selectinload(Feed.tags)) # Eager load for RssService
        .filter(Feed.id == feed_id)
    )
    return result.scalars().first()

async def get_feed_by_url(db: AsyncSession, *, url: str, user_id: UUID) -> Optional[Feed]:
    """Get a specific feed by its URL and user ID."""
    result = await db.execute(
        select(Feed).filter(Feed.url == url, Feed.user_id == user_id)
    )
    return result.scalars().first()

async def get_feeds_by_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    skip: int = 0,
    limit: int = 100,
    folder_id: Optional[UUID] = None,
    tag_names: Optional[List[str]] = None,
    is_favorite: Optional[bool] = None,
    search_query: Optional[str] = None,
) -> List[Feed]:
    """Get feeds for a user, with filtering options and eager loading."""
    stmt = select(Feed).options(selectinload(Feed.folder), selectinload(Feed.tags)).filter(Feed.user_id == user_id)

    if folder_id:
        stmt = stmt.filter(Feed.folder_id == folder_id)
    
    if is_favorite is not None:
        stmt = stmt.filter(Feed.is_favorite == is_favorite)

    if tag_names:
        # Assuming tag names are already normalized (e.g., lowercase) if that's the storage strategy
        # For "feeds that have ALL specified tags"
        # This requires one join per tag name for correctness with select()
        for i, tag_name in enumerate(tag_names):
            tag_alias = aliased(Tag, name=f"tag_{i}")
            stmt = stmt.join(tag_alias, Feed.tags).filter(tag_alias.name.ilike(tag_name))
        # If "ANY" of the tags:
        # stmt = stmt.join(Feed.tags).filter(Tag.name.ilike.any_(tag_names)) # Might need func.lower
        # stmt = stmt.distinct()

    if search_query:
        stmt = stmt.filter(Feed.title.ilike(f"%{search_query}%"))

    stmt = stmt.order_by(Feed.title).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()

async def create_feed(
    db: AsyncSession, *, feed_in: FeedCreate, user_id: UUID, initial_feed_data: Optional[FeedBase] = None
) -> Feed:
    """Create a new feed for a user."""
    folder = await crud_folder.get_folder(db, folder_id=feed_in.folder_id, user_id=user_id)
    if not folder:
        raise ValueError(f"Folder with id {feed_in.folder_id} not found for this user.")

    existing_feed = await get_feed_by_url(db, url=str(feed_in.url), user_id=user_id)
    if existing_feed:
        raise IntegrityError(
            f"Feed with URL '{feed_in.url}' already exists for this user.",
            params=None, orig=None
        )

    feed_data_dict = {
        "url": str(feed_in.url),
        "user_id": user_id,
        "folder_id": feed_in.folder_id,
        "is_favorite": False,
    }
    if initial_feed_data:
        feed_data_dict.update(initial_feed_data.model_dump(exclude_unset=True))
    
    db_feed = Feed(**feed_data_dict)

    if feed_in.tag_ids:
        for tag_id in feed_in.tag_ids:
            tag = await crud_tag.get_tag(db, tag_id=tag_id, user_id=user_id)
            if tag:
                db_feed.tags.append(tag)
            else:
                raise ValueError(f"Tag with id {tag_id} not found for this user.")

    db.add(db_feed)
    await db.commit()
    await db.refresh(db_feed)
    
    # Re-fetch to ensure relationships are loaded as get_feed does options(selectinload(...))
    # This is important because db_feed.tags and db_feed.folder might not be populated by db.refresh alone
    # in the way get_feed would populate them.
    refetched_feed = await get_feed(db, feed_id=db_feed.id, user_id=user_id)
    if refetched_feed is None: # Should not happen
        raise RuntimeError("Failed to refetch newly created feed.")
    return refetched_feed

async def update_feed(
    db: AsyncSession, *, feed_db: Feed, feed_in: FeedUpdate,
    parsed_feed_data: Optional[FeedBase] = None
) -> Feed:
    """Update an existing feed."""
    update_data = feed_in.model_dump(exclude_unset=True)
    user_id = feed_db.user_id

    if "folder_id" in update_data and update_data["folder_id"] != feed_db.folder_id:
        new_folder_id = update_data["folder_id"]
        if new_folder_id is None: # Should not happen if schema enforces UUID
             raise ValueError("Folder ID cannot be null.")
        new_folder = await crud_folder.get_folder(db, folder_id=new_folder_id, user_id=user_id)
        if not new_folder:
            raise ValueError(f"New folder with id {new_folder_id} not found for this user.")
        feed_db.folder_id = new_folder.id

    if "tag_ids" in update_data:
        feed_db.tags.clear() # This is a synchronous operation on a list-like collection
        if update_data["tag_ids"]:
            for tag_id in update_data["tag_ids"]:
                tag = await crud_tag.get_tag(db, tag_id=tag_id, user_id=user_id)
                if tag:
                    feed_db.tags.append(tag)
                else:
                    raise ValueError(f"Tag with id {tag_id} not found for this user.")
    
    if "is_favorite" in update_data:
        is_fav = update_data["is_favorite"]
        if is_fav is not None: # Ensure boolean is actually provided
             feed_db.is_favorite = is_fav
    
    if "title" in update_data:
        feed_db.title = update_data["title"]
    
    if parsed_feed_data:
        parsed_dict = parsed_feed_data.model_dump(exclude_unset=True)
        for key, value in parsed_dict.items():
            if key == "title" and "title" in update_data:
                continue
            if hasattr(feed_db, key) and getattr(feed_db, key) != value:
                setattr(feed_db, key, value)

    db.add(feed_db) # Stage changes
    await db.commit()
    await db.refresh(feed_db)
    
    refetched_feed = await get_feed(db, feed_id=feed_db.id, user_id=user_id)
    if refetched_feed is None: # Should not happen
        raise RuntimeError("Failed to refetch updated feed.")
    return refetched_feed

async def update_feed_fetch_metadata(
    db: AsyncSession,
    *,
    feed_db: Feed,
    title: Optional[str] = None,
    description: Optional[str] = None,
    link: Optional[str] = None,
    language: Optional[str] = None,
    image_url: Optional[str] = None,
    ttl: Optional[int] = None,
    skip_hours: Optional[List[int]] = None,
    skip_days: Optional[List[str]] = None,
    last_modified: Optional[str] = None,
    etag: Optional[str] = None,
    last_fetched_at: Optional[datetime] = None
) -> Feed:
    """Update feed details after a successful fetch or from parsed data."""
    if title is not None and feed_db.title != title:
        feed_db.title = title
    if description is not None and feed_db.description != description:
        feed_db.description = description
    if link is not None and feed_db.link != str(link): # Ensure comparison with string form
        feed_db.link = str(link)
    if language is not None and feed_db.language != language:
        feed_db.language = language
    if image_url is not None and feed_db.image_url != str(image_url): # Ensure comparison with string form
        feed_db.image_url = str(image_url)
    
    if ttl is not None: feed_db.ttl = ttl
    if skip_hours is not None: feed_db.skip_hours = skip_hours
    if skip_days is not None: feed_db.skip_days = skip_days
    if last_modified is not None: feed_db.last_modified_header = last_modified
    if etag is not None: feed_db.etag_header = etag
    if last_fetched_at is not None: feed_db.last_fetched_at = last_fetched_at
    
    feed_db.fetch_error_count = 0
    feed_db.last_error_message = None

    db.add(feed_db)
    await db.commit()
    await db.refresh(feed_db)
    return feed_db

async def update_feed_fetch_error(
    db: AsyncSession, *, feed_db: Feed, error_message: str
) -> Feed:
    """Update feed fetch error count and message."""
    feed_db.fetch_error_count = (feed_db.fetch_error_count or 0) + 1
    feed_db.last_error_message = error_message
    feed_db.last_fetched_at = datetime.now(timezone.utc)
    db.add(feed_db)
    await db.commit()
    await db.refresh(feed_db)
    return feed_db

async def delete_feed(db: AsyncSession, *, feed_id: UUID, user_id: UUID) -> Optional[Feed]:
    """Delete a feed by its ID and user ID.
    Associated articles will be cascade deleted.
    """
    db_feed = await get_feed(db, feed_id=feed_id, user_id=user_id)
    if db_feed:
        await db.delete(db_feed)
        await db.commit()
    return db_feed

async def get_all_feeds_for_user_by_url(db: AsyncSession, *, user_id: UUID) -> List[Feed]:
    """Retrieve all feeds for a user, primarily for OPML export or background processing.
       Returns a list of Feed objects, consider not loading all relationships if not needed.
    """
    stmt = select(Feed).options(selectinload(Feed.folder), selectinload(Feed.tags)).filter(Feed.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalars().all()

async def get_feeds_needing_refresh(db: AsyncSession, *, limit: int = 100) -> List[Feed]:
    """Get feeds that might need refreshing based on TTL, errors, and last fetched time."""
    now = datetime.now(timezone.utc)

    # For feeds never fetched, they are top priority
    never_fetched_stmt = (
        select(Feed)
        .filter(Feed.last_fetched_at == None)
        .order_by(Feed.created_at.asc())
        .limit(limit)
    )
    never_fetched_result = await db.execute(never_fetched_stmt)
    feeds_needing_refresh = list(never_fetched_result.scalars().all()) # Convert to list
    remaining_limit = limit - len(feeds_needing_refresh)

    if remaining_limit > 0:
        min_interval_ago = now - timedelta(minutes=MIN_REFRESH_INTERVAL_MINUTES)
        
        # Fetch candidate feeds that have been fetched before and are older than min_interval_ago
        # Order to prioritize errored feeds and then older fetches
        candidate_feeds_stmt = (
            select(Feed)
            .filter(Feed.last_fetched_at != None)
            .filter(Feed.last_fetched_at < min_interval_ago)
            .order_by(Feed.fetch_error_count.desc().nulls_last(), Feed.last_fetched_at.asc())
            .limit(remaining_limit * 5)  # Fetch a larger candidate set (e.g., * 5)
        )
        candidate_result = await db.execute(candidate_feeds_stmt)
        candidates = candidate_result.scalars().all()
        
        actually_due_feeds: List[Feed] = []
        for feed in candidates:
            if len(actually_due_feeds) >= remaining_limit:
                break

            current_utc_hour = now.hour
            current_utc_weekday = now.weekday()

            if feed.skip_hours and current_utc_hour in feed.skip_hours:
                continue
            
            if feed.skip_days:
                days_of_week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                current_day_name = days_of_week[current_utc_weekday]
                if current_day_name in feed.skip_days:
                    continue

            item_delay_minutes = DEFAULT_REFRESH_INTERVAL_MINUTES
            if feed.fetch_error_count and feed.fetch_error_count > 0:
                current_backoff = ERROR_BACKOFF_BASE_MINUTES * (2**(feed.fetch_error_count - 1))
                item_delay_minutes = min(current_backoff, MAX_ERROR_BACKOFF_MINUTES)
            elif feed.ttl is not None:
                item_delay_minutes = max(MIN_REFRESH_INTERVAL_MINUTES, min(feed.ttl, MAX_REFRESH_INTERVAL_MINUTES))
            
            if feed.last_fetched_at is None: # Should have been caught by never_fetched_stmt, but as a safeguard
                 actually_due_feeds.append(feed)
                 continue

            next_fetch_time = feed.last_fetched_at + timedelta(minutes=item_delay_minutes)
            if now >= next_fetch_time:
                actually_due_feeds.append(feed)
        
        feeds_needing_refresh.extend(actually_due_feeds)

    return feeds_needing_refresh[:limit] 