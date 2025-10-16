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
            // Check if user is new (has no feed subscriptions)
            const {
                data: { user },
            } = await supabase.auth.getUser()

            if (user) {
                // Check if user has any feed subscriptions
                const { data: subscriptions, error: subscriptionError } =
                    await supabase
                        .from("feed_subscriptions")
                        .select("id")
                        .eq("user_id", user.id)
                        .limit(1)

                // If user has no feed subscriptions, they're new - redirect to onboarding
                const isNewUser =
                    !subscriptionError &&
                    (!subscriptions || subscriptions.length === 0)
                const redirectPath = isNewUser ? "/onboarding" : next

                // behind a load‑balancer? trust x‑forwarded-host, else origin
                const host = request.headers.get("x-forwarded-host")
                const targetOrigin =
                    process.env.NODE_ENV === "production" && host
                        ? `https://${host}`
                        : origin

                console.log(
                    subscriptions,
                    subscriptionError,
                    "isNewUser:",
                    isNewUser,
                    "user:",
                    user.id,
                    "redirectPath:",
                    redirectPath,
                    "targetOrigin:",
                    targetOrigin
                )

                return NextResponse.redirect(`${targetOrigin}${redirectPath}`)
            }
        }
    }
    // on failure, send them somewhere safe
    return NextResponse.redirect(`${origin}/auth/error`)
}
