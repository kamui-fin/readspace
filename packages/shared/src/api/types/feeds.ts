import { FolderResponse } from './folders';

// Enums from server/app/models/enums.py
export enum FeedCategory {
  ARTS_CULTURE = 'arts_culture',
  AUTOMOTIVE_TRANSPORT = 'automotive_transport',
  BUSINESS_FINANCE = 'business_finance',
  CONSUMER_TECH_DIGITAL = 'consumer_tech_digital',
  ENTERTAINMENT = 'entertainment',
  FAMILY_RELATIONSHIPS = 'family_relationships',
  FOOD_DRINK = 'food_drink',
  GAMING = 'gaming',
  HEALTH_WELLNESS = 'health_wellness',
  HOME_HOBBIES = 'home_hobbies',
  IDENTITY_COMMUNITY = 'identity_community',
  INDUSTRY_PROFESSIONS = 'industry_professions',
  NEWS_CURRENT_EVENTS = 'news_current_events',
  REGIONAL_LOCAL = 'regional_local',
  SCIENCE_NATURE = 'science_nature',
  SOCIETY_LAW_HISTORY = 'society_law_history',
  SOFTWARE_ENGINEERING = 'software_engineering',
  SPORTS = 'sports',
  STYLE_SHOPPING = 'style_shopping',
  TRAVEL_GEOGRAPHY = 'travel_geography',
  MISCELLANEOUS = 'miscellaneous',
}

export enum ContentType {
  AGGREGATOR = 'aggregator',
  CORPORATE_BLOG = 'corporate_blog',
  DOCUMENTATION_WIKI = 'documentation_wiki',
  EDUCATION_RESEARCH = 'education_research',
  FORUM_COMMUNITY = 'forum_community',
  GOVERNMENT_INSTITUTIONAL = 'government_institutional',
  INDIE_BLOG = 'indie_blog',
  MAGAZINE_EDITORIAL = 'magazine_editorial',
  MARKETPLACE_LISTINGS = 'marketplace_listings',
  NEWSLETTER = 'newsletter',
  NEWS_OUTLET = 'news_outlet',
  OPEN_SOURCE_ACTIVITY = 'open_source_activity',
  PODCAST_FEED = 'podcast_feed',
  STATUS_CHANGELOG = 'status_changelog',
  VIDEO_CHANNEL = 'video_channel',
}

// Feed related types

export interface FeedBase {
  url: string;
  title: string;
  description: string | null;
  link: string | null;
  language: string;
  image_url: string | null;
  author: string | null;
  content_type: ContentType | null;
  tags_native: string[];
}

export interface FeedSummary extends FeedBase {
  id: string;
  is_subscribed?: boolean;
  top_level_category?: FeedCategory | null;
  popularity_score?: number;
}

export interface FeedDetail extends FeedSummary {
  // Fetching Logic
  last_fetched_at: string | null;
  next_fetch_at: string | null;
  adaptive_fetch_interval_minutes: number | null;
  last_error_message: string | null;
  error_count: number;

  // Advanced Metadata
  popularity_score: number;
  subscriber_count: number;
  top_level_category: FeedCategory | null;
  tags: string[];

  is_subscribed: boolean;

  // Timestamps
  created_at: string;
  last_updated_at: string | null;
}

// Requests

export interface FeedCreate {
  url: string;
  folder_id?: string;
}

export interface AdminFeedUpdate {
  title?: string;
  description?: string;
  link?: string;
  language?: string;
  image_url?: string;
  url?: string;
  top_level_category?: FeedCategory | null;
  popularity_score?: number;
  tags?: string[];
  tags_native?: string[];
  author?: string;
  content_type?: ContentType | null;
}

// Subscriptions

export interface SubscriptionBase {
  is_favorite: boolean;
  custom_title: string | null;
}

export interface SubscriptionCreate {
  url: string;
  folder_id?: string;
  custom_title?: string;
}

export interface SubscriptionCreateByFeedId {
  folder_id?: string;
  custom_title?: string;
  is_favorite?: boolean;
}

export interface SubscriptionUpdate {
  custom_title?: string;
  folder_id?: string;
  is_favorite?: boolean;
}

export interface SubscriptionResponse extends SubscriptionBase {
  id: string;
  feed: FeedSummary;
  folder: FolderResponse; // NOTE: Backend returns full FolderResponse now
  created_at: string;
}

export interface SubscriptionResponseExtended extends SubscriptionResponse {
  feed: FeedDetail;
}

// Aliases for compatibility
export type Subscription = SubscriptionResponse;
export type SubscriptionExtended = SubscriptionResponseExtended;
export type Feed = FeedSummary; // Or FeedDetail, depending on usage context, but mostly Summary in lists.

// Enrichment & Discovery

export interface FeedEnrichmentResponse {
  enhanced_description: string | null;
  tags: string[];
  tags_native: string[];
  author: string | null;
  content_type: string | null;
  category: string;
  popularity_estimate: number;
}

export interface FeedEnrichmentInput {
  title: string;
  description?: string;
  domain: string;
  language?: string;
  link?: string;
  url?: string;
  tags?: string[];
  contributors?: string[];
  articles?: string[];
}

export interface FaviconResult {
  image_url: string | null;
  canonical_link: string | null;
}

export interface FeedScoringData {
  id?: string;
  title?: string;
  description?: string;
  image_url?: string;
  language?: string;
  domain?: string;
  tags: string[];
  tags_native: string[];
  author?: string;
  content_type?: ContentType | null;
}

export interface MeilisearchFeedDocument extends FeedScoringData {
  id: string;
  url: string;
  link: string | null;
  top_level_category: string | null;
  popularity_score: number;
}

export interface ParsedFeed {
  title: string;
  id: string | null;
  url: string | null;
  description: string | null;
  link: string | null;
  language: string | null;
  image_url: string | null;
  author: string | null;
  content_type: string | null;
  last_updated_at: string | null;
  tags: string[];
  tags_native: string[];
  // articles: ArticleCreate[]; // Avoiding circular dependency for now or import simply
  is_subscribed: boolean;
}

export type FeedDiscoveryResult = ParsedFeed;

export interface FeedsResponse {
  subscriptions: SubscriptionResponse[] | SubscriptionResponseExtended[];
  folders: FolderResponse[];
}
