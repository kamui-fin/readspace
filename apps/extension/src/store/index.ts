import {
  ApiClient,
  configureExtensionApiClient,
  setStoreGetter,
} from '@/lib/api-client'
import { browser } from '@/lib/browser'
import { resetSupabaseClient } from '@/lib/supabase'
import {
  Article,
  DiscoveredFeed,
  ExtensionSettings,
  Feed,
  Folder,
  PageMetadata,
  SaveOptions,
  User,
} from '@readspace/shared'
import toast from 'react-hot-toast'
import { create } from 'zustand'
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware'

interface ExtensionState {
  // Settings
  settings: ExtensionSettings
  updateSettings: (settings: Partial<ExtensionSettings>) => void

  // Authentication
  user: User | null
  isAuthenticated: boolean
  login: (accessToken: string) => Promise<void>
  logout: () => Promise<void>
  updateToken: (accessToken: string) => Promise<void>
  checkExistingSession: () => Promise<void>

  // Data
  folders: Folder[]
  feeds: Feed[]
  savedArticleUrls: Set<string>
  savedArticles: Map<string, Article> // Map URL to full article object (includes ID, priority, note, etc.)
  pendingSaveUrls: Set<string> // Track articles currently being saved
  pendingFollowUrls: Set<string> // Track feeds currently being followed
  followAbortControllers: Map<string, AbortController> // Track abort controllers for feed subscriptions

  // Loading states
  isLoading: boolean
  isConnecting: boolean
  isSaving: boolean

  // Current page data
  currentPageMetadata: PageMetadata | null

  // Actions
  setLoading: (loading: boolean) => void
  setConnecting: (connecting: boolean) => void
  setSaving: (saving: boolean) => void
  setCurrentPageMetadata: (metadata: PageMetadata | null) => void

  // API calls
  loadUserData: () => Promise<void>
  saveArticle: (url: string, options?: Partial<SaveOptions>) => Promise<Article>
  subscribeToFeed: (
    feedUrl: string,
    options?: { folder_id?: string }
  ) => Promise<void>
  subscribeToFeeds: (
    feeds: DiscoveredFeed[],
    options?: { folder_id?: string }
  ) => Promise<void>
  unsubscribeFromFeed: (feedId: string) => Promise<void>
  checkArticleSaved: (url: string) => Promise<Article | null>
  getCachedArticle: (url: string) => Article | null
  isArticleSaved: (url: string) => boolean
  isArticlePendingSave: (url: string) => boolean
  unsaveArticle: (url: string) => Promise<void>
  cancelSave: (url: string) => void
  isFeedPendingFollow: (url: string) => boolean
  cancelFollow: (url: string) => void
}

const defaultSettings: ExtensionSettings = {
  readspace_url: 'https://api.readspace.ai',
  supabase_url: 'https://hnqyngkyugiamvlhqoaf.supabase.co',
  supabase_anon_key:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhucXluZ2t5dWdpYW12bGhxb2FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzODIwNDMsImV4cCI6MjA2NTk1ODA0M30.iu6pCWAX5ofuSumz6V0VwKNSEh88XDJ2RCC_iTln0xs',
  google_client_id:
    '618963664803-spg7g7mmlqj1lm47nph2ct16m7318u1e.apps.googleusercontent.com', // Firefox OAuth client ID
  auto_save: false,
  show_reading_time: true,
  theme: 'system',
}

// Custom storage adapter for browser extensions
// Zustand persist uses localStorage by default, which doesn't work in extension service workers
const extensionStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const result = await browser.storage.local.get(name)
      const value = result[name]
      // Zustand createJSONStorage expects a string or null
      return typeof value === 'string' ? value : null
    } catch (error) {
      console.error('Error reading from extension storage:', error)
      return null
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await browser.storage.local.set({ [name]: value })
    } catch (error) {
      console.error('Error writing to extension storage:', error)
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await browser.storage.local.remove(name)
    } catch (error) {
      console.error('Error removing from extension storage:', error)
    }
  },
}

export const useExtensionStore = create<ExtensionState>()(
  persist(
    (set, get) => ({
      // Initial state
      settings: defaultSettings,
      user: null,
      isAuthenticated: false,
      folders: [],
      feeds: [],
      savedArticleUrls: new Set<string>(),
      savedArticles: new Map<string, Article>(),
      pendingSaveUrls: new Set<string>(),
      pendingFollowUrls: new Set<string>(),
      followAbortControllers: new Map<string, AbortController>(),
      isLoading: false,
      isConnecting: false,
      isSaving: false,
      currentPageMetadata: null,

      // Settings
      updateSettings: async (newSettings) => {
        const settings = { ...get().settings, ...newSettings }
        set({ settings })

        // Reconfigure API client if URL or token changed
        if (newSettings.readspace_url || newSettings.access_token) {
          configureExtensionApiClient()
        }

        // Reset Supabase client if settings changed to force recreation with new settings
        if (newSettings.supabase_url || newSettings.supabase_anon_key) {
          resetSupabaseClient()
        }
      },

      // Authentication
      checkExistingSession: async () => {
        const { settings } = get()

        // Don't check session if Supabase is not configured
        if (!settings.supabase_url || !settings.supabase_anon_key) {
          return
        }

        try {
          // Read the Supabase session directly from chrome.storage
          // The background script manages the session, we just read it
          const sessionData = await browser.storage.local.get(
            'supabase-auth-token'
          )
          const sessionJson = sessionData['supabase-auth-token']

          if (!sessionJson || typeof sessionJson !== 'string') {
            console.log('No existing Supabase session found')
            return
          }

          // Parse the session
          const session = JSON.parse(sessionJson)
          const accessToken = session?.access_token

          if (accessToken) {
            // Update the token in the store if it's different from what we have
            const currentToken = settings.access_token
            if (currentToken !== accessToken) {
              console.log(
                '🔄 Found refreshed token from Supabase session, updating store'
              )
              await get().updateToken(accessToken)
            }

            // If not authenticated yet, perform full login
            if (!get().isAuthenticated) {
              await get().login(accessToken)
            }
          }
        } catch (error) {
          console.error('Failed to check existing session:', error)
        }
      },

      login: async (accessToken: string) => {
        set({ isConnecting: true })
        try {
          const { settings } = get()
          const updatedSettings = { ...settings, access_token: accessToken }

          // Update settings in store first
          set({ settings: updatedSettings })

          // Reconfigure API client with the new access token
          configureExtensionApiClient()

          // Test authentication by getting user profile
          const user = (await ApiClient.users.getProfile()) as User

          set({
            user,
            isAuthenticated: true,
            isConnecting: false,
          })

          // Load initial data
          await get().loadUserData()
        } catch (error) {
          set({ isConnecting: false })
          const errorMessage =
            error instanceof Error ? error.message : 'Authentication failed'
          console.error('Login failed:', error)
          throw new Error(errorMessage)
        }
      },

      logout: async () => {
        // Clear the Supabase session from chrome.storage
        // The background script's Supabase client will handle the actual sign out
        try {
          await browser.storage.local.remove('supabase-auth-token')
        } catch (error) {
          console.error('Failed to clear Supabase session:', error)
        }

        const updatedSettings = { ...get().settings, access_token: undefined }

        set({
          user: null,
          isAuthenticated: false,
          folders: [],
          settings: updatedSettings,
        })
      },

      updateToken: async (accessToken: string) => {
        const { settings } = get()
        const updatedSettings = { ...settings, access_token: accessToken }

        // Update settings - the getAuthToken function will pick up the new token
        set({ settings: updatedSettings })
      },

      // Loading states
      setLoading: (loading) => set({ isLoading: loading }),
      setConnecting: (connecting) => set({ isConnecting: connecting }),
      setSaving: (saving) => set({ isSaving: saving }),
      setCurrentPageMetadata: (metadata) =>
        set({ currentPageMetadata: metadata }),

      // Data loading
      loadUserData: async () => {
        const { isAuthenticated } = get()
        if (!isAuthenticated) return

        set({ isLoading: true })
        try {
          const [folders, feeds] = await Promise.all([
            ApiClient.rss.getFolders() as Promise<Folder[]>,
            ApiClient.rss.getFeeds() as Promise<Feed[]>,
          ])

          set({ folders, feeds })
        } catch (error) {
          console.error('Failed to load user data:', error)
          toast.error('Failed to load user data. Please try again.')
        } finally {
          set({ isLoading: false })
        }
      },

      saveArticle: async (url: string, options = {}) => {
        const {
          isAuthenticated,
          currentPageMetadata,
          savedArticleUrls,
          pendingSaveUrls,
        } = get()
        if (!isAuthenticated) throw new Error('Not authenticated')

        // Mark as pending save
        const newPendingSaveUrls = new Set(pendingSaveUrls)
        newPendingSaveUrls.add(url)

        // Immediately mark as saved optimistically
        const newSavedUrls = new Set(savedArticleUrls)
        newSavedUrls.add(url)
        set({
          savedArticleUrls: newSavedUrls,
          pendingSaveUrls: newPendingSaveUrls,
          isSaving: true,
        })

        try {
          // First, try to get cached content from persistent cache
          let extractedContent = null

          try {
            const cachedContent = await chrome.runtime.sendMessage({
              action: 'getCachedContentByUrl',
              url,
            })

            if (cachedContent) {
              extractedContent = cachedContent
            }
          } catch {
            // No cached content available, will extract fresh
          }

          // If no cached content, extract from the current page
          if (!extractedContent) {
            try {
              // Get current tab to extract content
              const tabs = await chrome.tabs.query({
                active: true,
                currentWindow: true,
              })
              if (tabs[0]?.id) {
                extractedContent = await chrome.tabs.sendMessage(tabs[0].id, {
                  action: 'extractContent',
                  url,
                })
              }
            } catch (error) {
              console.error('Failed to extract content from page:', error)
            }
          }

          // Build metadata object with only defined string values
          const metadata: Record<string, string> = {}
          const description =
            extractedContent?.description || currentPageMetadata?.description
          const author = extractedContent?.author || currentPageMetadata?.author
          const published_at =
            extractedContent?.published_at || currentPageMetadata?.published_at
          const image_url =
            extractedContent?.image_url || currentPageMetadata?.image_url
          const favicon = currentPageMetadata?.favicon

          if (description) metadata.description = description
          if (author) metadata.author = author
          if (published_at) metadata.published_at = published_at
          if (image_url) metadata.image_url = image_url
          if (favicon) metadata.favicon = favicon

          const saveRequest = {
            url,
            title:
              options.title ||
              extractedContent?.title ||
              currentPageMetadata?.title,
            content: extractedContent?.content, // Include the extracted HTML content
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            priority: options.priority,
            note: options.note,
          }

          const article = (await ApiClient.rss.saveArticle(
            saveRequest
          )) as Article

          // Store the full article object for instant cache access and remove from pending
          const newSavedArticles = new Map(get().savedArticles)
          newSavedArticles.set(url, article)
          const newPendingSaveUrls = new Set(get().pendingSaveUrls)
          newPendingSaveUrls.delete(url)
          set({
            savedArticles: newSavedArticles,
            pendingSaveUrls: newPendingSaveUrls,
          })

          return article
        } catch (error) {
          // Remove from both savedArticleUrls and pendingSaveUrls if save failed
          const rollbackUrls = new Set(get().savedArticleUrls)
          rollbackUrls.delete(url)
          const newPendingSaveUrls = new Set(get().pendingSaveUrls)
          newPendingSaveUrls.delete(url)
          set({
            savedArticleUrls: rollbackUrls,
            pendingSaveUrls: newPendingSaveUrls,
          })
          throw error
        } finally {
          set({ isSaving: false })
        }
      },

      checkArticleSaved: async (url: string) => {
        const { isAuthenticated } = get()
        if (!isAuthenticated) return null

        try {
          const article = (await ApiClient.rss.checkArticleSaved(
            url
          )) as Article | null

          // Update local state with full article object if saved
          if (article) {
            const newSavedUrls = new Set(get().savedArticleUrls)
            newSavedUrls.add(url)
            const newSavedArticles = new Map(get().savedArticles)
            newSavedArticles.set(url, article)
            set({
              savedArticleUrls: newSavedUrls,
              savedArticles: newSavedArticles,
            })
          }

          return article
        } catch (error) {
          console.error('Failed to check if article is saved:', error)
          return null
        }
      },

      getCachedArticle: (url: string) => {
        return get().savedArticles.get(url) || null
      },

      isArticleSaved: (url: string) => {
        return get().savedArticleUrls.has(url)
      },

      isArticlePendingSave: (url: string) => {
        return get().pendingSaveUrls.has(url)
      },

      cancelSave: (url: string) => {
        // Cancel the pending save by removing from both sets
        const newSavedUrls = new Set(get().savedArticleUrls)
        newSavedUrls.delete(url)
        const newPendingSaveUrls = new Set(get().pendingSaveUrls)
        newPendingSaveUrls.delete(url)
        set({
          savedArticleUrls: newSavedUrls,
          pendingSaveUrls: newPendingSaveUrls,
        })
      },

      unsaveArticle: async (url: string) => {
        const { isAuthenticated, savedArticles, savedArticleUrls } = get()
        if (!isAuthenticated) throw new Error('Not authenticated')

        const article = savedArticles.get(url)
        if (!article) {
          console.warn(
            'Cannot unsave article: no article found for URL',
            url
          )
          return
        }

        // Optimistically remove from saved state
        const newSavedUrls = new Set(savedArticleUrls)
        newSavedUrls.delete(url)
        const newSavedArticles = new Map(savedArticles)
        newSavedArticles.delete(url)
        set({ savedArticleUrls: newSavedUrls, savedArticles: newSavedArticles })

        try {
          // Mark article as not read later to remove from read-later list
          await ApiClient.rss.updateArticle(
            article.id,
            { is_read_later: false },
            'clipped'
          )
        } catch (error) {
          // Rollback on error
          console.error('Failed to unsave article:', error)
          const rollbackUrls = new Set(get().savedArticleUrls)
          rollbackUrls.add(url)
          const rollbackArticles = new Map(get().savedArticles)
          rollbackArticles.set(url, article)
          set({ savedArticleUrls: rollbackUrls, savedArticles: rollbackArticles })
          throw error
        }
      },

      subscribeToFeed: async (feedUrl: string, options = {}) => {
        const {
          isAuthenticated,
          settings,
          pendingFollowUrls,
          followAbortControllers,
        } = get()
        if (!isAuthenticated) {
          toast.error('Please sign in to subscribe to feeds')
          throw new Error('Not authenticated')
        }

        // Create abort controller for this request
        const abortController = new AbortController()
        const newFollowAbortControllers = new Map(followAbortControllers)
        newFollowAbortControllers.set(feedUrl, abortController)

        // Mark as pending follow (if not already)
        const newPendingFollowUrls = new Set(pendingFollowUrls)
        newPendingFollowUrls.add(feedUrl)
        set({
          followAbortControllers: newFollowAbortControllers,
          pendingFollowUrls: newPendingFollowUrls,
        })

        try {
          await ApiClient.rss.createFeed(
            {
              url: feedUrl,
              folder_id: options.folder_id || settings.default_folder_id,
            },
            abortController.signal
          )

          // Remove from pending on success
          const updatedPendingFollowUrls = new Set(get().pendingFollowUrls)
          updatedPendingFollowUrls.delete(feedUrl)
          const updatedFollowAbortControllers = new Map(
            get().followAbortControllers
          )
          updatedFollowAbortControllers.delete(feedUrl)
          set({
            pendingFollowUrls: updatedPendingFollowUrls,
            followAbortControllers: updatedFollowAbortControllers,
          })
        } catch (error) {
          // Remove from pending on error (including aborted requests)
          const rollbackPendingFollowUrls = new Set(get().pendingFollowUrls)
          rollbackPendingFollowUrls.delete(feedUrl)
          const rollbackFollowAbortControllers = new Map(
            get().followAbortControllers
          )
          rollbackFollowAbortControllers.delete(feedUrl)
          set({
            pendingFollowUrls: rollbackPendingFollowUrls,
            followAbortControllers: rollbackFollowAbortControllers,
          })

          // Don't throw error if it was aborted (user cancelled)
          if (error instanceof Error && error.name === 'AbortError') {
            return
          }

          console.error('Failed to subscribe to feed:', error)
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to subscribe to feed'
          throw new Error(errorMessage)
        }
      },

      isFeedPendingFollow: (url: string) => {
        return get().pendingFollowUrls.has(url)
      },

      cancelFollow: (url: string) => {
        // Abort the request if it's still in progress
        const abortController = get().followAbortControllers.get(url)
        if (abortController) {
          abortController.abort()
        }

        // Cancel the pending follow by removing from sets
        const newPendingFollowUrls = new Set(get().pendingFollowUrls)
        newPendingFollowUrls.delete(url)
        const newFollowAbortControllers = new Map(get().followAbortControllers)
        newFollowAbortControllers.delete(url)
        set({
          pendingFollowUrls: newPendingFollowUrls,
          followAbortControllers: newFollowAbortControllers,
        })
      },

      subscribeToFeeds: async (feeds: DiscoveredFeed[], options = {}) => {
        const { isAuthenticated, settings } = get()
        if (!isAuthenticated) {
          toast.error('Please sign in to subscribe to feeds')
          throw new Error('Not authenticated')
        }

        try {
          // Subscribe to feeds one by one since there's no bulk endpoint in the current API
          await Promise.all(
            feeds.map((feed) =>
              ApiClient.rss.createFeed({
                url: feed.url,
                folder_id: options.folder_id || settings.default_folder_id,
              })
            )
          )
        } catch (error) {
          console.error('Failed to subscribe to feeds:', error)
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to subscribe to feeds'
          throw new Error(errorMessage)
        }
      },

      unsubscribeFromFeed: async (feedId: string) => {
        const { isAuthenticated } = get()
        if (!isAuthenticated) {
          toast.error('Please sign in to unsubscribe from feeds')
          throw new Error('Not authenticated')
        }

        try {
          await ApiClient.rss.deleteFeed(feedId)
          // Reload user data to update the feeds list
          await get().loadUserData()
        } catch (error) {
          console.error('Failed to unsubscribe from feed:', error)
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to unsubscribe from feed'
          throw new Error(errorMessage)
        }
      },
    }),
    {
      name: 'readspace-extension',
      storage: createJSONStorage(() => extensionStorage),
      partialize: (state) => ({
        settings: state.settings,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        folders: state.folders,
        feeds: state.feeds,
        savedArticleUrls: Array.from(state.savedArticleUrls), // Convert Set to Array for storage
        savedArticles: Array.from(state.savedArticles.entries()), // Convert Map to Array of entries
      }),
      onRehydrateStorage: () => (state) => {
        // Convert savedArticleUrls array back to Set after rehydration
        if (state && Array.isArray(state.savedArticleUrls)) {
          state.savedArticleUrls = new Set(state.savedArticleUrls) as any
        } else if (state) {
          state.savedArticleUrls = new Set<string>() as any
        }

        // Convert savedArticles array back to Map after rehydration
        if (state && Array.isArray(state.savedArticles)) {
          state.savedArticles = new Map(state.savedArticles) as any
        } else if (state) {
          state.savedArticles = new Map<string, Article>() as any
        }

        // Configure ApiClient after store is rehydrated
        configureExtensionApiClient()

        // Check for existing Supabase session on startup
        // This ensures we pick up any token refreshes that happened while the extension was idle
        if (state) {
          state.checkExistingSession()
        }
      },
    }
  )
)

// Set up the store getter to break circular dependency
setStoreGetter(() => useExtensionStore.getState())

// Configure ApiClient immediately after store creation
configureExtensionApiClient()

// Listen for OAuth login success from background script
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'oauth-login-success' && message.access_token) {
      // Call the login function with the access token
      useExtensionStore
        .getState()
        .login(message.access_token)
        .then(() => {
          sendResponse({ success: true })
        })
        .catch((error) => {
          console.error('OAuth login failed:', error)
          sendResponse({ success: false, error: error.message })
        })

      // Return true to indicate async response
      return true
    }
  })
}
