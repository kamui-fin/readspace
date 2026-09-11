"use client"

import ClientLayout from "@/components/layout/ClientLayout"
import { AppSidebar } from "@/components/features/navigation/AppSidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { useUserRole } from "@/hooks/use-user-role"
import { isCloudProd } from "@/lib/is-cloud-prod"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Suspense, useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@readspace/shared"
import { toast } from "react-hot-toast"
import { Loader } from "@/components/ui/loader"

// Polar can take a moment to process the webhook after redirecting back to
// the app, so the profile/limits queries are re-checked a few times instead
// of relying on a single invalidation racing the webhook.
const CHECKOUT_REFETCH_ATTEMPTS = 5
const CHECKOUT_REFETCH_INTERVAL_MS = 2000

function CheckoutRedirectHandler() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const queryClient = useQueryClient()
    const hasHandledCheckout = useRef(false)

    useEffect(() => {
        const checkoutId = searchParams.get("checkout_id")
        if (!checkoutId) return
        // React Strict Mode double-invokes effects in dev; guard so the
        // toast and refetch loop only ever run once per redirect.
        if (hasHandledCheckout.current) return
        hasHandledCheckout.current = true

        // Strip the Polar params from the URL right away so a refresh
        // doesn't re-trigger this flow.
        const cleanParams = new URLSearchParams(searchParams.toString())
        cleanParams.delete("checkout_id")
        cleanParams.delete("customer_session_token")
        const query = cleanParams.toString()
        router.replace(query ? `${pathname}?${query}` : pathname)

        toast.success("Upgraded to Pro, enjoy!")

        let attempt = 0
        const refetchStatus = () => {
            attempt += 1
            queryClient.invalidateQueries({ queryKey: queryKeys.userProfile() })
            queryClient.invalidateQueries({ queryKey: queryKeys.userLimits() })
            if (attempt < CHECKOUT_REFETCH_ATTEMPTS) {
                setTimeout(refetchStatus, CHECKOUT_REFETCH_INTERVAL_MS)
            }
        }
        refetchStatus()
        // Only run once for the checkout_id present on initial load.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return null
}

export default function ProtectedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { profile, isLoading } = useUserRole()
    const router = useRouter()
    // Onboarding is a cloud-only flow — never gate self-hosted instances on it.
    const needsOnboarding = isCloudProd() && !!profile && !profile.is_onboarded

    useEffect(() => {
        if (!isLoading && needsOnboarding) {
            router.replace("/onboarding")
        }
    }, [needsOnboarding, isLoading, router])

    if (isLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader
                    variant="circular"
                    size="lg"
                    className="size-5 border-[3px] border-secondary border-t-transparent [animation:spin_0.45s_linear_infinite]"
                />
            </div>
        )
    }

    if (needsOnboarding) {
        return null
    }

    return (
        <ClientLayout>
            <Suspense fallback={null}>
                <CheckoutRedirectHandler />
            </Suspense>
            <AppSidebar />
            <SidebarInset>{children}</SidebarInset>
        </ClientLayout>
    )
}
