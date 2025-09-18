import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseClient: SupabaseClient | null = null

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
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
    return supabaseClient
  }

  return supabaseClient
}

export function resetSupabaseClient() {
  supabaseClient = null
}
