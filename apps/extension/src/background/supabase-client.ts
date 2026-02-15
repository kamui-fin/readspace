import { createClient, SupabaseClient, Session } from '@supabase/supabase-js'
import { ApiClient } from '@readspace/shared'
import browser from 'webextension-polyfill'
import { PRODUCTION_DEFAULTS, EXTENSION_STORAGE_KEY } from '../lib/constants'
import { ExtensionMessage } from '../shared/types'

let supabaseInstance: SupabaseClient | null = null

export const initSupabase = async () => {
  try {
    const storage = await browser.storage.local.get(EXTENSION_STORAGE_KEY)
    const rawState = storage[EXTENSION_STORAGE_KEY] as string | undefined

    let supabaseUrl = PRODUCTION_DEFAULTS.supabase_url
    let supabaseKey = PRODUCTION_DEFAULTS.supabase_anon_key
    let readspaceUrl = PRODUCTION_DEFAULTS.readspace_url

    if (rawState) {
      const state = JSON.parse(rawState)
      const settings = state.state?.settings
      if (settings) {
        if (settings.supabase_url && settings.supabase_anon_key) {
          supabaseUrl = settings.supabase_url
          supabaseKey = settings.supabase_anon_key
        }
        if (settings.readspace_url) {
          readspaceUrl = settings.readspace_url
        }
      }
    }

    // Configure Supabase
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })

    // Configure ApiClient
    ApiClient.configure({
      baseUrl: readspaceUrl,
      getAuthToken: async () => {
        const storage = await browser.storage.local.get('session')
        const session = storage.session as Session | undefined
        return session?.access_token || null
      },
      refreshToken: async () => {
        // We rely on Supabase's auto-refresh in the background script
        return null
      },
    })

    // Restore session
    const { session } = await browser.storage.local.get('session')
    if (session) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabaseInstance.auth.setSession(session as any)
    }

    // Listen for auth changes
    supabaseInstance.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await browser.storage.local.set({ session })
      } else {
        await browser.storage.local.remove('session')
      }

      browser.runtime
        .sendMessage({
          type: 'auth-changed',
          payload: session,
        })
        .catch(() => {
          // Ignore error if no receivers
        })
    })

    console.log('Supabase initialized with URL:', supabaseUrl)
    console.log('ApiClient initialized with URL:', readspaceUrl)
  } catch (error) {
    console.error('Failed to initialize Supabase/ApiClient:', error)
  }
}

// Initialize
initSupabase()

// Re-init on config change
// Re-init on config change
browser.runtime.onMessage.addListener((msg: unknown) => {
  const message = msg as ExtensionMessage
  if (message.type === 'config-changed') {
    initSupabase()
  }
})

export const supabase = new Proxy({} as SupabaseClient, {
  get: (_target, prop) => {
    if (!supabaseInstance) {
      throw new Error('Supabase client not initialized')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (supabaseInstance as any)[prop]
  },
})
