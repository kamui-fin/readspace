import { type EmailOtpType } from "@supabase/supabase-js"
import { type NextRequest } from "next/server"

import { isCloudProd } from "@/lib/is-cloud-prod"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const token_hash = searchParams.get("token_hash")
    const type = searchParams.get("type") as EmailOtpType | null

    if (token_hash && type) {
        const supabase = await createClient()

        const { error } = await supabase.auth.verifyOtp({
            type,
            token_hash,
        })
        if (!error) {
            redirect(
                isCloudProd(new URL(request.url).hostname)
                    ? "/onboarding"
                    : "/today"
            )
        }
    }

    // redirect the user to an error page with some instructions
    redirect("/auth/error")
}
