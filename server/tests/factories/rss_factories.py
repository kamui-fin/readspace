"""
Factory classes for RSS-related models
"""

import uuid
from datetime import datetime, timezone

import factory
from factory.alchemy import SQLAlchemyModelFactory

from app.models.rss_models import (
    ArticleContent,
    ClippedArticle,
    Feed,
    FeedArticle,
    Folder,
    Tag,
)


class FolderFactory(SQLAlchemyModelFactory):
    """Factory for Folder model"""

    class Meta:
        model = Folder
        sqlalchemy_session_persistence = "commit"

    id = factory.LazyFunction(uuid.uuid4)
    name = factory.Faker("word")
    # user_id must be provided when creating folders
    created_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))
    updated_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))


class TagFactory(SQLAlchemyModelFactory):
    """Factory for Tag model"""

    class Meta:
        model = Tag
        sqlalchemy_session_persistence = "commit"

    id = factory.LazyFunction(uuid.uuid4)
    name = factory.Faker("word")
    # user_id must be provided when creating tags
    created_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))
    updated_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))


class FeedFactory(SQLAlchemyModelFactory):
    """Factory for Feed model"""

    class Meta:
        model = Feed
        sqlalchemy_session_persistence = "commit"

    id = factory.LazyFunction(uuid.uuid4)
    # user_id and folder_id must be provided when creating feeds
    url = factory.Faker("url")
    title = factory.Faker("sentence", nb_words=4)
    description = factory.Faker("text", max_nb_chars=200)
    link = factory.Faker("url")
    language = factory.Faker("language_code")
    image_url = factory.Faker("image_url")
    ttl = factory.Faker("random_int", min=60, max=1440)  # 1 hour to 24 hours
    skip_hours = factory.LazyFunction(lambda: [2, 3, 4])  # Skip early morning hours
    skip_days = factory.LazyFunction(lambda: ["Saturday", "Sunday"])
    last_fetched_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))
    last_modified_header = factory.Faker("iso8601")
    etag_header = factory.Faker("sha256")
    last_article_published_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))
    is_favorite = factory.Faker("boolean", chance_of_getting_true=20)
    fetch_error_count = factory.Faker("random_int", min=0, max=5)
    last_error_message = factory.LazyAttribute(
        lambda obj: "Feed parsing error occurred" if obj.fetch_error_count > 0 else None
    )
    created_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))
    updated_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))


class ArticleContentFactory(SQLAlchemyModelFactory):
    """Factory for ArticleContent model"""

    class Meta:
        model = ArticleContent
        sqlalchemy_session_persistence = "commit"

    id = factory.LazyFunction(uuid.uuid4)
    title = factory.Faker("sentence", nb_words=6)
    link = factory.Faker("url")
    description = factory.Faker("text", max_nb_chars=300)
    content = factory.Faker("text", max_nb_chars=2000)
    image_url = factory.Faker("image_url")
    author = factory.Faker("name")
    published_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))
    estimated_read_time_minutes = factory.Faker("random_int", min=1, max=30)
    custom_metadata = factory.LazyFunction(
        lambda: {
            "source": "rss",
            "word_count": 1000,
            "tags": ["test", "article", "content"],
        }
    )
    created_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))
    updated_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))


class FeedArticleFactory(SQLAlchemyModelFactory):
    """Factory for FeedArticle model"""

    class Meta:
        model = FeedArticle
        sqlalchemy_session_persistence = "commit"

    id = factory.LazyFunction(uuid.uuid4)
    # feed_id, content_id, and user_id must be provided when creating feed articles
    guid = factory.Faker("uuid4")
    is_read = factory.Faker("boolean", chance_of_getting_true=30)
    read_at = factory.LazyAttribute(
        lambda obj: datetime.now(timezone.utc) if obj.is_read else None
    )
    is_read_later = factory.Faker("boolean", chance_of_getting_true=40)
    is_favorite = factory.Faker("boolean", chance_of_getting_true=10)
    created_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))
    updated_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))


class ClippedArticleFactory(SQLAlchemyModelFactory):
    """Factory for ClippedArticle model"""

    class Meta:
        model = ClippedArticle
        sqlalchemy_session_persistence = "commit"

    id = factory.LazyFunction(uuid.uuid4)
    # content_id and user_id must be provided when creating clipped articles
    priority = factory.Faker("random_element", elements=["low", "medium", "high"])
    note = factory.Faker("text", max_nb_chars=200)
    is_read = factory.Faker("boolean", chance_of_getting_true=20)
    read_at = factory.LazyAttribute(
        lambda obj: datetime.now(timezone.utc) if obj.is_read else None
    )
    is_read_later = factory.Faker(
        "boolean", chance_of_getting_true=80
    )  # Most clipped articles are read later
    is_favorite = factory.Faker("boolean", chance_of_getting_true=15)
    created_at = factory.LazyFunction(lambda: datetime.now(timezone.utc))
