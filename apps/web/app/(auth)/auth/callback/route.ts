import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get("code")
    // read your "next" param; default to /articles
    const next = searchParams.get("next") ?? "/articles"

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            // Check is_onboarded flag from the API to decide if onboarding is needed.
            // This works correctly for both email sign-ups and Google OAuth first-time sign-ins.
            const {
                data: { session },
            } = await supabase.auth.getSession()

            let redirectPath = next

            if (session?.access_token) {
                try {
                    const apiBase =
                        process.env.NEXT_PUBLIC_API_URL ||
                        "http://localhost:8008"
                    const profileRes = await fetch(
                        `${apiBase}/api/users/profile`,
                        {
                            headers: {
                                Authorization: `Bearer ${session.access_token}`,
                            },
                            cache: "no-store",
                        }
                    )
                    if (profileRes.ok) {
                        const profile = await profileRes.json()
                        if (!profile.is_onboarded) {
                            redirectPath = "/onboarding"
                        }
                    }
                } catch {
                    // Fallback: go to next (don't block sign-in on API error)
                }
            }

            // behind a load-balancer? trust x-forwarded-host, else origin
            const host = request.headers.get("x-forwarded-host")
            const targetOrigin =
                process.env.NODE_ENV === "production" && host
                    ? `https://${host}`
                    : origin

            return NextResponse.redirect(`${targetOrigin}${redirectPath}`)
        }
    }
    // on failure, send them somewhere safe
    return NextResponse.redirect(`${origin}/auth/error`)
}
