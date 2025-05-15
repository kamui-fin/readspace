// app/providers.tsx
"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { usePostHog } from "posthog-js/react"
import { Suspense, useEffect } from "react"

import { env } from "@/env"
import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"

export function PostHogProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Only initialize PostHog in production
        if (env.NEXT_PUBLIC_NODE_ENV === "production") {
            posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY!, {
                api_host:
                    env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
                person_profiles: "identified_only", // or 'always' to create profiles for anonymous users as well
                capture_pageview: false, // Disable automatic pageview capture, as we capture manually
                loaded: (posthog) => {
                    if (env.NEXT_PUBLIC_NODE_ENV !== "production")
                        posthog.debug()
                },
            })
        }
    }, [])

    // If not in production, just render children without PostHog
    if (env.NEXT_PUBLIC_NODE_ENV !== "production") {
        return <>{children}</>
    }

    return (
        <PHProvider client={posthog}>
            <SuspendedPostHogPageView />
            {children}
        </PHProvider>
    )
}

function PostHogPageView() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const posthog = usePostHog()

    // Track pageviews
    useEffect(() => {
        if (pathname && posthog) {
            let url = window.origin + pathname
            if (searchParams.toString()) {
                url = url + "?" + searchParams.toString()
            }

            posthog.capture("$pageview", { $current_url: url })
        }
    }, [pathname, searchParams, posthog])

    return null
}

// Wrap PostHogPageView in Suspense to avoid the useSearchParams usage above
// from de-opting the whole app into client-side rendering
// See: https://nextjs.org/docs/messages/deopted-into-client-rendering
function SuspendedPostHogPageView() {
    return (
        <Suspense fallback={null}>
            <PostHogPageView />
        </Suspense>
    )
}
