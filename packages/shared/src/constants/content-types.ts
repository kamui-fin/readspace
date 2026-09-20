import { ContentType } from "../api/types/feeds"

/**
 * Curated list of high-signal content types exposed as discovery filter chips.
 */
export const CURATED_CONTENT_TYPES: ContentType[] = [
    ContentType.NEWSLETTER,
    ContentType.PODCAST_FEED,
    ContentType.INDIE_BLOG,
    ContentType.NEWS_OUTLET,
    ContentType.MAGAZINE_EDITORIAL,
    ContentType.VIDEO_CHANNEL,
    ContentType.FORUM_COMMUNITY,
]

/**
 * Every content type, in the order they're offered as filters: the curated
 * high-signal ones first, then the long tail. Clients that show the full set
 * (e.g. the mobile filter sheet) use this; clients with room for only a few
 * (web's inline chip rail) use CURATED_CONTENT_TYPES.
 */
export const ALL_CONTENT_TYPES: ContentType[] = [
    ...CURATED_CONTENT_TYPES,
    ContentType.AGGREGATOR,
    ContentType.CORPORATE_BLOG,
    ContentType.DOCUMENTATION_WIKI,
    ContentType.EDUCATION_RESEARCH,
    ContentType.OPEN_SOURCE_ACTIVITY,
    ContentType.GOVERNMENT_INSTITUTIONAL,
    ContentType.MARKETPLACE_LISTINGS,
    ContentType.STATUS_CHANGELOG,
]

/**
 * Human-readable display names for feed content types.
 */
export const CONTENT_TYPE_DISPLAY_NAMES: Record<ContentType, string> = {
    [ContentType.NEWSLETTER]: "Newsletters",
    [ContentType.PODCAST_FEED]: "Podcasts",
    [ContentType.INDIE_BLOG]: "Blogs",
    [ContentType.NEWS_OUTLET]: "News Outlets",
    [ContentType.MAGAZINE_EDITORIAL]: "Magazines",
    [ContentType.VIDEO_CHANNEL]: "Videos",
    [ContentType.FORUM_COMMUNITY]: "Communities",
    [ContentType.AGGREGATOR]: "Aggregators",
    [ContentType.CORPORATE_BLOG]: "Corporate Blogs",
    [ContentType.DOCUMENTATION_WIKI]: "Documentation",
    [ContentType.EDUCATION_RESEARCH]: "Research & Education",
    [ContentType.GOVERNMENT_INSTITUTIONAL]: "Government & Institutional",
    [ContentType.MARKETPLACE_LISTINGS]: "Marketplaces",
    [ContentType.OPEN_SOURCE_ACTIVITY]: "Open Source",
    [ContentType.STATUS_CHANGELOG]: "Changelogs",
}
