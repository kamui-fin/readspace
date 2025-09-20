"""OPML processing service for import and export operations."""

import xml.etree.ElementTree as ET
from typing import Any

import structlog

from app.core.custom_exceptions import ValidationError
from app.schemas.rss_schemas import FeedResponse

logger = structlog.get_logger(__name__)


class OpmlProcessor:
    """Processes OPML files for feed import and export operations."""

    async def extract_feeds_from_opml(
        self, content: str, default_folder_name: str | None = None
    ) -> list[dict[str, Any]]:
        """Extract feed information from OPML content.

        Args:
            content: Raw OPML XML content
            default_folder_name: Default folder name for feeds without a folder

        Returns:
            List of dictionaries containing feed and folder information

        Raises:
            ValidationError: If OPML content is invalid
        """
        # Validate OPML content first
        self.validate_opml_content(content)

        try:
            root = ET.fromstring(content)  # noqa: S314
        except ET.ParseError as e:
            raise ValidationError(
                f"Invalid XML format: {str(e)}. Please check that you've uploaded a valid OPML file."
            ) from e

        feeds_data = []

        # Find the body element
        body = root.find(".//body")
        if body is not None:
            # Standard OPML format with body element
            for outline in body.findall("outline"):
                feed_data = self._process_outline_element(
                    outline, default_folder_name=default_folder_name, current_depth=0
                )
                if feed_data:
                    feeds_data.extend(feed_data)
        else:
            # Fallback: Look for outline elements anywhere in the document
            # This handles cases where OPML has non-standard structure
            direct_outlines = root.findall(".//outline")
            if direct_outlines:
                logger.info(
                    "Processing OPML with relaxed structure - no body element found", outline_count=len(direct_outlines)
                )
                for outline in direct_outlines:
                    feed_data = self._process_outline_element(
                        outline, default_folder_name=default_folder_name, current_depth=0
                    )
                    if feed_data:
                        feeds_data.extend(feed_data)
            else:
                raise ValidationError("Invalid OPML format: No body element or outline elements found")

        # Deduplicate feeds by XML URL
        seen_urls = set()
        deduplicated_feeds = []
        duplicate_count = 0

        for feed in feeds_data:
            url = feed["xml_url"]
            if url not in seen_urls:
                seen_urls.add(url)
                deduplicated_feeds.append(feed)
            else:
                duplicate_count += 1

        if duplicate_count > 0:
            logger.info(
                "Removed duplicate feeds from OPML",
                original_count=len(feeds_data),
                deduplicated_count=len(deduplicated_feeds),
                duplicates_removed=duplicate_count,
            )
            feeds_data = deduplicated_feeds

        if not feeds_data:
            raise ValidationError("No valid feeds found in OPML file")

        logger.info("OPML processing completed", feed_count=len(feeds_data))
        return feeds_data

    def _process_outline_element(
        self,
        outline: ET.Element,
        parent_folder: str | None = None,
        default_folder_name: str | None = None,
        max_depth: int = 2,
        current_depth: int = 0,
    ) -> list[dict[str, Any]]:
        """Process a single outline element and its children.

        Args:
            outline: XML outline element
            parent_folder: Parent folder name if nested
            default_folder_name: Default folder name for feeds without a folder
            max_depth: Maximum nesting depth allowed (default 2: root/category/feed)
            current_depth: Current nesting depth

        Returns:
            List of feed dictionaries
        """
        feeds_data = []

        # Get outline attributes
        title = outline.get("title", outline.get("text", ""))
        xml_url = outline.get("xmlUrl")
        html_url = outline.get("htmlUrl")
        outline.get("type", "")

        # Determine if this is a folder or a feed
        if xml_url:
            # This is a feed
            folder_name = parent_folder
            if folder_name is None and default_folder_name:
                # Only use default folder name if one is explicitly provided
                folder_name = default_folder_name

            feed_info = {
                "title": title if title is not None else "Untitled Feed",
                "xml_url": xml_url,
                "html_url": html_url,
                "folder_name": folder_name,
                "type": "feed",
            }
            feeds_data.append(feed_info)

        elif title and not xml_url:
            # This is likely a folder, process children
            folder_name = title
            if parent_folder:
                # Handle nested categories by flattening them
                if current_depth >= max_depth:
                    # Too deep, flatten by combining folder names
                    folder_name = f"{parent_folder} - {title}"
                    logger.warning(
                        "Flattening nested category",
                        original_parent=parent_folder,
                        nested_name=title,
                        flattened_name=folder_name,
                        depth=current_depth,
                    )
                else:
                    folder_name = title

            # Process child outlines
            for child in outline.findall("outline"):
                child_feeds = self._process_outline_element(
                    child,
                    folder_name,
                    default_folder_name,
                    max_depth,
                    current_depth + 1,
                )
                feeds_data.extend(child_feeds)

        return feeds_data

    async def export_feeds_to_opml(self, feeds: list[FeedResponse]) -> str:
        """Export feeds to OPML format.

        Args:
            feeds: List of FeedResponse objects to export

        Returns:
            OPML XML string
        """
        # Create root OPML structure
        opml = ET.Element("opml", version="2.0")

        # Add head element
        head = ET.SubElement(opml, "head")
        title = ET.SubElement(head, "title")
        title.text = "Readspace Feeds Export"

        # Add creation date
        from datetime import UTC, datetime

        date_created = ET.SubElement(head, "dateCreated")
        date_created.text = datetime.now(UTC).strftime("%a, %d %b %Y %H:%M:%S GMT")

        # Add body element
        body = ET.SubElement(opml, "body")

        # Group feeds by folder
        folders_dict: dict[str, list[FeedResponse]] = {}

        for feed in feeds:
            # Check if feed has folder relationship (for test compatibility)
            if hasattr(feed, "folder") and feed.folder and hasattr(feed.folder, "name"):
                folder_name = feed.folder.name
            else:
                # For FeedResponse objects, we don't have folder relationship
                # All feeds are exported as "Uncategorized"
                folder_name = "Uncategorized"

            if folder_name not in folders_dict:
                folders_dict[folder_name] = []

            folders_dict[folder_name].append(feed)

        # Create outline elements for each folder
        for folder_name, folder_feeds in folders_dict.items():
            if len(folders_dict) > 1 or folder_name != "Uncategorized":
                # Create folder outline if we have multiple folders or named folder
                folder_outline = ET.SubElement(body, "outline", text=folder_name, title=folder_name)
                parent_element = folder_outline
            else:
                # Put feeds directly in body if only uncategorized
                parent_element = body

            # Add feeds to the folder (or body)
            for feed in folder_feeds:
                feed_attrs: dict[str, str] = {
                    "text": feed.title or "Untitled Feed",
                    "title": feed.title or "Untitled Feed",
                    "type": "rss",
                    "xmlUrl": str(feed.url),
                }

                if feed.link:
                    feed_attrs["htmlUrl"] = str(feed.link)

                ET.SubElement(parent_element, "outline", **feed_attrs)  # type: ignore[arg-type]

        # Convert to string with proper formatting
        self._indent_xml(opml)
        xml_str = ET.tostring(opml, encoding="unicode", method="xml")

        # Add XML declaration
        return f'<?xml version="1.0" encoding="UTF-8"?>\n{xml_str}'

    def _indent_xml(self, elem: ET.Element, level: int = 0) -> None:
        """Add indentation to XML elements for pretty printing.

        Args:
            elem: XML element to indent
            level: Current indentation level
        """
        indent = "\n" + level * "  "

        if len(elem):
            if not elem.text or not elem.text.strip():
                elem.text = indent + "  "
            if not elem.tail or not elem.tail.strip():
                elem.tail = indent

            for child in elem:
                self._indent_xml(child, level + 1)

            if not child.tail or not child.tail.strip():
                child.tail = indent
        else:
            if level and (not elem.tail or not elem.tail.strip()):
                elem.tail = indent

    def validate_opml_content(self, content: str) -> None:
        """Validate OPML content structure.

        Args:
            content: Raw OPML content to validate

        Raises:
            ValidationError: If OPML is invalid
        """
        if not content or not content.strip():
            raise ValidationError("OPML content is empty")

        # Check if this is an RSS/Atom feed instead of OPML
        content_lower = content.lower().strip()
        if (
            content_lower.startswith("<rss")
            or content_lower.startswith("<feed")
            or ("<channel>" in content_lower and "<opml" not in content_lower)
        ):
            raise ValidationError(
                "This appears to be an RSS/Atom feed file, not an OPML file. "
                "OPML files contain lists of feeds, while RSS/Atom files contain actual feed content. "
                "Please export your feed list as OPML from your RSS reader."
            )

        try:
            root = ET.fromstring(content)  # noqa: S314
        except ET.ParseError as e:
            # Try to wrap content in a root element if it might be missing
            wrapped_content = f"<opml>{content}</opml>"
            try:
                root = ET.fromstring(wrapped_content)  # noqa: S314
                logger.info("Successfully parsed OPML by adding root element wrapper")
            except ET.ParseError:
                raise ValidationError(
                    f"Invalid XML format: {str(e)}. "
                    "Please check that you've uploaded a valid OPML file exported from your RSS reader."
                ) from e

        # Check for required OPML structure - be more permissive
        if root.tag.lower() != "opml":
            # Check if it might be another type of XML file
            if root.tag.lower() in ["rss", "feed", "atom"]:
                raise ValidationError(
                    "This appears to be an RSS/Atom feed file, not an OPML file. "
                    "Please export your feed list as OPML from your RSS reader instead of exporting individual feeds."
                )

            # Check if the root element might contain outline elements directly
            # This handles cases where the root element is missing or non-standard
            direct_outlines = root.findall(".//outline")
            if direct_outlines:
                logger.info(
                    "OPML file has non-standard root element but contains outline elements",
                    root_tag=root.tag,
                    outline_count=len(direct_outlines),
                )
                # Continue validation with relaxed requirements
            else:
                raise ValidationError(
                    f"Invalid OPML format: Root element must be 'opml' but found '{root.tag}'. "
                    "Please check that you've uploaded a valid OPML file."
                )

        # Look for body element or outline elements anywhere in the document
        body = root.find(".//body")
        if body is None:
            # Check if outline elements exist directly under root (relaxed validation)
            direct_outlines = root.findall(".//outline")
            if not direct_outlines:
                raise ValidationError("Invalid OPML format: No body element found")
            logger.info("OPML file missing body element but has outline elements", outline_count=len(direct_outlines))
        else:
            # Check for at least one outline element in body
            outlines = body.findall(".//outline")
            if not outlines:
                # Check if there are outline elements elsewhere in the document
                global_outlines = root.findall(".//outline")
                if not global_outlines:
                    raise ValidationError(
                        "Invalid OPML format: No feed entries found. "
                        "The OPML file appears to be empty or doesn't contain any feed subscriptions."
                    )
                logger.info("OPML validation passed with relaxed requirements", outline_count=len(global_outlines))
            else:
                logger.info("OPML validation passed", outline_count=len(outlines))
