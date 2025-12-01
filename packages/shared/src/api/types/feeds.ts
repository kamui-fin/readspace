import { Folder } from "./folders";

// Feed related types

export interface FeedBase {
  url: string;
  title: string;
  link: string | null;
  image_url: string | null;
}

export interface FeedSummary extends FeedBase {
  id: string;
  error_count: number;
  is_subscribed?: boolean;
}

export interface FeedDetail extends FeedSummary {
  description: string | null;
  language: string | null;

  // Fetching Logic
  last_fetched_at: string | null;
  next_fetch_at: string | null;
  adaptive_fetch_interval_minutes: number | null;
  last_error_message: string | null;

  // Advanced Metadata
  popularity_score: number;
  subscriber_count: number;
  top_level_category: string | null;
  tags: string[];

  is_subscribed: boolean;

  // Timestamps
  created_at: string;
  last_updated_at: string | null;
}

export interface Subscription {
  id: string;
  is_favorite: boolean;
  custom_title: string | null;
  feed: FeedSummary;
  folder: Folder | null;
  created_at: string;
}

export interface SubscriptionExtended extends Subscription {
  feed: FeedDetail;
}

export interface FeedCreate {
  url: string;
  folder_id: string;
}

export interface SubscriptionCreateByFeedId {
  folder_id: string;
  custom_title?: string;
  is_favorite?: boolean;
}

export interface SubscriptionUpdate {
  is_favorite?: boolean;
  custom_title?: string;
  folder_id?: string;
}

export interface FeedDiscoveryRequest {
  url: string;
}

export interface FeedDiscoveryResult {
  id: string;
  url: string;
  title: string;
  description: string;
  link?: string;
  image_url?: string;
  language: string;
  top_level_category: string;
  popularity_score: number;
  tags?: string[];
  is_subscribed?: boolean;
}

export interface FeedsResponse {
  subscriptions: Subscription[] | SubscriptionExtended[];
  folders: Folder[];
}
