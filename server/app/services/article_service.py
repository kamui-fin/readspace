"""
Article business logic - isolated for unit testing
"""

from datetime import datetime, timezone
from uuid import UUID

import structlog

from app.core.custom_exceptions import ValidationError

logger = structlog.get_logger(__name__)


class ArticleBusinessLogic:
    """Isolated article business logic that doesn't depend on database"""

    def __init__(self):
        pass

    def detect_duplicate_articles(
        self, new_articles: list[dict], existing_articles_by_feed: dict[UUID, set[str]]
    ) -> tuple[list[dict], list[dict]]:
        """
        Detect duplicate articles based on feed_id + guid combination

        Args:
            new_articles: List of article dicts with feed_id and guid
            existing_articles_by_feed: Map of feed_id -> set of existing guids

        Returns:
            Tuple of (new_articles_to_create, duplicate_articles)
        """
        new_articles_to_create = []
        duplicate_articles = []

        for article in new_articles:
            feed_id = article.get("feed_id")
            guid = article.get("guid")

            if not feed_id or not guid:
                logger.warning("Article missing feed_id or guid", article=article)
                continue

            existing_guids = existing_articles_by_feed.get(feed_id, set())

            if guid in existing_guids:
                duplicate_articles.append(article)
            else:
                new_articles_to_create.append(article)
                # Add to existing set to catch duplicates within the same batch
                if feed_id not in existing_articles_by_feed:
                    existing_articles_by_feed[feed_id] = set()
                existing_articles_by_feed[feed_id].add(guid)

        return new_articles_to_create, duplicate_articles

    def validate_article_data(self, article_data: dict) -> dict:
        """
        Validate and clean article data

        Args:
            article_data: Article data dictionary

        Returns:
            Validated and cleaned article data

        Raises:
            ValidationError: If article data is invalid
        """
        # Required fields
        required_fields = ["guid", "link", "feed_id", "user_id"]
        for field in required_fields:
            if not article_data.get(field):
                raise ValidationError(f"Article missing required field: {field}")

        validated_data = article_data.copy()

        # Validate and clean GUID
        guid = str(validated_data["guid"])[:1024]  # Ensure fits in model
        if not guid.strip():
            raise ValidationError("Article GUID cannot be empty")
        validated_data["guid"] = guid

        # Validate and clean link
        link = str(validated_data["link"]).strip()
        if not link or link in ["#", "javascript:void(0)"]:
            raise ValidationError("Article link is invalid")
        validated_data["link"] = link

        # Clean title
        title = validated_data.get("title")
        if title is not None:
            title = str(title).strip()
            validated_data["title"] = title if title else None

        # Clean description
        description = validated_data.get("description")
        if description is not None:
            description = str(description).strip()
            validated_data["description"] = description if description else None

        # Clean content
        content = validated_data.get("content")
        if content is not None:
            content = str(content).strip()
            validated_data["content"] = content if content else None

        # Validate we have some meaningful content
        if not any(
            [
                validated_data.get("title"),
                validated_data.get("content"),
                validated_data.get("description"),
            ]
        ):
            raise ValidationError(
                "Article must have at least title, content, or description"
            )

        # Ensure published_at is timezone-aware if provided
        if validated_data.get("published_at") and isinstance(
            validated_data["published_at"], datetime
        ):
            pub_date = validated_data["published_at"]
            if pub_date.tzinfo is None:
                validated_data["published_at"] = pub_date.replace(tzinfo=timezone.utc)

        # Validate estimated read time
        read_time = validated_data.get("estimated_read_time_minutes")
        if read_time is not None:
            try:
                read_time = int(read_time)
                if read_time < 0:
                    read_time = None
                elif read_time > 1440:  # More than 24 hours seems unreasonable
                    read_time = 1440
                validated_data["estimated_read_time_minutes"] = read_time
            except (ValueError, TypeError):
                validated_data["estimated_read_time_minutes"] = None

        return validated_data

    def calculate_article_priority_score(self, article_data: dict) -> float:
        """
        Calculate a priority score for an article based on various factors

        Args:
            article_data: Article data dictionary

        Returns:
            Priority score (higher = more important)
        """
        score = 0.0

        # Base score for having content
        if article_data.get("title"):
            score += 1.0
        if article_data.get("content"):
            score += 2.0
        if article_data.get("description"):
            score += 0.5

        # Score based on content length (longer articles might be more substantial)
        content_length = 0
        if article_data.get("content"):
            content_length += len(str(article_data["content"]))
        if article_data.get("description"):
            content_length += len(str(article_data["description"]))

        # Normalize content length score (0-2 points)
        if content_length > 0:
            score += min(2.0, content_length / 1000)

        # Score based on recency (newer articles score higher)
        published_at = article_data.get("published_at")
        if published_at and isinstance(published_at, datetime):
            days_old = (datetime.now(timezone.utc) - published_at).days
            if days_old <= 1:
                score += 2.0  # Very recent
            elif days_old <= 7:
                score += 1.5  # Recent
            elif days_old <= 30:
                score += 1.0  # Somewhat recent
            else:
                score += 0.5  # Older content

        # Score based on estimated read time (medium-length articles might be preferred)
        read_time = article_data.get("estimated_read_time_minutes")
        if read_time:
            if 3 <= read_time <= 15:  # Sweet spot for most readers
                score += 1.0
            elif 1 <= read_time <= 25:  # Still reasonable
                score += 0.5

        return score

    def group_articles_by_feed(self, articles: list[dict]) -> dict[UUID, list[dict]]:
        """Group articles by feed_id"""
        grouped = {}
        for article in articles:
            feed_id = article.get("feed_id")
            if feed_id:
                if feed_id not in grouped:
                    grouped[feed_id] = []
                grouped[feed_id].append(article)
        return grouped

    def calculate_read_time_statistics(self, articles: list[dict]) -> dict:
        """Calculate read time statistics for a list of articles"""
        read_times = []
        for article in articles:
            read_time = article.get("estimated_read_time_minutes")
            if read_time and read_time > 0:
                read_times.append(read_time)

        if not read_times:
            return {"total_articles": len(articles), "articles_with_read_time": 0}

        return {
            "total_articles": len(articles),
            "articles_with_read_time": len(read_times),
            "min_read_time": min(read_times),
            "max_read_time": max(read_times),
            "average_read_time": sum(read_times) / len(read_times),
            "total_read_time": sum(read_times),
        }

    def filter_articles_by_date_range(
        self,
        articles: list[dict],
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> list[dict]:
        """Filter articles by published date range"""
        filtered = []

        for article in articles:
            published_at = article.get("published_at")
            if not published_at or not isinstance(published_at, datetime):
                continue

            # Convert to UTC if not already
            if published_at.tzinfo is None:
                published_at = published_at.replace(tzinfo=timezone.utc)

            # Check date range
            if start_date and published_at < start_date:
                continue
            if end_date and published_at > end_date:
                continue

            filtered.append(article)

        return filtered

    def sort_articles_by_priority(
        self, articles: list[dict], reverse: bool = True
    ) -> list[dict]:
        """Sort articles by their calculated priority score"""
        return sorted(
            articles,
            key=lambda article: self.calculate_article_priority_score(article),
            reverse=reverse,
        )

    def extract_article_keywords(
        self, article_data: dict, max_keywords: int = 10
    ) -> list[str]:
        """Extract potential keywords from article title and description"""
        import re

        text_content = ""
        if article_data.get("title"):
            text_content += " " + str(article_data["title"])
        if article_data.get("description"):
            text_content += " " + str(article_data["description"])

        if not text_content.strip():
            return []

        # Simple keyword extraction (could be improved with NLP)
        # Remove HTML tags, normalize whitespace, convert to lowercase
        text_content = re.sub(r"<[^>]+>", " ", text_content)
        text_content = re.sub(r"\s+", " ", text_content.lower())

        # Split into words and filter
        words = text_content.split()

        # Filter out common stop words and short words
        stop_words = {
            "a",
            "an",
            "and",
            "are",
            "as",
            "at",
            "be",
            "by",
            "for",
            "from",
            "has",
            "he",
            "in",
            "is",
            "it",
            "its",
            "of",
            "on",
            "that",
            "the",
            "to",
            "was",
            "will",
            "with",
            "this",
            "but",
            "not",
            "or",
            "have",
            "had",
            "what",
            "when",
            "where",
            "who",
            "which",
            "why",
            "how",
        }

        keywords = []
        for word in words:
            # Clean word (remove punctuation)
            clean_word = re.sub(r"[^\w]", "", word)
            if (
                len(clean_word) >= 3
                and clean_word not in stop_words
                and clean_word not in keywords
            ):
                keywords.append(clean_word)

            if len(keywords) >= max_keywords:
                break

        return keywords
