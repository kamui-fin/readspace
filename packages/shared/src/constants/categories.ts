/**
 * Available feed categories for discovery
 *
 * These categories are shared across web, mobile, and extension
 * to ensure consistent feed categorization.
 */
export const FEED_CATEGORIES = [
    "Technology & Programming",
    "Artificial Intelligence",
    "Design & Creativity",
    "Business & Finance",
    "News & Politics",
    "Gaming & Entertainment",
    "Science & Research",
    "Lifestyle & Personal",
    "Culture & Arts",
    "Security & Privacy",
    "Education & Learning",
    "Miscellaneous",
] as const

export type FeedCategory = typeof FEED_CATEGORIES[number]

/**
 * Mobile-friendly category name mappings
 * Used for displaying shorter category names on smaller screens
 */
export const MOBILE_CATEGORY_NAMES: Record<string, string> = {
    "Technology & Programming": "Tech & Code",
    "Artificial Intelligence": "AI",
    "Design & Creativity": "Design",
    "Business & Finance": "Business",
    "News & Politics": "News",
    "Gaming & Entertainment": "Gaming",
    "Science & Research": "Science",
    "Lifestyle & Personal": "Lifestyle",
    "Culture & Arts": "Culture",
    "Security & Privacy": "Security",
    "Education & Learning": "Education",
    "Miscellaneous": "Other",
}
