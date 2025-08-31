import { useQuery } from "@tanstack/react-query"
import { ApiClient } from "@/lib/api/client"
import { USER_QUERY_KEYS } from "@/lib/query-keys"

export function useUserRole() {
    const { data: profile, isLoading, error } = useQuery({
        queryKey: [USER_QUERY_KEYS.PROFILE],
        queryFn: () => ApiClient.users.getProfile(),
        retry: false, // Don't retry on auth failures
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    })

    return {
        profile,
        role: profile?.role || 'basic',
        isAdmin: profile?.role === 'admin',
        isPro: profile?.role === 'pro',
        isBasic: profile?.role === 'basic',
        isLoading,
        error,
    }
}