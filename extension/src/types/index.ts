export interface User {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
}

export interface Article {
  id: string
  title: string
  url: string
  description?: string
  content?: string
  author?: string
  published_at?: string
  image_url?: string
  favicon?: string
  estimated_read_time_minutes?: number
  is_read: boolean
  is_read_later: boolean
  is_favorite: boolean
  created_at: string
  updated_at: string
}

export interface SaveArticleRequest {
  url: string
  title?: string
  content?: string
  metadata?: {
    description?: string
    author?: string
    published_at?: string
    image_url?: string
    favicon?: string
  }
  priority?: 'high' | 'medium' | 'low'
  note?: string
}

export interface Folder {
  id: string
  name: string
  user_id: string
  created_at: string
  updated_at: string
}

export interface Feed {
  id: string
  url: string
  title?: string
  description?: string
  link?: string
  image_url?: string
  is_favorite: boolean
  folder_id: string
  user_id: string
  created_at: string
  updated_at: string
}

export interface FeedDiscoveryRequest {
  url: string
}

export interface DiscoveredFeed {
  url: string
  title?: string
  description?: string
  type: 'rss' | 'atom' | 'json'
}

export interface BulkFeedSubscribeRequest {
  feeds: Array<{
    url: string
    folder_id?: string
  }>
}

export interface ExtensionSettings {
  readspace_url: string
  supabase_url: string
  supabase_anon_key: string
  access_token?: string
  default_folder_id?: string
  auto_save: boolean
  show_reading_time: boolean
  theme: 'light' | 'dark' | 'system'
}

export interface PageMetadata {
  title?: string
  description?: string
  author?: string
  published_at?: string
  image_url?: string
  favicon?: string
  canonical_url?: string
  feeds?: DiscoveredFeed[]
}

export interface ContentExtractionResult {
  content: string
  title: string
  description?: string
  author?: string
  published_at?: string
  image_url?: string
  estimated_read_time: number
}

export type Priority = 'high' | 'medium' | 'low'

export interface SaveOptions {
  priority: Priority
  folder_id?: string
  note?: string
  title?: string
}
