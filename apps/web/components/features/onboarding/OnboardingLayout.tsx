"use client"

import { useCurrentUser } from "@/hooks/use-current-user"
import { useOnboardingStore } from "@/stores/onboarding"
import { useRouter } from "next/navigation"
import React, { ReactNode } from "react"
import OnboardingProgress from "./OnboardingProgress"
import { useUpdateProfile } from "@readspace/shared"

interface OnboardingLayoutProps {
    children: ReactNode
    title: string
    subtitle?: string
}

const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
    children,
    title,
    subtitle,
}) => {
    const { currentStep, totalSteps } = useOnboardingStore()
    const { user } = useCurrentUser()
    const router = useRouter()
    const updateProfile = useUpdateProfile()

    const skipOnboarding = async () => {
        if (!user) return
        try {
            await updateProfile.mutateAsync({ is_onboarded: true })
            document.cookie = `is_onboarded_${user.id}=true; path=/; max-age=31536000; SameSite=Lax`
        } catch (e) {
            console.warn("Failed to mark onboarding as skipped:", e)
        }
        router.push("/today")
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50/50 dark:bg-zinc-950/50 px-4 py-12 animate-fade-in">
            <div className="w-full max-w-3xl">
                <OnboardingProgress />

                <div className="text-center mb-8 px-4">
                    <h1 className="text-3xl font-bold text-foreground mb-3 leading-tight tracking-tight">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
                            {subtitle}
                        </p>
                    )}
                </div>

                <div className="w-full">
                    {children}
                </div>

                {currentStep !== totalSteps && (
                    <div className="text-center mt-4">
                        <button
                            onClick={skipOnboarding}
                            className="text-muted-foreground text-sm hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-muted/50 cursor-pointer select-none"
                        >
                            Skip for now
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default OnboardingLayout
