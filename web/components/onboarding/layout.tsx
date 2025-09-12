"use client"

import { useCurrentUser } from "@/hooks/use-current-user"
import { createClient } from "@/lib/supabase/client"
import { useOnboardingStore } from "@/stores/onboarding"
import Image from "next/image"
import { useRouter } from "next/navigation"
import React, { ReactNode } from "react"
import ReadspaceLogo from "../../public/readspace.svg"
import OnboardingProgress from "./progress"

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

    const skipOnboarding = async () => {
        if (!user) return
        // TODO: mark onboarding as completed in user preferences/metadata
        router.push("/library")
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-muted px-4 py-12 animate-fade-in font-geist">
            <div className="w-full max-w-lg">
                <div className="flex justify-center mb-6">
                    <Image
                        src={ReadspaceLogo}
                        alt="Readspace Logo"
                        className="rounded"
                        width={60}
                        height={60}
                    />
                </div>
                <OnboardingProgress />
                <div className="text-center mb-8 px-8">
                    <h1 className="text-2xl font-bold text-gray-800 max-w-sm mx-auto md:max-w-lg">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="text-gray-600 mt-2 max-w-sm mx-auto md:max-w-lg">
                            {subtitle}
                        </p>
                    )}
                </div>
                <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-6">
                    {children}
                </div>
                {currentStep !== totalSteps && (
                    <div className="text-center mt-6">
                        <button
                            onClick={skipOnboarding}
                            className="text-gray-500 text-sm hover:text-primary transition-colors"
                        >
                            Skip onboarding for now
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default OnboardingLayout
