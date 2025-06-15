import { getSupabaseClient } from './supabase'
import { useExtensionStore } from '@/store'

export class SupabaseAuthService {
  private static instance: SupabaseAuthService | null = null
  private authSubscription: any = null

  static getInstance(): SupabaseAuthService {
    if (!SupabaseAuthService.instance) {
      SupabaseAuthService.instance = new SupabaseAuthService()
    }
    return SupabaseAuthService.instance
  }

  async initialize() {
    const supabase = getSupabaseClient()
    
    // Set up auth state listener for token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Extension auth event:', event)
        
        switch (event) {
          case 'TOKEN_REFRESHED':
            if (session?.access_token) {
              // Update the stored token in extension settings
              const { updateToken } = useExtensionStore.getState()
              updateToken(session.access_token)
              console.log('Extension token refreshed successfully')
            }
            break
          case 'SIGNED_OUT':
            // Clear stored tokens
            const { logout } = useExtensionStore.getState()
            logout()
            break
        }
      }
    )
    
    this.authSubscription = subscription
  }

  async refreshSession() {
    const supabase = getSupabaseClient()
    const { data: { session }, error } = await supabase.auth.refreshSession()
    
    if (error) {
      console.error('Failed to refresh session:', error)
      throw error
    }
    
    if (session?.access_token) {
      const { updateToken } = useExtensionStore.getState()
      updateToken(session.access_token)
    }
    
    return session
  }

  destroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe()
      this.authSubscription = null
    }
  }
} 