import { createClient } from "@/lib/supabase/client"
import { User } from "@supabase/supabase-js"
import { useEffect, useState } from "react"

export function useCurrentUser() {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const supabase = createClient()
        
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            setIsLoading(false)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth event:', event, session?.user?.email)
            
            switch (event) {
                case 'INITIAL_SESSION':
                    setUser(session?.user ?? null)
                    setIsLoading(false)
                    break
                case 'SIGNED_IN':
                    setUser(session?.user ?? null)
                    setIsLoading(false)
                    break
                case 'SIGNED_OUT':
                    setUser(null)
                    setIsLoading(false)
                    // Clear any cached data
                    break
                case 'TOKEN_REFRESHED':
                    // Update user data with refreshed session
                    setUser(session?.user ?? null)
                    console.log('Token refreshed successfully')
                    break
                case 'USER_UPDATED':
                    setUser(session?.user ?? null)
                    break
                default:
                    setUser(session?.user ?? null)
                    setIsLoading(false)
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    return { user, isLoading }
}
