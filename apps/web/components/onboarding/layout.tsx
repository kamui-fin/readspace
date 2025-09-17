"use client"

import { useCurrentUser } from "@/hooks/use-current-user"
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
        router.push("/library")
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-muted px-4 py-8 animate-fade-in">
            <div className="w-full max-w-5xl">
                <div className="flex justify-center mb-8">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded-2xl blur-lg opacity-20"></div>
                        <div className="relative bg-card p-4 rounded-2xl shadow-sm border border-border">
                            <Image
                                src={ReadspaceLogo}
                                alt="Readspace Logo"
                                className="rounded-lg"
                                width={48}
                                height={48}
                            />
                        </div>
                    </div>
                </div>

                <OnboardingProgress />

                <div className="text-center mb-8 px-4">
                    <h1 className="text-3xl font-bold text-foreground mb-3 leading-tight">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                            {subtitle}
                        </p>
                    )}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    {children}
                </div>

                {currentStep !== totalSteps && (
                    <div className="text-center mt-8">
                        <button
                            onClick={skipOnboarding}
                            className="text-gray-500 text-sm hover:text-gray-700 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100/50"
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
