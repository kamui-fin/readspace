import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { browser } from './browser'

let supabaseClient: SupabaseClient | null = null

/**
 * Custom storage adapter for Supabase that uses chrome.storage.local
 * This ensures session persistence across extension restarts and proper token refresh
 */
const chromeStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const result = await browser.storage.local.get(key)
      const value = result[key]
      return typeof value === 'string' ? value : null
    } catch (error) {
      console.error('Error reading from chrome storage:', error)
      return null
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await browser.storage.local.set({ [key]: value })
    } catch (error) {
      console.error('Error writing to chrome storage:', error)
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await browser.storage.local.remove(key)
    } catch (error) {
      console.error('Error removing from chrome storage:', error)
    }
  },
}

export function getSupabaseClient(
  supabaseUrl?: string,
  supabaseAnonKey?: string
): SupabaseClient | null {
  // If client exists and no new credentials provided, return existing
  if (supabaseClient && !supabaseUrl && !supabaseAnonKey) {
    return supabaseClient
  }

  // If new credentials provided, create new client
  if (supabaseUrl && supabaseAnonKey) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: chromeStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // Not needed in extension context
        storageKey: 'supabase-auth-token', // Explicit storage key for session
      },
    })
    return supabaseClient
  }

  return supabaseClient
}

export function resetSupabaseClient() {
  supabaseClient = null
}
