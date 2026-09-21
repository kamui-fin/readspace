import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/** Constant-time string comparison to avoid leaking the secret via timing. */
function safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

const disabledResponse = () =>
    NextResponse.json(
        { error: "RevenueCat webhook is not configured" },
        { status: 503 }
    )

export async function GET() {
    // Self-hosted deployments without RevenueCat leave the secret unset.
    if (!process.env.REVENUECAT_WEBHOOK_SECRET) return disabledResponse()
    return NextResponse.json({
        message:
            "RevenueCat Webhook Receiver is active. Please send POST requests.",
        timestamp: new Date().toISOString(),
    })
}

export async function POST(req: NextRequest) {
    try {
        // 1. Verify Authorization. Fail closed: with no secret configured
        // (e.g. self-hosted without RevenueCat) the webhook is disabled.
        const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET
        if (!webhookSecret) {
            console.warn(
                "[RevenueCat Webhook] REVENUECAT_WEBHOOK_SECRET not set; rejecting request."
            )
            return disabledResponse()
        }

        const authHeader = req.headers.get("authorization")
        const token = authHeader?.startsWith("Bearer ")
            ? authHeader.substring(7)
            : authHeader

        if (!token || !safeEqual(token, webhookSecret)) {
            console.warn("[RevenueCat Webhook] Unauthorized request received.")
            return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            })
        }

        // 2. Parse payload
        const body = await req.json()
        const event = body?.event

        if (!event) {
            console.warn(
                "[RevenueCat Webhook] Missing event object in request body."
            )
            return new NextResponse(
                JSON.stringify({ error: "Missing event object" }),
                {
                    status: 400,
                    headers: { "Content-Type": "application/json" },
                }
            )
        }

        const {
            type: eventType,
            app_user_id: appUserId,
            original_app_user_id: originalAppUserId,
            entitlement_id: entitlementId,
            entitlement_ids: entitlementIds,
        } = event

        console.log(
            `[RevenueCat Webhook] Event received: ${eventType} for App User ID: ${appUserId}`
        )

        // 3. Verify it affects the "Readspace Pro" entitlement (bypass for TEST events)
        const isTestEvent = eventType === "TEST"
        const isProEntitlement =
            isTestEvent ||
            entitlementId === "Readspace Pro" ||
            (Array.isArray(entitlementIds) &&
                entitlementIds.includes("Readspace Pro"))

        if (!isProEntitlement) {
            console.log(
                `[RevenueCat Webhook] Event does not affect 'Readspace Pro' entitlement. Skipping.`
            )
            return new NextResponse(
                JSON.stringify({ message: "Ignored (not Pro entitlement)" }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }
            )
        }

        if (isTestEvent) {
            console.log("[RevenueCat Webhook] TEST connection successful!")
            return new NextResponse(
                JSON.stringify({
                    success: true,
                    message: "Test connection successful",
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }
            )
        }

        const supabase = getSupabaseAdmin()

        // 4. Handle event types
        if (
            eventType === "INITIAL_PURCHASE" ||
            eventType === "RENEWAL" ||
            eventType === "PRODUCT_CHANGE" ||
            eventType === "SUBSCRIBER_ALIAS"
        ) {
            if (!appUserId) {
                console.warn(
                    "[RevenueCat Webhook] app_user_id is missing in purchase/renewal event."
                )
                return new NextResponse(
                    JSON.stringify({ error: "Missing app_user_id" }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    }
                )
            }

            console.log(
                `[RevenueCat Webhook] Upgrading user ${appUserId} to PRO.`
            )
            const { error } = await supabase
                .from("profiles")
                .update({ role: "PRO" })
                .eq("id", appUserId)

            if (error) {
                console.error(
                    `[RevenueCat Webhook] Failed to update user to PRO in database: ${error.message}`
                )
                return new NextResponse(
                    JSON.stringify({ error: "Database update failed" }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    }
                )
            }

            console.log(
                `[RevenueCat Webhook] User ${appUserId} successfully upgraded to PRO.`
            )
        } else if (eventType === "EXPIRATION" || eventType === "REVOCATION") {
            if (!appUserId) {
                console.warn(
                    "[RevenueCat Webhook] app_user_id is missing in expiration/revocation event."
                )
                return new NextResponse(
                    JSON.stringify({ error: "Missing app_user_id" }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    }
                )
            }

            console.log(
                `[RevenueCat Webhook] Downgrading user ${appUserId} to BASIC.`
            )
            const { error } = await supabase
                .from("profiles")
                .update({ role: "BASIC" })
                .eq("id", appUserId)

            if (error) {
                console.error(
                    `[RevenueCat Webhook] Failed to update user to BASIC in database: ${error.message}`
                )
                return new NextResponse(
                    JSON.stringify({ error: "Database update failed" }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    }
                )
            }

            console.log(
                `[RevenueCat Webhook] User ${appUserId} successfully downgraded to BASIC.`
            )
        } else if (eventType === "TRANSFER") {
            // Purchases transferred: grant to new user, revoke from old user
            if (appUserId) {
                console.log(
                    `[RevenueCat Webhook] Transfer: Upgrading new user ${appUserId} to PRO.`
                )
                await supabase
                    .from("profiles")
                    .update({ role: "PRO" })
                    .eq("id", appUserId)
            }

            if (originalAppUserId) {
                console.log(
                    `[RevenueCat Webhook] Transfer: Downgrading old user ${originalAppUserId} to BASIC.`
                )
                await supabase
                    .from("profiles")
                    .update({ role: "BASIC" })
                    .eq("id", originalAppUserId)
            }
        } else {
            console.log(`[RevenueCat Webhook] Event type ${eventType} ignored.`)
        }

        return new NextResponse(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        })
    } catch (error: any) {
        console.error(
            "[RevenueCat Webhook] Exception occurred processing webhook:",
            error
        )
        return new NextResponse(
            JSON.stringify({ error: error.message || "Internal server error" }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        )
    }
}
