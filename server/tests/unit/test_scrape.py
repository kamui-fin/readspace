import pytest
from unittest.mock import patch, MagicMock
from bs4 import BeautifulSoup
from app.services.articles import scrape


@pytest.mark.asyncio
async def test_extract_full_content_success():
    with patch("app.services.articles.scrape._fetch_and_extract") as mock_fetch:
        mock_fetch.return_value = (
            "<html><body><h1>Title</h1><p>Content</p></body></html>"
        )

        # extract_full_content returns (content, error)
        content, error = await scrape.extract_full_content(
            "http://example.com"
        )

        assert content is not None
        assert "Content" in content
        assert error is None


@pytest.mark.asyncio
async def test_extract_full_content_timeout():
    with patch("asyncio.wait_for", side_effect=TimeoutError):
        content, error = await scrape.extract_full_content(
            "http://example.com"
        )
        assert content is None
        assert error is not None
        assert "Timed out" in error


@pytest.mark.asyncio
async def test_extract_full_content_failure():
    with patch("app.services.articles.scrape._fetch_and_extract") as mock_fetch:
        mock_fetch.return_value = None

        content, error = await scrape.extract_full_content(
            "http://example.com"
        )

        assert content is None
        assert error == "Could not extract readable content"


def test_remove_duplicate_title():
    html = "<h1>My Title</h1><p>Content</p>"
    soup = BeautifulSoup(html, "html.parser")
    scrape._remove_duplicate_title_heading(soup, "My Title")
    assert str(soup) == "<p>Content</p>"


def test_remove_duplicate_title_mismatch():
    html = "<h1>Other Title</h1><p>Content</p>"
    soup = BeautifulSoup(html, "html.parser")
    scrape._remove_duplicate_title_heading(soup, "My Title")
    assert "<h1>Other Title</h1>" in str(soup)


def test_remove_duplicate_image():
    html = '<img src="http://example.com/img.jpg"><p>Content</p>'
    soup = BeautifulSoup(html, "html.parser")
    scrape._remove_duplicate_image(soup, "http://example.com/img.jpg")
    assert str(soup) == "<p>Content</p>"


def test_remove_duplicate_image_mismatch():
    html = '<img src="http://example.com/other.jpg"><p>Content</p>'
    soup = BeautifulSoup(html, "html.parser")
    scrape._remove_duplicate_image(soup, "http://example.com/img.jpg")
    assert '<img src="http://example.com/other.jpg"/>' in str(
        soup
    ) or '<img src="http://example.com/other.jpg">' in str(soup)
