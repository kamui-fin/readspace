"""OPML parsing utilities using listparser."""

import listparser
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
    from io import BytesIO

    import defusedxml.ElementTree as ElementTree

    # 1. Strict XML Validation & Root Tag Check
    try:
        # Handle both str and bytes
        if isinstance(opml_content, str):
            content_bytes = opml_content.encode("utf-8")
        else:
            content_bytes = opml_content

        # Parse XML to check root element
        # This will raise ParseError if XML is malformed
        tree = ElementTree.parse(BytesIO(content_bytes))
        root = tree.getroot()

        if root.tag.lower() != "opml":
            raise ValueError("Root element must be <opml>")

    except ElementTree.ParseError as e:
        logger.error("Invalid XML structure", error=str(e))
        raise ValueError(f"Invalid XML format: {e}") from e
    except Exception as e:
        logger.error("Failed to validate OPML structure", error=str(e))
        raise ValueError(f"Invalid OPML file: {e}") from e

    # 2. Parse with listparser (lenient but we validated structure)
    try:
        parsed = listparser.parse(opml_content)
    except Exception as e:
        logger.error("Failed to parse OPML content", error=str(e))
        raise ValueError(f"Failed to parse OPML content: {e}") from e

    feeds = []
    for feed in parsed.feeds:
        feed_dict = {
            "xml_url": feed.url,
            "title": feed.title,
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


def get_folder_name(categories, full_path: bool = True, separator: str = " / ") -> str:
    """
    Safely extracts a string representation from listparser categories.

    Args:
        categories (list): The objects[i].categories list (list of lists).
        full_path (bool): If True, returns 'News / Tech'. If False, returns 'Tech'.
        separator (str): The divider string used if full_path is True.

    Returns:
        str: The formatted folder string, or an empty string if none exists.
    """
    # 1. Safety Check: Ensure categories is not None and not empty
    if not categories:
        return ""

    # 2. Extract the first hierarchy path.
    # listparser returns a list of lists (e.g., [['News', 'Tech']]).
    # We usually care about the first one found.
    primary_hierarchy = categories[0]

    # Safety Check: Ensure the inner list isn't empty
    if not primary_hierarchy:
        return ""

    # 3. Return the string based on preference
    if full_path:
        # Returns "News / Sports / ESPN"
        return separator.join(primary_hierarchy)
    else:
        # Returns just "ESPN" (the immediate folder)
        return primary_hierarchy[-1]


def _extract_folder_name(feed, default: str) -> str:
    """Extract folder/category name from feed, with fallback."""
    if hasattr(feed, "categories") and feed.categories:
        folder_name = get_folder_name(feed.categories, full_path=False)
        return folder_name if folder_name else default
    return default
