import { useQuery } from "@tanstack/react-query"
import { ApiWebClient } from "@/lib/api-client"
import { USER_QUERY_KEYS } from "@readspace/shared"

// Define user profile type with role
interface UserProfile {
    id?: string
    email?: string
    role?: "basic" | "pro" | "admin"
    created_at?: string
    updated_at?: string
}

export function useUserRole() {
    const {
        data: profile,
        isLoading,
        error,
    } = useQuery<UserProfile>({
        queryKey: [USER_QUERY_KEYS.PROFILE],
        queryFn: () => ApiWebClient.users.getProfile() as Promise<UserProfile>,
        retry: false, // Don't retry on auth failures
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    })

    return {
        profile,
        role: profile?.role || "basic",
        isAdmin: profile?.role === "admin",
        isPro: profile?.role === "pro",
        isBasic: profile?.role === "basic" || !profile?.role,
        isLoading,
        error,
    }
}
