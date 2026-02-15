from enum import Enum


class FeedCategory(str, Enum):
    ARTS_CULTURE = "arts_culture"
    AUTOMOTIVE_TRANSPORT = "automotive_transport"
    BUSINESS_FINANCE = "business_finance"
    CONSUMER_TECH_DIGITAL = "consumer_tech_digital"
    ENTERTAINMENT = "entertainment"
    FAMILY_RELATIONSHIPS = "family_relationships"
    FOOD_DRINK = "food_drink"
    GAMING = "gaming"
    HEALTH_WELLNESS = "health_wellness"
    HOME_HOBBIES = "home_hobbies"
    IDENTITY_COMMUNITY = "identity_community"
    INDUSTRY_PROFESSIONS = "industry_professions"
    NEWS_CURRENT_EVENTS = "news_current_events"
    REGIONAL_LOCAL = "regional_local"
    SCIENCE_NATURE = "science_nature"
    SOCIETY_LAW_HISTORY = "society_law_history"
    SOFTWARE_ENGINEERING = "software_engineering"
    SPORTS = "sports"
    STYLE_SHOPPING = "style_shopping"
    TRAVEL_GEOGRAPHY = "travel_geography"
    MISCELLANEOUS = "miscellaneous"


class ContentType(str, Enum):
    AGGREGATOR = "aggregator"
    CORPORATE_BLOG = "corporate_blog"
    DOCUMENTATION_WIKI = "documentation_wiki"
    EDUCATION_RESEARCH = "education_research"
    FORUM_COMMUNITY = "forum_community"
    GOVERNMENT_INSTITUTIONAL = "government_institutional"
    INDIE_BLOG = "indie_blog"
    MAGAZINE_EDITORIAL = "magazine_editorial"
    MARKETPLACE_LISTINGS = "marketplace_listings"
    NEWSLETTER = "newsletter"
    NEWS_OUTLET = "news_outlet"
    OPEN_SOURCE_ACTIVITY = "open_source_activity"
    PODCAST_FEED = "podcast_feed"
    STATUS_CHANGELOG = "status_changelog"
    VIDEO_CHANNEL = "video_channel"


class ArticlePriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class UserRole(str, Enum):
    BASIC = "BASIC"
    PRO = "PRO"
    ADMIN = "ADMIN"
