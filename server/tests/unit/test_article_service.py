"""
Unit tests for article business logic - no database dependencies
"""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.core.custom_exceptions import ValidationError
from app.services.article_service import ArticleBusinessLogic


@pytest.mark.unit
class TestArticleBusinessLogic:
    """Test article business logic"""

    def setup_method(self):
        self.service = ArticleBusinessLogic()

    def test_detect_duplicate_articles_no_duplicates(self):
        """Test duplicate detection when there are no duplicates"""
        feed_id1 = uuid4()
        feed_id2 = uuid4()

        new_articles = [
            {"feed_id": feed_id1, "guid": "article1", "title": "Article 1"},
            {"feed_id": feed_id1, "guid": "article2", "title": "Article 2"},
            {"feed_id": feed_id2, "guid": "article3", "title": "Article 3"},
        ]

        existing_articles = {
            feed_id1: {"existing1", "existing2"},
            feed_id2: {"existing3"},
        }

        new_to_create, duplicates = self.service.detect_duplicate_articles(
            new_articles, existing_articles
        )

        assert len(new_to_create) == 3
        assert len(duplicates) == 0
        assert all(article in new_to_create for article in new_articles)

    def test_detect_duplicate_articles_with_duplicates(self):
        """Test duplicate detection when there are duplicates"""
        feed_id = uuid4()

        new_articles = [
            {"feed_id": feed_id, "guid": "article1", "title": "Article 1"},
            {"feed_id": feed_id, "guid": "duplicate", "title": "Duplicate Article"},
            {"feed_id": feed_id, "guid": "article2", "title": "Article 2"},
        ]

        existing_articles = {feed_id: {"duplicate", "existing1"}}

        new_to_create, duplicates = self.service.detect_duplicate_articles(
            new_articles, existing_articles
        )

        assert len(new_to_create) == 2
        assert len(duplicates) == 1
        assert duplicates[0]["guid"] == "duplicate"
        assert all(article["guid"] != "duplicate" for article in new_to_create)

    def test_detect_duplicate_articles_within_batch(self):
        """Test duplicate detection within the same batch"""
        feed_id = uuid4()

        new_articles = [
            {"feed_id": feed_id, "guid": "article1", "title": "Article 1"},
            {"feed_id": feed_id, "guid": "article1", "title": "Duplicate within batch"},
            {"feed_id": feed_id, "guid": "article2", "title": "Article 2"},
        ]

        existing_articles = {}

        new_to_create, duplicates = self.service.detect_duplicate_articles(
            new_articles, existing_articles
        )

        assert len(new_to_create) == 2  # Only unique articles
        assert len(duplicates) == 1
        assert duplicates[0]["title"] == "Duplicate within batch"

    def test_validate_article_data_valid(self):
        """Test validating valid article data"""
        article_data = {
            "guid": "test-guid-123",
            "link": "https://example.com/article",
            "feed_id": uuid4(),
            "user_id": uuid4(),
            "title": "Test Article",
            "description": "Test description",
            "content": "<p>Test content</p>",
            "published_at": datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
            "estimated_read_time_minutes": 5,
        }

        validated = self.service.validate_article_data(article_data)

        assert validated["guid"] == "test-guid-123"
        assert validated["title"] == "Test Article"
        assert validated["description"] == "Test description"
        assert validated["content"] == "<p>Test content</p>"
        assert validated["estimated_read_time_minutes"] == 5

    def test_validate_article_data_missing_required_fields(self):
        """Test validation fails for missing required fields"""
        # Test missing guid
        with pytest.raises(
            ValidationError, match="Article missing required field: guid"
        ):
            self.service.validate_article_data(
                {"link": "https://example.com", "feed_id": uuid4(), "user_id": uuid4()}
            )

        # Test missing link
        with pytest.raises(
            ValidationError, match="Article missing required field: link"
        ):
            self.service.validate_article_data(
                {"guid": "test", "feed_id": uuid4(), "user_id": uuid4()}
            )

    def test_validate_article_data_invalid_link(self):
        """Test validation fails for invalid links"""
        article_data = {
            "guid": "test-guid",
            "link": "#",  # Invalid link
            "feed_id": uuid4(),
            "user_id": uuid4(),
            "title": "Test Article",
        }

        with pytest.raises(ValidationError, match="Article link is invalid"):
            self.service.validate_article_data(article_data)

    def test_validate_article_data_no_meaningful_content(self):
        """Test validation fails when no meaningful content exists"""
        article_data = {
            "guid": "test-guid",
            "link": "https://example.com/article",
            "feed_id": uuid4(),
            "user_id": uuid4(),
            # No title, content, or description
        }

        with pytest.raises(
            ValidationError,
            match="Article must have at least title, content, or description",
        ):
            self.service.validate_article_data(article_data)

    def test_validate_article_data_clean_empty_strings(self):
        """Test that empty strings are cleaned to None"""
        article_data = {
            "guid": "test-guid",
            "link": "https://example.com/article",
            "feed_id": uuid4(),
            "user_id": uuid4(),
            "title": "",  # Empty string
            "description": "   ",  # Whitespace only
            "content": "Valid content",
        }

        validated = self.service.validate_article_data(article_data)

        assert validated["title"] is None
        assert validated["description"] is None
        assert validated["content"] == "Valid content"

    def test_validate_article_data_timezone_handling(self):
        """Test timezone handling for published_at"""
        # Test naive datetime gets UTC timezone
        naive_datetime = datetime(2024, 1, 1, 12, 0, 0)
        article_data = {
            "guid": "test-guid",
            "link": "https://example.com/article",
            "feed_id": uuid4(),
            "user_id": uuid4(),
            "title": "Test Article",
            "published_at": naive_datetime,
        }

        validated = self.service.validate_article_data(article_data)

        assert validated["published_at"].tzinfo == timezone.utc

    def test_validate_article_data_read_time_validation(self):
        """Test read time validation and normalization"""
        article_data = {
            "guid": "test-guid",
            "link": "https://example.com/article",
            "feed_id": uuid4(),
            "user_id": uuid4(),
            "title": "Test Article",
            "estimated_read_time_minutes": 2000,  # Unreasonably high
        }

        validated = self.service.validate_article_data(article_data)

        assert validated["estimated_read_time_minutes"] == 1440  # Capped at 24 hours

        # Test negative read time
        article_data["estimated_read_time_minutes"] = -5
        validated = self.service.validate_article_data(article_data)
        assert validated["estimated_read_time_minutes"] is None

    def test_calculate_article_priority_score(self):
        """Test article priority score calculation"""
        # High priority article (recent, good content, reasonable length)
        high_priority_article = {
            "title": "Important Article",
            "content": "This is substantial content that provides value. "
            * 50,  # ~500 chars
            "description": "Good description",
            "published_at": datetime.now(timezone.utc)
            - timedelta(hours=1),  # Very recent
            "estimated_read_time_minutes": 5,  # Sweet spot
        }

        high_score = self.service.calculate_article_priority_score(
            high_priority_article
        )

        # Lower priority article (older, minimal content)
        low_priority_article = {
            "title": "Basic Article",
            "description": "Short desc",
            "published_at": datetime.now(timezone.utc) - timedelta(days=100),  # Old
            "estimated_read_time_minutes": 1,
        }

        low_score = self.service.calculate_article_priority_score(low_priority_article)

        assert high_score > low_score
        assert high_score > 5.0  # Should have substantial score
        assert low_score < 3.0  # Should have lower score

    def test_group_articles_by_feed(self):
        """Test grouping articles by feed_id"""
        feed_id1 = uuid4()
        feed_id2 = uuid4()

        articles = [
            {"feed_id": feed_id1, "title": "Article 1"},
            {"feed_id": feed_id1, "title": "Article 2"},
            {"feed_id": feed_id2, "title": "Article 3"},
            {"title": "Article without feed_id"},  # Should be ignored
        ]

        grouped = self.service.group_articles_by_feed(articles)

        assert len(grouped) == 2
        assert len(grouped[feed_id1]) == 2
        assert len(grouped[feed_id2]) == 1
        assert all(article["feed_id"] == feed_id1 for article in grouped[feed_id1])

    def test_calculate_read_time_statistics(self):
        """Test read time statistics calculation"""
        articles = [
            {"estimated_read_time_minutes": 5},
            {"estimated_read_time_minutes": 10},
            {"estimated_read_time_minutes": 15},
            {"estimated_read_time_minutes": None},  # Should be ignored
            {},  # No read time field
        ]

        stats = self.service.calculate_read_time_statistics(articles)

        assert stats["total_articles"] == 5
        assert stats["articles_with_read_time"] == 3
        assert stats["min_read_time"] == 5
        assert stats["max_read_time"] == 15
        assert stats["average_read_time"] == 10.0
        assert stats["total_read_time"] == 30

    def test_calculate_read_time_statistics_no_read_times(self):
        """Test read time statistics when no articles have read times"""
        articles = [
            {"title": "Article 1"},
            {"estimated_read_time_minutes": None},
            {"estimated_read_time_minutes": 0},  # Zero should be ignored
        ]

        stats = self.service.calculate_read_time_statistics(articles)

        assert stats["total_articles"] == 3
        assert stats["articles_with_read_time"] == 0
        assert "min_read_time" not in stats

    def test_filter_articles_by_date_range(self):
        """Test filtering articles by date range"""
        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)

        articles = [
            {"title": "Recent", "published_at": now - timedelta(days=1)},
            {"title": "Week old", "published_at": week_ago},
            {"title": "Month old", "published_at": month_ago},
            {"title": "No date"},  # No published_at
        ]

        # Filter to last week
        filtered = self.service.filter_articles_by_date_range(
            articles, start_date=week_ago, end_date=now
        )

        assert len(filtered) == 2  # Recent and week old
        assert all(
            "Recent" in article["title"] or "Week old" in article["title"]
            for article in filtered
        )

    def test_filter_articles_by_date_range_naive_datetime(self):
        """Test filtering with naive datetime (should convert to UTC)"""
        naive_datetime = datetime(2024, 1, 1, 12, 0, 0)  # No timezone
        utc_datetime = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

        articles = [
            {"title": "Naive", "published_at": naive_datetime},
            {"title": "UTC", "published_at": utc_datetime},
        ]

        start_date = datetime(2024, 1, 1, 11, 0, 0, tzinfo=timezone.utc)
        end_date = datetime(2024, 1, 1, 13, 0, 0, tzinfo=timezone.utc)

        filtered = self.service.filter_articles_by_date_range(
            articles, start_date, end_date
        )

        assert (
            len(filtered) == 2
        )  # Both should be included after timezone normalization

    def test_sort_articles_by_priority(self):
        """Test sorting articles by priority score"""
        # Create articles with different priority characteristics
        articles = [
            {
                "title": "Low Priority",
                "description": "Short",
                "published_at": datetime.now(timezone.utc) - timedelta(days=100),
            },
            {
                "title": "High Priority Article",
                "content": "Substantial content here. " * 20,
                "description": "Good description",
                "published_at": datetime.now(timezone.utc),
                "estimated_read_time_minutes": 8,
            },
            {
                "title": "Medium Priority",
                "content": "Some content",
                "published_at": datetime.now(timezone.utc) - timedelta(days=7),
            },
        ]

        sorted_articles = self.service.sort_articles_by_priority(articles)

        # Should be sorted by priority (highest first)
        assert "High Priority" in sorted_articles[0]["title"]
        assert "Low Priority" in sorted_articles[-1]["title"]

    def test_extract_article_keywords(self):
        """Test keyword extraction from article content"""
        article_data = {
            "title": "Python Programming Best Practices",
            "description": "This article covers advanced Python programming techniques and best practices for clean code development.",
        }

        keywords = self.service.extract_article_keywords(article_data, max_keywords=5)

        assert len(keywords) <= 5
        assert "python" in keywords
        assert "programming" in keywords
        assert "practices" in keywords
        # Stop words should be filtered out
        assert "this" not in keywords
        assert "and" not in keywords

    def test_extract_article_keywords_html_content(self):
        """Test keyword extraction handles HTML content"""
        article_data = {
            "title": "<h1>Web Development Tutorial</h1>",
            "description": "<p>Learn <strong>JavaScript</strong> and <em>React</em> for modern web development.</p>",
        }

        keywords = self.service.extract_article_keywords(article_data)

        assert "web" in keywords
        assert "development" in keywords
        assert "javascript" in keywords
        assert "react" in keywords
        # HTML tags should be stripped
        assert "strong" not in keywords
        assert "em" not in keywords

    def test_extract_article_keywords_empty_content(self):
        """Test keyword extraction with empty content"""
        article_data = {}

        keywords = self.service.extract_article_keywords(article_data)

        assert keywords == []

    def test_extract_article_keywords_max_limit(self):
        """Test keyword extraction respects max limit"""
        # Create content with many potential keywords
        long_content = " ".join([f"keyword{i}" for i in range(20)])
        article_data = {"title": long_content}

        keywords = self.service.extract_article_keywords(article_data, max_keywords=5)

        assert len(keywords) == 5
