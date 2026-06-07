"use client"

import { useUserLimits } from "@readspace/shared"
import { useUpgradeDialog } from "@/stores/upgrade-dialog"

export function useLimitChecker() {
    const { data: limitData, isLoading, refetch } = useUserLimits()
    const { open } = useUpgradeDialog()

    const canAddFeed = () => {
        if (!limitData) return true
        const { limits, usage } = limitData
        if (limits.max_subscriptions === -1) return true
        return usage.subscriptions < limits.max_subscriptions
    }

    const canUseAI = () => {
        if (!limitData) return true
        const { limits, usage } = limitData
        if (limits.max_daily_ai_calls === -1) return true
        return usage.daily_ai_calls < limits.max_daily_ai_calls
    }

    const checkAndTriggerUpgrade = (type: "feed" | "ai") => {
        if (type === "feed" && !canAddFeed()) {
            open({
                title: "Feed Subscription Limit Reached",
                description: `You have subscribed to ${limitData?.usage.subscriptions} of your ${limitData?.limits.max_subscriptions} maximum feeds. Upgrade to Pro for up to 1000 feeds!`,
            })
            return false
        }

        if (type === "ai" && !canUseAI()) {
            open({
                title: "Daily AI Limit Reached",
                description: `You have used all ${limitData?.limits.max_daily_ai_calls} of your basic daily AI summaries. Upgrade to Pro for 100 daily summaries & translations!`,
            })
            return false
        }

        return true
    }

    return {
        limitData,
        isLoading,
        canAddFeed,
        canUseAI,
        checkAndTriggerUpgrade,
        refetch,
    }
}
