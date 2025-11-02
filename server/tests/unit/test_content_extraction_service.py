"""Unit tests for ContentExtractionService."""

import pytest

from app.services.content_extraction_service import ContentExtractionService


@pytest.mark.asyncio
async def test_extract_full_content_success(mocker):
    """Test successful content extraction."""
    # Mock trafilatura
    mock_fetch = mocker.patch("trafilatura.fetch_url")
    mock_extract = mocker.patch("trafilatura.extract")
    mock_fetch.return_value = "<html><body>content</body></html>"
    mock_extract.return_value = "<p>Full article content here with enough text to make it substantial</p>"

    service = ContentExtractionService()
    content, read_time, error = await service.extract_full_content("https://example.com/article")

    # Verify trafilatura was called correctly
    mock_fetch.assert_called_once_with("https://example.com/article")
    mock_extract.assert_called_once_with("<html><body>content</body></html>", output_format="html")

    # Verify results
    assert content == "<p>Full article content here with enough text to make it substantial</p>"
    assert read_time is not None
    assert read_time > 0
    assert read_time <= 60  # Should be capped at 60
    assert error is None


@pytest.mark.asyncio
async def test_extract_full_content_fetch_failure(mocker):
    """Test when trafilatura fails to fetch the URL."""
    mock_fetch = mocker.patch("trafilatura.fetch_url")
    mock_fetch.return_value = None

    service = ContentExtractionService()
    content, read_time, error = await service.extract_full_content("https://example.com/article")

    # Verify results
    assert content is None
    assert read_time is None
    assert error == "Failed to fetch content from URL"


@pytest.mark.asyncio
async def test_extract_full_content_extraction_failure(mocker):
    """Test when trafilatura fails to extract readable content."""
    mock_fetch = mocker.patch("trafilatura.fetch_url")
    mock_extract = mocker.patch("trafilatura.extract")
    mock_fetch.return_value = "<html><body>content</body></html>"
    mock_extract.return_value = None

    service = ContentExtractionService()
    content, read_time, error = await service.extract_full_content("https://example.com/article")

    # Verify results
    assert content is None
    assert read_time is None
    assert error == "Could not extract readable content from the page"


@pytest.mark.asyncio
async def test_extract_full_content_exception(mocker):
    """Test when an unexpected exception occurs."""
    mock_fetch = mocker.patch("trafilatura.fetch_url")
    mock_fetch.side_effect = Exception("Network error")

    service = ContentExtractionService()
    content, read_time, error = await service.extract_full_content("https://example.com/article")

    # Verify results
    assert content is None
    assert read_time is None
    assert error == "An unexpected error occurred while extracting content"


@pytest.mark.asyncio
async def test_extract_full_content_with_long_article(mocker):
    """Test that read time is capped at 60 minutes for very long articles."""
    mock_fetch = mocker.patch("trafilatura.fetch_url")
    mock_extract = mocker.patch("trafilatura.extract")
    mock_fetch.return_value = "<html><body>content</body></html>"
    # Create a very long article (simulate 2+ hours of reading)
    long_content = "Lorem ipsum dolor sit amet. " * 10000
    mock_extract.return_value = long_content

    service = ContentExtractionService()
    content, read_time, error = await service.extract_full_content("https://example.com/article")

    # Verify results
    assert content == long_content
    assert read_time == 60  # Should be capped at 60 minutes
    assert error is None


def test_calculate_read_time_empty_content():
    """Test read time calculation with empty content."""
    service = ContentExtractionService()
    read_time = service._calculate_read_time("")
    assert read_time == 1  # Should default to 1 minute


def test_calculate_read_time_short_content():
    """Test read time calculation with short content."""
    service = ContentExtractionService()
    # About 50 words (should be < 1 minute but returns 1 due to minimum)
    short_content = "word " * 50
    read_time = service._calculate_read_time(short_content)
    assert read_time >= 1
    assert read_time <= 60


def test_calculate_read_time_long_content():
    """Test read time calculation with long content."""
    service = ContentExtractionService()
    # About 2000 words (should be around 10 minutes at 200 wpm)
    long_content = "word " * 2000
    read_time = service._calculate_read_time(long_content)
    assert read_time > 1
    assert read_time <= 60  # Should be capped


def test_calculate_read_time_very_long_content():
    """Test that very long content is capped at 60 minutes."""
    service = ContentExtractionService()
    # Simulate a very long article
    very_long_content = "word " * 20000
    read_time = service._calculate_read_time(very_long_content)
    assert read_time == 60  # Should be capped at maximum


def test_remove_duplicate_title_heading_exact_match():
    """Test that duplicate title heading is removed when it matches exactly."""
    service = ContentExtractionService()
    html_content = "<h1>My Article Title</h1><p>Article content here</p>"
    article_title = "My Article Title"

    result = service._remove_duplicate_title_heading(html_content, article_title)

    # The h1 should be removed, leaving only the paragraph
    assert "<h1>My Article Title</h1>" not in result
    assert "<p>Article content here</p>" in result


def test_remove_duplicate_title_heading_with_whitespace():
    """Test that duplicate heading is removed even with different whitespace."""
    service = ContentExtractionService()
    html_content = "<h1>  My   Article\n  Title  </h1><p>Content</p>"
    article_title = "My Article Title"

    result = service._remove_duplicate_title_heading(html_content, article_title)

    # The h1 should be removed despite whitespace differences
    assert "<h1>" not in result
    assert "<p>Content</p>" in result


def test_remove_duplicate_title_heading_no_match():
    """Test that heading is kept when it doesn't match the title."""
    service = ContentExtractionService()
    html_content = "<h1>Different Heading</h1><p>Article content here</p>"
    article_title = "My Article Title"

    result = service._remove_duplicate_title_heading(html_content, article_title)

    # The h1 should be preserved since it doesn't match
    assert "<h1>Different Heading</h1>" in result
    assert "<p>Article content here</p>" in result


def test_remove_duplicate_title_heading_no_headings():
    """Test behavior when there are no headings in the content."""
    service = ContentExtractionService()
    html_content = "<p>Article content without headings</p>"
    article_title = "My Article Title"

    result = service._remove_duplicate_title_heading(html_content, article_title)

    # Content should remain unchanged
    assert result == html_content


def test_remove_duplicate_title_heading_no_title():
    """Test behavior when article title is not provided."""
    service = ContentExtractionService()
    html_content = "<h1>Some Heading</h1><p>Content</p>"

    result = service._remove_duplicate_title_heading(html_content, None)

    # Content should remain unchanged when no title is provided
    assert result == html_content


def test_remove_duplicate_title_heading_h2_match():
    """Test that first h2 heading is checked if no h1 exists."""
    service = ContentExtractionService()
    html_content = "<h2>My Article Title</h2><p>Article content here</p>"
    article_title = "My Article Title"

    result = service._remove_duplicate_title_heading(html_content, article_title)

    # The h2 should be removed since it's the first heading and matches
    assert "<h2>My Article Title</h2>" not in result
    assert "<p>Article content here</p>" in result


def test_remove_duplicate_title_heading_keeps_other_headings():
    """Test that only the first matching heading is removed, others are kept."""
    service = ContentExtractionService()
    html_content = "<h1>My Article Title</h1><h2>Section 1</h2><p>Content</p><h2>My Article Title</h2>"
    article_title = "My Article Title"

    result = service._remove_duplicate_title_heading(html_content, article_title)

    # First h1 should be removed, but later h2 with same text should remain
    assert result.count("<h1>") == 0
    assert "<h2>Section 1</h2>" in result
    assert "<h2>My Article Title</h2>" in result  # This one stays


@pytest.mark.asyncio
async def test_extract_full_content_with_title_removes_duplicate(mocker):
    """Test that extract_full_content removes duplicate title heading."""
    mock_fetch = mocker.patch("trafilatura.fetch_url")
    mock_extract = mocker.patch("trafilatura.extract")
    mock_fetch.return_value = "<html><body>content</body></html>"
    mock_extract.return_value = "<h1>Test Article</h1><p>Article content here</p>"

    service = ContentExtractionService()
    content, read_time, error = await service.extract_full_content("https://example.com/article", "Test Article")

    # The duplicate heading should be removed
    assert content is not None
    assert "<h1>Test Article</h1>" not in content
    assert "<p>Article content here</p>" in content
    assert error is None


@pytest.mark.asyncio
async def test_extract_full_content_without_title_keeps_heading(mocker):
    """Test that headings are kept when no title is provided."""
    mock_fetch = mocker.patch("trafilatura.fetch_url")
    mock_extract = mocker.patch("trafilatura.extract")
    mock_fetch.return_value = "<html><body>content</body></html>"
    mock_extract.return_value = "<h1>Test Article</h1><p>Article content here</p>"

    service = ContentExtractionService()
    content, read_time, error = await service.extract_full_content("https://example.com/article")

    # Heading should be preserved when no title is provided
    assert content is not None
    assert "<h1>Test Article</h1>" in content
    assert "<p>Article content here</p>" in content
    assert error is None
