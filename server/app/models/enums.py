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
