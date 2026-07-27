import { FeedCategory } from '../api/types';

/**
 * List of all available feed categories, ordered from most popular/sought-out to least.
 * Excludes MISCELLANEOUS.
 */
export const FEED_CATEGORIES: FeedCategory[] = [
  FeedCategory.NEWS_CURRENT_EVENTS,
  FeedCategory.SOFTWARE_ENGINEERING,
  FeedCategory.CONSUMER_TECH_DIGITAL,
  FeedCategory.BUSINESS_FINANCE,
  FeedCategory.SCIENCE_NATURE,
  FeedCategory.SPORTS,
  FeedCategory.GAMING,
  FeedCategory.ENTERTAINMENT,
  FeedCategory.SOCIETY_LAW_HISTORY,
  FeedCategory.ARTS_CULTURE,
  FeedCategory.TRAVEL_GEOGRAPHY,
  FeedCategory.FOOD_DRINK,
  FeedCategory.HEALTH_WELLNESS,
  FeedCategory.STYLE_SHOPPING,
  FeedCategory.HOME_HOBBIES,
  FeedCategory.FAMILY_RELATIONSHIPS,
  FeedCategory.IDENTITY_COMMUNITY,
  FeedCategory.INDUSTRY_PROFESSIONS,
  FeedCategory.AUTOMOTIVE_TRANSPORT,
  FeedCategory.REGIONAL_LOCAL,
];

/**
 * Display names for categories
 */
export const CATEGORY_DISPLAY_NAMES: Record<FeedCategory, string> = {
  [FeedCategory.ARTS_CULTURE]: 'Arts & Culture',
  [FeedCategory.AUTOMOTIVE_TRANSPORT]: 'Automotive',
  [FeedCategory.BUSINESS_FINANCE]: 'Business & Finance',
  [FeedCategory.CONSUMER_TECH_DIGITAL]: 'Tech & Digital',
  [FeedCategory.ENTERTAINMENT]: 'Entertainment',
  [FeedCategory.FAMILY_RELATIONSHIPS]: 'Family & Relationships',
  [FeedCategory.FOOD_DRINK]: 'Food & Drink',
  [FeedCategory.GAMING]: 'Gaming',
  [FeedCategory.HEALTH_WELLNESS]: 'Health & Wellness',
  [FeedCategory.HOME_HOBBIES]: 'Home & Hobbies',
  [FeedCategory.IDENTITY_COMMUNITY]: 'Identity & Community',
  [FeedCategory.INDUSTRY_PROFESSIONS]: 'Industry & Professions',
  [FeedCategory.NEWS_CURRENT_EVENTS]: 'News & Politics',
  [FeedCategory.REGIONAL_LOCAL]: 'Regional & Local',
  [FeedCategory.SCIENCE_NATURE]: 'Science & Nature',
  [FeedCategory.SOCIETY_LAW_HISTORY]: 'Society & History',
  [FeedCategory.SOFTWARE_ENGINEERING]: 'Software Engineering',
  [FeedCategory.SPORTS]: 'Sports',
  [FeedCategory.STYLE_SHOPPING]: 'Style & Shopping',
  [FeedCategory.TRAVEL_GEOGRAPHY]: 'Travel',
  [FeedCategory.MISCELLANEOUS]: 'Miscellaneous',
};

/**
 * Mobile-friendly category name mappings, ordered from most popular to least.
 * Excludes MISCELLANEOUS.
 */
export const MOBILE_CATEGORY_NAMES: Omit<Record<FeedCategory, string>, FeedCategory.MISCELLANEOUS> = {
  [FeedCategory.NEWS_CURRENT_EVENTS]: 'News',
  [FeedCategory.SOFTWARE_ENGINEERING]: 'Software Engineering',
  [FeedCategory.CONSUMER_TECH_DIGITAL]: 'Tech',
  [FeedCategory.BUSINESS_FINANCE]: 'Business & Finance',
  [FeedCategory.SCIENCE_NATURE]: 'Science & Nature',
  [FeedCategory.SPORTS]: 'Sports',
  [FeedCategory.GAMING]: 'Gaming',
  [FeedCategory.ENTERTAINMENT]: 'Entertainment',
  [FeedCategory.SOCIETY_LAW_HISTORY]: 'Society',
  [FeedCategory.ARTS_CULTURE]: 'Arts & Culture',
  [FeedCategory.TRAVEL_GEOGRAPHY]: 'Travel',
  [FeedCategory.FOOD_DRINK]: 'Food & Drink',
  [FeedCategory.HEALTH_WELLNESS]: 'Health & Wellness',
  [FeedCategory.STYLE_SHOPPING]: 'Style & Shopping',
  [FeedCategory.HOME_HOBBIES]: 'Home & Hobbies',
  [FeedCategory.FAMILY_RELATIONSHIPS]: 'Family',
  [FeedCategory.IDENTITY_COMMUNITY]: 'Identity & Community',
  [FeedCategory.INDUSTRY_PROFESSIONS]: 'Industry',
  [FeedCategory.AUTOMOTIVE_TRANSPORT]: 'Automotive',
  [FeedCategory.REGIONAL_LOCAL]: 'Regional & Local',
};

