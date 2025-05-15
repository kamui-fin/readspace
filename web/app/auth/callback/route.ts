import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get("code")
    // read your “next” param; default to /dashboard
    const next = searchParams.get("next") ?? "/library"

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            // behind a load‑balancer? trust x‑forwarded-host, else origin
            const host = request.headers.get("x-forwarded-host")
            const targetOrigin =
                process.env.NODE_ENV === "production" && host
                    ? `https://${host}`
                    : origin

            return NextResponse.redirect(`${targetOrigin}${next}`)
        }
    }
    // on failure, send them somewhere safe
    return NextResponse.redirect(`${origin}/auth/error`)
}
