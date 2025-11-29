"use client"

import { useOnboardingStore } from "@/stores/onboarding"
import React from "react"
import CategorySelectionStep from "./steps/CategorySelectionStep"
import FeedSelectionStep from "./steps/FeedSelectionStep"

const Onboarding: React.FC = () => {
    const currentStep = useOnboardingStore((state) => state.currentStep)

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
