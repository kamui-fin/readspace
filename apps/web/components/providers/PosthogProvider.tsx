"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { usePostHog } from "posthog-js/react"

import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"
import { isCloudProd } from "@/lib/is-cloud-prod"
import { useCurrentUser } from "@/hooks/use-current-user"

function PostHogPageView() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const posthog = usePostHog()

    useEffect(() => {
        if (pathname && posthog) {
            let url = window.origin + pathname
            if (searchParams.toString()) {
                url = url + `?${searchParams.toString()}`
            }
            posthog.capture("$pageview", {
                $current_url: url,
            })
        }
    }, [pathname, searchParams, posthog])

    return null
}

function PostHogIdentify() {
    const { user, isLoading } = useCurrentUser()

    useEffect(() => {
        if (isLoading) return

        if (user) {
            posthog.identify(user.id, { email: user.email })
        } else {
            posthog.reset()
        }
    }, [user, isLoading])

    return null
}

export function PosthogProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (isCloudProd() && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
            posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
                api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
                person_profiles: "identified_only",
                capture_pageview: false, // Disable automatic pageview capture, as we capture manually
            })
        }
    }, [])

    // Only wrap with PHProvider if we're in cloud prod and have the key
    if (isCloudProd() && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        return (
            <PHProvider client={posthog}>
                <PostHogPageView />
                <PostHogIdentify />
                {children}
            </PHProvider>
        )
    }

    // For self-hosted, just return children without PostHog
    return <>{children}</>
}
