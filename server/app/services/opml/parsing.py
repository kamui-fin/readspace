"""
OPML Parsing logic.
Handles reading, validation, and extraction of feeds from OPML XML.
"""

import xml.etree.ElementTree as ElementTree
from typing import Any

import structlog
from defusedxml import ElementTree as DefusedET

from app.core.custom_exceptions import ValidationError

logger = structlog.get_logger(__name__)

# 10MB Limit
MAX_OPML_SIZE_BYTES = 10 * 1024 * 1024

def parse_opml(content: str, default_folder_name: str | None = None) -> list[dict[str, Any]]:
    """
    Parse OPML content string and return a flat list of feeds.
    """
    # 1. Safety Checks
    if not content or not content.strip():
        raise ValidationError("OPML content is empty")

    content_size = len(content.encode("utf-8"))
    if content_size > MAX_OPML_SIZE_BYTES:
        raise ValidationError(f"OPML file too large ({content_size/1024/1024:.1f}MB)")

    # 2. Parse XML (Defused for security)
    try:
        root = DefusedET.fromstring(content)
    except DefusedET.ParseError as e:
        # Try wrapping in case of missing root (common in malformed exports)
        try:
            root = DefusedET.fromstring(f"<opml>{content}</opml>")
        except DefusedET.ParseError:
            raise ValidationError(f"Invalid XML format: {str(e)}") from e

    # 3. Validate Structure
    if root.tag.lower() != "opml":
        # Simple check to prevent uploading RSS feeds as OPML
        if root.tag.lower() in ["rss", "feed", "channel"]:
            raise ValidationError("File appears to be an RSS feed, not an OPML export.")
        # If it has outline tags, we'll be lenient
        if not root.findall(".//outline"):
             raise ValidationError("Invalid OPML: Root is not 'opml' and no outlines found.")

    # 4. Extraction Strategy
    feeds_data = []
    
    # Strategy A: Standard Body
    body = root.find(".//body")
    if body is not None:
        for outline in body.findall("outline"):
            feeds_data.extend(_process_outline(outline, default_folder_name=default_folder_name))
    else:
        # Strategy B: Loose Outlines (No body tag)
        outlines = root.findall(".//outline")
        if not outlines:
            raise ValidationError("No feed entries found in file.")
        
        for outline in outlines:
            feeds_data.extend(_process_outline(outline, default_folder_name=default_folder_name))

    # 5. Deduplication (by XML URL)
    unique_feeds = {}
    for feed in feeds_data:
        if feed["xml_url"]:
            unique_feeds[feed["xml_url"]] = feed
            
    results = list(unique_feeds.values())
    
    if not results:
        raise ValidationError("No valid feed URLs found in OPML.")

    return results

def _process_outline(
    outline: ElementTree.Element,
    parent_folder: str | None = None,
    default_folder_name: str | None = None,
    current_depth: int = 0,
    max_depth: int = 2
) -> list[dict[str, Any]]:
    """
    Recursive function to extract feeds from outline elements.
    Flattens nested folder structures if they exceed max_depth.
    """
    feeds = []
    
    # Attributes
    title = outline.get("title") or outline.get("text") or "Untitled"
    xml_url = outline.get("xmlUrl")
    html_url = outline.get("htmlUrl")
    
    # Case 1: It's a Feed
    if xml_url:
        folder = parent_folder or default_folder_name
        feeds.append({
            "title": title,
            "xml_url": xml_url,
            "html_url": html_url,
            "folder_name": folder,
            "type": "feed"
        })
    
    # Case 2: It's a Folder (has title, no xmlUrl, potential children)
    elif title:
        # Determine folder name for children
        new_folder_name = title
        
        # Handle flattening for deep nesting
        if parent_folder:
            if current_depth >= max_depth:
                new_folder_name = f"{parent_folder} - {title}"
            else:
                new_folder_name = title # In a flat list, we usually just take the immediate parent
                # Alternatively, you could do f"{parent_folder} - {title}" always to preserve hierarchy name

        # Recursion
        for child in outline.findall("outline"):
            feeds.extend(_process_outline(
                child, 
                parent_folder=new_folder_name,
                default_folder_name=default_folder_name,
                current_depth=current_depth + 1,
                max_depth=max_depth
            ))

    return feeds