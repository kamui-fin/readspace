import { Session } from '@supabase/supabase-js'
import { CheckArticleSavedResponse } from '@readspace/shared'

export type MessageType =
  | 'login'
  | 'logout'
  | 'getSession'
  | 'auth-changed'
  | 'fetchFolders'
  | 'saveArticle'
  | 'unsaveArticle'
  | 'updateArticle'
  | 'checkArticleSaved'
  | 'getProfile'
  | 'createFeed'
  | 'deleteFeed'
  | 'createFolder'
  | 'updateFolder'
  | 'deleteFolder'
  | 'config-changed'
  | 'getCachedPageByUrl'
  | 'extractMetadata'
  | 'extractContent'
  | 'discoverFeeds'
  | 'startGoogleOAuth'
  | 'startAppleOAuth'
  | 'checkFeedFollowed'
  | 'follow-changed'
  | 'save-changed'
  | 'page-cache-updated'

/** Broadcast by the background when server revalidation changes a page's saved state. */
export interface SaveChangedPayload {
  /** Normalized with normalizeKey */
  url: string
  article: CheckArticleSavedResponse
}

/** Follow status for a page's discovered feeds. */
export interface FeedFollowStatus {
  followed: boolean
  followId?: string
  /** The candidate feed URL the status applies to */
  url?: string
}

/** Broadcast by the background when server revalidation changes a feed's follow state. */
export interface FollowChangedPayload {
  url: string
  followed: boolean
  id?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ExtensionMessage<T = any> {
  type: MessageType
  payload?: T
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface MessageResponse<T = any> {
  data: T | null
  error: string | null
}

export type { Session }
