"use client"

import { useOnboardingStore } from "@/stores/onboarding"
import { useUserRole } from "@/hooks/use-user-role"
import { useRouter } from "next/navigation"
import React, { useEffect } from "react"
import CategorySelectionStep from "./steps/CategorySelection"
import FeedSelectionStep from "./steps/FeedSelection"
import { Loader } from "@/components/ui/loader"

const Onboarding: React.FC = () => {
    const currentStep = useOnboardingStore((state) => state.currentStep)
    const { profile, isLoading } = useUserRole()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading && profile?.is_onboarded) {
            router.replace("/today")
        }
    }, [profile, isLoading, router])

    if (isLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader variant="classic" size="lg" />
            </div>
        )
    }

    if (profile?.is_onboarded) {
        return null
    }

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return <CategorySelectionStep />
            case 2:
                return <FeedSelectionStep />
            default:
                return <CategorySelectionStep />
        }
    }

    return <div className="min-h-screen">{renderStep()}</div>
}

export default Onboarding

