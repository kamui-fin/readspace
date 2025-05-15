import { createClient } from "@/lib/supabase/client"
import { User } from "@supabase/supabase-js"
import { useEffect, useState } from "react"

export function useCurrentUser() {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const supabase = createClient()
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
            setIsLoading(false)
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    return { user, isLoading }
} 