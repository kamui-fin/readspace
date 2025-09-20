"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { usePostHog } from "posthog-js/react"

import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"
import { useIsCloudProd } from "@/hooks/useIsCloudProd"

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

export function PostHogProvider({ children }: { children: React.ReactNode }) {
    const isCloudProd = useIsCloudProd()

    useEffect(() => {
        if (isCloudProd && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
            posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
                api_host:
                    process.env.NEXT_PUBLIC_POSTHOG_HOST ||
                    "https://us.i.posthog.com",
                person_profiles: "identified_only",
                capture_pageview: false, // Disable automatic pageview capture, as we capture manually
                capture_pageleave: true, // Enable pageleave capture
            })
        }
    }, [isCloudProd])

    // Only wrap with PHProvider if we're in cloud prod and have the key
    if (isCloudProd && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        return (
            <PHProvider client={posthog}>
                <PostHogPageView />
                {children}
            </PHProvider>
        )
    }

    // For self-hosted, just return children without PostHog
    return <>{children}</>
}
