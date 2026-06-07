import { createClient } from "@supabase/supabase-js"
import { env } from "@/env"

export function getSupabaseAdmin() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
        throw new Error(
            "SUPABASE_SERVICE_ROLE_KEY is not configured in server environment variables."
        )
    }
    return createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    })
}
