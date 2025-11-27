"""OPML parsing utilities using listparser2."""

import listparser2 as listparser
import structlog

logger = structlog.get_logger(__name__)


def parse_opml(opml_content: str | bytes, default_folder_name: str = "Imported Feeds") -> list[dict]:
    """
    Parse OPML content and extract feeds with folder structure.
    
    Args:
        opml_content: OPML file content as string or bytes
        default_folder_name: Fallback folder name for feeds without a category
        
    Returns:
        List of feed dictionaries with keys: xml_url, title, folder_name
    """
    try:
        parsed = listparser.parse(opml_content)
    except Exception as e:
        logger.error("Failed to parse OPML", error=str(e))
        raise ValueError(f"Invalid OPML format: {e}")
    
    feeds = []
    for feed in parsed.feeds:
        feed_dict = {
            "xml_url": feed.url,
            "title": feed.title or "Untitled Feed",
            "folder_name": _extract_folder_name(feed, default_folder_name),
        }
        feeds.append(feed_dict)
    
    return feeds


def extract_opml_metadata(opml_content: str | bytes) -> tuple[str | None, str | None]:
    """
    Extract title and author from OPML metadata.
    
    Args:
        opml_content: OPML file content as string or bytes
        
    Returns:
        Tuple of (title, author) - both can be None if not present
    """
    try:
        parsed = listparser.parse(opml_content)
    except Exception as e:
        logger.warning("Failed to extract OPML metadata", error=str(e))
        return None, None
    
    # Extract title
    opml_title = parsed.meta.get("title")
    
    # Extract author (can be string or dict)
    opml_author = None
    if "author" in parsed.meta:
        author_data = parsed.meta["author"]
        if isinstance(author_data, dict):
            # Try name first, fallback to email
            opml_author = author_data.get("name") or author_data.get("email")
        elif isinstance(author_data, str):
            opml_author = author_data
    
    return opml_title, opml_author


def _extract_folder_name(feed, default: str) -> str:
    """Extract folder/category name from feed, with fallback."""
    # listparser provides categories as a list
    if hasattr(feed, "categories") and feed.categories:
        # Use the first category as folder name
        return feed.categories[0]
    return default
