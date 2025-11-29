import { useProfile } from "@readspace/shared"

export function useUserRole() {
    const {
        data: profile,
        isLoading,
        error,
    } = useProfile({
        retry: false,
        staleTime: 5 * 60 * 1000,
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
