import { createClient } from "@/lib/supabase/server"

export async function checkNewUser(userId: string) {
    const supabase = await createClient()

    // Check if user has any feed subscriptions
    const { data: subscriptions, error: subscriptionError } =
        await supabase
            .from("feed_subscriptions")
            .select("id")
            .eq("user_id", userId)
            .limit(1)

    // If user has no feed subscriptions, they're new
    return !subscriptionError && (!subscriptions || subscriptions.length === 0)
}
