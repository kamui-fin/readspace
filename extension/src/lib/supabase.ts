import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { useExtensionStore } from '@/store'

let supabaseClient: SupabaseClient | null = null
let currentUrl: string | null = null
let currentKey: string | null = null

export function getSupabaseClient(): SupabaseClient {
  const settings = useExtensionStore.getState().settings
  
  if (!supabaseClient || 
      currentUrl !== settings.supabase_url ||
      currentKey !== settings.supabase_anon_key) {
    
    if (!settings.supabase_url || !settings.supabase_anon_key) {
      throw new Error('Supabase URL and anonymous key must be configured')
    }
    
    supabaseClient = createClient(settings.supabase_url, settings.supabase_anon_key)
    currentUrl = settings.supabase_url
    currentKey = settings.supabase_anon_key
  }
  
  return supabaseClient
}

export function resetSupabaseClient() {
  supabaseClient = null
  currentUrl = null
  currentKey = null
} 