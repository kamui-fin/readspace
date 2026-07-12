import { env } from "@/env"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(
                    cookiesToSet: {
                        name: string
                        value: string
                        options: CookieOptions
                    }[]
                ) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
            cookieOptions: { secure: request.nextUrl.protocol === "https:" },
        }
    )

    // Do not run code between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    // IMPORTANT: DO NOT REMOVE auth.getUser()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (
        !user &&
        !request.nextUrl.pathname.startsWith("/login") &&
        !request.nextUrl.pathname.startsWith("/signup") &&
        !request.nextUrl.pathname.startsWith("/auth") &&
        !request.nextUrl.pathname.startsWith("/api/webhook")
    ) {
        // no user, potentially respond by redirecting the user to the login page
        const url = request.nextUrl.clone()
        url.pathname = "/login"
        return NextResponse.redirect(url)
    }

    if (
        user &&
        !request.nextUrl.pathname.startsWith("/login") &&
        !request.nextUrl.pathname.startsWith("/signup") &&
        !request.nextUrl.pathname.startsWith("/auth") &&
        !request.nextUrl.pathname.startsWith("/api/webhook")
    ) {
        const cookieName = `is_onboarded_${user.id}`
        const isOnboardedCookie = request.cookies.get(cookieName)?.value
        const isOnboardingRoute = request.nextUrl.pathname.startsWith("/onboarding")

        if (isOnboardedCookie === "true") {
            if (isOnboardingRoute) {
                const url = request.nextUrl.clone()
                url.pathname = "/today"
                const redirectResponse = NextResponse.redirect(url)
                supabaseResponse.cookies.getAll().forEach((cookie) => {
                    redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
                })
                return redirectResponse
            }
        } else {
            try {
                const apiBase = env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8008"
                const { data: { session } } = await supabase.auth.getSession()

                if (session?.access_token) {
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
                        const isOnboarded = !!profile.is_onboarded

                        if (isOnboarded) {
                            if (isOnboardingRoute) {
                                const url = request.nextUrl.clone()
                                url.pathname = "/today"
                                const redirectResponse = NextResponse.redirect(url)
                                supabaseResponse.cookies.getAll().forEach((cookie) => {
                                    redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
                                })
                                redirectResponse.cookies.set(cookieName, "true", { path: "/", maxAge: 60 * 60 * 24 * 365 })
                                return redirectResponse
                            } else {
                                supabaseResponse.cookies.set(cookieName, "true", { path: "/", maxAge: 60 * 60 * 24 * 365 })
                            }
                        } else {
                            if (!isOnboardingRoute) {
                                const url = request.nextUrl.clone()
                                url.pathname = "/onboarding"
                                const redirectResponse = NextResponse.redirect(url)
                                supabaseResponse.cookies.getAll().forEach((cookie) => {
                                    redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
                                })
                                redirectResponse.cookies.set(cookieName, "false", { path: "/", maxAge: 60 * 60 * 24 * 365 })
                                return redirectResponse
                            } else {
                                supabaseResponse.cookies.set(cookieName, "false", { path: "/", maxAge: 60 * 60 * 24 * 365 })
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("Error checking onboarding status in middleware:", error)
            }
        }
    }

    // IMPORTANT: You *must* return the supabaseResponse object as it is.
    // If you're creating a new response object with NextResponse.next() make sure to:
    // 1. Pass the request in it, like so:
    //    const myNewResponse = NextResponse.next({ request })
    // 2. Copy over the cookies, like so:
    //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
    // 3. Change the myNewResponse object to fit your needs, but avoid changing
    //    the cookies!
    // 4. Finally:
    //    return myNewResponse
    // If this is not done, you may be causing the browser and server to go out
    // of sync and terminate the user's session prematurely!

    return supabaseResponse
}
