import { ApiClient, USER_QUERY_KEYS } from "@readspace/shared"
import { useQuery } from "@tanstack/react-query"

// Define user profile type with role
interface UserProfile {
    id?: string
    email?: string
    role?: "BASIC" | "PRO" | "ADMIN"
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
        queryFn: () => ApiClient.getProfile() as Promise<UserProfile>,
        retry: false, // Don't retry on auth failures
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    })

    return {
        profile,
        role: profile?.role || "BASIC",
        isAdmin: profile?.role === "ADMIN",
        isPro: profile?.role === "PRO",
        isBasic: profile?.role === "BASIC" || !profile?.role,
        isLoading,
        error,
    }
}
