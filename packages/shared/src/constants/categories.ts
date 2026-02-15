import { FeedCategory } from "../api/types";

/**
 * List of all available feed categories
 */
export const FEED_CATEGORIES: FeedCategory[] = Object.values(FeedCategory);

/**
 * Display names for categories
 */
export const CATEGORY_DISPLAY_NAMES: Record<FeedCategory, string> = {
  [FeedCategory.ARTS_CULTURE]: "Arts & Culture",
  [FeedCategory.AUTOMOTIVE_TRANSPORT]: "Automotive",
  [FeedCategory.BUSINESS_FINANCE]: "Business & Finance",
  [FeedCategory.CONSUMER_TECH_DIGITAL]: "Tech & Digital",
  [FeedCategory.ENTERTAINMENT]: "Entertainment",
  [FeedCategory.FAMILY_RELATIONSHIPS]: "Family & Relationships",
  [FeedCategory.FOOD_DRINK]: "Food & Drink",
  [FeedCategory.GAMING]: "Gaming",
  [FeedCategory.HEALTH_WELLNESS]: "Health & Wellness",
  [FeedCategory.HOME_HOBBIES]: "Home & Hobbies",
  [FeedCategory.IDENTITY_COMMUNITY]: "Identity & Community",
  [FeedCategory.INDUSTRY_PROFESSIONS]: "Industry & Professions",
  [FeedCategory.NEWS_CURRENT_EVENTS]: "News & Politics",
  [FeedCategory.REGIONAL_LOCAL]: "Regional & Local",
  [FeedCategory.SCIENCE_NATURE]: "Science & Nature",
  [FeedCategory.SOCIETY_LAW_HISTORY]: "Society & History",
  [FeedCategory.SOFTWARE_ENGINEERING]: "Software Engineering",
  [FeedCategory.SPORTS]: "Sports",
  [FeedCategory.STYLE_SHOPPING]: "Style & Shopping",
  [FeedCategory.TRAVEL_GEOGRAPHY]: "Travel",
  [FeedCategory.MISCELLANEOUS]: "Miscellaneous",
};

/**
 * Mobile-friendly category name mappings
 * (Optional - falling back to display names if not specific enough)
 */
export const MOBILE_CATEGORY_NAMES: Record<FeedCategory, string> = {
  ...CATEGORY_DISPLAY_NAMES,
  [FeedCategory.CONSUMER_TECH_DIGITAL]: "Tech",
  [FeedCategory.NEWS_CURRENT_EVENTS]: "News",
  [FeedCategory.SOCIETY_LAW_HISTORY]: "Society",
  [FeedCategory.FAMILY_RELATIONSHIPS]: "Family",
  [FeedCategory.INDUSTRY_PROFESSIONS]: "Industry",
};
