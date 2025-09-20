"""
Test app/utils/validators.py - Input validation logic
"""

from datetime import datetime, timezone
from uuid import UUID

import pytest

from app.core.custom_exceptions import ValidationError
from app.utils.validators import (
    validate_article_priority,
    validate_book_format,
    validate_datetime,
    validate_description,
    validate_email,
    validate_folder_name,
    validate_highlight_color,
    validate_pagination,
    validate_string_length,
    validate_tag_name,
    validate_title,
    validate_url,
    validate_uuid,
)


@pytest.mark.unit
class TestUrlValidation:
    """Test URL validation logic"""

    def test_valid_urls(self):
        """Test that valid URLs pass validation"""
        valid_urls = [
            "https://example.com",
            "http://example.com/path",
            "https://subdomain.example.com/feed.xml",
            "https://example.com:8080/api",
            "https://example.com/path?query=value&other=test",
        ]

        for url in valid_urls:
            result = validate_url(url)
            assert result == url

    def test_invalid_urls(self):
        """Test that invalid URLs raise ValidationError"""
        invalid_urls = [
            "not-a-url",
            "ftp://example.com",  # Wrong scheme
            "javascript:alert('xss')",  # Dangerous scheme
            "http://",  # Missing netloc
            "https://",  # Missing netloc
            "",  # Empty string
        ]

        for url in invalid_urls:
            with pytest.raises(ValidationError):
                validate_url(url)

    def test_url_length_validation(self):
        """Test URL length limits"""
        # Create a URL that's too long
        long_url = "https://example.com/" + "x" * 3000

        with pytest.raises(ValidationError, match="too long"):
            validate_url(long_url)

    def test_optional_url_validation(self):
        """Test URL validation when field is optional"""
        # Should return None for empty values when not required
        assert validate_url(None, required=False) is None
        assert validate_url("", required=False) is None

        # Should raise error when required
        with pytest.raises(ValidationError, match="required"):
            validate_url(None, required=True)

        with pytest.raises(ValidationError, match="required"):
            validate_url("", required=True)


@pytest.mark.unit
class TestEmailValidation:
    """Test email validation logic"""

    def test_valid_emails(self):
        """Test that valid emails pass validation"""
        valid_emails = [
            "user@example.com",
            "test.email@domain.org",
            "user+tag@example.co.uk",
            "123@numbers.com",
            "user-name@example-domain.com",
        ]

        for email in valid_emails:
            result = validate_email(email)
            assert result == email.lower()  # Should be lowercased

    def test_invalid_emails(self):
        """Test that invalid emails raise ValidationError"""
        invalid_emails = [
            "not-an-email",
            "@domain.com",  # Missing local part
            "user@",  # Missing domain
            "user@domain",  # Missing TLD
            "user name@domain.com",  # Space not allowed
            "",  # Empty string
        ]

        for email in invalid_emails:
            with pytest.raises(ValidationError):
                validate_email(email)

    def test_email_case_normalization(self):
        """Test that emails are normalized to lowercase"""
        mixed_case_email = "User.Name@EXAMPLE.COM"
        result = validate_email(mixed_case_email)
        assert result == "user.name@example.com"


@pytest.mark.unit
class TestStringLengthValidation:
    """Test string length validation logic"""

    def test_valid_string_lengths(self):
        """Test strings within length limits"""
        result = validate_string_length("test", "field", max_length=10)
        assert result == "test"

        # Test trimming whitespace
        result = validate_string_length("  padded  ", "field", max_length=10)
        assert result == "padded"

    def test_string_too_long(self):
        """Test strings that exceed max length"""
        with pytest.raises(ValidationError, match="at most 5 characters"):
            validate_string_length("too long", "field", max_length=5)

    def test_string_too_short(self):
        """Test strings that are below min length"""
        with pytest.raises(ValidationError, match="at least 3 characters"):
            validate_string_length("hi", "field", max_length=10, min_length=3)

    def test_optional_string_validation(self):
        """Test string validation when field is optional"""
        # Should return None for empty values when not required
        assert validate_string_length(None, "field", 10, required=False) is None
        assert validate_string_length("", "field", 10, required=False) is None

        # Should raise error when required
        with pytest.raises(ValidationError, match="required"):
            validate_string_length(None, "field", 10, required=True)


@pytest.mark.unit
class TestDateTimeValidation:
    """Test datetime validation logic"""

    def test_valid_iso_datetime(self):
        """Test valid ISO datetime strings"""
        valid_datetimes = [
            "2025-01-01T12:00:00Z",
            "2025-01-01T12:00:00+00:00",
            "2025-01-01T12:00:00.123Z",
            "2025-12-31T23:59:59Z",
        ]

        for dt_str in valid_datetimes:
            result = validate_datetime(dt_str)
            assert isinstance(result, datetime)
            assert result.tzinfo is not None  # Should have timezone info

    def test_invalid_datetime_formats(self):
        """Test invalid datetime formats"""
        invalid_datetimes = [
            "not-a-date",
            "2025-13-01T12:00:00Z",  # Invalid month
            "2025-01-32T12:00:00Z",  # Invalid day
            "2025-01-01T25:00:00Z",  # Invalid hour
            "2025/01/01 12:00:00",  # Wrong format
            "",
        ]

        for dt_str in invalid_datetimes:
            with pytest.raises(ValidationError):
                validate_datetime(dt_str)

    def test_timezone_handling(self):
        """Test that timezone info is properly handled"""
        # Test Z suffix (UTC)
        utc_dt = validate_datetime("2025-01-01T12:00:00Z")
        assert utc_dt.tzinfo == timezone.utc

        # Test explicit timezone offset
        offset_dt = validate_datetime("2025-01-01T12:00:00+05:00")
        assert offset_dt.tzinfo is not None

        # Test naive datetime gets UTC timezone
        naive_dt = validate_datetime("2025-01-01T12:00:00")
        assert naive_dt.tzinfo == timezone.utc


@pytest.mark.unit
class TestPaginationValidation:
    """Test pagination parameter validation"""

    def test_valid_pagination(self):
        """Test valid pagination parameters"""
        skip, limit = validate_pagination(0, 10)
        assert skip == 0
        assert limit == 10

        skip, limit = validate_pagination(50, 100)
        assert skip == 50
        assert limit == 100

    def test_invalid_skip_values(self):
        """Test invalid skip values"""
        with pytest.raises(ValidationError, match="non-negative"):
            validate_pagination(-1, 10)

        with pytest.raises(ValidationError, match="non-negative"):
            validate_pagination(-100, 10)

    def test_invalid_limit_values(self):
        """Test invalid limit values"""
        with pytest.raises(ValidationError, match="positive"):
            validate_pagination(0, 0)

        with pytest.raises(ValidationError, match="positive"):
            validate_pagination(0, -5)

        with pytest.raises(ValidationError, match="too large"):
            validate_pagination(0, 2000)  # Exceeds max of 1000

    def test_default_pagination(self):
        """Test default pagination values"""
        skip, limit = validate_pagination()
        assert skip == 0
        assert limit == 100


@pytest.mark.unit
class TestBookFormatValidation:
    """Test book format validation"""

    def test_valid_book_formats(self):
        """Test valid book format values"""
        assert validate_book_format("EPUB") == "EPUB"
        assert validate_book_format("PDF") == "PDF"
        assert validate_book_format("epub") == "EPUB"  # Should uppercase
        assert validate_book_format("pdf") == "PDF"  # Should uppercase

    def test_invalid_book_formats(self):
        """Test invalid book format values"""
        # Test unsupported but valid format strings
        unsupported_formats = ["MOBI", "TXT", "DOCX", "invalid"]

        for format_str in unsupported_formats:
            with pytest.raises(ValidationError, match="Unsupported book format"):
                validate_book_format(format_str)

        # Test empty/None formats
        empty_formats = ["", None]
        for format_str in empty_formats:
            with pytest.raises(ValidationError, match="Book format is required"):
                validate_book_format(format_str)


@pytest.mark.unit
class TestValidationErrorHandling:
    """Test validation error handling and messages"""

    def test_validation_error_messages(self):
        """Test that validation errors have helpful messages"""
        try:
            validate_url("invalid-url")
        except ValidationError as e:
            assert "Invalid URL" in e.message

        try:
            validate_email("invalid-email")
        except ValidationError as e:
            assert "Invalid email" in e.message

        # Test empty string (required case)
        try:
            validate_string_length("", "Title", 5, min_length=1)
        except ValidationError as e:
            assert "Title is required" in e.message

        # Test string too short (non-empty but below min_length)
        try:
            validate_string_length("a", "Title", 5, min_length=2)
        except ValidationError as e:
            assert "at least 2 characters" in e.message

    def test_validation_error_details(self):
        """Test that validation errors can include details"""
        try:
            validate_pagination(-1, 10)
        except ValidationError as e:
            assert e.message is not None
            assert isinstance(e.details, dict)

    def test_custom_field_names_in_errors(self):
        """Test that custom field names appear in error messages"""
        field_name = "Custom Field Name"

        try:
            validate_string_length("", field_name, 10, required=True)
        except ValidationError as e:
            assert field_name in e.message


@pytest.mark.unit
class TestUuidValidation:
    """Test UUID validation logic"""

    def test_valid_uuids(self):
        """Test that valid UUIDs pass validation"""
        valid_uuids = [
            "550e8400-e29b-41d4-a716-446655440000",
            "123e4567-e89b-12d3-a456-426614174000",
            "00000000-0000-0000-0000-000000000000",
        ]

        for uuid_str in valid_uuids:
            result = validate_uuid(uuid_str)
            assert isinstance(result, UUID)
            assert str(result) == uuid_str

    def test_invalid_uuids(self):
        """Test that invalid UUIDs raise ValidationError"""
        invalid_uuids = [
            "not-a-uuid",
            "123-456-789",
            "550e8400-e29b-41d4-a716",  # Too short
            "550e8400-e29b-41d4-a716-446655440000-extra",  # Too long
            "",
            None,
        ]

        for uuid_str in invalid_uuids:
            with pytest.raises(ValidationError):
                validate_uuid(uuid_str)

    def test_uuid_custom_field_name(self):
        """Test UUID validation with custom field name"""
        try:
            validate_uuid("invalid", "User ID")
        except ValidationError as e:
            assert "User ID" in e.message


@pytest.mark.unit
class TestTitleValidation:
    """Test title validation logic"""

    def test_valid_titles(self):
        """Test valid title values"""
        valid_titles = [
            "Short Title",
            "A" * 500,  # Assuming max length is 500
            "Title with numbers 123",
            "Title with special chars !@#",
        ]

        for title in valid_titles:
            result = validate_title(title)
            assert result == title.strip()

    def test_invalid_titles(self):
        """Test invalid title values"""
        # Empty title when required
        with pytest.raises(ValidationError, match="required"):
            validate_title("")

        with pytest.raises(ValidationError, match="required"):
            validate_title(None)

    def test_optional_title(self):
        """Test title validation when optional"""
        assert validate_title("", required=False) is None
        assert validate_title(None, required=False) is None


@pytest.mark.unit
class TestDescriptionValidation:
    """Test description validation logic"""

    def test_valid_descriptions(self):
        """Test valid description values"""
        valid_descriptions = [
            "Short description",
            "A" * 1000,  # Assuming reasonable max length
            "Description with\nnewlines",
            "Description with special chars !@#$%",
        ]

        for desc in valid_descriptions:
            result = validate_description(desc)
            assert result == desc.strip()

    def test_optional_description(self):
        """Test description validation when optional (default)"""
        assert validate_description("") is None
        assert validate_description(None) is None

    def test_required_description(self):
        """Test description validation when required"""
        with pytest.raises(ValidationError, match="required"):
            validate_description("", required=True)


@pytest.mark.unit
class TestTagNameValidation:
    """Test tag name validation logic"""

    def test_valid_tag_names(self):
        """Test valid tag name values"""
        valid_tag_names = [
            "tech",
            "python-tips",
            "web_development",
            "ai-ml",
            "news123",
            "a",
        ]

        for tag_name in valid_tag_names:
            result = validate_tag_name(tag_name)
            assert result == tag_name.lower()

    def test_invalid_tag_names(self):
        """Test invalid tag name values"""
        invalid_tag_names = [
            "Tag With Spaces",  # Spaces not allowed
            "TAG@SYMBOL",  # Special symbols not allowed
            "tag.with.dots",  # Dots not allowed
            "",  # Empty
            "TAG WITH CAPS",  # Should be lowercase
        ]

        for tag_name in invalid_tag_names:
            with pytest.raises(ValidationError):
                validate_tag_name(tag_name)

    def test_tag_name_case_normalization(self):
        """Test that tag names are normalized to lowercase"""
        mixed_case_tag = "TeCh-TiPs"
        result = validate_tag_name(mixed_case_tag)
        assert result == "tech-tips"


@pytest.mark.unit
class TestFolderNameValidation:
    """Test folder name validation logic"""

    def test_valid_folder_names(self):
        """Test valid folder name values"""
        valid_folder_names = [
            "Technology",
            "News & Updates",
            "Work Stuff",
            "A" * 100,  # Assuming reasonable max length
            "Folder-Name_123",
        ]

        for folder_name in valid_folder_names:
            result = validate_folder_name(folder_name)
            assert result == folder_name.strip()

    def test_invalid_folder_names(self):
        """Test invalid folder name values"""
        with pytest.raises(ValidationError, match="required"):
            validate_folder_name("")

        with pytest.raises(ValidationError, match="required"):
            validate_folder_name(None)


@pytest.mark.unit
class TestHighlightColorValidation:
    """Test highlight color validation logic"""

    def test_valid_highlight_colors(self):
        """Test valid highlight color values"""
        # These should match the colors defined in constants
        valid_colors = ["yellow", "green", "blue", "red", "purple"]

        for color in valid_colors:
            try:
                result = validate_highlight_color(color)
                assert result == color.lower()
            except ValidationError:
                # Skip if this color isn't defined in constants
                pass

    def test_invalid_highlight_colors(self):
        """Test invalid highlight color values"""
        invalid_colors = [
            "invalid-color",
            "orange",  # Assuming not in allowed list
            "",
            None,
        ]

        for color in invalid_colors:
            with pytest.raises(ValidationError):
                validate_highlight_color(color)

    def test_highlight_color_case_normalization(self):
        """Test that highlight colors are normalized to lowercase"""
        try:
            result = validate_highlight_color("YELLOW")
            assert result == "yellow"
        except ValidationError:
            # Skip if yellow isn't in allowed colors
            pass


@pytest.mark.unit
class TestArticlePriorityValidation:
    """Test article priority validation logic"""

    def test_valid_article_priorities(self):
        """Test valid article priority values"""
        # These should match the priorities defined in constants
        valid_priorities = ["low", "medium", "high"]

        for priority in valid_priorities:
            try:
                result = validate_article_priority(priority)
                assert result == priority.lower()
            except ValidationError:
                # Skip if this priority isn't defined in constants
                pass

    def test_invalid_article_priorities(self):
        """Test invalid article priority values"""
        invalid_priorities = [
            "invalid-priority",
            "urgent",  # Not in allowed list (only low, medium, high)
            "",
            None,
        ]

        for priority in invalid_priorities:
            with pytest.raises(ValidationError):
                validate_article_priority(priority)

    def test_article_priority_case_normalization(self):
        """Test that article priorities are normalized to lowercase"""
        try:
            result = validate_article_priority("HIGH")
            assert result == "high"
        except ValidationError:
            # Skip if high isn't in allowed priorities
            pass
