import { Webhooks } from "@polar-sh/nextjs"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

export const POST = Webhooks({
    webhookSecret: process.env.POLAR_WEBHOOK_SECRET || "",

    onPayload: async (payload) => {
        console.log(`[Polar Webhook] Event payload received: ${payload.type}`)
    },

    onOrderCreated: async (order) => {
        // Polar webhook payload wraps the resource in the 'data' property
        const orderData = (order as any).data
        if (!orderData) {
            console.warn("[Polar Webhook] Order data object is missing.")
            return
        }

        console.log(`[Polar Webhook] Order created: ${orderData.id}`)
        const email = orderData.customer?.email || orderData.customer_email
        let userId: string | undefined

        // Try extracting user_id from metadata if present
        if (orderData.metadata && typeof orderData.metadata === "object") {
            userId = orderData.metadata.user_id
        }

        if (email || userId) {
            await handleRoleUpgrade(email, userId)
        }
    },

    onSubscriptionCreated: async (subscription) => {
        // Polar webhook payload wraps the resource in the 'data' property
        const subData = (subscription as any).data
        if (!subData) {
            console.warn("[Polar Webhook] Subscription data object is missing.")
            return
        }

        console.log(`[Polar Webhook] Subscription created: ${subData.id}`)
        const email = subData.customer?.email || subData.customer_email
        let userId: string | undefined

        // Try extracting user_id from metadata if present
        if (subData.metadata && typeof subData.metadata === "object") {
            userId = subData.metadata.user_id
        }

        if (email || userId) {
            await handleRoleUpgrade(email, userId)
        }
    },

    onSubscriptionRevoked: async (subscription) => {
        const subData = (subscription as any).data
        if (!subData) {
            console.warn("[Polar Webhook] Revocation subscription data missing.")
            return
        }

        console.log(`[Polar Webhook] Subscription revoked: ${subData.id}`)
        const email = subData.customer?.email || subData.customer_email
        let userId: string | undefined

        if (subData.metadata && typeof subData.metadata === "object") {
            userId = subData.metadata.user_id
        }

        if (email || userId) {
            await handleRoleDowngrade(email, userId)
        }
    },
})

async function handleRoleDowngrade(email?: string, userId?: string) {
    try {
        const supabase = getSupabaseAdmin()
        console.log(
            `[Polar Webhook] Downgrading user role to BASIC (User ID: ${userId || "None"}, Email: ${email || "None"})`
        )

        if (userId) {
            const { data, error } = await supabase
                .from("profiles")
                .update({ role: "BASIC" })
                .eq("id", userId)
                .select()

            if (!error && data && data.length > 0) {
                console.log(
                    `[Polar Webhook] User profile successfully downgraded to BASIC by ID: ${userId}`
                )
                return
            }
        }

        if (email) {
            const { data, error } = await supabase
                .from("profiles")
                .update({ role: "BASIC" })
                .eq("email", email)
                .select()

            if (!error && data && data.length > 0) {
                console.log(
                    `[Polar Webhook] User profile successfully downgraded to BASIC by email: ${email}`
                )
                return
            }
        }
    } catch (err) {
        console.error("[Polar Webhook] Failed to process role downgrade:", err)
    }
}

async function handleRoleUpgrade(email?: string, userId?: string) {
    try {
        const supabase = getSupabaseAdmin()
        console.log(
            `[Polar Webhook] Upgrading user role to PRO (User ID: ${userId || "None"}, Email: ${email || "None"})`
        )

        // Upgrade by user ID if available
        if (userId) {
            const { data, error } = await supabase
                .from("profiles")
                .update({ role: "PRO" })
                .eq("id", userId)
                .select()

            if (!error && data && data.length > 0) {
                console.log(
                    `[Polar Webhook] User profile successfully upgraded to PRO by ID: ${userId}`
                )
                return
            }
            if (error) {
                console.error(
                    `[Polar Webhook] Supabase RLS bypass update error by User ID: ${error.message}`
                )
            }
        }

        // Upgrade by email if ID update wasn't successful or ID wasn't provided
        if (email) {
            const { data, error } = await supabase
                .from("profiles")
                .update({ role: "PRO" })
                .eq("email", email)
                .select()

            if (!error && data && data.length > 0) {
                console.log(
                    `[Polar Webhook] User profile successfully upgraded to PRO by email: ${email}`
                )
                return
            }
            if (error) {
                console.error(
                    `[Polar Webhook] Supabase RLS bypass update error by email: ${error.message}`
                )
            }
        }

        console.warn(
            `[Polar Webhook] No matching user profile found in the database for User ID: ${userId || "None"} or Email: ${email || "None"}`
        )
    } catch (err) {
        console.error("[Polar Webhook] Failed to process role upgrade:", err)
    }
}
