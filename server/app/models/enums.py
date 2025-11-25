"""Enumeration types used across models and schemas."""

from enum import Enum


class FeedCategory(Enum):
    """Feed categories from RSS dataset."""

    TECHNOLOGY_PROGRAMMING = "Technology & Programming"
    CULTURE_ARTS = "Culture & Arts"
    LIFESTYLE_PERSONAL = "Lifestyle & Personal"
    MISCELLANEOUS = "Miscellaneous"
    DESIGN_CREATIVITY = "Design & Creativity"
    SCIENCE_RESEARCH = "Science & Research"
    NEWS_POLITICS = "News & Politics"
    GAMING_ENTERTAINMENT = "Gaming & Entertainment"
    BUSINESS_FINANCE = "Business & Finance"
    ARTIFICIAL_INTELLIGENCE = "Artificial Intelligence"
    SECURITY_PRIVACY = "Security & Privacy"
    EDUCATION_LEARNING = "Education & Learning"


class UserRole(str, Enum):
    """User role levels for access control and feature gating.

    Maps to PostgreSQL enum type 'userrole'.
    """

    BASIC = "BASIC"
    PRO = "PRO"
    ADMIN = "ADMIN"


class ArticlePriority(str, Enum):
    """Priority levels for manually clipped articles.

    Maps to PostgreSQL enum type 'articlepriority'.
    """

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class ImportStatus(str, Enum):
    """Status of an OPML import task."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    UNKNOWN = "unknown"
