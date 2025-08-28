"""OPML processing service for import and export operations."""

import xml.etree.ElementTree as ET
from typing import Any

import structlog

from app.core.custom_exceptions import ValidationError
from app.models.rss_models import Feed

logger = structlog.get_logger(__name__)


class OpmlProcessor:
    """Processes OPML files for feed import and export operations."""

    async def extract_feeds_from_opml(
        self, content: str, default_folder_name: str = None
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
        try:
            root = ET.fromstring(content)
        except ET.ParseError as e:
            raise ValidationError(f"Invalid OPML XML format: {str(e)}")

        # Find the body element
        body = root.find(".//body")
        if body is None:
            raise ValidationError("Invalid OPML format: No body element found")

        feeds_data = []

        # Process only direct child outline elements (not recursive)
        for outline in body.findall("outline"):
            feed_data = self._process_outline_element(
                outline, default_folder_name=default_folder_name
            )
            if feed_data:
                feeds_data.extend(feed_data)

        if not feeds_data:
            raise ValidationError("No valid feeds found in OPML file")

        logger.info("OPML processing completed", feed_count=len(feeds_data))
        return feeds_data

    def _process_outline_element(
        self,
        outline: ET.Element,
        parent_folder: str = None,
        default_folder_name: str = None,
    ) -> list[dict[str, Any]]:
        """Process a single outline element and its children.

        Args:
            outline: XML outline element
            parent_folder: Parent folder name if nested
            default_folder_name: Default folder name for feeds without a folder

        Returns:
            List of feed dictionaries
        """
        feeds_data = []

        # Get outline attributes
        title = outline.get("title", outline.get("text", ""))
        xml_url = outline.get("xmlUrl")
        html_url = outline.get("htmlUrl")
        outline_type = outline.get("type", "")

        # Determine if this is a folder or a feed
        if xml_url:
            # This is a feed
            folder_name = parent_folder
            if folder_name is None and default_folder_name:
                folder_name = default_folder_name

            feed_info = {
                "title": title,
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
                folder_name = f"{parent_folder}/{title}"

            # Process child outlines
            for child in outline.findall("outline"):
                child_feeds = self._process_outline_element(
                    child, folder_name, default_folder_name
                )
                feeds_data.extend(child_feeds)

        return feeds_data

    async def export_feeds_to_opml(self, feeds: list[Feed]) -> str:
        """Export feeds to OPML format.

        Args:
            feeds: List of Feed objects to export

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
        folders_dict = {}

        for feed in feeds:
            folder_name = feed.folder.name if feed.folder else "Uncategorized"

            if folder_name not in folders_dict:
                folders_dict[folder_name] = []

            folders_dict[folder_name].append(feed)

        # Create outline elements for each folder
        for folder_name, folder_feeds in folders_dict.items():
            if len(folders_dict) > 1 or folder_name != "Uncategorized":
                # Create folder outline if we have multiple folders or named folder
                folder_outline = ET.SubElement(
                    body, "outline", text=folder_name, title=folder_name
                )
                parent_element = folder_outline
            else:
                # Put feeds directly in body if only uncategorized
                parent_element = body

            # Add feeds to the folder (or body)
            for feed in folder_feeds:
                feed_attrs = {
                    "text": feed.title,
                    "title": feed.title,
                    "type": "rss",
                    "xmlUrl": feed.url,
                }

                if feed.link:
                    feed_attrs["htmlUrl"] = feed.link

                ET.SubElement(parent_element, "outline", **feed_attrs)

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

        try:
            root = ET.fromstring(content)
        except ET.ParseError as e:
            raise ValidationError(f"Invalid OPML XML format: {str(e)}")

        # Check for required OPML structure
        if root.tag.lower() != "opml":
            raise ValidationError("Invalid OPML format: Root element must be 'opml'")

        body = root.find(".//body")
        if body is None:
            raise ValidationError("Invalid OPML format: No body element found")

        # Check for at least one outline element
        outlines = body.findall(".//outline")
        if not outlines:
            raise ValidationError("Invalid OPML format: No outline elements found")

        logger.info("OPML validation passed", outline_count=len(outlines))
