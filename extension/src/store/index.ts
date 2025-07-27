import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import toast from 'react-hot-toast'
import {
  ExtensionSettings,
  User,
  Article,
  Folder,
  Tag,
  SaveOptions,
  PageMetadata,
  DiscoveredFeed,
} from '@/types'
import { ReadspaceAPI } from '@/lib/api'
import { getSupabaseClient } from '@/lib/supabase'

interface ExtensionState {
  // Settings
  settings: ExtensionSettings
  updateSettings: (settings: Partial<ExtensionSettings>) => void

  // Authentication
  user: User | null
  isAuthenticated: boolean
  api: ReadspaceAPI | null
  login: (accessToken: string) => Promise<void>
  logout: () => void
  updateToken: (accessToken: string) => void
  checkExistingSession: () => Promise<void>

  // Data
  folders: Folder[]
  tags: Tag[]
  
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
  subscribeToFeed: (feedUrl: string, options?: { folder_id?: string; tag_ids?: string[] }) => Promise<void>
  subscribeToFeeds: (feeds: DiscoveredFeed[], options?: { folder_id?: string; tag_ids?: string[] }) => Promise<void>
}

const defaultSettings: ExtensionSettings = {
  readspace_url: 'https://api.readspace.ai',
  supabase_url: 'https://hnqyngkyugiamvlhqoaf.supabase.co',
  supabase_anon_key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhucXluZ2t5dWdpYW12bGhxb2FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAzODIwNDMsImV4cCI6MjA2NTk1ODA0M30.iu6pCWAX5ofuSumz6V0VwKNSEh88XDJ2RCC_iTln0xs',
  auto_save: false,
  show_reading_time: true,
  theme: 'system',
  default_tags: [],
}

export const useExtensionStore = create<ExtensionState>()(
  persist(
    (set, get) => ({
      // Initial state
      settings: defaultSettings,
      user: null,
      isAuthenticated: false,
      api: null,
      folders: [],
      tags: [],
      isLoading: false,
      isConnecting: false,
      isSaving: false,
      currentPageMetadata: null,

      // Settings
      updateSettings: async (newSettings) => {
        const settings = { ...get().settings, ...newSettings }
        set({ settings })
        
        // Update API instance if URL changed
        const { api } = get()
        if (api && newSettings.readspace_url && newSettings.readspace_url !== api['baseUrl']) {
          const newApi = new ReadspaceAPI(settings.readspace_url, settings.access_token)
          set({ api: newApi })
        }

        // Reset Supabase client if settings changed to force recreation with new settings
        if (newSettings.supabase_url || newSettings.supabase_anon_key) {
          const { resetSupabaseClient } = await import('@/lib/supabase')
          resetSupabaseClient()
          console.log('Supabase client reset for new settings')
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
          console.log('Checking existing session...')
          const supabase = getSupabaseClient(settings.supabase_url, settings.supabase_anon_key)
          
          if (!supabase) {
            console.log('Failed to create Supabase client')
            return
          }
          
          const { data: { session }, error } = await supabase.auth.getSession()
          
          if (error) {
            console.error('Session check failed:', error)
            return
          }

          if (session?.access_token) {
            console.log('Found existing session, logging in...')
            await get().login(session.access_token)
          } else {
            console.log('No existing session found')
          }
        } catch (error) {
          console.error('Failed to check existing session:', error)
        }
      },

      login: async (accessToken: string) => {
        set({ isConnecting: true })
        try {
          const { settings } = get()
          
          // Create authenticated API instance and test it
          const api = new ReadspaceAPI(settings.readspace_url, accessToken)
          const user = await api.getCurrentUser()
          
          set({
            user,
            isAuthenticated: true,
            api,
            settings: { ...settings, access_token: accessToken },
            isConnecting: false,
          })

          // Load initial data
          await get().loadUserData()
        } catch (error) {
          set({ isConnecting: false })
          const errorMessage = error instanceof Error ? error.message : 'Authentication failed'
          console.error('Login failed:', error)
          throw new Error(errorMessage)
        }
      },

      logout: () => {
        const { settings } = get()
        
        // Sign out from Supabase
        const supabase = getSupabaseClient(settings.supabase_url, settings.supabase_anon_key)
        if (supabase) {
          supabase.auth.signOut().catch(error => {
            console.error('Failed to sign out from Supabase:', error)
          })
        }
        
        set({
          user: null,
          isAuthenticated: false,
          api: null,
          folders: [],
          tags: [],
          settings: { ...get().settings, access_token: undefined },
        })
      },

      updateToken: (accessToken: string) => {
        const { settings, api } = get()
        const updatedSettings = { ...settings, access_token: accessToken }
        
        // Update settings
        set({ settings: updatedSettings })
        
        // Update API instance with new token
        if (api) {
          api.setAccessToken(accessToken)
        }
      },

      // Loading states
      setLoading: (loading) => set({ isLoading: loading }),
      setConnecting: (connecting) => set({ isConnecting: connecting }),
      setSaving: (saving) => set({ isSaving: saving }),
      setCurrentPageMetadata: (metadata) => set({ currentPageMetadata: metadata }),

      // Data loading
      loadUserData: async () => {
        const { api } = get()
        if (!api) return

        set({ isLoading: true })
        try {
          const [folders, tags] = await Promise.all([
            api.getFolders(),
            api.getTags(),
          ])

          set({ folders, tags })
        } catch (error) {
          console.error('Failed to load user data:', error)
          toast.error('Failed to load user data. Please try again.')
        } finally {
          set({ isLoading: false })
        }
      },

      saveArticle: async (url: string, options = {}) => {
        const { api, settings, currentPageMetadata } = get()
        if (!api) throw new Error('Not authenticated')

        set({ isSaving: true })
        try {
          // Extract content from the current page
          console.log('Extracting content for article save...')
          let extractedContent = null
          
          try {
            // Get current tab to extract content
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
            if (tabs[0]?.id) {
              extractedContent = await chrome.tabs.sendMessage(tabs[0].id, { 
                action: 'extractContent',
                url 
              })
              console.log('Content extracted from page:', extractedContent)
            }
          } catch (error) {
            console.error('Failed to extract content from page:', error)
          }

          const saveRequest = {
            url,
            title: options.title || extractedContent?.title || currentPageMetadata?.title,
            content: extractedContent?.content, // Include the extracted HTML content
            metadata: {
              description: extractedContent?.description || currentPageMetadata?.description,
              author: extractedContent?.author || currentPageMetadata?.author,
              published_at: extractedContent?.published_at || currentPageMetadata?.published_at,
              image_url: extractedContent?.image_url || currentPageMetadata?.image_url,
              favicon: currentPageMetadata?.favicon,
            },
            priority: options.priority,
            tag_ids: options.tag_ids?.length ? options.tag_ids : settings.default_tags,
            note: options.note,
          }
          
          console.log('Saving article with request:', {
            ...saveRequest,
            content: saveRequest.content ? `${saveRequest.content.length} chars` : 'no content'
          })

          const article = await api.saveArticle(saveRequest)
          return article
        } finally {
          set({ isSaving: false })
        }
      },

      subscribeToFeed: async (feedUrl: string, options = {}) => {
        const { api, settings } = get()
        if (!api) {
          toast.error('Please sign in to subscribe to feeds')
          throw new Error('Not authenticated')
        }

        try {
          await api.createFeed({
            url: feedUrl,
            folder_id: options.folder_id || settings.default_folder_id,
            tag_ids: options.tag_ids || settings.default_tags,
          })
        } catch (error) {
          console.error('Failed to subscribe to feed:', error)
          const errorMessage = error instanceof Error ? error.message : 'Failed to subscribe to feed'
          throw new Error(errorMessage)
        }
      },

      subscribeToFeeds: async (feeds: DiscoveredFeed[], options = {}) => {
        const { api, settings } = get()
        if (!api) {
          toast.error('Please sign in to subscribe to feeds')
          throw new Error('Not authenticated')
        }

        try {
          const subscribeRequest = {
            feeds: feeds.map(feed => ({
              url: feed.url,
              folder_id: options.folder_id || settings.default_folder_id,
              tag_ids: options.tag_ids || settings.default_tags,
            }))
          }

          await api.subscribeToFeeds(subscribeRequest)
        } catch (error) {
          console.error('Failed to subscribe to feeds:', error)
          const errorMessage = error instanceof Error ? error.message : 'Failed to subscribe to feeds'
          throw new Error(errorMessage)
        }
      },
    }),
    {
      name: 'readspace-extension',
      partialize: (state) => ({
        settings: state.settings,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        folders: state.folders,
        tags: state.tags,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.isAuthenticated && state?.settings?.access_token && state?.settings?.readspace_url) {
          // Recreate API instance on rehydration
          const api = new ReadspaceAPI(state.settings.readspace_url, state.settings.access_token)
          state.api = api
          console.log('API instance recreated on rehydration with token', state.settings.access_token)
        }
      },
    }
  )
) 