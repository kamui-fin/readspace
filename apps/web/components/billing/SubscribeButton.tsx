"use client"

import { Button } from "@/components/ui/button"
import { useState } from "react"
import { useUserRole } from "@/hooks/use-user-role"

interface SubscribeButtonProps {
    priceId?: string
    checkoutUrl?: string
    className?: string
    style?: React.CSSProperties
    disabled?: boolean
    children?: React.ReactNode
}

export function SubscribeButton({
    priceId,
    checkoutUrl,
    className,
    style,
    disabled,
    children,
}: SubscribeButtonProps) {
    const [isLoading, setIsLoading] = useState(false)
    const { profile } = useUserRole()

    const handleSubscribe = async () => {
        setIsLoading(true)
        try {
            // Direct Polar checkout URL
            const targetUrl =
                checkoutUrl ||
                "https://buy.polar.sh/polar_cl_2xSvHr4wXvwzLfolIpMv2wPTceXNzDQH4LWgu1vaZWF"

            const urlObj = new URL(targetUrl)

            if (profile?.email) {
                urlObj.searchParams.append("customer_email", profile.email)
            }
            if (profile?.id) {
                // Attach user_id metadata so the webhook can immediately identify and upgrade them
                urlObj.searchParams.append(
                    "metadata",
                    JSON.stringify({ user_id: profile.id })
                )
            }

            window.location.href = urlObj.toString()
        } catch (err) {
            console.error("Polar billing checkout error:", err)
            alert(
                `💳 Premium Subscription Request\n` +
                    `-----------------------------------------\n` +
                    `Polar Checkout failed to load. Please try again.\n\n` +
                    `💡 Self-Hosting/Development Mode:\n` +
                    `If you are self-hosting, database access is fully yours! You can upgrade your account to PRO manually by running this command in your server directory:\n\n` +
                    `./promote-admin.sh your-email@example.com`
            )
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Button
            onClick={handleSubscribe}
            className={className}
            style={style}
            disabled={disabled || isLoading}
        >
            {isLoading ? "Processing..." : children}
        </Button>
    )
}
